import React, { type PropsWithChildren, createContext, useState, useCallback } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import {
  BehaviorSubject,
  type Observable,
  concatMap,
  filter,
  firstValueFrom,
  interval,
  map,
  of,
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
  type ProvingProvider,
} from '@midnight-ntwrk/dapp-connector-api';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { type BalancedProvingRecipe } from '@midnight-ntwrk/midnight-js-types';
import { CostModel } from '@midnight-ntwrk/ledger-v6';
import semver from 'semver';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { ZKLoanCreditScorer, witnesses, type ZKLoanCreditScorerPrivateState } from 'zkloan-credit-scorer-contract';

/**
 * IMPORTANT: This dApp uses Lace wallet's proving provider for all ZK proofs.
 * DO NOT use httpClientProofProvider or local proof servers - they produce
 * incompatible transaction formats (pedersen-schnorr binding instead of embedded-fr).
 * The wallet's getProvingProvider() must be used for v4.x dapp-connector-api compatibility.
 */

// Helper function to convert Uint8Array to hex string
const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

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
}

export const ZKLoanContext = createContext<ZKLoanAPIProvider | undefined>(undefined);

export type ZKLoanProviderProps = PropsWithChildren<{
  logger: Logger;
}>;

const COMPATIBLE_CONNECTOR_API_VERSION = '4.x';
const NETWORK_ID = import.meta.env.VITE_NETWORK_ID || 'TestNet';
const STORAGE_PASSWORD = import.meta.env.VITE_STORAGE_PASSWORD || 'zkloan-credit-scorer-ui-default-password';

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

  const connectToWallet = useCallback(async (): Promise<{ wallet: ConnectedAPI; config: Configuration }> => {
    const result = await firstValueFrom(
      interval(100).pipe(
        map(() => {
          // In v4.x, wallets are under window.midnight[key] where key is a UUID
          // Find the first available wallet (usually mnLace)
          const midnight = (window as unknown as { midnight?: Record<string, InitialAPI> }).midnight;
          if (!midnight) return undefined;
          // Try mnLace first, then any other wallet
          return midnight.mnLace || Object.values(midnight)[0];
        }),
        tap((initialAPI) => {
          logger.trace(initialAPI, 'Check for wallet connector API');
        }),
        filter((initialAPI): initialAPI is InitialAPI => !!initialAPI),
        concatMap((initialAPI) =>
          semver.satisfies(initialAPI.apiVersion, COMPATIBLE_CONNECTOR_API_VERSION)
            ? of(initialAPI)
            : throwError(() => {
                logger.error(
                  { expected: COMPATIBLE_CONNECTOR_API_VERSION, actual: initialAPI.apiVersion },
                  'Incompatible version of wallet connector API',
                );
                return new Error(
                  `Incompatible Lace wallet version. Require '${COMPATIBLE_CONNECTOR_API_VERSION}', got '${initialAPI.apiVersion}'.`,
                );
              }),
        ),
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
          // New v4.x API: connect with network ID
          logger.info({ networkId: NETWORK_ID }, 'Attempting to connect with network ID');
          const connectedAPI = await initialAPI.connect(NETWORK_ID);
          return connectedAPI;
        }),
        catchError((error) => {
          logger.error({ error, requestedNetwork: NETWORK_ID }, 'Unable to connect to wallet');
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('Network ID mismatch')) {
            return throwError(() => new Error(`Network mismatch: dApp requests "${NETWORK_ID}" but wallet is on different network. Change wallet network to "${NETWORK_ID}" in Lace settings.`));
          }
          return throwError(() => new Error('Application is not authorized. Please approve in Lace wallet.'));
        }),
        concatMap(async (connectedAPI) => {
          // Get configuration (replaces serviceUriConfig)
          const config = await connectedAPI.getConfiguration();
          logger.info({ config }, 'Connected to wallet connector API and retrieved service configuration');
          return { wallet: connectedAPI, config };
        }),
      ),
    );
    return result as { wallet: ConnectedAPI; config: Configuration };
  }, [logger]);

  const initializeProviders = useCallback(async () => {
    const { wallet: connectedWallet, config } = await connectToWallet();

    // Get wallet addresses (replaces state())
    const addresses = await connectedWallet.getShieldedAddresses();
    const zkConfigPath = window.location.origin;

    setIsConnected(true);
    setWalletAddress(addresses.shieldedAddress || null);

    logger.info(`Connected to wallet with network ID: ${getNetworkId()}`);
    logger.info({
      availableMethods: Object.keys(connectedWallet).filter(k => typeof (connectedWallet as Record<string, unknown>)[k] === 'function'),
      hasGetProvingProvider: typeof connectedWallet.getProvingProvider === 'function',
      config
    }, 'Wallet connection details');

    // Get proving provider from wallet
    const zkConfigProvider = new FetchZkConfigProvider<ZKLoanCircuitKeys>(zkConfigPath, fetch.bind(window));

    // Try to get the wallet's proving provider first (preferred for v4.x compatibility)
    // Fall back to httpClientProofProvider if not available
    let proofProvider;

    if (typeof connectedWallet.getProvingProvider === 'function') {
      logger.info('Getting proving provider from wallet...');
      const walletProvingProvider: ProvingProvider = await connectedWallet.getProvingProvider({
        getZKIR: async (loc) => {
          const res = await fetch(`${zkConfigPath}/zkir/${loc}.zkir`);
          return new Uint8Array(await res.arrayBuffer());
        },
        getProverKey: async (loc) => {
          const res = await fetch(`${zkConfigPath}/keys/${loc}.prover`);
          return new Uint8Array(await res.arrayBuffer());
        },
        getVerifierKey: async (loc) => {
          const res = await fetch(`${zkConfigPath}/keys/${loc}.verifier`);
          return new Uint8Array(await res.arrayBuffer());
        },
      });
      logger.info('Got proving provider from wallet');

      // Create a MidnightJS-compatible ProofProvider that wraps the wallet's ProvingProvider
      proofProvider = {
        async proveTx(unprovenTx: unknown): Promise<unknown> {
          logger.info('Proving transaction using wallet proving provider...');
          const costModel = CostModel.initialCostModel();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const provenTx = await (unprovenTx as any).prove(walletProvingProvider, costModel);
          logger.info('Transaction proven successfully');
          return provenTx;
        }
      };
    } else if (config.proverServerUri) {
      // Fallback to httpClientProofProvider using wallet's configured prover server
      logger.info({ proverServerUri: config.proverServerUri }, 'Wallet does not have getProvingProvider, using httpClientProofProvider with wallet prover URI');
      const { httpClientProofProvider } = await import('@midnight-ntwrk/midnight-js-http-client-proof-provider');
      proofProvider = httpClientProofProvider(config.proverServerUri);
    } else {
      throw new Error('Wallet does not support getProvingProvider and no proverServerUri configured');
    }

    return {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: 'zkloan-credit-scorer-private-state',
        privateStoragePasswordProvider: () => STORAGE_PASSWORD,
      }),
      zkConfigProvider,
      proofProvider,
      publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
      walletProvider: {
        coinPublicKey: addresses.shieldedCoinPublicKey,
        encryptionPublicKey: addresses.shieldedEncryptionPublicKey,
        getCoinPublicKey: () => addresses.shieldedCoinPublicKey,
        getEncryptionPublicKey: () => addresses.shieldedEncryptionPublicKey,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async balanceTx(tx: any, _newCoins?: any[], _ttl?: Date): Promise<BalancedProvingRecipe> {
          // v4.x workflow: prove → balance → submit
          // MidnightJS workflow: balance → prove → bind → submit
          //
          // To make this work, we need to:
          // 1. Prove the transaction here (before MidnightJS does it)
          // 2. Balance it with the wallet (while still in PreBinding format)
          // 3. Return the balanced tx as NothingToProve
          // 4. MidnightJS will call .bind() but it's already bound, so no-op

          try {
            logger.info('Proving transaction...');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const provenTx = await proofProvider.proveTx(tx) as any;

            // Erase signatures - balanceUnsealedTransaction expects SignatureErased
            // httpClientProofProvider returns SignatureEnabled, so we need to convert
            const unsignedTx = provenTx.eraseSignatures;

            // Serialize the proven, unsigned transaction
            const serializedBytes = unsignedTx.serialize() as Uint8Array;
            const headerPreview = new TextDecoder().decode(serializedBytes.slice(0, 120));
            logger.info({ headerPreview }, 'Transaction proven and signatures erased, balancing with wallet...');

            const serializedTx = toHex(serializedBytes);

            // Balance with wallet - tx is now SignatureErased + PreBinding (embedded-fr)
            const balanced = await connectedWallet.balanceUnsealedTransaction(serializedTx);
            logger.info('Transaction balanced by wallet!');

            // Deserialize the balanced transaction (now fully bound and ready)
            const { Transaction } = await import('@midnight-ntwrk/ledger-v6');
            const balancedBytes = new Uint8Array(balanced.tx.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));
            const balancedTx = Transaction.deserialize('signature', 'proof', 'binding', balancedBytes);

            // Return as NothingToProve - MidnightJS will skip proving
            // When it calls .bind(), it's already bound so should be no-op
            return {
              type: 'NothingToProve',
              transaction: balancedTx,
            } as unknown as BalancedProvingRecipe;
          } catch (error) {
            logger.error({ error }, 'Failed to prove and balance transaction');
            throw error;
          }
        },
      },
      midnightProvider: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async submitTx(tx: any): Promise<any> {
          // Transaction should already be balanced by the wallet in balanceTx
          const serializedBytes = tx.serialize();
          const headerPreview = new TextDecoder().decode(serializedBytes.slice(0, 120));
          const serializedTx = toHex(serializedBytes);

          logger.info({ headerPreview }, 'Submitting transaction...');

          // Submit directly - tx should already be balanced
          try {
            await connectedWallet.submitTransaction(serializedTx);
            logger.info('Transaction submitted successfully!');
            return tx;
          } catch (submitError) {
            logger.error({ error: submitError, headerPreview }, 'Direct submission failed');
            throw submitError;
          }
        },
      },
    };
  }, [connectToWallet, logger]);

  const deployNewContract = useCallback(async () => {
    try {
      deploymentSubject.next({ status: 'in-progress' });

      const providers = await initializeProviders();

      logger.info('Deploying ZKLoan Credit Scorer contract...');
      const zkLoanContract = new ZKLoanCreditScorer.Contract(witnesses);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deployed = await deployContract(providers as any, {
        contract: zkLoanContract,
        privateStateId: 'zkLoanCreditScorerPrivateState',
        initialPrivateState: privateState,
      });

      setContract(deployed);
      logger.info(`Deployed contract at address: ${deployed.deployTxData.public.contractAddress}`);

      deploymentSubject.next({
        status: 'deployed',
        contractAddress: deployed.deployTxData.public.contractAddress,
      });
    } catch (error) {
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

      const providers = await initializeProviders();

      logger.info(`Joining contract at address: ${contractAddress}`);
      const zkLoanContract = new ZKLoanCreditScorer.Contract(witnesses);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const joined = await findDeployedContract(providers as any, {
        contractAddress,
        contract: zkLoanContract,
        privateStateId: 'zkLoanCreditScorerPrivateState',
        initialPrivateState: privateState,
      });

      setContract(joined);
      logger.info(`Joined contract at address: ${joined.deployTxData.public.contractAddress}`);

      deploymentSubject.next({
        status: 'deployed',
        contractAddress: joined.deployTxData.public.contractAddress,
      });
    } catch (error) {
      logger.error(error, 'Failed to join contract');
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

    logger.info(`Requesting loan for amount: ${amount} with PIN...`);
    const finalizedTxData = await contract.callTx.requestLoan(amount, pin);
    logger.info(`Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);
  }, [contract, logger]);

  const connect = useCallback(async () => {
    if (isConnecting || isConnected) {
      logger.info('Already connecting or connected');
      return;
    }

    setIsConnecting(true);
    try {
      const { wallet: connectedWallet } = await connectToWallet();
      const addresses = await connectedWallet.getShieldedAddresses();

      setIsConnected(true);
      setWalletAddress(addresses.shieldedAddress || null);
      logger.info('Successfully reconnected to wallet');
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
  };

  return <ZKLoanContext.Provider value={apiProvider}>{children}</ZKLoanContext.Provider>;
};
