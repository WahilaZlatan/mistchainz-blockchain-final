import * as crypto from 'crypto';

export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  return {
    publicKey: (publicKey as unknown as Buffer).toString('base64'),
    privateKey: (privateKey as unknown as Buffer).toString('base64'),
  };
}

export function signData(privateKey: string, data: any): string {
  try {
    const keyObject = crypto.createPrivateKey({
      key: Buffer.from(privateKey, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
    const signer = crypto.createSign('sha256');
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    signer.update(dataString);
    return signer.sign(keyObject, 'hex');
  } catch (error) {
    console.error('Error signing data:', error);
    throw new Error('Failed to sign data');
  }
}

export function verifySignature(publicKey: string, data: any, signature: string): boolean {
  try {
    const keyObject = crypto.createPublicKey({
      key: Buffer.from(publicKey, 'base64'),
      format: 'der',
      type: 'spki',
    });
    const verifier = crypto.createVerify('sha256');
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    verifier.update(dataString);
    return verifier.verify(keyObject, signature, 'hex');
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

export function hashData(...inputs: any[]): string {
  const hash = crypto.createHash('sha256');
  const sortedInputs = inputs.map((input) => JSON.stringify(input)).sort().join(' ');
  hash.update(sortedInputs);
  return hash.digest('hex');
}

// Derives a 32-byte AES-256 key from the configured key string, so any length of
// ENCRYPTION_KEY works, and prepends the IV to the ciphertext so decryption is possible later.
export function encryptAES(data: any, key: string): string {
  const derivedKey = crypto.createHash('sha256').update(key).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  return Buffer.concat([iv, encrypted]).toString('base64');
}
