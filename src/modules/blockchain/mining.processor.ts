import { Process, Processor } from '@nestjs/bull';
import { ModuleRef } from '@nestjs/core';
import * as Bull from 'bull';
import { ConsensusService } from '../consensus/consensus.service';
import { RedisP2PService } from '../redis-p2p/redis-p2p.service';
import { P2P_CHANNELS } from '../p2p/p2p.service';
import { Transaction } from '../transaction/transaction.class';
import { TransactionService } from '../transaction/transaction.service';
import { BlockchainService } from './blockchain.service';

export interface MiningJobData {
  minerId: string;
  transactionPageIndex: number;
}

@Processor('mining')
export class MiningProcessor {
  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly moduleRef: ModuleRef,
  ) {}

  @Process({ name: 'mineTransactions', concurrency: 20 })
  mineTransactions(job: Bull.Job<MiningJobData>): void {
    const { minerId } = job.data;

    const redisP2PService = this.moduleRef.get(RedisP2PService, { strict: false });
    const consensusService = this.moduleRef.get(ConsensusService, { strict: false });
    const transactionService = this.moduleRef.get(TransactionService, { strict: false });

    // Take the top BLOCK_TRANSACTIONS_LIMIT pending transactions off the front of the pool
    const transactions = transactionService.getPendingForMining();

    if (transactions.length === 0) {
      console.log('Mining job: transaction pool is empty — skipping');
      return;
    }

    // Validate each transaction and collect valid ones as a plain array
    const validTransactions: Transaction[] = transactions.filter((tx) => {
      const isValid = Transaction.validTransaction(tx);
      if (!isValid) {
        console.warn(`Transaction ${tx.id} failed validation — excluded from block`);
      }
      return isValid;
    });

    if (validTransactions.length === 0) {
      console.log('No valid transactions after filtering — skipping block creation');
      return;
    }

    // Mark each valid transaction as complete
    validTransactions.forEach((tx) => tx.markComplete());

    // Mine a new block containing the valid transactions
    const newBlock = this.blockchainService.addBlock(validTransactions, minerId);
    console.log(`Block mined: ${newBlock.hash} by ${minerId} (${validTransactions.length} transactions)`);

    // Broadcast the new block. Redis pub/sub has no PubNub-style ~32KB message cap,
    // so unlike the old PubNub path there's no need to fall back to a file transfer.
    const blockJson = newBlock.toJSON();
    redisP2PService.publishMessage({
      channel: P2P_CHANNELS.BLOCKCHAIN,
      message: { type: 'NEW_BLOCK', block: blockJson },
      timestamp: Date.now(),
    });

    // Increment before selectNextMiner so the START_MINING message carries the updated index
    consensusService.transactionPageIndex++;

    // Assign the next peer in round-robin to continue the mining chain
    const nextMiner = consensusService.selectNextMiner();
    if (!nextMiner) {
      console.log('No peers available for the next mining round');
    }
  }
}
