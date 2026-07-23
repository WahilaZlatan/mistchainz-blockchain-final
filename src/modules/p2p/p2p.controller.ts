import { Controller, Get, Post, Body } from '@nestjs/common';
import { P2PService, P2P_CHANNELS } from './p2p.service';

@Controller('p2p')
export class P2PController {
  constructor(private p2pService: P2PService) {}

  @Get('network-status')
  getNetworkStatus() {
    return this.p2pService.getNetworkStatus();
  }

  @Get('peers')
  async getActivePeers() {
    try {
      return await this.p2pService.getActivePeers();
    } catch (error) {
      return { error: 'Unable to fetch peers. Ensure the PubNub Presence add-on is enabled for your key.' };
    }
  }

  @Get('history')
  getMessageHistory() {
    return this.p2pService.getMessageHistory();
  }

  @Post('broadcast-transaction')
  broadcastTransaction(@Body() body: { transaction: any }) {
    if (!body.transaction) {
      return { error: 'Transaction is required' };
    }
    return this.p2pService.broadcastTransaction(body.transaction);
  }

  @Post('publish')
  publishMessage(@Body() body: { message: any }) {
    this.p2pService.publishMessage({
      channel: P2P_CHANNELS.TRANSACTION,
      message: body.message,
      timestamp: Date.now(),
    });
    return { success: true, message: 'Message published' };
  }

  @Post('clear-history')
  clearHistory() {
    this.p2pService.clearHistory();
    return { success: true, message: 'History cleared' };
  }
}
