import { hashData } from '../../common/utils/crypto.util';
import { GENESIS_DATA } from '../../config/blockchain.config';

/**
 * Represents a single block in the blockchain
 */
export class Block {
  timestamp: number;
  lastHash: string;
  hash: string;
  data: any;
  miner: string | null;

  constructor({
    timestamp,
    lastHash,
    hash,
    data,
    miner,
  }: {
    timestamp: number;
    lastHash: string;
    hash: string;
    data: any;
    miner: string | null;
  }) {
    this.timestamp = timestamp;
    this.lastHash = lastHash;
    this.hash = hash;
    this.data = data;
    this.miner = miner;
  }

  /**
   * Creates the genesis (first) block
   */
  static genesis(): Block {
    return new this(GENESIS_DATA);
  }

  /**
   * Creates a new block with validated transactions
   * @param lastBlock - The previous block
   * @param data - Transactions to include in the block
   * @param miner - The peer_id of the peer that mines this block
   */
  static mineBlock({
    lastBlock,
    data,
    miner,
  }: {
    lastBlock: Block;
    data: any;
    miner: string;
  }): Block {
    const timestamp = Date.now();
    const lastHash = lastBlock.hash;
    const hash = hashData(timestamp, lastHash, data, miner);

    return new this({ timestamp, lastHash, hash, data, miner });
  }

  /**
   * Returns block information
   */
  toJSON() {
    return {
      timestamp: this.timestamp,
      lastHash: this.lastHash,
      hash: this.hash,
      data: this.data,
      miner: this.miner,
    };
  }
}
