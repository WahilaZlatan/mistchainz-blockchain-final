import { Module } from '@nestjs/common';
import { P2PService } from './p2p.service';
import { P2PController } from './p2p.controller';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  imports: [TransactionModule],
  providers: [P2PService],
  controllers: [P2PController],
  exports: [P2PService],
})
export class P2PModule {}
