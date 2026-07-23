import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { RedisP2PService } from './redis-p2p.service';
import { RedisP2PController } from './redis-p2p.controller';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ConsensusModule } from '../consensus/consensus.module';
import { TransactionModule } from '../transaction/transaction.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    BlockchainModule,
    TransactionModule,
    WalletModule,
    BullModule.registerQueue({ name: 'mining' }),
    forwardRef(() => ConsensusModule),
  ],
  providers: [RedisP2PService],
  controllers: [RedisP2PController],
  exports: [RedisP2PService],
})
export class RedisP2PModule {}
