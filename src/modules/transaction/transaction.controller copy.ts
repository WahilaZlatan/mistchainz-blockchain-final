import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { TransactionService } from './transaction.service';
import { WalletService } from '../wallet/wallet.service';

/**
 * REST Controller for transaction operations
 */
@Controller('transactions')
export class TransactionController {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly walletService: WalletService,
    @InjectQueue('transactions') private readonly transactionQueue: any,
  ) {}

  /**
   * Creates a new transaction
   * @param body - The request body containing senderAddress, recipient, and data
   */
  @Post()
  create(
    @Body()
    body: {
      senderAddress: string;
      recipient: string;
      data: any;
    },
  ) {
    const senderWallet = this.walletService.getByAddress(body.senderAddress);
    if (!senderWallet) {
      return { error: 'Sender wallet not found' };
    }

    const transaction = this.transactionService.create(
      senderWallet,
      body.recipient,
      body.data,
    );
    return transaction.toJSON();
  }

  @Post('receive')
  async receive(@Body() transaction: any) {
    await this.transactionQueue.add('receiveTransaction', { transaction });
    return { message: 'Transaction queued for processing', id: transaction.id };
  }

  private serialize(t: any): any {
    return typeof t?.toJSON === 'function' ? t.toJSON() : t;
  }

  @Get()
  getAll() {
    return this.transactionService.getAll().map((t) => this.serialize(t));
  }

  @Get(':transaction-id')
  getById(@Param('transaction-id') transactionId: string) {
    const transaction = this.transactionService.getById(transactionId);
    if (!transaction) {
      return { error: 'Transaction not found' };
    }
    return this.serialize(transaction);
  }

  /**
   * Validates a transaction
   * @param transactionId - The transaction ID
   */
  @Post(':transaction-id/validate')
  validate(@Param('transaction-id') transactionId: string) {
    const transaction = this.transactionService.getById(transactionId);
    if (!transaction) {
      return { error: 'Transaction not found' };
    }
    const isValid = this.transactionService.validate(transaction);
    return { transactionId: transactionId, isValid };
  }

  /**
   * Mines a transaction — validates it and marks it as complete
   * @param transactionId - The transaction ID
   */
  @Post(':transaction-id/mine')
  mine(@Param('transaction-id') transactionId: string) {
    const transaction = this.transactionService.markComplete(transactionId);
    if (!transaction) {
      return { error: 'Transaction not found or failed validation' };
    }
    return this.serialize(transaction);
  }

  /**
   * Deletes a transaction
   * @param transactionId - The transaction ID
   */
  @Post(':transaction-id/delete')
  delete(@Param('transaction-id') transactionId: string) {
    const deleted = this.transactionService.delete(transactionId);
    if (!deleted) {
      return { error: 'Transaction not found' };
    }
    return { message: 'Transaction deleted successfully' };
  }
}
