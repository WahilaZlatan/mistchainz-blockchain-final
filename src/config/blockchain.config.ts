/**
 * Blockchain configuration constants
 */

export const GENESIS_DATA = {
  timestamp: 1,
  lastHash: '-----',
  hash: '============GGL Data-sphynx v.1.0=======',
  data: [],
  miner: null,
};

export const MESSAGE_LIMIT = 32000; // bytes

export const REWARD_INPUT = {
  address: '---reward---',
};

export const RECEIPIENT_ADDRESS = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAELs4ZZD9lgxOWtWfJjpDYT0iGawRGj5C52YmHyfYpmLYfeNfnoxzBzK/VbzRH3LHrgOl2+uaUit5rC9CuSqNl5A==';

export const MINING_REWARD = 50;

export const IS_BOOT_NODE = false;

export const MIN_PEERS = 5;

export const MAX_PEERS = 25;

export const BLOCK_TRANSACTIONS_LIMIT = 3000; // increase gradually upto 5000

export const NATS_SERVER_CLIENT = 'nats://localhost:4222';

export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'ggl-ds-mist-demo-block-encryption-key';
