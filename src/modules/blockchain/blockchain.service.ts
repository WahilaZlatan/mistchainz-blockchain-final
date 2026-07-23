import { Injectable } from '@nestjs/common';
import { Blockchain } from './blockchain.class';
import { Block } from './block.class';
import { hashData } from '../../common/utils/crypto.util';

/**
 * Service for blockchain operations
 */
@Injectable()
export class BlockchainService {
  private blockchain: Blockchain;

  constructor() {
    this.blockchain = new Blockchain();
  }

  /**
   * Gets the blockchain instance
   */
  getBlockchain(): Blockchain {
    return this.blockchain;
  }

  /**
   * Adds a new block with data
   */
  addBlock(data: any, miner: string): Block {
    return this.blockchain.addBlock({ data, miner });
  }

  /**
   * Validates and appends a block received from a peer.
   * Checks lastHash linkage and recomputes the hash before accepting.
   */
  appendBlock(blockData: {
    timestamp: number;
    lastHash: string;
    hash: string;
    data: any;
    miner: string | null;
  }): boolean {
    const lastBlock = this.getLastBlock();
    if (blockData.lastHash !== lastBlock.hash) return false;
    const expectedHash = hashData(
      blockData.timestamp,
      blockData.lastHash,
      blockData.data,
      blockData.miner,
    );
    if (blockData.hash !== expectedHash) return false;
    this.blockchain.chain.push(new Block(blockData));
    return true;
  }

  /**
   * Gets all blocks
   */
  getChain(): Block[] {
    return this.blockchain.getChain();
  }

  /**
   * Gets a specific block by index
   */
  getBlock(index: number): Block | undefined {
    return this.blockchain.getBlock(index);
  }

  /**
   * Gets the last block
   */
  getLastBlock(): Block {
    return this.blockchain.getLastBlock();
  }

  /**
   * Gets the chain length
   */
  getLength(): number {
    return this.blockchain.getLength();
  }

  /**
   * Validates a chain
   */
  validateChain(chain: Block[]): boolean {
    return Blockchain.isValidChain(chain);
  }

  /**
   * Replaces the chain
   */
  replaceChain(
    chain: Block[],
    validateTransactions = false,
    onSuccess?: () => void,
  ): boolean {
    return this.blockchain.replaceChain(chain, validateTransactions, onSuccess);
  }

  /**
   * Gets blockchain info
   */
  getBlockchainInfo() {
    return this.blockchain.toJSON();
  }
}
