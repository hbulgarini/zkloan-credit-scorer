# Migration Guide: Upgrading to Midnight SDK 3.0.0 and Preprod Network

This guide documents the changes required to migrate a Midnight dApp from older SDK versions to the stable 3.0.0 release with preprod network support.

## Overview of Changes

1. **Wallet SDK Migration**: From `@midnight-ntwrk/wallet` to `@midnight-ntwrk/wallet-sdk-*` packages
2. **Indexer API Version**: From `/api/v1/graphql` to `/api/v3/graphql`
3. **Contract API**: From `contract` property to `compiledContract` with `CompiledContract` pattern
4. **Network Configuration**: Adding preprod network support

---

## 1. Package Dependencies

### Old Dependencies (Remove)
```json
{
  "@midnight-ntwrk/wallet": "5.0.0",
  "@midnight-ntwrk/wallet-api": "5.0.0",
  "@midnight-ntwrk/midnight-js-contracts": "2.0.2",
  "@midnight-ntwrk/ledger": "^4.0.0"
}
```

### New Dependencies (Add)
```json
{
  "@midnight-ntwrk/compact-js": "2.4.0",
  "@midnight-ntwrk/compact-runtime": "0.14.0",
  "@midnight-ntwrk/ledger-v7": "7.0.0",
  "@midnight-ntwrk/midnight-js-contracts": "3.0.0",
  "@midnight-ntwrk/midnight-js-http-client-proof-provider": "3.0.0",
  "@midnight-ntwrk/midnight-js-indexer-public-data-provider": "3.0.0",
  "@midnight-ntwrk/midnight-js-level-private-state-provider": "3.0.0",
  "@midnight-ntwrk/midnight-js-network-id": "3.0.0",
  "@midnight-ntwrk/midnight-js-node-zk-config-provider": "3.0.0",
  "@midnight-ntwrk/midnight-js-types": "3.0.0",
  "@midnight-ntwrk/midnight-js-utils": "3.0.0",
  "@midnight-ntwrk/wallet-sdk-abstractions": "1.0.0",
  "@midnight-ntwrk/wallet-sdk-address-format": "3.0.0",
  "@midnight-ntwrk/wallet-sdk-dust-wallet": "1.0.0",
  "@midnight-ntwrk/wallet-sdk-facade": "1.0.0",
  "@midnight-ntwrk/wallet-sdk-hd": "3.0.0",
  "@midnight-ntwrk/wallet-sdk-shielded": "1.0.0",
  "@midnight-ntwrk/wallet-sdk-unshielded-wallet": "1.0.0"
}
```

### Recommended Resolutions
```json
{
  "resolutions": {
    "@midnight-ntwrk/ledger-v7": "7.0.0",
    "@midnight-ntwrk/midnight-js-network-id": "3.0.0",
    "@midnight-ntwrk/compact-runtime": "0.14.0"
  }
}
```

---

## 2. Wallet SDK Migration

### Old Wallet API (DEPRECATED)
```typescript
import { WalletBuilder } from '@midnight-ntwrk/wallet';

const wallet = await WalletBuilder.build(
  indexerUrl,
  indexerWsUrl,
  proofServerUrl,
  nodeUrl,
  secretKey,
  NetworkId.Undeployed,
  'debug'
);

await wallet.start();
```

### New Wallet SDK API
```typescript
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import * as ledger from '@midnight-ntwrk/ledger-v7';

// Derive keys from seed
const hdWallet = HDWallet.fromSeed(seed);
const derivationResult = hdWallet.hdWallet
  .selectAccount(0)
  .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
  .deriveKeysAt(0);

const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(derivationResult.keys[Roles.Zswap]);
const dustSecretKey = ledger.DustSecretKey.fromSeed(derivationResult.keys[Roles.Dust]);
const unshieldedKeystore = createKeystore(derivationResult.keys[Roles.NightExternal], networkId);

// Create separate configurations for each wallet type
const shieldedConfig = {
  networkId,
  indexerClientConnection: {
    indexerHttpUrl: indexer,
    indexerWsUrl: indexerWS,
  },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, 'ws')), // Convert http(s) to ws(s)
};

const unshieldedConfig = {
  networkId,
  indexerClientConnection: {
    indexerHttpUrl: indexer,
    indexerWsUrl: indexerWS,
  },
  txHistoryStorage: new InMemoryTransactionHistoryStorage(),
};

const dustConfig = {
  networkId,
  costParameters: {
    additionalFeeOverhead: 300_000_000_000_000n,
    feeBlocksMargin: 5,
  },
  indexerClientConnection: {
    indexerHttpUrl: indexer,
    indexerWsUrl: indexerWS,
  },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, 'ws')),
};

// Initialize wallets
const shieldedWallet = ShieldedWallet(shieldedConfig).startWithSecretKeys(shieldedSecretKeys);
const unshieldedWallet = UnshieldedWallet(unshieldedConfig).startWithPublicKey(
  PublicKey.fromKeyStore(unshieldedKeystore)
);
const dustWallet = DustWallet(dustConfig).startWithSecretKey(
  dustSecretKey,
  ledger.LedgerParameters.initialParameters().dust
);

// Create facade and start
const wallet = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
await wallet.start(shieldedSecretKeys, dustSecretKey);
```

---

## 3. Contract Deployment API

### Old Contract API
```typescript
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';

const contractInstance = new MyContract.Contract(witnesses);

const deployed = await deployContract(providers, {
  contract: contractInstance,
  privateStateId: 'myPrivateState',
  initialPrivateState: privateState,
});
```

### New Contract API (with CompiledContract)
```typescript
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';

// Create compiled contract with the new pattern
const compiledContract = CompiledContract.make<MyContractType>(
  'MyContract',
  MyContract.Contract
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);

// Deploy using compiledContract property
const deployed = await deployContract(providers, {
  compiledContract: compiledContract,
  privateStateId: 'myPrivateState',
  initialPrivateState: privateState,
});

// Join existing contract
const joined = await findDeployedContract(providers, {
  contractAddress,
  compiledContract: compiledContract,
  privateStateId: 'myPrivateState',
  initialPrivateState: privateState,
});
```

---

## 4. WalletProvider Interface

### Old WalletProvider
```typescript
const walletProvider: WalletProvider = {
  coinPublicKey: coinPkBytes,

  async balanceTx(tx: UnprovenTransaction, newCoins: string[]): Promise<BalancedTransaction> {
    // ...
  },

  async finalizeTx(tx: BalancedTransaction): Promise<FinalizedTransaction> {
    // ...
  },
};
```

### New WalletProvider
```typescript
const walletProvider: WalletProvider = {
  getCoinPublicKey(): ledger.CoinPublicKey {
    return shieldedSecretKeys.coinPublicKey;
  },

  getEncryptionPublicKey(): ledger.EncPublicKey {
    return shieldedSecretKeys.encryptionPublicKey;
  },

  async balanceTx(tx: UnboundTransaction, ttl?: Date): Promise<ledger.FinalizedTransaction> {
    const txTtl = ttl ?? new Date(Date.now() + 30 * 60 * 1000);

    const recipe = await wallet.balanceUnboundTransaction(
      tx,
      { shieldedSecretKeys, dustSecretKey },
      { ttl: txTtl }
    );

    return await wallet.finalizeRecipe(recipe);
  },
};
```

---

## 5. Indexer API Version

### Update URLs from v1 to v3

**Old:**
```typescript
indexer = 'https://indexer.preview.midnight.network/api/v1/graphql';
indexerWS = 'wss://indexer.preview.midnight.network/api/v1/graphql/ws';
```

**New:**
```typescript
indexer = 'https://indexer.preview.midnight.network/api/v3/graphql';
indexerWS = 'wss://indexer.preview.midnight.network/api/v3/graphql/ws';
```

---

## 6. Network Configuration

### Adding Preprod Network Support

```typescript
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

export class PreviewConfig implements Config {
  logDir = 'logs/preview';
  indexer = 'https://indexer.preview.midnight.network/api/v3/graphql';
  indexerWS = 'wss://indexer.preview.midnight.network/api/v3/graphql/ws';
  node = 'wss://rpc.preview.midnight.network';
  proofServer = 'http://127.0.0.1:6300';
  networkId = 'preview';
}

export class PreprodConfig implements Config {
  logDir = 'logs/preprod';
  indexer = 'https://indexer.preprod.midnight.network/api/v3/graphql';
  indexerWS = 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws';
  node = 'wss://rpc.preprod.midnight.network';
  proofServer = 'http://127.0.0.1:6300';
  networkId = 'preprod';
}

export class StandaloneConfig implements Config {
  logDir = 'logs/standalone';
  indexer = 'http://127.0.0.1:8088/api/v3/graphql';
  indexerWS = 'ws://127.0.0.1:8088/api/v3/graphql/ws';
  node = 'http://127.0.0.1:9944';  // Use http:// for local, converted to ws:// in code
  proofServer = 'http://127.0.0.1:6300';
  networkId = 'undeployed';

  constructor() {
    setNetworkId('undeployed');
  }
}
```

### Important: Relay URL Protocol Conversion

The wallet SDK expects WebSocket URLs for the relay. Convert `http(s)://` to `ws(s)://`:

```typescript
const relayURL = new URL(config.node.replace(/^http/, 'ws'));
// http://localhost:9944 → ws://localhost:9944
// https://rpc.preprod.midnight.network → wss://rpc.preprod.midnight.network
```

---

## 7. Docker Standalone Configuration

### standalone.yml
```yaml
services:
  proof-server:
    container_name: 'myapp-proof-server'
    image: 'midnightntwrk/proof-server:7.0.0'
    command: ['midnight-proof-server -v']
    ports:
      - '6300'
    environment:
      RUST_BACKTRACE: 'full'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:6300/version']
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 10s

  indexer:
    container_name: 'myapp-indexer'
    image: 'midnightntwrk/indexer-standalone:3.0.0'  # Use versioned image
    env_file: standalone.env.example
    ports:
      - '0:8088'
    environment:
      RUST_LOG: 'indexer=info,chain_indexer=info,indexer_api=info,wallet_indexer=info,indexer_common=info,fastrace_opentelemetry=off,info'
      APP__APPLICATION__NETWORK_ID: 'undeployed'
    healthcheck:
      test: ['CMD-SHELL', 'cat /var/run/indexer-standalone/running']
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 10s
    depends_on:
      node:
        condition: service_healthy

  node:
    image: 'midnightntwrk/midnight-node:0.20.0'
    container_name: 'myapp-node'
    ports:
      - '9944'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9944/health']
      interval: 2s
      timeout: 5s
      retries: 20
      start_period: 20s
    environment:
      CFG_PRESET: 'dev'
      SIDECHAIN_BLOCK_BENEFICIARY: '04bcf7ad3be7a5c790460be82a713af570f22e0f801f6659ab8e84a52be6969e'
```

### standalone.env.example
```env
APP__INFRA__NODE__URL=ws://node:9944
APP__INFRA__STORAGE__PASSWORD=indexer
APP__INFRA__PUB_SUB__PASSWORD=indexer
APP__INFRA__LEDGER_STATE_STORAGE__PASSWORD=indexer
APP__INFRA__SECRET=303132333435363738393031323334353637383930313233343536373839303132
```

---

## 8. Common Issues and Solutions

### Issue: "Unknown field 'wallet' on type 'Subscription'"
**Cause:** Using old `@midnight-ntwrk/wallet` package with new indexer
**Solution:** Migrate to `@midnight-ntwrk/wallet-sdk-*` packages

### Issue: "Endpoint should start with 'ws://'"
**Cause:** Passing HTTP URL where WebSocket is expected
**Solution:** Convert node URL: `node.replace(/^http/, 'ws')`

### Issue: "expected HRP mn_addr_preview, but was mn_addr_preprod"
**Cause:** Network ID mismatch between wallet and indexer
**Solution:** Ensure `networkId` matches the indexer's network

### Issue: "Timed out trying to connect" to indexer
**Cause:** Using v1 API which redirects to v3
**Solution:** Update URLs to use `/api/v3/graphql`

### Issue: Container name mismatch in testcontainers
**Cause:** Wait strategy uses different names than docker-compose
**Solution:** Ensure container names match in both `standalone.yml` and `standalone.ts`

---

## 9. Version Compatibility Matrix

| Component | Version | Notes |
|-----------|---------|-------|
| midnight-js-* | 3.0.0 | Stable release |
| wallet-sdk-facade | 1.0.0 | New wallet SDK |
| wallet-sdk-hd | 3.0.0 | HD key derivation |
| ledger-v7 | 7.0.0 | Ledger types |
| compact-runtime | 0.14.0 | Contract runtime |
| compact-js | 2.4.0 | CompiledContract API |
| proof-server | 7.0.0 | Docker image |
| indexer-standalone | 3.0.0 | Docker image |
| midnight-node | 0.20.0 | Docker image |

---

## 10. Migration Checklist

- [ ] Update package.json with new dependencies
- [ ] Add resolutions for consistent versions
- [ ] Replace `@midnight-ntwrk/wallet` with `wallet-sdk-*` packages
- [ ] Update wallet initialization code
- [ ] Update contract deployment to use `CompiledContract`
- [ ] Change `contract` to `compiledContract` in deploy/find options
- [ ] Update WalletProvider interface
- [ ] Change indexer URLs from v1 to v3
- [ ] Add preprod network configuration
- [ ] Update standalone.yml with versioned images
- [ ] Create standalone.env.example
- [ ] Update testcontainers wait strategies
- [ ] Test on standalone mode
- [ ] Test on preview network
- [ ] Test on preprod network
