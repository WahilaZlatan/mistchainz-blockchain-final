import { generateKeyPair, signData } from '../../common/utils/crypto.util';

/**
 * Represents a blockchain wallet with cryptographic capabilities
 */
export class Wallet {
  public publicKey: string;
  private privateKey: string;
  public balance: number;

  constructor(privateKey?: string) {
    if (privateKey) {
      this.privateKey = privateKey;
      // For this implementation, we'd need a way to derive public key from private key
      // For now, we'll generate both
      const keyPair = generateKeyPair();
      this.publicKey = keyPair.publicKey;
      this.privateKey = privateKey;
    } else {
      const keyPair = generateKeyPair();
      this.publicKey = keyPair.publicKey;
      this.privateKey = keyPair.privateKey;
    }
    this.balance = 0;
  }

  /**
   * Signs data using this wallet's private key
   * @param data - The data to sign (typically outputMap from a transaction)
   * @returns The signature as a hex string
   */
  public sign(data: any): string {
    return signData(this.privateKey, data);
  }

  public getAddress(): string {
    return this.publicKey;
  }

  public getPrivateKey(): string {
    return this.privateKey;
  }

  /**
   * Returns wallet information
   */
  public toJSON() {
    return {
      address: this.publicKey,
      balance: this.balance,
    };
  }
}
