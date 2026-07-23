import { Injectable } from '@nestjs/common';
import {
  verifySignature,
  hashData,
  generateKeyPair,
  signData,
  encryptAES,
} from '../../common/utils/crypto.util';

/**
 * Service for cryptographic operations
 */
@Injectable()
export class CryptoService {
  /**
   * Verifies a signature
   */
  verify(publicKey: string, data: any, signature: string): boolean {
    return verifySignature(publicKey, data, signature);
  }

  /**
   * Hashes data
   */
  hash(data: any): string {
    return hashData(data);
  }

  /**
   * Generates a new key pair
   */
  generateKeys(): { publicKey: string; privateKey: string } {
    return generateKeyPair();
  }

  /**
   * Signs data with a private key
   */
  sign(privateKey: string, data: any): string {
    return signData(privateKey, data);
  }

  /**
   * Encrypts data with AES using the given key, returning a base64 string
   */
  encrypt(data: any, key: string): string {
    return encryptAES(data, key);
  }
}
