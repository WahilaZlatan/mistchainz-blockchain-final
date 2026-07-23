import { Processor, Process } from '@nestjs/bull';
import * as Bull from 'bull';
import { TransactionService } from './transaction.service';

export interface ReceiveTransactionJobData {
  transaction: any;
}

@Processor('transactions')
export class TransactionProcessor {
  constructor(private readonly transactionService: TransactionService) {}

  @Process({ name: 'receiveTransaction', concurrency: 20 })
  async receiveTransaction(job: Bull.Job<ReceiveTransactionJobData>): Promise<void> {
    const { transaction } = job.data;
    this.transactionService.receive(transaction);
    console.log(`Transaction received and added to pool: ${transaction.id}`);
  }
}
