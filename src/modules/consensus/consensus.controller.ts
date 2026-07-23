import { Controller, Get, Post } from '@nestjs/common';
import { ConsensusService } from './consensus.service';

@Controller('consensus')
export class ConsensusController {
  constructor(private readonly consensusService: ConsensusService) {}

  @Get('status')
  getStatus() {
    return this.consensusService.getStatus();
  }

  @Post('refresh')
  async refresh() {
    await this.consensusService.determineBootNode();
    return this.consensusService.getStatus();
  }
}
