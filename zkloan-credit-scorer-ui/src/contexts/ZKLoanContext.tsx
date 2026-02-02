import React, { type PropsWithChildren, createContext, useState, useCallback, useMemo, useEffect } from 'react';
import { Buffer } from 'buffer';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import * as ledger from '@midnight-ntwrk/ledger-v7';
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
  type MidnightProvider,
  type WalletProvider,
  type ZKConfigProvider,
} from '@midnight-ntwrk/midnight-js-types';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { ZKLoanCreditScorer, witnesses, type ZKLoanCreditScorerPrivateState } from 'zkloan-credit-scorer-contract';

// Type for the ZKLoan contract
type ZKLoanCreditScorerContract = ZKLoanCreditScorer.Contract<ZKLoanCreditScorerPrivateState>;
import { saveLoanProfile } from '../utils/loanProfiles';

export type ZKLoanCircuitKeys = 'requestLoan' | 'changePin' | 'blacklistUser' | 'removeBlacklistUser' | 'transferAdmin' | 'respondToLoan';

// Re-export loan types for components
export type LoanStatus = 'Approved' | 'Rejected' | 'Proposed' | 'NotAccepted';

export type LoanApplication = {
  authorizedAmount: bigint;
  status: LoanStatus;
};

export type UserLoan = {
  loanId: bigint;
  authorizedAmount: bigint;
  status: LoanStatus;
};

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
  readonly currentProfileId: string;
  readonly setCurrentProfileId: (profileId: string) => void;
  readonly secretPin: string;
  readonly setSecretPin: (pin: string) => void;
  readonly deploy: () => void;
  readonly join: (contractAddress: ContractAddress) => void;
  readonly requestLoan: (amount: bigint) => Promise<void>;
  readonly respondToLoan: (loanId: bigint, accept: boolean) => Promise<void>;
  readonly refreshLoans: () => Promise<void>;
  readonly getMyLoans: () => Promise<UserLoan[]>;
  readonly lastLoanUpdate: number;
  readonly isConnected: boolean;
  readonly isConnecting: boolean;
  readonly walletAddress: string | null;
  readonly walletPublicKeyBytes: Uint8Array | null;
  readonly connect: () => Promise<void>;
  readonly flowMessage: string | undefined;
}

export const ZKLoanContext = createContext<ZKLoanAPIProvider | undefined>(undefined);

export type ZKLoanProviderProps = PropsWithChildren<{
  logger: Logger;
}>;

const NETWORK_ID = import.meta.env.VITE_NETWORK_ID || 'TestNet';

// Helper functions for hex conversion
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function hexToUint8Array(hex: string): Uint8Array {
  const cleaned = hex.replace(/^0x/, '');
  const matches = cleaned.match(/.{1,2}/g);
  if (!matches) return new Uint8Array();
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

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
  const [currentProfileId, setCurrentProfileId] = useState<string>('user-001');
  const [secretPin, setSecretPin] = useState<string>('1234');
  const [lastLoanUpdate, setLastLoanUpdate] = useState<number>(0);
  const [deploymentSubject] = useState(() => new BehaviorSubject<ZKLoanDeployment>({ status: 'idle' }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [contract, setContract] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletPublicKeyBytes, setWalletPublicKeyBytes] = useState<Uint8Array | null>(null);
  const [flowMessage, setFlowMessage] = useState<string | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [publicDataProviderRef, setPublicDataProviderRef] = useState<any>(null);
  const [contractAddressRef, setContractAddressRef] = useState<ContractAddress | null>(null);

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

  // Sync React privateState with the provider whenever it changes
  useEffect(() => {
    privateStateProvider.set('zkLoanCreditScorerPrivateState', privateState);
    logger.info({ privateState }, 'Private state synced to provider');
  }, [privateState, privateStateProvider, logger]);

  const initializeProviders = useCallback(async () => {
    const { wallet, config } = await connectToWallet();

    const addresses = await wallet.getShieldedAddresses();
    const zkConfigPath = window.location.origin;

    setIsConnected(true);
    setWalletAddress(addresses.shieldedAddress || null);

    // Store the coin public key bytes for later use in getMyLoans
    if (addresses.shieldedCoinPublicKey) {
      const coinPkBytes = typeof addresses.shieldedCoinPublicKey === 'string'
        ? new Uint8Array(Buffer.from(addresses.shieldedCoinPublicKey, 'hex'))
        : new Uint8Array(addresses.shieldedCoinPublicKey as ArrayBuffer);
      setWalletPublicKeyBytes(coinPkBytes);
    }

    logger.info({
      indexerUri: config.indexerUri,
      proverServerUri: config.proverServerUri,
    }, 'Service configuration');

    if (!config.proverServerUri) {
      throw new Error('Proof server URI not available from wallet configuration');
    }

    // ZK config provider - fetches prover/verifier keys
    const zkConfigProvider: ZKConfigProvider<ZKLoanCircuitKeys> = new FetchZkConfigProvider<ZKLoanCircuitKeys>(zkConfigPath, fetch.bind(window));

    // Proof provider - uses remote proof server
    const proofProvider = httpClientProofProvider(config.proverServerUri, zkConfigProvider);

    // Public data provider - indexer for blockchain queries
    const publicDataProvider = indexerPublicDataProvider(config.indexerUri, config.indexerWsUri);

    // Wallet provider using the stable API
    // For browser wallet, we need to use the wallet's balancing capabilities
    const coinPkBytes = typeof addresses.shieldedCoinPublicKey === 'string'
      ? new Uint8Array(Buffer.from(addresses.shieldedCoinPublicKey, 'hex'))
      : new Uint8Array(addresses.shieldedCoinPublicKey as ArrayBuffer);

    const walletProvider: WalletProvider = {
      getCoinPublicKey(): ledger.CoinPublicKey {
        // Return the coin public key from wallet addresses
        return coinPkBytes as unknown as ledger.CoinPublicKey;
      },

      getEncryptionPublicKey(): ledger.EncPublicKey {
        // Return encryption public key from wallet (derived from coin public key in browser context)
        return coinPkBytes as unknown as ledger.EncPublicKey;
      },

      async balanceTx(
        tx: ledger.Transaction<ledger.SignatureEnabled, ledger.Proof, ledger.PreBinding>,
        _ttl?: Date,
      ): Promise<ledger.FinalizedTransaction> {
        try {
          setFlowMessage('Signing the transaction with Midnight Lace wallet...');
          logger.info('Balancing proven (unsealed) transaction via wallet');

          // Serialize the proven but unsealed (unbound) transaction
          const serialized = tx.serialize();
          const serializedStr = uint8ArrayToHex(serialized);

          // Call wallet to balance the unsealed transaction
          // This takes Transaction<SignatureEnabled, Proof, PreBinding> and returns a balanced/finalized tx
          const result = await wallet.balanceUnsealedTransaction(serializedStr);

          // Deserialize the balanced and finalized transaction
          const resultBytes = hexToUint8Array(result.tx);
          const finalizedTx = ledger.Transaction.deserialize(
            'signature',
            'proof',
            'binding',
            resultBytes
          ) as ledger.FinalizedTransaction;

          setFlowMessage(undefined);

          return finalizedTx;
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

        const serialized = tx.serialize();
        const serializedStr = uint8ArrayToHex(serialized);
        await wallet.submitTransaction(serializedStr);

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

      // Store the public data provider for later ledger queries
      setPublicDataProviderRef(providers.publicDataProvider);

      setFlowMessage('Deploying ZKLoan Credit Scorer contract...');
      logger.info('Deploying ZKLoan Credit Scorer contract...');

      // Create compiled contract using the stable API pattern
      const zkConfigPath = window.location.origin;
      const zkLoanCompiledContract = CompiledContract.make<ZKLoanCreditScorerContract>(
        'ZKLoanCreditScorer',
        ZKLoanCreditScorer.Contract
      ).pipe(
        CompiledContract.withWitnesses(witnesses),
        CompiledContract.withCompiledFileAssets(zkConfigPath),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deployed = await deployContract(providers as any, {
        compiledContract: zkLoanCompiledContract,
        privateStateId: 'zkLoanCreditScorerPrivateState',
        initialPrivateState: privateState,
      });

      setContract(deployed);
      const deployedAddress = deployed.deployTxData.public.contractAddress;
      setContractAddressRef(deployedAddress);
      setFlowMessage(undefined);
      logger.info(`Deployed contract at address: ${deployedAddress}`);

      deploymentSubject.next({
        status: 'deployed',
        contractAddress: deployedAddress,
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

      // Store the public data provider for later ledger queries
      setPublicDataProviderRef(providers.publicDataProvider);

      setFlowMessage('Joining contract...');
      logger.info({ contractAddress }, 'Joining contract...');

      // Create compiled contract using the stable API pattern
      const zkConfigPath = window.location.origin;
      const zkLoanCompiledContract = CompiledContract.make<ZKLoanCreditScorerContract>(
        'ZKLoanCreditScorer',
        ZKLoanCreditScorer.Contract
      ).pipe(
        CompiledContract.withWitnesses(witnesses),
        CompiledContract.withCompiledFileAssets(zkConfigPath),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const joined = await findDeployedContract(providers as any, {
        contractAddress,
        compiledContract: zkLoanCompiledContract,
        privateStateId: 'zkLoanCreditScorerPrivateState',
        initialPrivateState: privateState,
      });

      logger.info({ joined: !!joined }, 'findDeployedContract returned');
      setContract(joined);
      setFlowMessage(undefined);

      const resolvedAddress = joined?.deployTxData?.public?.contractAddress ?? contractAddress;
      setContractAddressRef(resolvedAddress);

      deploymentSubject.next({
        status: 'deployed',
        contractAddress: resolvedAddress,
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

  const requestLoanTx = useCallback(async (amount: bigint) => {
    if (!contract) {
      throw new Error('Contract not deployed. Please deploy or join a contract first.');
    }

    const pinNum = parseInt(secretPin, 10);
    if (isNaN(pinNum)) {
      throw new Error('Invalid PIN');
    }
    const pin = BigInt(pinNum);

    setFlowMessage('Requesting loan...');
    logger.info(`Requesting loan for amount: ${amount} with PIN...`);

    const finalizedTxData = await contract.callTx.requestLoan(amount, pin);

    setFlowMessage(undefined);
    logger.info(`Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);

    // After successful loan request, save the profile mapping
    // We need to find the newly created loan ID by querying the contract state
    if (publicDataProviderRef && contractAddressRef && walletPublicKeyBytes) {
      try {
        const contractState = await publicDataProviderRef.queryContractState(contractAddressRef);
        if (contractState) {
          const ledgerState = ZKLoanCreditScorer.ledger(contractState.data);
          const userPublicKey = ZKLoanCreditScorer.pureCircuits.publicKey(walletPublicKeyBytes, pin);

          if (ledgerState.loans.member(userPublicKey)) {
            const userLoansMap = ledgerState.loans.lookup(userPublicKey);
            let maxLoanId = 0n;
            for (const [loanId] of userLoansMap) {
              if (loanId > maxLoanId) {
                maxLoanId = loanId;
              }
            }
            // Save the profile used for this loan
            saveLoanProfile(contractAddressRef, maxLoanId.toString(), currentProfileId);
            logger.info({ loanId: maxLoanId.toString(), profileId: currentProfileId }, 'Saved loan profile mapping');
          }
        }
      } catch (error) {
        logger.warn({ error }, 'Failed to save loan profile mapping (non-critical)');
      }
    }

    // Signal that loans have been updated so UI can refresh
    setLastLoanUpdate(Date.now());
  }, [contract, logger, publicDataProviderRef, contractAddressRef, walletPublicKeyBytes, currentProfileId, secretPin]);

  const respondToLoanTx = useCallback(async (loanId: bigint, accept: boolean) => {
    if (!contract) {
      throw new Error('Contract not deployed. Please deploy or join a contract first.');
    }

    const pinNum = parseInt(secretPin, 10);
    if (isNaN(pinNum)) {
      throw new Error('Invalid PIN');
    }
    const pin = BigInt(pinNum);

    setFlowMessage(accept ? 'Accepting loan proposal...' : 'Declining loan proposal...');
    logger.info(`Responding to loan ${loanId}: ${accept ? 'accept' : 'decline'}`);

    const finalizedTxData = await contract.callTx.respondToLoan(loanId, pin, accept);

    setFlowMessage(undefined);
    logger.info(`Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);

    // Signal that loans have been updated so UI can refresh
    setLastLoanUpdate(Date.now());
  }, [contract, logger, secretPin]);

  const getMyLoans = useCallback(async (): Promise<UserLoan[]> => {
    if (!publicDataProviderRef || !contractAddressRef || !walletPublicKeyBytes) {
      logger.warn('Cannot get loans: missing provider, contract address, or wallet public key');
      return [];
    }

    const pinNum = parseInt(secretPin, 10);
    if (isNaN(pinNum)) {
      throw new Error('Invalid PIN');
    }
    const pin = BigInt(pinNum);

    try {
      setFlowMessage('Fetching your loans...');
      logger.info('Querying contract state for loans...');

      // Query the contract state from the indexer
      const contractState = await publicDataProviderRef.queryContractState(contractAddressRef);
      if (!contractState) {
        logger.warn('No contract state found');
        setFlowMessage(undefined);
        return [];
      }

      // Parse the ledger state
      const ledgerState = ZKLoanCreditScorer.ledger(contractState.data);

      // Derive the user's public key from their wallet public key and PIN
      const userPublicKey = ZKLoanCreditScorer.pureCircuits.publicKey(walletPublicKeyBytes, pin);
      logger.info({ userPublicKeyHex: Buffer.from(userPublicKey).toString('hex').slice(0, 20) + '...' }, 'Derived user public key');

      // Check if the user has any loans
      if (!ledgerState.loans.member(userPublicKey)) {
        logger.info('No loans found for this user');
        setFlowMessage(undefined);
        return [];
      }

      // Get the user's loans map and iterate over it
      const userLoansMap = ledgerState.loans.lookup(userPublicKey);
      const loans: UserLoan[] = [];

      // Map loan status enum to string
      const mapLoanStatus = (status: number): LoanStatus => {
        switch (status) {
          case ZKLoanCreditScorer.LoanStatus.Approved:
            return 'Approved';
          case ZKLoanCreditScorer.LoanStatus.Rejected:
            return 'Rejected';
          case ZKLoanCreditScorer.LoanStatus.Proposed:
            return 'Proposed';
          case ZKLoanCreditScorer.LoanStatus.NotAccepted:
            return 'NotAccepted';
          default:
            return 'Rejected';
        }
      };

      // Use the iterator to get all loans
      for (const [loanId, loanApplication] of userLoansMap) {
        loans.push({
          loanId,
          authorizedAmount: loanApplication.authorizedAmount,
          status: mapLoanStatus(loanApplication.status),
        });
      }

      logger.info({ loanCount: loans.length }, 'Found loans for user');
      setFlowMessage(undefined);
      return loans;
    } catch (error) {
      setFlowMessage(undefined);
      logger.error({ error }, 'Failed to get loans');
      throw error;
    }
  }, [publicDataProviderRef, contractAddressRef, walletPublicKeyBytes, logger, secretPin]);

  const refreshLoans = useCallback(async () => {
    // Trigger a refresh by updating lastLoanUpdate
    setLastLoanUpdate(Date.now());
  }, []);

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
    currentProfileId,
    setCurrentProfileId,
    secretPin,
    setSecretPin,
    deploy: deployNewContract,
    join: joinExistingContract,
    requestLoan: requestLoanTx,
    respondToLoan: respondToLoanTx,
    refreshLoans,
    getMyLoans,
    lastLoanUpdate,
    isConnected,
    isConnecting,
    walletAddress,
    walletPublicKeyBytes,
    connect,
    flowMessage,
  };

  return <ZKLoanContext.Provider value={apiProvider}>{children}</ZKLoanContext.Provider>;
};
