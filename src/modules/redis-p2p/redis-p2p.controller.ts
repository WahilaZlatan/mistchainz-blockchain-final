import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { RedisP2PService, REDIS_P2P_CHANNELS } from './redis-p2p.service';
import { P2P_CHANNELS } from '../p2p/p2p.service';

@Controller('redis-p2p')
export class RedisP2PController {
  constructor(private redisP2PService: RedisP2PService) {}

  @Get('network-status')
  getNetworkStatus() {
    return this.redisP2PService.getNetworkStatus();
  }

  @Get('peers')
  async getActivePeers() {
    return this.redisP2PService.getActivePeers();
  }

  @Get('history')
  getMessageHistory() {
    return this.redisP2PService.getMessageHistory();
  }

  @Get('history/:channel')
  getChannelHistory(@Param('channel') channel: string) {
    const channelEnum = channel.toUpperCase();
    if (!(REDIS_P2P_CHANNELS as string[]).includes(channelEnum)) {
      return { error: `Invalid channel: ${channel}` };
    }
    return this.redisP2PService.getChannelHistory(channelEnum);
  }

  @Post('broadcast-chain')
  broadcastChain() {
    return this.redisP2PService.broadcastChain();
  }

  @Post('broadcast-block')
  broadcastBlock(@Body() body: { block: any }) {
    if (!body.block) {
      return { error: 'Block is required' };
    }
    return this.redisP2PService.broadcastBlock(body.block);
  }

  @Post('publish')
  publishMessage(@Body() body: { channel: string; message: any }) {
    const channelEnum = body.channel?.toUpperCase();
    if (!(REDIS_P2P_CHANNELS as string[]).includes(channelEnum)) {
      return { error: `Invalid channel: ${body.channel}` };
    }
    this.redisP2PService.publishMessage({
      channel: channelEnum,
      message: body.message,
      timestamp: Date.now(),
    });
    return { success: true, message: 'Message published' };
  }

  @Post('clear-history')
  clearHistory() {
    this.redisP2PService.clearHistory();
    return { success: true, message: 'History cleared' };
  }

  @Post('sync')
  requestSync() {
    this.redisP2PService.publishMessage({
      channel: P2P_CHANNELS.SYNC,
      message: { type: 'sync-request' },
      timestamp: Date.now(),
    });
    return { success: true, message: 'Sync request sent' };
  }
}
