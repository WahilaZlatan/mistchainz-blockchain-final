import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BlockchainService } from '../blockchain/blockchain.service';
import { RedisP2PService } from '../redis-p2p/redis-p2p.service';
import { P2P_CHANNELS } from '../p2p/p2p.service';
import { TransactionService } from '../transaction/transaction.service';
import { TransactionStatus } from '../transaction/transaction.class';
import { MIN_PEERS, BLOCK_TRANSACTIONS_LIMIT } from '../../config/blockchain.config';

@Injectable()
export class ConsensusService implements OnModuleInit {
  isBootNode: boolean = false;
  miningStarted: boolean = false;
  peers: string[] = [];
  currentMiner: string | null = null;
  transactionPageIndex: number = 0;
  private currentMinerIndex: number = 0;

  constructor(
    @Inject(forwardRef(() => RedisP2PService)) private readonly redisP2PService: RedisP2PService,
    private readonly blockchainService: BlockchainService,
    private readonly transactionService: TransactionService,
  ) {}

  onModuleInit(): void {
    this.redisP2PService.registerOnConnected(() => {
      this.determineBootNode().catch((err) =>
        console.error('Boot node determination failed:', err),
      );
    });
  }

  async determineBootNode(): Promise<void> {
    const channelPeers = await this.redisP2PService.getPeersOnChannel(
      P2P_CHANNELS.BLOCKCHAIN,
    );
    channelPeers.forEach((peerId) => {
      if (!this.peers.includes(peerId)) {
        this.peers.push(peerId);
      }
    });
    this.isBootNode =
      this.peers.length > 0 && this.peers[0] === this.redisP2PService.peerId;
    console.log(
      `Boot node: ${this.isBootNode} (peer_id: ${this.redisP2PService.peerId}, first peer: ${this.peers[0] ?? 'none'}, total peers: ${this.peers.length})`,
    );
  }

  /**
   * Selects the next mining peer in round-robin order, skipping the boot node
   * (always peers[0]). Wraps back to peers[1] — not peers[0] — when the end
   * of the array is reached.
   * Returns the selected peer ID, or null if no non-boot-node peers exist.
   */
  selectNextMiner(): string | null {
    // Need at least one peer beyond the boot node
    if (this.peers.length <= 1) {
      console.log('No mining peers available — boot node does not mine');
      return null;
    }

    // If the index is pointing at the boot node (0) or past the end, reset to 1
    if (this.currentMinerIndex < 1 || this.currentMinerIndex >= this.peers.length) {
      this.currentMinerIndex = 1;
    }else{
      this.currentMinerIndex++;
    }

    const selectedPeer = this.peers[this.currentMinerIndex];
    const selectedIndex = this.currentMinerIndex;

    // Advance index; wrap to 1 (not 0) when the last peer has been reached
   // this.currentMinerIndex = this.currentMinerIndex + 1 >= this.peers.length ? 1 : this.currentMinerIndex + 1;

    console.log(
      `Next miner selected: ${selectedPeer} (peer index ${selectedIndex}, next index: ${this.currentMinerIndex})`,
    );

    this.redisP2PService.publishMessage({
      channel: P2P_CHANNELS.BLOCKCHAIN,
      message: {
        type: 'START_MINING',
        targetPeerId: selectedPeer,
        transactionPageIndex: this.transactionPageIndex,
      },
      timestamp: Date.now(),
    });

    return selectedPeer;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async startMining(): Promise<void> {
    if (!this.isBootNode) return;

    const freshPeers = await this.redisP2PService
      .getPeersOnChannel(P2P_CHANNELS.PEERS)
      .catch((err) => {
        console.error('Failed to fetch peers:', err);
        return [] as string[];
      });

    freshPeers.forEach((peerId) => {
      if (!this.peers.includes(peerId)) {
        this.peers.push(peerId);
      }
    });

    if (this.peers.length <= MIN_PEERS) {
      console.log(`Mining conditions not met: ${this.peers.length}/${MIN_PEERS} minimum peers connected`);
      return;
    }

    const pendingCount = this.transactionService
      .getAll()
      .filter((tx) => tx.status === TransactionStatus.INCOMPLETE || (tx.status as any) === 'UNVERIFIED' || tx.status == null)
      .length ?? 0;

    if (pendingCount <= BLOCK_TRANSACTIONS_LIMIT) {
      console.log(`Mining conditions not met: ${pendingCount}/${BLOCK_TRANSACTIONS_LIMIT} transactions pending`);
      return;
    }

    this.miningStarted = true;
    this.redisP2PService.publishMessage({
      channel: P2P_CHANNELS.PEERS,
      message: { type: 'MINING_STARTED' },
      timestamp: Date.now(),
    });
    this.selectNextMiner();
  }

  addPeer(peerId: string): void {
    if (!this.peers.includes(peerId)) {
      this.peers.push(peerId);
      console.log(`Peer joined: ${peerId} (total: ${this.peers.length})`);
    }
  }

  getStatus() {
    return {
      isBootNode: this.isBootNode,
      miningStarted: this.miningStarted,
      peerId: this.redisP2PService.peerId,
      peers: this.peers,
      peerCount: this.peers.length,
      blockLength: this.blockchainService.getLength(),
      pendingTransactions: this.transactionService.getByStatus(TransactionStatus.INCOMPLETE).length,
    };
  }
}
