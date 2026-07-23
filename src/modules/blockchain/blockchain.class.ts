import { Block } from './block.class';
import { hashData } from '../../common/utils/crypto.util';
import {
  REWARD_INPUT,
  MINING_REWARD,
} from '../../config/blockchain.config';
import { Transaction } from '../transaction/transaction.class';
import { Wallet } from '../wallet/wallet.class';

/**
 * Represents the blockchain - a chain of validated blocks
 */
export class Blockchain {
  chain: Block[];

  constructor() {
    this.chain = [Block.genesis()];
  }

  /**
   * Adds a new block to the chain
   * @param data - Data to include in the block (typically transactions)
   */
  addBlock({ data, miner }: { data: any; miner: string }): Block {
    const newBlock = Block.mineBlock({
      lastBlock: this.chain[this.chain.length - 1],
      data,
      miner,
    });

    this.chain.push(newBlock);
    return newBlock;
  }

  /**
   * Gets all blocks in the chain
   */
  getChain(): Block[] {
    return this.chain;
  }

  /**
   * Gets a specific block by index
   */
  getBlock(index: number): Block | undefined {
    return this.chain[index];
  }

  /**
   * Gets the last block in the chain
   */
  getLastBlock(): Block {
    return this.chain[this.chain.length - 1];
  }

  /**
   * Gets the chain length
   */
  getLength(): number {
    return this.chain.length;
  }

  /**
   * Replaces the chain with a new one if it's valid
   * @param chain - New chain to replace with
   * @param validateTransactions - Whether to validate transactions
   * @param onSuccess - Callback if replacement is successful
   */
  replaceChain(
    chain: Block[],
    validateTransactions = false,
    onSuccess?: () => void,
  ): boolean {
    if (chain.length <= this.chain.length) {
      console.error('The incoming chain must be longer');
      return false;
    }

    if (!Blockchain.isValidChain(chain)) {
      console.error('The incoming chain must be valid');
      return false;
    }

    if (validateTransactions && !this.validTransactionData({ chain })) {
      console.error('The incoming chain has invalid data');
      return false;
    }

    if (onSuccess) onSuccess();
    console.log('replacing chain with incoming chain');
    this.chain = chain;
    return true;
  }

  /**
   * Validates all transaction data in the chain
   */
  private validTransactionData({ chain }: { chain: Block[] }): boolean {
    for (let i = 1; i < chain.length; i++) {
      const block = chain[i];
      const transactionSet = new Set();
      let rewardTransactionCount = 0;

      for (let transaction of block.data) {
        // Check mining rewards
        if (transaction.input?.address === REWARD_INPUT.address) {
          rewardTransactionCount += 1;

          if (rewardTransactionCount > 1) {
            console.error('Miner rewards exceed limit');
            return false;
          }

          if (Object.values(transaction.outputMap || {})[0] !== MINING_REWARD) {
            console.error('Miner reward amount is invalid');
            return false;
          }
        } else {
          // Validate regular transactions
          if (!Transaction.validTransaction(transaction)) {
            console.error('Invalid transaction');
            return false;
          }

          // Check balance validity (would need wallet history for full validation)
          if (transactionSet.has(transaction)) {
            console.error(
              'An identical transaction appears more than once in the block',
            );
            return false;
          } else {
            transactionSet.add(transaction);
          }
        }
      }
    }

    return true;
  }

  /**
   * Validates the entire chain
   * @param chain - Chain to validate
   */
  static isValidChain(chain: Block[]): boolean {
    if (JSON.stringify(chain[0]) !== JSON.stringify(Block.genesis())) {
      return false;
    }

    for (let i = 1; i < chain.length; i++) {
      const { timestamp, lastHash, hash, data, miner } = chain[i];
      const actualLastHash = chain[i - 1].hash;

      if (lastHash !== actualLastHash) {
        console.error('Invalid last hash');
        return false;
      }

      // Verify hash integrity
      const validatedHash = hashData(timestamp, lastHash, data, miner);

      if (hash !== validatedHash) {
        console.error('Invalid hash');
        return false;
      }
    }

    return true;
  }

  /**
   * Returns blockchain information
   */
  toJSON() {
    return {
      chain: this.chain.map((block) => block.toJSON()),
      length: this.chain.length,
    };
  }
}
