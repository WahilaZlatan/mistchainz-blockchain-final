import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BlockchainService } from './blockchain.service';
import { BlockchainController } from './blockchain.controller';
import { MiningProcessor } from './mining.processor';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  imports: [
    TransactionModule,
    BullModule.registerQueue({ name: 'mining' }),
  ],
  providers: [BlockchainService, MiningProcessor],
  controllers: [BlockchainController],
  exports: [BlockchainService, BullModule],
})
export class BlockchainModule {}
