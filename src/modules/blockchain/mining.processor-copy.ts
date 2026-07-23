import { Process, Processor } from '@nestjs/bull';
import { ModuleRef } from '@nestjs/core';
import * as Bull from 'bull';
import { ConsensusService } from '../consensus/consensus.service';
import { P2PService, P2P_CHANNELS } from '../p2p/p2p.service';
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
  async mineTransactions(job: Bull.Job<MiningJobData>): Promise<void> {
    const { minerId, transactionPageIndex } = job.data;

    const p2pService = this.moduleRef.get(P2PService, { strict: false });
    const consensusService = this.moduleRef.get(ConsensusService, { strict: false });
    const transactionService = this.moduleRef.get(TransactionService, { strict: false });

    // Fetch the page of transactions via the service paginator
    const { transactions } = transactionService.paginate(transactionPageIndex);

    if (transactions.length === 0) {
      console.log('Mining job: transaction pool page is empty — skipping');
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

    // Broadcast the new block to all peers
    p2pService.publishMessage({
      channel: P2P_CHANNELS.BLOCKCHAIN,
      message: { type: 'NEW_BLOCK', block: newBlock.toJSON() },
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
