import { Injectable } from '@nestjs/common';
import { Wallet } from './wallet.class';

export interface ExternalWallet {
  address: string;
  balance: number;
}

@Injectable()
export class WalletService {
  private wallets: Map<string, Wallet> = new Map();
  private externalWallets: Map<string, ExternalWallet> = new Map();
  private onCreateCallbacks: Array<(wallet: ExternalWallet) => void> = [];

  registerOnCreate(callback: (wallet: ExternalWallet) => void): void {
    this.onCreateCallbacks.push(callback);
  }

  create(): { address: string; privateKey: string } {
    const wallet = new Wallet();
    this.wallets.set(wallet.getAddress(), wallet);
    const publicInfo: ExternalWallet = { address: wallet.getAddress(), balance: wallet.balance };
    this.onCreateCallbacks.forEach((cb) => cb(publicInfo));
    console.log(`Wallet created: ${wallet.getAddress()}`);
    return { address: wallet.getAddress(), privateKey: wallet.getPrivateKey() };
  }

  getByAddress(address: string): Wallet | undefined {
    return this.wallets.get(address);
  }

  getAll(): Wallet[] {
    return Array.from(this.wallets.values());
  }

  setBalance(address: string, balance: number): void {
    const wallet = this.wallets.get(address);
    if (wallet) {
      wallet.balance = balance;
    }
  }

  getBalance(address: string): number | undefined {
    return this.wallets.get(address)?.balance;
  }

  addExternal(data: ExternalWallet): void {
    if (!this.wallets.has(data.address) && !this.externalWallets.has(data.address)) {
      this.externalWallets.set(data.address, data);
      console.log(`External wallet registered: ${data.address}`);
    }
  }

  getExternalByAddress(address: string): ExternalWallet | undefined {
    return this.externalWallets.get(address);
  }

  getAllExternal(): ExternalWallet[] {
    return Array.from(this.externalWallets.values());
  }
}
