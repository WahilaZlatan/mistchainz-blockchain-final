import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WalletModule } from './modules/wallet/wallet.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { CryptoModule } from './modules/crypto/crypto.module';
import { BlockchainModule } from './modules/blockchain/blockchain.module';
import { P2PModule } from './modules/p2p/p2p.module';
import { RedisP2PModule } from './modules/redis-p2p/redis-p2p.module';
import { ConsensusModule } from './modules/consensus/consensus.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    WalletModule,
    TransactionModule,
    CryptoModule,
    BlockchainModule,
    P2PModule,
    RedisP2PModule,
    ConsensusModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
