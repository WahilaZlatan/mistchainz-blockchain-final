import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { Block } from './block.class';

/**
 * REST Controller for blockchain operations
 */
@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  /**
   * Gets the entire blockchain
   */
  @Get()
  getBlockchain() {
    return this.blockchainService.getBlockchainInfo();
  }

  /**
   * Gets the length of the chain
   */
  @Get('length')
  getLength() {
    return { length: this.blockchainService.getLength() };
  }

  /**
   * Gets the last block in the chain
   */
  @Get('last-block')
  getLastBlock() {
    const lastBlock = this.blockchainService.getLastBlock();
    return lastBlock.toJSON();
  }

  /**
   * Gets a specific block by index
   */
  @Get('block/:index')
  getBlock(@Param('index') index: string) {
    const blockIndex = parseInt(index, 10);
    const block = this.blockchainService.getBlock(blockIndex);

    if (!block) {
      return { error: 'Block not found' };
    }

    return block.toJSON();
  }

  /**
   * Adds a new block with data
   */
  @Post('add-block')
  addBlock(@Body() body: { data: any; miner: string }) {
    if (!body.data) {
      return { error: 'Data is required' };
    }
    if (!body.miner) {
      return { error: 'Miner peer ID is required' };
    }

    const newBlock = this.blockchainService.addBlock(body.data, body.miner);
    return newBlock.toJSON();
  }

  /**
   * Validates the blockchain
   */
  @Post('validate')
  validate() {
    const chain = this.blockchainService.getChain();
    const isValid = this.blockchainService.validateChain(chain);
    return { isValid };
  }

  /**
   * Replaces the chain
   */
  @Post('replace-chain')
  replaceChain(@Body() body: { chain: any; validateTransactions?: boolean }) {
    if (!Array.isArray(body.chain)) {
      return { error: 'Chain must be an array' };
    }

    const success = this.blockchainService.replaceChain(
      body.chain,
      body.validateTransactions || false,
    );

    return {
      success,
      message: success
        ? 'Chain replaced successfully'
        : 'Failed to replace chain',
    };
  }

  /**
   * Gets all blocks as an array
   */
  @Get('blocks')
  getChain() {
    return this.blockchainService.getChain().map((block) => block.toJSON());
  }
}
