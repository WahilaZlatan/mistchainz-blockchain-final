import { Injectable, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ConsensusService } from '../consensus/consensus.service';
import { TransactionService } from '../transaction/transaction.service';
import { WalletService } from '../wallet/wallet.service';
import { P2P_CHANNELS, P2PMessage } from '../p2p/p2p.service';

// Every channel except TRANSACTION — that one is owned exclusively by the PubNub P2P service.
export const REDIS_P2P_CHANNELS = Object.values(P2P_CHANNELS).filter(
  (channel) => channel !== P2P_CHANNELS.TRANSACTION,
);

const REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT ?? '6379', 10);

// Redis pub/sub has no built-in presence API (unlike PubNub's hereNow), so presence is
// tracked ourselves in a sorted set per channel, keyed by peerId with a last-seen timestamp.
const PRESENCE_KEY_PREFIX = 'p2p:presence:';
const PRESENCE_STALE_MS = 60_000;
const PRESENCE_HEARTBEAT_MS = 15_000;

interface RedisEnvelope {
  senderId: string;
  payload: any;
}

@Injectable()
export class RedisP2PService implements OnModuleInit, OnModuleDestroy {
  public peerId: string = process.env.REDIS_PEER_ID ?? randomUUID();
  private publisher!: Redis;
  private subscriber!: Redis;
  private messageHistory: P2PMessage[] = [];
  private readonly maxHistorySize = 100;
  private onConnectedCallbacks: Array<() => void> = [];
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    private blockchainService: BlockchainService,
    private transactionService: TransactionService,
    private walletService: WalletService,
    @Inject(forwardRef(() => ConsensusService)) private consensusService: ConsensusService,
    @InjectQueue('mining') private miningQueue: any,
  ) {}

  onModuleInit(): void {
    this.publisher = new Redis({ host: REDIS_HOST, port: REDIS_PORT });
    this.subscriber = new Redis({ host: REDIS_HOST, port: REDIS_PORT });

    this.publisher.on('error', (err) => console.error('Redis publisher error:', err));
    this.subscriber.on('error', (err) => console.error('Redis subscriber error:', err));

    this.subscriber.on('message', (channel: string, raw: string) => {
      this.onMessage(channel, raw);
    });

    this.subscriber.on('ready', () => {
      console.log(`Redis P2P service connected (${REDIS_HOST}:${REDIS_PORT}). Peer ID: ${this.peerId}`);
      this.subscriber.subscribe(...REDIS_P2P_CHANNELS).catch((err) => {
        console.error('Redis subscribe failed:', err);
      });

      this.announcePresence();
      this.heartbeatTimer = setInterval(() => this.announcePresence(), PRESENCE_HEARTBEAT_MS);

      this.onConnectedCallbacks.forEach((cb) => cb());
      this.publishMessage({
        channel: P2P_CHANNELS.PEERS,
        message: { type: 'PEER_ANNOUNCE', peerId: this.peerId },
        timestamp: Date.now(),
      });
    });

    this.walletService.registerOnCreate((wallet) => {
      this.publishMessage({
        channel: P2P_CHANNELS.WALLET,
        message: { type: 'NEW_WALLET', wallet },
        timestamp: Date.now(),
      });
      console.log(`Wallet broadcast to peers (redis): ${wallet.address}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    await Promise.all(
      REDIS_P2P_CHANNELS.map((channel) =>
        this.publisher.zrem(PRESENCE_KEY_PREFIX + channel, this.peerId).catch(() => undefined),
      ),
    );
    this.subscriber?.disconnect();
    this.publisher?.disconnect();
    console.log('Redis P2P service disconnected');
  }

  private announcePresence(): void {
    const now = Date.now();
    REDIS_P2P_CHANNELS.forEach((channel) => {
      const key = PRESENCE_KEY_PREFIX + channel;
      this.publisher.zadd(key, now, this.peerId).catch((err) => {
        console.error(`Failed to announce presence on ${channel}:`, err);
      });
      this.publisher.zremrangebyscore(key, '-inf', now - PRESENCE_STALE_MS).catch(() => undefined);
    });
  }

  private onMessage(channel: string, raw: string): void {
    let envelope: RedisEnvelope;
    try {
      envelope = JSON.parse(raw);
    } catch {
      envelope = { senderId: 'unknown', payload: raw };
    }

    console.log(`Message received. Channel: ${channel}. Publisher: ${envelope.senderId}`);

    const p2pMessage: P2PMessage = {
      channel,
      message: envelope.payload,
      timestamp: Date.now(),
      senderId: envelope.senderId,
    };

    this.storeInHistory(p2pMessage);
    this.handleMessage(p2pMessage);
  }

  broadcastChain(): P2PMessage {
    const chain = this.blockchainService.getBlockchainInfo();
    this.publish(P2P_CHANNELS.BLOCKCHAIN, chain);
    return { channel: P2P_CHANNELS.BLOCKCHAIN, message: chain, timestamp: Date.now() };
  }

  broadcastBlock(block: any): P2PMessage {
    this.publish(P2P_CHANNELS.BLOCK, block);
    return { channel: P2P_CHANNELS.BLOCK, message: block, timestamp: Date.now() };
  }

  publishMessage(p2pMessage: P2PMessage): void {
    this.publish(p2pMessage.channel, p2pMessage.message);
  }

  private publish(channel: string, message: any): void {
    const envelope: RedisEnvelope = { senderId: this.peerId, payload: message };
    this.publisher.publish(channel, JSON.stringify(envelope));
  }

  handleMessage(message: P2PMessage): void {
    switch (message.channel) {
      case P2P_CHANNELS.BLOCKCHAIN:
        this.handleBlockchainMessage(message);
        break;
      case P2P_CHANNELS.BLOCK:
        this.handleBlockMessage(message);
        break;
      case P2P_CHANNELS.PEERS:
        this.handlePeersMessage(message);
        break;
      case P2P_CHANNELS.SYNC:
        this.handleSyncMessage(message);
        break;
      case P2P_CHANNELS.UPLOAD:
        this.handleUploadMessage(message);
        break;
      case P2P_CHANNELS.BACKUP:
        this.handleBackupMessage(message);
        break;
      case P2P_CHANNELS.KEY_VALIDATION:
        this.handleKeyValidationMessage(message);
        break;
      case P2P_CHANNELS.WALLET:
        this.handleWalletMessage(message);
        break;
      default:
        console.warn(`Unknown channel: ${message.channel}`);
    }
  }

  private handleBlockchainMessage(message: P2PMessage): void {
    try {
      const type: string | undefined = message.message?.type;

      switch (type) {
        case 'START_MINING':
          this.handleStartMiningMessage(message);
          break;
        case 'NEW_BLOCK':
          this.handleNewBlockMessage(message);
          break;
        case 'SYNC_CHAINS':
        default:
          this.handleChainSyncMessage(message);
      }
    } catch (error) {
      console.error('Error handling blockchain message:', error);
    }
  }

  private handleChainSyncMessage(message: P2PMessage): void {
    const incomingChain = message.message?.chain ?? message.message;
    const isValid = this.blockchainService.validateChain(incomingChain);
    if (isValid) {
      this.blockchainService.replaceChain(incomingChain, false, () => {
        console.log('Blockchain replaced from peer:', message.senderId);
      });
    } else {
      console.warn('Invalid blockchain from peer:', message.senderId);
    }
  }

  private handleStartMiningMessage(message: P2PMessage): void {
    const { targetPeerId, transactionPageIndex } = message.message;
    this.consensusService.currentMiner = targetPeerId;
    this.consensusService.transactionPageIndex = transactionPageIndex;
    if (targetPeerId !== this.peerId) return;

    console.log(`START_MINING received. Queuing mining job for page ${transactionPageIndex}`);
    this.miningQueue.add('mineTransactions', {
      minerId: this.peerId,
      transactionPageIndex,
    });
  }

  private handleNewBlockMessage(message: P2PMessage): void {
    const { block } = message.message;
    const accepted = this.blockchainService.appendBlock(block);
    if (accepted) {
      console.log(`New block accepted: ${block?.hash} from peer ${message.senderId}`);

      const transactions: any[] = Array.isArray(block?.data) ? block.data : [];
      this.transactionService.removeMined(transactions.length);
      console.log(`Removed ${transactions.length} mined transaction(s) from the pool after block ${block?.hash}`);
    } else {
      console.warn(`New block rejected: ${block?.hash} from peer ${message.senderId}`);
    }
  }

  private handleBlockMessage(message: P2PMessage): void {
    console.log('Block received from peer:', message.message?.hash, 'from', message.senderId);
  }

  private handlePeersMessage(message: P2PMessage): void {
    const { type, peerId } = message.message;
    if (type === 'PEER_ANNOUNCE' && peerId && peerId !== this.peerId) {
      this.consensusService.addPeer(peerId);
    } else if (type === 'MINING_STARTED') {
      this.consensusService.miningStarted = true;
      console.log('Mining started signal received — miningStarted set to true');
    }
  }

  private handleSyncMessage(message: P2PMessage): void {
    console.log('Sync request from:', message.senderId);
    this.broadcastChain();
  }

  private handleUploadMessage(message: P2PMessage): void {
    console.log('Upload message from:', message.senderId);
    // TODO: split large files into chunks, handle file metadata (name, mime-type, size, sender, recipient),
    // generate digital signatures, push to download channel, mine transactions, verify downloaded file
  }

  private handleBackupMessage(message: P2PMessage): void {
    console.log('Backup message from:', message.senderId);
    // TODO: backup blockchain, smart contracts, transactions, audit trails
  }

  private handleKeyValidationMessage(message: P2PMessage): void {
    console.log('Key validation message from:', message.senderId);
    // TODO: implement key validation logic
  }

  private handleWalletMessage(message: P2PMessage): void {
    const { type, wallet } = message.message;
    if (type === 'NEW_WALLET' && wallet?.address) {
      this.walletService.addExternal({ address: wallet.address, balance: wallet.balance ?? 0 });
    }
  }

  private storeInHistory(message: P2PMessage): void {
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }
  }

  registerOnConnected(callback: () => void): void {
    this.onConnectedCallbacks.push(callback);
  }

  async getPeersOnChannel(channel: string): Promise<string[]> {
    const key = PRESENCE_KEY_PREFIX + channel;
    const cutoff = Date.now() - PRESENCE_STALE_MS;
    await this.publisher.zremrangebyscore(key, '-inf', cutoff);
    return this.publisher.zrange(key, 0, -1);
  }

  async getActivePeers(): Promise<{
    peers: string[];
    peerCount: number;
    totalOccupancy: number;
    byChannel: Record<string, { occupancy: number; peers: string[] }>;
  }> {
    const byChannel: Record<string, { occupancy: number; peers: string[] }> = {};
    const allPeers = new Set<string>();
    let totalOccupancy = 0;

    for (const channel of REDIS_P2P_CHANNELS) {
      const peers = await this.getPeersOnChannel(channel);
      peers.forEach((id) => allPeers.add(id));
      byChannel[channel] = { occupancy: peers.length, peers };
      totalOccupancy += peers.length;
    }

    return {
      peers: Array.from(allPeers),
      peerCount: allPeers.size,
      totalOccupancy,
      byChannel,
    };
  }

  getMessageHistory(): P2PMessage[] {
    return this.messageHistory;
  }

  getChannelHistory(channel: string): P2PMessage[] {
    return this.messageHistory.filter((msg) => msg.channel === channel);
  }

  clearHistory(): void {
    this.messageHistory = [];
  }

  getNetworkStatus() {
    return {
      userId: this.peerId,
      channels: REDIS_P2P_CHANNELS,
      messageHistorySize: this.messageHistory.length,
      messageHistory: this.messageHistory,
    };
  }
}
