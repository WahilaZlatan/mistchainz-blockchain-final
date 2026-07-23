import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { Transaction, TransactionStatus } from './transaction.class';
import { BLOCK_TRANSACTIONS_LIMIT, ENCRYPTION_KEY } from '../../config/blockchain.config';
import { Wallet } from '../wallet/wallet.class';
import { CryptoService } from '../crypto/crypto.service';
import type { ConsensusService } from '../consensus/consensus.service';
import type { BlockchainService } from '../blockchain/blockchain.service';
import type { RedisP2PService } from '../redis-p2p/redis-p2p.service';

const DEMO_BLOCK_DELAY_MS = 30_000;
const DEMO_TRANSACTION_COUNT = 10;

@Injectable()
export class TransactionService implements OnModuleInit {
  private transactions: Transaction[] = [];
  private onCreateCallbacks: Array<(transaction: ReturnType<Transaction['toJSON']>) => void> = [];
  private onReceiveCallbacks: Array<(transaction: ReturnType<Transaction['toJSON']>) => void> = [];

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly cryptoService: CryptoService,
  ) {}

  onModuleInit(): void {
    setTimeout(() => {
      this.demoBlock().catch((error) => console.error('Demo block failed:', error));
    }, DEMO_BLOCK_DELAY_MS);
  }

  // Consensus/blockchain/redis-p2p classes are imported dynamically here (instead of at the
  // top of the file) to avoid a circular require chain at module-load time — those modules
  // import TransactionService too, and by the time this timer fires the whole graph is loaded.
  private async demoBlock(): Promise<void> {
    const { ConsensusService } = await import('../consensus/consensus.service.js');
    const consensusService = this.moduleRef.get<ConsensusService>(ConsensusService, { strict: false });
    if (!consensusService.isBootNode) return;

    const { BlockchainService } = await import('../blockchain/blockchain.service.js');
    const { RedisP2PService } = await import('../redis-p2p/redis-p2p.service.js');
    const blockchainService = this.moduleRef.get<BlockchainService>(BlockchainService, { strict: false });
    const redisP2PService = this.moduleRef.get<RedisP2PService>(RedisP2PService, { strict: false });

    const verifiedTransactions = this.loadVerifiedTransactions(DEMO_TRANSACTION_COUNT);
    const encryptedTransactions = verifiedTransactions.map((transaction) => ({
      ...transaction,
      outputMap: {
        ...transaction.outputMap,
        data: { cipher: this.cryptoService.encrypt(transaction.outputMap?.data, ENCRYPTION_KEY) },
      },
    }));

    const newBlock = blockchainService.addBlock(encryptedTransactions, redisP2PService.peerId);
    console.log('Demo block mined:', newBlock);
  }

  private loadVerifiedTransactions(count: number): any[] {
    try {
      const filePath = path.join(__dirname, 'verified-tansactions.js');
      const source = fs.readFileSync(filePath, 'utf-8');
      // verified-tansactions.js is a trusted bundled data file (Mongo shell export syntax, not
      // valid JSON/CommonJS), so it's evaluated with a stubbed ObjectId() rather than parsed.
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
      const transactions = new Function('ObjectId', `return (${source});`)((hex: string) => hex) as any[];
      return transactions.slice(0, count);
    } catch (error) {
      console.error('Failed to load verified transactions for demo block:', error);
      return [];
    }
  }

  registerOnCreate(callback: (transaction: ReturnType<Transaction['toJSON']>) => void): void {
    this.onCreateCallbacks.push(callback);
  }

  registerOnReceive(callback: (transaction: ReturnType<Transaction['toJSON']>) => void): void {
    this.onReceiveCallbacks.push(callback);
  }

  create(senderWallet: Wallet, recipient: string, data: any): Transaction {
    const transaction = new Transaction({
      senderWallet,
      recipient,
      data,
    });
    this.transactions.push(transaction);
    this.onCreateCallbacks.forEach((cb) => cb(transaction.toJSON()));
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

  getPendingForMining(): Transaction[] {
    return this.transactions.slice(0, BLOCK_TRANSACTIONS_LIMIT);
  }

  removeMined(minedCount: number): void {
    this.transactions = this.transactions.slice(minedCount, this.transactions.length);
  }

  getByStatus(status: TransactionStatus): Transaction[] {
    return this.transactions.filter((t) => t.status === status);
  }

 async receive(txData: any): Promise<Transaction | null> {
    if (this.transactions.find((t) => t.id === txData.id)) return null;
    this.transactions.push(txData as Transaction);
    const serialized = typeof txData.toJSON === 'function' ? txData.toJSON() : txData;
    this.onReceiveCallbacks.forEach((cb) => cb(serialized));
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
