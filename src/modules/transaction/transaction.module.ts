import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TransactionService } from './transaction.service';
import { TransactionProcessor } from './transaction.processor';
import { TransactionController } from './transaction.controller';
import { WalletModule } from '../wallet/wallet.module';
import { CryptoModule } from '../crypto/crypto.module';

@Module({
  imports: [WalletModule, CryptoModule, BullModule.registerQueue({ name: 'transactions' })],
  providers: [TransactionService, TransactionProcessor],
  controllers: [TransactionController],
  exports: [TransactionService, BullModule],
})
export class TransactionModule {}
