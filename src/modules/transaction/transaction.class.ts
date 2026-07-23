import { v4 as uuidv4 } from 'uuid';
import { Wallet } from '../wallet/wallet.class';
import { verifySignature } from '../../common/utils/crypto.util';

export enum TransactionStatus {
  INCOMPLETE = 'UNVERIFIED',
  COMPLETE = 'VERIFIED',
  ERROR = 'ERROR'
}

/**
 * Represents a single transaction input
 */
export interface TransactionInput {
  timestamp: number;
  address: string; // sender's public key
  signature: string;
}

/**
 * Represents the output of a transaction
 */
export interface TransactionOutput {
  destination: string;
  data: any; // blob data in format less than 32 KB
}

/**
 * Represents a blockchain transaction
 */
export class Transaction {
  public id: string;
  public status: TransactionStatus;
  public outputMap: TransactionOutput;
  public input: TransactionInput;

  constructor({
    senderWallet,
    recipient,
    data,
    outputMap,
    input,
  }: {
    senderWallet: Wallet;
    recipient?: string;
    data?: any;
    outputMap?: TransactionOutput;
    input?: TransactionInput;
  }) {
    this.id = uuidv4();
    this.status = TransactionStatus.INCOMPLETE;
    this.outputMap =
      outputMap || this.createOutputMap({ recipient: recipient || '', data });
    this.input =
      input || this.createInput({ senderWallet, outputMap: this.outputMap });
  }

  /**
   * Creates the output map for a transaction
   * @param recipient - The recipient address
   * @param data - The data to send (blob format, less than 32 KB)
   * @returns The output map
   */
  private createOutputMap({
    recipient,
    data,
  }: {
    recipient: string;
    data: any;
  }): TransactionOutput {
    return {
      destination: recipient,
      data: data, // blob format
    };
  }

  /**
   * Creates the input signature for a transaction
   * @param senderWallet - The wallet of the sender
   * @param outputMap - The output map to sign
   * @returns The transaction input with signature
   */
  private createInput({
    senderWallet,
    outputMap,
  }: {
    senderWallet: Wallet;
    outputMap: TransactionOutput;
  }): TransactionInput {
    return {
      timestamp: Date.now(),
      address: senderWallet.getAddress(),
      signature: senderWallet.sign(outputMap),
    };
  }

  /**
   * Marks the transaction as complete once it has been validated and mined into a block.
   */
  public markComplete(): void {
    this.status = TransactionStatus.COMPLETE;
  }

  /**
   * Validates a transaction
   * @param transaction - The transaction to validate
   * @returns True if the transaction is valid, false otherwise
   */
  public static validTransaction(transaction: Transaction): boolean {
    const {
      input: { address, signature },
      outputMap,
    } = transaction;

    if (!verifySignature(address, outputMap, signature)) {
      console.error(`Invalid signature from ${address}`);
      return false;
    }

    return true;
  }

  /**
   * Returns transaction information
   */
  public toJSON() {
    return {
      id: this.id,
      status: this.status,
      input: this.input,
      outputMap: this.outputMap,
    };
  }
}
