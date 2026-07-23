import { Module, forwardRef } from '@nestjs/common';
import { ConsensusService } from './consensus.service';
import { ConsensusController } from './consensus.controller';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { RedisP2PModule } from '../redis-p2p/redis-p2p.module';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  imports: [forwardRef(() => RedisP2PModule), TransactionModule, BlockchainModule],
  providers: [ConsensusService],
  controllers: [ConsensusController],
  exports: [ConsensusService],
})
export class ConsensusModule {}
