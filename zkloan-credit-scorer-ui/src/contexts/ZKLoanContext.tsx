import React, { type PropsWithChildren, createContext, useState, useCallback, useMemo } from 'react';
import { type ContractAddress, fromHex, toHex } from '@midnight-ntwrk/compact-runtime';
import * as ledger from '@midnight-ntwrk/ledger-v6';
import {
  BehaviorSubject,
  type Observable,
  concatMap,
  filter,
  firstValueFrom,
  interval,
  map,
  take,
  tap,
  throwError,
  timeout,
  catchError,
} from 'rxjs';
import { type Logger } from 'pino';
import {
  type InitialAPI,
  type ConnectedAPI,
  type Configuration,
} from '@midnight-ntwrk/dapp-connector-api';
import {
  type BalancedProvingRecipe,
  type MidnightProvider,
  type WalletProvider,
} from '@midnight-ntwrk/midnight-js-types';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { ZKLoanCreditScorer, witnesses, type ZKLoanCreditScorerPrivateState } from 'zkloan-credit-scorer-contract';

export type ZKLoanCircuitKeys = 'requestLoan' | 'changePin' | 'blacklistUser' | 'removeBlacklistUser' | 'transferAdmin';

export interface IdleDeployment {
  readonly status: 'idle';
}

export interface InProgressDeployment {
  readonly status: 'in-progress';
}

export interface DeployedZKLoan {
  readonly status: 'deployed';
  readonly contractAddress: ContractAddress;
}

export interface FailedDeployment {
  readonly status: 'failed';
  readonly error: Error;
}

export type ZKLoanDeployment = IdleDeployment | InProgressDeployment | DeployedZKLoan | FailedDeployment;

export interface ZKLoanAPIProvider {
  readonly deployment$: Observable<ZKLoanDeployment>;
  readonly privateState: ZKLoanCreditScorerPrivateState;
  readonly setPrivateState: (state: ZKLoanCreditScorerPrivateState) => void;
  readonly deploy: () => void;
  readonly join: (contractAddress: ContractAddress) => void;
  readonly requestLoan: (amount: bigint, pin: bigint) => Promise<void>;
  readonly isConnected: boolean;
  readonly isConnecting: boolean;
  readonly walletAddress: string | null;
  readonly connect: () => Promise<void>;
  readonly flowMessage: string | undefined;
}

export const ZKLoanContext = createContext<ZKLoanAPIProvider | undefined>(undefined);

export type ZKLoanProviderProps = PropsWithChildren<{
  logger: Logger;
}>;

const NETWORK_ID = import.meta.env.VITE_NETWORK_ID || 'TestNet';

// In-memory private state provider (simpler than level for browser)
function inMemoryPrivateStateProvider<K extends string, V>() {
  const states = new Map<K, V>();
  const signingKeys: Record<string, unknown> = {};

  return {
    async get(key: K): Promise<V | null> {
      return states.get(key) ?? null;
    },
    async set(key: K, value: V): Promise<void> {
      states.set(key, value);
    },
    async remove(key: K): Promise<void> {
      states.delete(key);
    },
    async clear(): Promise<void> {
      states.clear();
    },
    async setSigningKey(contractAddress: string, signingKey: unknown): Promise<void> {
      signingKeys[contractAddress] = signingKey;
    },
    async getSigningKey(contractAddress: string): Promise<unknown | null> {
      return signingKeys[contractAddress] ?? null;
    },
    async removeSigningKey(contractAddress: string): Promise<void> {
      delete signingKeys[contractAddress];
    },
    async clearSigningKeys(): Promise<void> {
      Object.keys(signingKeys).forEach((key) => {
        delete signingKeys[key];
      });
    },
  };
}

export const ZKLoanProvider: React.FC<Readonly<ZKLoanProviderProps>> = ({ logger, children }) => {
  const [privateState, setPrivateState] = useState<ZKLoanCreditScorerPrivateState>({
    creditScore: 720n,
    monthlyIncome: 2500n,
    monthsAsCustomer: 24n,
  });
  const [deploymentSubject] = useState(() => new BehaviorSubject<ZKLoanDeployment>({ status: 'idle' }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [contract, setContract] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [flowMessage, setFlowMessage] = useState<string | undefined>(undefined);

  const connectToWallet = useCallback(async (): Promise<{ wallet: ConnectedAPI; config: Configuration }> => {
    const result = await firstValueFrom(
      interval(100).pipe(
        map(() => {
          // In v4.x, wallets are under window.midnight[key] where key is a UUID
          const midnight = (window as unknown as { midnight?: Record<string, InitialAPI> }).midnight;
          if (!midnight) return undefined;
          // Try mnLace first, then any other wallet
          return midnight.mnLace || Object.values(midnight)[0];
        }),
        tap((initialAPI) => {
          logger.trace(initialAPI, 'Check for wallet connector API');
        }),
        filter((initialAPI): initialAPI is InitialAPI => !!initialAPI),
        tap((initialAPI) => {
          logger.info({ name: initialAPI.name, version: initialAPI.apiVersion }, 'Compatible wallet connector API found. Connecting.');
        }),
        take(1),
        timeout({
          first: 5_000,
          with: () =>
            throwError(() => {
              logger.error('Could not find wallet connector API');
              return new Error('Could not find Midnight Lace wallet. Is the extension installed?');
            }),
        }),
        concatMap(async (initialAPI) => {
          logger.info({ networkId: NETWORK_ID }, 'Attempting to connect with network ID');
          const connectedAPI = await initialAPI.connect(NETWORK_ID);
          return connectedAPI;
        }),
        catchError((error) => {
          logger.error({ error, requestedNetwork: NETWORK_ID }, 'Unable to connect to wallet');
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('Network ID mismatch')) {
            return throwError(() => new Error(`Network mismatch: dApp requests "${NETWORK_ID}" but wallet is on different network.`));
          }
          return throwError(() => new Error('Application is not authorized. Please approve in Lace wallet.'));
        }),
        concatMap(async (connectedAPI) => {
          const config = await connectedAPI.getConfiguration();
          const status = await connectedAPI.getConnectionStatus();

          // Set network ID globally
          if (status.status === 'connected') {
            setNetworkId(status.networkId);
          }

          logger.info({ config }, 'Connected to wallet connector API');
          return { wallet: connectedAPI, config };
        }),
      ),
    );
    return result as { wallet: ConnectedAPI; config: Configuration };
  }, [logger]);

  const privateStateProvider = useMemo(
    () => inMemoryPrivateStateProvider<string, ZKLoanCreditScorerPrivateState>(),
    []
  );

  const initializeProviders = useCallback(async () => {
    const { wallet, config } = await connectToWallet();

    const addresses = await wallet.getShieldedAddresses();
    const zkConfigPath = window.location.origin;

    setIsConnected(true);
    setWalletAddress(addresses.shieldedAddress || null);

    logger.info({
      indexerUri: config.indexerUri,
      proverServerUri: config.proverServerUri,
    }, 'Service configuration');

    if (!config.proverServerUri) {
      throw new Error('Proof server URI not available from wallet configuration');
    }

    // ZK config provider - fetches prover/verifier keys
    const zkConfigProvider = new FetchZkConfigProvider<ZKLoanCircuitKeys>(zkConfigPath, fetch.bind(window));

    // Proof provider - uses remote proof server (this is the key difference!)
    const proofProvider = httpClientProofProvider<ZKLoanCircuitKeys>(config.proverServerUri);

    // Public data provider - indexer for blockchain queries
    const publicDataProvider = indexerPublicDataProvider(config.indexerUri, config.indexerWsUri);

    // Wallet provider - handles transaction balancing via Lace wallet
    const walletProvider: WalletProvider = {
      getCoinPublicKey(): ledger.CoinPublicKey {
        return addresses.shieldedCoinPublicKey as unknown as ledger.CoinPublicKey;
      },
      getEncryptionPublicKey(): ledger.EncPublicKey {
        return addresses.shieldedEncryptionPublicKey as unknown as ledger.EncPublicKey;
      },
      async balanceTx(
        tx: ledger.UnprovenTransaction,
        _newCoins?: unknown[],
        _ttl?: Date
      ): Promise<BalancedProvingRecipe> {
        try {
          setFlowMessage('Signing the transaction with Midnight Lace wallet...');
          logger.info('Balancing transaction via wallet');

          // Serialize the unproven transaction
          const serializedTx = toHex(tx.serialize());

          // Call wallet to balance the unsealed transaction
          const received = await wallet.balanceUnsealedTransaction(serializedTx);

          // Deserialize the balanced transaction
          const transaction = ledger.Transaction.deserialize<
            ledger.SignatureEnabled,
            ledger.PreProof,
            ledger.PreBinding
          >(
            'signature',
            'pre-proof',
            'pre-binding',
            fromHex(received.tx)
          );

          setFlowMessage(undefined);

          // Return as TransactionToProve - will be proven by proofProvider
          return {
            type: 'TransactionToProve',
            transaction: transaction,
          };
        } catch (e) {
          setFlowMessage(undefined);
          logger.error({ error: e }, 'Error balancing transaction via wallet');
          throw e;
        }
      },
    };

    // Midnight provider - handles transaction submission
    const midnightProvider: MidnightProvider = {
      async submitTx(tx: ledger.FinalizedTransaction): Promise<ledger.TransactionId> {
        setFlowMessage('Submitting transaction...');
        logger.info('Submitting transaction via wallet');

        await wallet.submitTransaction(toHex(tx.serialize()));

        const txIdentifiers = tx.identifiers();
        const txId = txIdentifiers[0];

        setFlowMessage(undefined);
        logger.info({ txId }, 'Transaction submitted successfully');
        return txId;
      },
    };

    return {
      privateStateProvider,
      zkConfigProvider,
      proofProvider,
      publicDataProvider,
      walletProvider,
      midnightProvider,
    };
  }, [connectToWallet, logger, privateStateProvider]);

  const deployNewContract = useCallback(async () => {
    try {
      deploymentSubject.next({ status: 'in-progress' });
      setFlowMessage('Initializing providers...');

      const providers = await initializeProviders();

      setFlowMessage('Deploying ZKLoan Credit Scorer contract...');
      logger.info('Deploying ZKLoan Credit Scorer contract...');

      const zkLoanContract = new ZKLoanCreditScorer.Contract(witnesses);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deployed = await deployContract(providers as any, {
        contract: zkLoanContract,
        privateStateId: 'zkLoanCreditScorerPrivateState',
        initialPrivateState: privateState,
      });

      setContract(deployed);
      setFlowMessage(undefined);
      logger.info(`Deployed contract at address: ${deployed.deployTxData.public.contractAddress}`);

      deploymentSubject.next({
        status: 'deployed',
        contractAddress: deployed.deployTxData.public.contractAddress,
      });
    } catch (error) {
      setFlowMessage(undefined);
      logger.error(error, 'Failed to deploy contract');
      deploymentSubject.next({
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, [initializeProviders, logger, privateState, deploymentSubject]);

  const joinExistingContract = useCallback(async (contractAddress: ContractAddress) => {
    try {
      deploymentSubject.next({ status: 'in-progress' });
      setFlowMessage('Initializing providers...');

      logger.info('Initializing providers for join...');
      const providers = await initializeProviders();
      logger.info('Providers initialized successfully');

      setFlowMessage('Joining contract...');
      logger.info({ contractAddress }, 'Joining contract...');

      const zkLoanContract = new ZKLoanCreditScorer.Contract(witnesses);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const joined = await findDeployedContract(providers as any, {
        contractAddress,
        contract: zkLoanContract,
        privateStateId: 'zkLoanCreditScorerPrivateState',
        initialPrivateState: privateState,
      });

      logger.info({ joined: !!joined }, 'findDeployedContract returned');
      setContract(joined);
      setFlowMessage(undefined);

      const resolvedAddress = joined?.deployTxData?.public?.contractAddress;

      deploymentSubject.next({
        status: 'deployed',
        contractAddress: resolvedAddress ?? contractAddress,
      });
    } catch (error) {
      setFlowMessage(undefined);
      logger.error({ error, message: error instanceof Error ? error.message : String(error) }, 'Failed to join contract');
      deploymentSubject.next({
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, [initializeProviders, logger, privateState, deploymentSubject]);

  const requestLoanTx = useCallback(async (amount: bigint, pin: bigint) => {
    if (!contract) {
      throw new Error('Contract not deployed. Please deploy or join a contract first.');
    }

    setFlowMessage('Requesting loan...');
    logger.info(`Requesting loan for amount: ${amount} with PIN...`);

    const finalizedTxData = await contract.callTx.requestLoan(amount, pin);

    setFlowMessage(undefined);
    logger.info(`Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);
  }, [contract, logger]);

  const connect = useCallback(async () => {
    if (isConnecting || isConnected) {
      logger.info('Already connecting or connected');
      return;
    }

    setIsConnecting(true);
    try {
      const { wallet } = await connectToWallet();
      const addresses = await wallet.getShieldedAddresses();

      setIsConnected(true);
      setWalletAddress(addresses.shieldedAddress || null);
      logger.info('Successfully connected to wallet');
    } catch (error) {
      logger.error(error, 'Failed to connect to wallet');
      setIsConnected(false);
      setWalletAddress(null);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, isConnected, connectToWallet, logger]);

  const apiProvider: ZKLoanAPIProvider = {
    deployment$: deploymentSubject.asObservable(),
    privateState,
    setPrivateState,
    deploy: deployNewContract,
    join: joinExistingContract,
    requestLoan: requestLoanTx,
    isConnected,
    isConnecting,
    walletAddress,
    connect,
    flowMessage,
  };

  return <ZKLoanContext.Provider value={apiProvider}>{children}</ZKLoanContext.Provider>;
};
