import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { WalletService } from './wallet.service';

@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('create')
  create(): { address: string; privateKey: string } {
    return this.walletService.create();
  }

  /**
   * Gets all wallets
   */
  @Get()
  getAll() {
    return this.walletService.getAll().map((w) => w.toJSON());
  }

  /**
   * Gets a wallet by address
   * @param address - The wallet address
   */
  @Get(':address')
  getByAddress(@Param('address') address: string) {
    const wallet = this.walletService.getByAddress(address);
    if (!wallet) {
      return { error: 'Wallet not found' };
    }
    return wallet.toJSON();
  }

  /**
   * Gets the balance of a wallet
   * @param address - The wallet address
   */
  @Get(':address/balance')
  getBalance(@Param('address') address: string) {
    const balance = this.walletService.getBalance(address);
    if (balance === undefined) {
      return { error: 'Wallet not found' };
    }
    return { address, balance };
  }

  /**
   * Sets the balance of a wallet (for testing purposes)
   */
  @Post(':address/balance')
  setBalance(
    @Param('address') address: string,
    @Body() body: { balance: number },
  ) {
    const wallet = this.walletService.getByAddress(address);
    if (!wallet) {
      return { error: 'Wallet not found' };
    }
    this.walletService.setBalance(address, body.balance);
    return { address, balance: body.balance };
  }
}
