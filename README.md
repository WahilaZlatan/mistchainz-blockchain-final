# GGL-DS-MIST

A NestJS TypeScript application that recreates a blockchain wallet and transaction system with cryptographic utilities. This project demonstrates secure wallet management, digital signatures, and transaction validation using modern cryptographic practices.

## Project Overview

GGL-DS-MIST is a complete TypeScript/NestJS reimplementation of a blockchain wallet and transaction system. It provides:

- **Wallet Management**: Create and manage blockchain wallets with RSA-based public/private key pairs
- **Transaction Processing**: Create and manage blockchain transactions with cryptographic signatures
- **Cryptographic Utilities**: Sign data, verify signatures, and hash data using industry-standard algorithms
- **REST API**: Comprehensive REST endpoints for all wallet and transaction operations

## Features

### Wallet Module (`src/modules/wallet/`)
- Create new wallets with RSA key pairs
- Manage wallet addresses (public keys) and balances
- Sign transactions with private keys
- Track multiple wallets

### Transaction Module (`src/modules/transaction/`)
- Create transactions with sender, recipient, and data
- Validate transaction signatures
- Store and retrieve transactions
- Cryptographic signing and verification

### Crypto Module (`src/modules/crypto/`)
- RSA key pair generation
- SHA256 hashing
- Digital signature creation and verification
- Secure data signing with private keys

## Architecture

```
src/
  ├── modules/
  │   ├── wallet/
  │   │   ├── wallet.class.ts       # Wallet domain model
  │   │   ├── wallet.service.ts     # Business logic
  │   │   ├── wallet.controller.ts  # REST endpoints
  │   │   └── wallet.module.ts      # Module definition
  │   ├── transaction/
  │   │   ├── transaction.class.ts       # Transaction domain model
  │   │   ├── transaction.service.ts     # Business logic
  │   │   ├── transaction.controller.ts  # REST endpoints
  │   │   └── transaction.module.ts      # Module definition
  │   └── crypto/
  │       ├── crypto.service.ts      # Cryptographic operations
  │       └── crypto.module.ts       # Module definition
  ├── common/
  │   └── utils/
  │       └── crypto.util.ts        # Utility functions
  ├── app.module.ts                  # Root application module
  └── main.ts                        # Application entry point
```

## Installation

```bash
npm install
```

## Development

### Start the development server

```bash
npm run start:dev
```

The application will be running at `http://localhost:3000`

### Build for production

```bash
npm run build
```

### Run in production mode

```bash
npm start
```

## API Endpoints

### Wallet Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/wallets` | Create a new wallet |
| GET | `/wallets` | Get all wallets |
| GET | `/wallets/:address` | Get wallet by address |


### Transaction Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/transactions` | Create a new transaction |
| GET | `/transactions` | Get all transactions |
| GET | `/transactions/:id` | Get transaction by ID |
| POST | `/transactions/:id/validate` | Validate a transaction |
| POST | `/transactions/:id/delete` | Delete a transaction |

## Usage Examples

### Create a Wallet

```bash
curl -X POST http://localhost:3000/wallets
```

Response:
```json
{
  "address": "-----BEGIN PUBLIC KEY-----...",
  "balance": 0
}
```

### Create a Transaction

```bash
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "senderAddress": "-----BEGIN PUBLIC KEY-----...",
    "recipient": "recipient_address",
    "data": { "message": "Hello, Blockchain!" }
  }'
```

Response:
```json
{
  "id": "uuid-string",
  "input": {
    "timestamp": 1234567890,
    "address": "sender_public_key",
    "signature": "hex_signature"
  },
  "outputMap": {
    "destination": "recipient_address",
    "data": { "message": "Hello, Blockchain!" }
  }
}
```

### Validate a Transaction

```bash
curl -X POST http://localhost:3000/transactions/:id/validate
```

Response:
```json
{
  "transactionId": "uuid-string",
  "isValid": true
}
```

## Testing

```bash
# Unit tests
npm run test

# Integration/E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Key Classes

### Wallet Class
- Manages public/private key pairs
- Signs transactions with the private key
- Maintains wallet balance
- Provides wallet address (public key)

### Transaction Class
- Represents a blockchain transaction
- Contains sender signature, recipient, and data
- Validates transactions using public key cryptography
- Unique ID using UUID v4

### Crypto Utilities
- **verifySignature**: Verify RSA signatures
- **signData**: Sign data with a private key
- **hashData**: Generate SHA256 hashes
- **generateKeyPair**: Create RSA key pairs

## Security Notes

- Uses RSA 2048-bit encryption for key generation
- SHA256 hashing for data integrity
- Digital signatures for transaction authentication
- Private keys should be stored securely in production
- Transactions are cryptographically signed and verified

## Technologies

- **Framework**: NestJS 11.x
- **Language**: TypeScript 5.x
- **Cryptography**: Node.js built-in `crypto` module
- **ID Generation**: UUID v4
- **HTTP**: Express.js (via NestJS)

## Project Structure

This project follows NestJS best practices:
- Modular architecture with feature modules
- Service layer for business logic
- Controller layer for REST endpoints
- Dependency injection throughout
- Domain models for core entities

## Environment Variables

Currently, no environment variables are required. The application runs with default settings suitable for development.

For production, consider adding:
- `NODE_ENV=production`
- `PORT=3000`
- Key storage and management

## Contributing

1. Follow NestJS coding conventions
2. Write tests for new features
3. Update documentation
4. Use TypeScript strict mode
5. Follow the existing module structure

## License

This project is licensed under the UNLICENSED license. Check the LICENSE file for details.

## Support

For issues, questions, or contributions, please refer to the project documentation and NestJS documentation at https://docs.nestjs.com

