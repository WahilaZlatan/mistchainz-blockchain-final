import { Pool } from 'pg';
import { MistClient } from 'mist-chainz-client';
import { RECEIPIENT_ADDRESS } from '../src/config/blockchain.config';
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '4242',
    database: 'mpsr_collateral_registry',
    max: 20, // Maximum clients in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  const mistClient = new MistClient('http://localhost:3000');
   (async () => {
    const queryResult = await pool.query(
      'SELECT * FROM transactions ORDER BY created_at DESC LIMIT 1',
    );
    console.log('Postgres query result:', queryResult.rows);
    const transactionData = queryResult.rows[0];
    await mistClient.createWallet();
    const blockchainTransaction = await mistClient.createTransaction({
      recipient: RECEIPIENT_ADDRESS,
      data: {
        id: transactionData.id,
        ...transactionData,
      },
    });
    console.log('Blockchain transaction response:', blockchainTransaction);
  })().catch((error) => {
    console.error('Error occurred:', error);
  }).finally(() => {
    pool.end();
  });
