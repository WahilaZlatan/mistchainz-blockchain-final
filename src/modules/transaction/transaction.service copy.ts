import { Injectable } from '@nestjs/common';
import { Transaction, TransactionStatus } from './transaction.class';
import { BLOCK_TRANSACTIONS_LIMIT } from '../../config/blockchain.config';
import { Wallet } from '../wallet/wallet.class';

@Injectable()
export class TransactionService {
  private transactions: Transaction[] = [];

  create(senderWallet: Wallet, recipient: string, data: any): Transaction {
    const transaction = new Transaction({
      senderWallet,
      recipient,
      data,
    });
    this.transactions.push(transaction);
    return transaction;
  }

  getById(id: string): Transaction | undefined {
    return this.transactions.find((t) => t.id === id);
  }

  getAll(): Transaction[] {
    return this.transactions;
  }

  validate(transaction: Transaction): boolean {
    return Transaction.validTransaction(transaction);
  }

  markComplete(id: string): Transaction | undefined {
    const transaction = this.transactions.find((t) => t.id === id);
    if (!transaction) return undefined;

    if (!Transaction.validTransaction(transaction)) {
      console.error(`Transaction ${id} failed validation — cannot mark complete`);
      return undefined;
    }

    transaction.markComplete();
    return transaction;
  }

  getByStatus(status: TransactionStatus): Transaction[] {
    return this.transactions.filter((t) => t.status === status);
  }

  receive(txData: any): Transaction | null {
    if (this.transactions.find((t) => t.id === txData.id)) return null;
    this.transactions.push(txData as Transaction);
    return txData as Transaction;
  }

  delete(id: string): boolean {
    const index = this.transactions.findIndex((t) => t.id === id);
    if (index === -1) return false;
    this.transactions.splice(index, 1);
    return true;
  }

  paginate(transactionPageIndex: number): {
    transactions: Transaction[];
    totalItems: number;
    totalPages: number;
    currentPage: number;
    startIndex: number;
    endIndex: number;
  } {
    const totalItems = this.transactions.length;
    const totalPages = Math.ceil(totalItems / BLOCK_TRANSACTIONS_LIMIT);
    const startIndex = transactionPageIndex * BLOCK_TRANSACTIONS_LIMIT;
    const endIndex = Math.min(startIndex + BLOCK_TRANSACTIONS_LIMIT, totalItems);
    const transactions = this.transactions.slice(startIndex, endIndex);

    return { transactions, totalItems, totalPages, currentPage: transactionPageIndex, startIndex, endIndex };
  }
}
