import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import PubNub from 'pubnub';
import { TransactionService } from '../transaction/transaction.service';

export interface P2PMessage {
  channel: string;
  message: any;
  timestamp: number;
  senderId?: string;
}

export enum P2P_CHANNELS {
  BLOCKCHAIN = 'BLOCKCHAIN',
  BLOCK = 'BLOCK',
  TRANSACTION = 'TRANSACTION',
  UPLOAD = 'UPLOAD',
  BACKUP = 'BACKUP',
  KEY_VALIDATION = 'KEY_VALIDATION',
  SYNC = 'SYNC',
  PEERS = 'PEERS',
  WALLET = 'WALLET',
}

const CREDENTIALS: PubNub.PubNubConfiguration = {
  publishKey: process.env.PUBNUB_PUBLISH_KEY ?? 'pub-c-17fc9bc9-8936-4264-9e26-ae81fa7d7837',
  subscribeKey: process.env.PUBNUB_SUBSCRIBE_KEY ?? 'sub-c-c6699956-a120-11ea-9123-e6a08f73ae22',
  secretKey: process.env.PUBNUB_SECRET_KEY ?? 'sec-c-Y2M5OWE2OTAtOGI5Ny00NzI4LWJhMWItMzE3ZmIzMmI4NTM1',
  userId: process.env.PUBNUB_USER_ID ?? PubNub.generateUUID(),
};

// PubNub handles the TRANSACTION channel exclusively; every other channel is owned by
// the Redis P2P service (see ../redis-p2p/redis-p2p.service.ts) to keep concerns separated.
@Injectable()
export class P2PService implements OnModuleInit, OnModuleDestroy {
  public peerId: string = '';
  private pubnub!: PubNub;
  private messageHistory: P2PMessage[] = [];
  private readonly maxHistorySize = 100;

  constructor(private transactionService: TransactionService) {}

  onModuleInit(): void {
    this.pubnub = new PubNub(CREDENTIALS);
    this.pubnub.addListener(this.buildListener());
    this.pubnub.subscribe({ channels: [P2P_CHANNELS.TRANSACTION] });
    this.peerId = this.pubnub.getUserId();
    console.log(`PubNub P2P service initialized. Peer ID: ${this.peerId}`);

    this.transactionService.registerOnCreate((transaction) => {
      this.publishMessage({
        channel: P2P_CHANNELS.TRANSACTION,
        message: { type: 'NEW_TRANSACTION', transaction },
        timestamp: Date.now(),
      });
      console.log(`Transaction broadcast to peers: ${transaction.id}`);
    });

    this.transactionService.registerOnReceive((transaction) => {
      this.publishMessage({
        channel: P2P_CHANNELS.TRANSACTION,
        message: { type: 'NEW_TRANSACTION', transaction },
        timestamp: Date.now(),
      });
      console.log(`Received transaction re-broadcast to peers: ${transaction.id}`);
    });
  }

  onModuleDestroy(): void {
    this.pubnub.unsubscribeAll();
    console.log('PubNub P2P service disconnected');
  }

  private buildListener(): PubNub.Listener {
    return {
      message: (event: PubNub.Subscription.Message) => {
        const { channel, message, publisher } = event;
        console.log(`Message received. Channel: ${channel}. Publisher: ${publisher}`);

        const parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;
        const p2pMessage: P2PMessage = {
          channel,
          message: parsedMessage,
          timestamp: Date.now(),
          senderId: publisher,
        };

        this.storeInHistory(p2pMessage);
        this.handleMessage(p2pMessage);
      },
      status: (event) => {
        console.log(`PubNub status: ${event.category}`);
      },
    };
  }

  broadcastTransaction(transaction: any): P2PMessage {
    this.publish({ channel: P2P_CHANNELS.TRANSACTION, message: JSON.stringify(transaction) });
    return { channel: P2P_CHANNELS.TRANSACTION, message: transaction, timestamp: Date.now() };
  }

  publishMessage(p2pMessage: P2PMessage): void {
    this.publish({
      channel: p2pMessage.channel,
      message: JSON.stringify(p2pMessage.message),
    });
  }

  private publish({ channel, message }: { channel: string; message: string }): void {
    this.pubnub.publish({ channel, message });
  }

  handleMessage(message: P2PMessage): void {
    switch (message.channel) {
      case P2P_CHANNELS.TRANSACTION:
        this.handleTransactionMessage(message);
        break;
      default:
        console.warn(`Unknown channel: ${message.channel}`);
    }
  }

  private handleTransactionMessage(message: P2PMessage): void {
    try {
      const { type, transaction } = message.message;
      if (type !== 'NEW_TRANSACTION' || !transaction) return;

      if (!this.transactionService.validate(transaction)) {
        console.warn(`Invalid transaction from peer ${message.senderId} — discarded`);
        return;
      }

      this.transactionService.receive(transaction);
      console.log(`Transaction stored from peer ${message.senderId}: ${transaction.id}`);
    } catch (error) {
      console.error('Error handling transaction message:', error);
    }
  }

  private storeInHistory(message: P2PMessage): void {
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }
  }

  async getPeersOnChannel(channel: string): Promise<string[]> {
    const response = await this.pubnub.hereNow({
      channels: [channel],
      includeUUIDs: true,
    });
    return (response.channels[channel]?.occupants ?? []).map((o) => o.uuid);
  }

  async getActivePeers(): Promise<{
    peers: string[];
    peerCount: number;
    totalOccupancy: number;
    byChannel: Record<string, { occupancy: number; peers: string[] }>;
  }> {
    const response = await this.pubnub.hereNow({
      channels: [P2P_CHANNELS.TRANSACTION],
      includeUUIDs: true,
    });

    const byChannel: Record<string, { occupancy: number; peers: string[] }> = {};
    const allPeers = new Set<string>();

    for (const [channelName, channelData] of Object.entries(response.channels)) {
      const peers = channelData.occupants.map((o) => o.uuid);
      peers.forEach((id) => allPeers.add(id));
      byChannel[channelName] = { occupancy: channelData.occupancy, peers };
    }

    return {
      peers: Array.from(allPeers),
      peerCount: allPeers.size,
      totalOccupancy: response.totalOccupancy,
      byChannel,
    };
  }

  getMessageHistory(): P2PMessage[] {
    return this.messageHistory;
  }

  getChannelHistory(channel: P2P_CHANNELS): P2PMessage[] {
    return this.messageHistory.filter((msg) => msg.channel === channel);
  }

  clearHistory(): void {
    this.messageHistory = [];
  }

  getNetworkStatus() {
    return {
      userId: CREDENTIALS.userId,
      channels: [P2P_CHANNELS.TRANSACTION],
      messageHistorySize: this.messageHistory.length,
      messageHistory: this.messageHistory,
    };
  }
}
