import {
  assertDefined,
  assertIsContractAddress,
  assertUndefined,
  fromHex,
  parseCoinPublicKeyToHex,
  parseEncPublicKeyToHex,
  toHex,
  ttlOneHour
} from "./chunk-MJS24RSX.js";
import "./chunk-NTLGP5MK.js";
import {
  getNetworkId
} from "./chunk-QU7K2XTK.js";
import {
  ContractState as ContractState2,
  CostModel,
  QueryContext as QueryContext2,
  decodeZswapLocalState,
  emptyZswapLocalState,
  sampleSigningKey,
  signatureVerifyingKey
} from "./chunk-U3SMOY2T.js";
import {
  BALANCE_TRANSACTION_TO_PROVE,
  NOTHING_TO_PROVE,
  SucceedEntirely,
  TRANSACTION_TO_PROVE,
  getImpureCircuitIds
} from "./chunk-J7ZCMGN6.js";
import {
  ChargedState,
  ContractCallPrototype,
  ContractDeploy,
  ContractMaintenanceAuthority,
  ContractOperationVersion,
  ContractOperationVersionedVerifierKey,
  ContractState,
  Intent,
  LedgerParameters,
  MaintenanceUpdate,
  PreTranscript,
  QueryContext,
  ReplaceAuthority,
  StateValue,
  Transaction,
  VerifierKeyInsert,
  VerifierKeyRemove,
  ZswapInput,
  ZswapOffer,
  ZswapOutput,
  ZswapTransient,
  communicationCommitmentRandomness,
  partitionTranscripts,
  signData
} from "./chunk-OLWGKVHT.js";
import {
  __commonJS,
  __toESM
} from "./chunk-V4OQ3NZ2.js";

// browser-external:fs
var require_fs = __commonJS({
  "browser-external:fs"(exports, module) {
    module.exports = Object.create(new Proxy({}, {
      get(_, key) {
        if (key !== "__esModule" && key !== "__proto__" && key !== "constructor" && key !== "splice") {
          console.warn(`Module "fs" has been externalized for browser compatibility. Cannot access "fs.${key}" in client code. See https://vite.dev/guide/troubleshooting.html#module-externalized-for-browser-compatibility for more details.`);
        }
      }
    }));
  }
});

// browser-external:path
var require_path = __commonJS({
  "browser-external:path"(exports, module) {
    module.exports = Object.create(new Proxy({}, {
      get(_, key) {
        if (key !== "__esModule" && key !== "__proto__" && key !== "constructor" && key !== "splice") {
          console.warn(`Module "path" has been externalized for browser compatibility. Cannot access "path.${key}" in client code. See https://vite.dev/guide/troubleshooting.html#module-externalized-for-browser-compatibility for more details.`);
        }
      }
    }));
  }
});

// ../node_modules/@midnight-ntwrk/midnight-js-contracts/dist/index.mjs
var import_fs = __toESM(require_fs(), 1);
var import_path = __toESM(require_path(), 1);
var DEFAULT_SEGMENT_NUMBER = 0;
var checkKeys = (coinInfo) => Object.keys(coinInfo).forEach((key) => {
  if (key !== "value" && key !== "type" && key !== "nonce") {
    throw new TypeError(`Key '${key}' should not be present in output data ${coinInfo}`);
  }
});
var serializeCoinInfo = (coinInfo) => {
  checkKeys(coinInfo);
  return JSON.stringify({
    ...coinInfo,
    value: { __big_int_val__: coinInfo.value.toString() }
  });
};
var serializeQualifiedShieldedCoinInfo = (coinInfo) => {
  const { mt_index: _, ...rest } = coinInfo;
  return serializeCoinInfo(rest);
};
var deserializeCoinInfo = (coinInfo) => {
  const res = JSON.parse(coinInfo, (key, value) => {
    if (key === "value" && value != null && typeof value === "object" && "__big_int_val__" in value && typeof value.__big_int_val__ === "string") {
      return BigInt(value.__big_int_val__);
    }
    if ((key === "color" || key === "nonce") && value != null && typeof value === "object" && "__uint8Array_val__" in value && typeof value.__uint8Array_val__ === "string") {
      return fromHex(value.__uint8Array_val__);
    }
    return value;
  });
  checkKeys(res);
  return res;
};
var createZswapOutput = ({ coinInfo, recipient }, encryptionPublicKey, segmentNumber = 0) => (
  // TBD need to confirm segment number and wallet encryptionPublicKey usage.
  recipient.is_left ? ZswapOutput.new(coinInfo, segmentNumber, recipient.left, encryptionPublicKey) : ZswapOutput.newContractOwned(coinInfo, segmentNumber, recipient.right)
);
var unprovenOfferFromCoinInfo = ([coinInfo, unproven], f) => {
  const { type, value } = deserializeCoinInfo(coinInfo);
  return f(unproven, type, value);
};
var unprovenOfferFromMap = (map, f) => {
  if (map.size === 0) {
    return void 0;
  }
  const offers = Array.from(map, (entry) => unprovenOfferFromCoinInfo(entry, f)).filter((offer) => offer != null);
  if (offers.length === 0) {
    return void 0;
  }
  return offers.reduce((acc, curr) => acc.merge(curr));
};
var zswapStateToOffer = (zswapLocalState, encryptionPublicKey, addressAndChainStateTuple) => {
  const unprovenOutputs = new Map(zswapLocalState.outputs.map((output) => [
    serializeCoinInfo(output.coinInfo),
    createZswapOutput(output, encryptionPublicKey, DEFAULT_SEGMENT_NUMBER)
  ]));
  const unprovenInputs = /* @__PURE__ */ new Map();
  const unprovenTransients = /* @__PURE__ */ new Map();
  zswapLocalState.inputs.forEach((qualifiedCoinInfo) => {
    const serializedCoinInfo = serializeQualifiedShieldedCoinInfo(qualifiedCoinInfo);
    const unprovenOutput = unprovenOutputs.get(serializedCoinInfo);
    if (unprovenOutput) {
      unprovenTransients.set(serializedCoinInfo, ZswapTransient.newFromContractOwnedOutput(qualifiedCoinInfo, DEFAULT_SEGMENT_NUMBER, unprovenOutput));
      unprovenOutputs.delete(serializedCoinInfo);
    } else {
      assertDefined(addressAndChainStateTuple, `Only outputs or transients are expected when no chain state is provided`);
      assertIsContractAddress(addressAndChainStateTuple.contractAddress);
      unprovenInputs.set(serializedCoinInfo, ZswapInput.newContractOwned(qualifiedCoinInfo, DEFAULT_SEGMENT_NUMBER, addressAndChainStateTuple.contractAddress, addressAndChainStateTuple.zswapChainState));
    }
  });
  const inputsOffer = unprovenOfferFromMap(unprovenInputs, ZswapOffer.fromInput);
  const outputsOffer = unprovenOfferFromMap(unprovenOutputs, ZswapOffer.fromOutput);
  const transientsOffer = unprovenOfferFromMap(unprovenTransients, ZswapOffer.fromTransient);
  const offers = [inputsOffer, outputsOffer, transientsOffer].filter((offer) => offer != null);
  if (offers.length === 0) {
    return void 0;
  }
  if (offers.length === 1) {
    return offers[0];
  }
  return offers.reduce((acc, curr) => acc.merge(curr));
};
var zswapStateToNewCoins = (receiverCoinPublicKey, zswapState) => zswapState.outputs.filter((output) => output.recipient.left === receiverCoinPublicKey).map(({ coinInfo }) => coinInfo);
var encryptionPublicKeyForZswapState = (zswapState, walletCoinPublicKey, walletEncryptionPublicKey) => {
  const networkId = getNetworkId();
  const walletCoinPublicKeyLocal = parseCoinPublicKeyToHex(walletCoinPublicKey, networkId);
  const localCoinPublicKey = parseCoinPublicKeyToHex(zswapState.coinPublicKey, networkId);
  if (localCoinPublicKey !== walletCoinPublicKeyLocal) {
    throw new Error("Unable to lookup encryption public key (Unsupported coin)");
  }
  return parseEncPublicKeyToHex(walletEncryptionPublicKey, networkId);
};
var toLedgerContractState = (contractState) => ContractState.deserialize(contractState.serialize());
var fromLedgerContractState = (contractState) => ContractState2.deserialize(contractState.serialize());
var toLedgerQueryContext = (queryContext) => {
  const stateValue = StateValue.decode(queryContext.state.state.encode());
  const ledgerQueryContext = new QueryContext(new ChargedState(stateValue), queryContext.address);
  ledgerQueryContext.block = queryContext.block;
  ledgerQueryContext.effects = queryContext.effects;
  return ledgerQueryContext;
};
var addVerifierKeys = (verifierKeys, contractState) => {
  verifierKeys.forEach(([impureCircuitId, verifierKey]) => {
    const operation = contractState.operation(impureCircuitId);
    assertDefined(operation, `Circuit '${impureCircuitId}' is undefined for contract state ${contractState.toString(false)}`);
    operation.verifierKey = verifierKey;
    contractState.setOperation(impureCircuitId, operation);
  });
};
var contractMaintenanceAuthority = (sk, contractState) => {
  const svk = signatureVerifyingKey(sk);
  const threshold = 1;
  return new ContractMaintenanceAuthority([svk], threshold, contractState ? contractState.maintenanceAuthority.counter + 1n : 0n);
};
var addMaintenanceAuthority = (sk, contractState) => {
  contractState.maintenanceAuthority = contractMaintenanceAuthority(sk);
};
var createUnprovenLedgerDeployTx = (verifierKeys, sk, contractState, zswapLocalState, encryptionPublicKey) => {
  const ledgerContractState = toLedgerContractState(contractState);
  addVerifierKeys(verifierKeys, ledgerContractState);
  addMaintenanceAuthority(sk, ledgerContractState);
  const contractDeploy = new ContractDeploy(ledgerContractState);
  return [
    contractDeploy.address,
    fromLedgerContractState(contractDeploy.initialState),
    Transaction.fromParts(getNetworkId(), zswapStateToOffer(zswapLocalState, encryptionPublicKey), void 0, Intent.new(ttlOneHour()).addDeploy(contractDeploy))
  ];
};
var createUnprovenLedgerCallTx = (circuitId, contractAddress, initialContractState, zswapChainState, partitionedTranscript, privateTranscriptOutputs, input, output, nextZswapLocalState, encryptionPublicKey) => {
  const op = toLedgerContractState(initialContractState).operation(circuitId);
  assertDefined(op, `Operation '${circuitId}' is undefined for contract state ${initialContractState.toString(false)}`);
  return Transaction.fromParts(getNetworkId(), zswapStateToOffer(nextZswapLocalState, encryptionPublicKey, {
    contractAddress,
    zswapChainState
  }), void 0, Intent.new(ttlOneHour()).addCall(new ContractCallPrototype(contractAddress, circuitId, op, partitionedTranscript[0], partitionedTranscript[1], privateTranscriptOutputs, input, output, communicationCommitmentRandomness(), circuitId)));
};
var replaceAuthority = (newAuthority, contractState) => new ReplaceAuthority(contractMaintenanceAuthority(newAuthority, contractState));
var removeVerifierKey = (operation) => new VerifierKeyRemove(operation, new ContractOperationVersion("v2"));
var insertVerifierKey = (operation, newVk) => new VerifierKeyInsert(operation, new ContractOperationVersionedVerifierKey("v2", newVk));
var unprovenTxFromContractUpdates = (contractAddress, updates, contractState, sk) => {
  const maintenanceUpdate = new MaintenanceUpdate(contractAddress, updates, contractState.maintenanceAuthority.counter);
  const idx = 0n;
  const signedMaintenanceUpdate = maintenanceUpdate.addSignature(idx, signData(sk, maintenanceUpdate.dataToSign));
  return Transaction.fromParts(getNetworkId(), void 0, void 0, Intent.new(ttlOneHour()).addMaintenanceUpdate(signedMaintenanceUpdate));
};
var createUnprovenReplaceAuthorityTx = (contractAddress, newAuthority, contractState, currentAuthority) => unprovenTxFromContractUpdates(contractAddress, [replaceAuthority(newAuthority, contractState)], contractState, currentAuthority);
var createUnprovenRemoveVerifierKeyTx = (contractAddress, operation, contractState, currentAuthority) => unprovenTxFromContractUpdates(contractAddress, [removeVerifierKey(operation)], contractState, currentAuthority);
var createUnprovenInsertVerifierKeyTx = (contractAddress, operation, newVk, contractState, currentAuthority) => unprovenTxFromContractUpdates(contractAddress, [insertVerifierKey(operation, newVk)], contractState, currentAuthority);
var partitionTranscript = (initialTxContext, finalTxContext, publicTranscript) => {
  const partitionedTranscripts = partitionTranscripts([
    new PreTranscript(Array.from(finalTxContext.comIndices).reduce((queryContext, entry) => queryContext.insertCommitment(...entry), toLedgerQueryContext(initialTxContext)), publicTranscript)
  ], LedgerParameters.initialParameters());
  if (partitionedTranscripts.length !== 1) {
    throw new Error(`Expected one transcript partition pair, received: ${partitionedTranscripts.length}`);
  }
  return partitionedTranscripts[0];
};
var call = (options) => {
  const { contract, circuitId, contractAddress, coinPublicKey, initialContractState } = options;
  const circuit = contract.impureCircuits[circuitId];
  assertDefined(circuit, `Circuit '${circuitId}' is not defined`);
  const initialTxContext = new QueryContext2(initialContractState.data, contractAddress);
  initialTxContext.block = {
    ...initialTxContext.block,
    secondsSinceEpoch: BigInt(Math.floor(Date.now() / 1e3))
  };
  const { result, context, proofData } = circuit({
    //TODO: validate this originalState
    originalState: initialContractState,
    currentPrivateState: "initialPrivateState" in options ? options.initialPrivateState : void 0,
    currentQueryContext: initialTxContext,
    currentZswapLocalState: emptyZswapLocalState(parseCoinPublicKeyToHex(coinPublicKey, getNetworkId())),
    costModel: CostModel.initialCostModel()
  }, ..."args" in options ? options.args : []);
  return {
    public: {
      nextContractState: context.currentQueryContext.state.state,
      publicTranscript: proofData.publicTranscript,
      partitionedTranscript: partitionTranscript(initialTxContext, context.currentQueryContext, proofData.publicTranscript)
    },
    private: {
      result,
      input: proofData.input,
      output: proofData.output,
      privateTranscriptOutputs: proofData.privateTranscriptOutputs,
      nextPrivateState: context.currentPrivateState,
      nextZswapLocalState: decodeZswapLocalState(context.currentZswapLocalState)
    }
  };
};
var callContractConstructor = (options) => {
  const constructorResult = options.contract.initialState({
    initialPrivateState: "initialPrivateState" in options ? options.initialPrivateState : void 0,
    // TODO: IMPORTANT - consult
    initialZswapLocalState: emptyZswapLocalState(options.coinPublicKey)
  }, ..."args" in options ? options.args : []);
  return {
    nextContractState: constructorResult.currentContractState,
    nextPrivateState: constructorResult.currentPrivateState,
    nextZswapLocalState: decodeZswapLocalState(constructorResult.currentZswapLocalState)
  };
};
var TxFailedError = class extends Error {
  finalizedTxData;
  circuitId;
  /**
   * @param finalizedTxData The finalization data of the transaction that failed.
   * @param circuitId The name of the circuit that was called to create the call
   *                  transaction that failed. Only defined if a call transaction
   *                  failed.
   */
  constructor(finalizedTxData, circuitId) {
    super("Transaction failed");
    this.finalizedTxData = finalizedTxData;
    this.circuitId = circuitId;
    this.message = JSON.stringify({
      ...circuitId && { circuitId },
      ...finalizedTxData
    }, null, "	");
  }
};
var DeployTxFailedError = class extends TxFailedError {
  /**
   * @param finalizedTxData The finalization data of the deployment transaction that failed.
   */
  constructor(finalizedTxData) {
    super(finalizedTxData);
    this.name = "DeployTxFailedError";
  }
};
var CallTxFailedError = class extends TxFailedError {
  /**
   * @param finalizedTxData The finalization data of the call transaction that failed.
   * @param circuitId The name of the circuit that was called to build the transaction.
   */
  constructor(finalizedTxData, circuitId) {
    super(finalizedTxData, circuitId);
    this.name = "CallTxFailedError";
  }
};
var ContractTypeError = class extends TypeError {
  contractState;
  circuitIds;
  /**
   * Initializes a new {@link ContractTypeError}.
   *
   * @param contractState The initial deployed contract state.
   * @param circuitIds The circuits that are undefined, or have a verifier key mismatch with the
   *                   key present in `contractState`.
   */
  constructor(contractState, circuitIds) {
    super(`Following operations: ${circuitIds.join(", ")}, are undefined or have mismatched verifier keys for contract state ${contractState.toString(false)}`);
    this.contractState = contractState;
    this.circuitIds = circuitIds;
  }
};
var ReplaceMaintenanceAuthorityTxFailedError = class extends TxFailedError {
  constructor(finalizedTxData) {
    super(finalizedTxData);
    this.name = "ReplaceMaintenanceAuthorityTxFailedError";
  }
};
var RemoveVerifierKeyTxFailedError = class extends TxFailedError {
  constructor(finalizedTxData) {
    super(finalizedTxData);
    this.name = "RemoveVerifierKeyTxFailedError";
  }
};
var InsertVerifierKeyTxFailedError = class extends TxFailedError {
  constructor(finalizedTxData) {
    super(finalizedTxData);
    this.name = "InsertVerifierKeyTxFailedError";
  }
};
var IncompleteCallTxPrivateStateConfig = class extends Error {
  constructor() {
    super("Incorrect call transaction configuration");
    this.message = "'privateStateId' was defined for call transaction while 'privateStateProvider' was undefined";
  }
};
var IncompleteFindContractPrivateStateConfig = class extends Error {
  constructor() {
    super("Incorrect find contract configuration");
    this.message = "'initialPrivateState' was defined for contract find while 'privateStateId' was undefined";
  }
};
async function proveTransaction(recipe, providers, proveTxConfig) {
  let toSubmit;
  switch (recipe.type) {
    case TRANSACTION_TO_PROVE: {
      toSubmit = await providers.proofProvider.proveTx(recipe.transaction, proveTxConfig);
      break;
    }
    case BALANCE_TRANSACTION_TO_PROVE: {
      const recipeBalance = recipe;
      const merged = recipeBalance.transactionToBalance.merge(recipeBalance.transactionToProve);
      toSubmit = await providers.proofProvider.proveTx(merged, proveTxConfig);
      break;
    }
    case NOTHING_TO_PROVE: {
      toSubmit = recipe.transaction;
      break;
    }
    default:
      throw new Error(`Unknown recipe type: ${recipe.type}`);
  }
  return toSubmit;
}
async function submitTxCore(providers, options) {
  const proveTxConfig = options.circuitId ? { zkConfig: await providers.zkConfigProvider.get(options.circuitId) } : void 0;
  const recipe = await providers.walletProvider.balanceTx(options.unprovenTx, options.newCoins);
  const toSubmit = await proveTransaction(recipe, providers, proveTxConfig);
  const bound = toSubmit.bind();
  return providers.midnightProvider.submitTx(bound);
}
var submitTx = async (providers, options) => {
  const txId = await submitTxCore(providers, options);
  return providers.publicDataProvider.watchForTxData(txId);
};
var submitTxAsync = async (providers, options) => {
  return submitTxCore(providers, options);
};
var createContractConstructorOptions = (deployTxOptions, coinPublicKey) => {
  const constructorOptionsBase = {
    contract: deployTxOptions.contract
  };
  const constructorOptionsWithArguments = "args" in deployTxOptions ? {
    ...constructorOptionsBase,
    args: deployTxOptions.args
  } : constructorOptionsBase;
  const constructorOptionsWithProviderDataDependencies = {
    ...constructorOptionsWithArguments,
    coinPublicKey
  };
  const constructorOptions = "initialPrivateState" in deployTxOptions ? {
    ...constructorOptionsWithProviderDataDependencies,
    initialPrivateState: deployTxOptions.initialPrivateState
  } : constructorOptionsWithProviderDataDependencies;
  return constructorOptions;
};
function createUnprovenDeployTxFromVerifierKeys(verifierKeys, coinPublicKey, options, encryptionPublicKey) {
  const { nextContractState, nextPrivateState, nextZswapLocalState } = callContractConstructor(createContractConstructorOptions(options, coinPublicKey));
  const [contractAddress, initialContractState, unprovenTx] = createUnprovenLedgerDeployTx(verifierKeys, options.signingKey, nextContractState, nextZswapLocalState, encryptionPublicKey);
  return {
    public: {
      contractAddress,
      initialContractState
    },
    private: {
      signingKey: options.signingKey,
      initialPrivateState: nextPrivateState,
      initialZswapState: nextZswapLocalState,
      unprovenTx,
      newCoins: zswapStateToNewCoins(coinPublicKey, nextZswapLocalState)
    }
  };
}
async function createUnprovenDeployTx(providers, options) {
  const verifierKeys = await providers.zkConfigProvider.getVerifierKeys(getImpureCircuitIds(options.contract));
  return createUnprovenDeployTxFromVerifierKeys(verifierKeys, parseCoinPublicKeyToHex(providers.walletProvider.getCoinPublicKey(), getNetworkId()), options, providers.walletProvider.getEncryptionPublicKey());
}
async function submitDeployTx(providers, options) {
  const unprovenDeployTxData = await createUnprovenDeployTx(providers, options);
  const finalizedTxData = await submitTx(providers, {
    unprovenTx: unprovenDeployTxData.private.unprovenTx,
    newCoins: unprovenDeployTxData.private.newCoins
  });
  if (finalizedTxData.status !== SucceedEntirely) {
    throw new DeployTxFailedError(finalizedTxData);
  }
  if ("privateStateId" in options) {
    await providers.privateStateProvider.set(options.privateStateId, unprovenDeployTxData.private.initialPrivateState);
  }
  await providers.privateStateProvider.setSigningKey(unprovenDeployTxData.public.contractAddress, unprovenDeployTxData.private.signingKey);
  return {
    private: unprovenDeployTxData.private,
    public: {
      ...finalizedTxData,
      ...unprovenDeployTxData.public
    }
  };
}
var getPublicStates = async (publicDataProvider, contractAddress) => {
  assertIsContractAddress(contractAddress);
  const zswapAndContractState = await publicDataProvider.queryZSwapAndContractState(contractAddress);
  assertDefined(zswapAndContractState, `No public state found at contract address '${contractAddress}'`);
  const [zswapChainState, contractState] = zswapAndContractState;
  return { contractState, zswapChainState };
};
var getStates = async (publicDataProvider, privateStateProvider, contractAddress, privateStateId) => {
  const publicContractStates = await getPublicStates(publicDataProvider, contractAddress);
  const privateState = await privateStateProvider.get(privateStateId);
  assertDefined(privateState, `No private state found at private state ID '${privateStateId}'`);
  return { ...publicContractStates, privateState };
};
function createUnprovenCallTxFromInitialStates(options, walletCoinPublicKey, walletEncryptionPublicKey) {
  const { contract, circuitId, contractAddress, coinPublicKey, initialContractState, initialZswapChainState } = options;
  assertIsContractAddress(contractAddress);
  assertDefined(contract.impureCircuits[circuitId], `Circuit '${circuitId}' is undefined`);
  const callResult = call(options);
  return {
    public: {
      ...callResult.public
    },
    private: {
      ...callResult.private,
      unprovenTx: createUnprovenLedgerCallTx(circuitId, contractAddress, initialContractState, initialZswapChainState, callResult.public.partitionedTranscript, callResult.private.privateTranscriptOutputs, callResult.private.input, callResult.private.output, callResult.private.nextZswapLocalState, encryptionPublicKeyForZswapState(callResult.private.nextZswapLocalState, walletCoinPublicKey, walletEncryptionPublicKey)),
      newCoins: zswapStateToNewCoins(parseCoinPublicKeyToHex(coinPublicKey, getNetworkId()), callResult.private.nextZswapLocalState)
    }
  };
}
var createCallOptions = (callTxOptions, coinPublicKey, initialContractState, initialZswapChainState, initialPrivateState) => {
  const callOptionsBase = {
    contract: callTxOptions.contract,
    contractAddress: callTxOptions.contractAddress,
    circuitId: callTxOptions.circuitId
  };
  const callOptionsWithArguments = "args" in callTxOptions ? {
    ...callOptionsBase,
    args: callTxOptions.args
  } : callOptionsBase;
  const callOptionsBaseWithProviderDataDependencies = {
    ...callOptionsWithArguments,
    coinPublicKey: parseCoinPublicKeyToHex(coinPublicKey, getNetworkId()),
    initialContractState,
    initialZswapChainState
  };
  const callOptions = initialPrivateState ? { ...callOptionsBaseWithProviderDataDependencies, initialPrivateState } : callOptionsBaseWithProviderDataDependencies;
  return callOptions;
};
async function createUnprovenCallTx(providers, options) {
  assertIsContractAddress(options.contractAddress);
  assertDefined(options.contract.impureCircuits[options.circuitId], `Circuit '${options.circuitId}' is undefined`);
  const hasPrivateStateProvider = "privateStateProvider" in providers;
  const hasPrivateStateId = "privateStateId" in options;
  if (hasPrivateStateId && !hasPrivateStateProvider) {
    throw new IncompleteCallTxPrivateStateConfig();
  }
  if (hasPrivateStateId && hasPrivateStateProvider) {
    const { zswapChainState: zswapChainState2, contractState: contractState2, privateState } = await getStates(providers.publicDataProvider, providers.privateStateProvider, options.contractAddress, options.privateStateId);
    return createUnprovenCallTxFromInitialStates(createCallOptions(options, parseCoinPublicKeyToHex(providers.walletProvider.getCoinPublicKey(), getNetworkId()), contractState2, zswapChainState2, privateState), providers.walletProvider.getCoinPublicKey(), providers.walletProvider.getEncryptionPublicKey());
  }
  const { zswapChainState, contractState } = await getPublicStates(providers.publicDataProvider, options.contractAddress);
  return createUnprovenCallTxFromInitialStates(createCallOptions(options, parseCoinPublicKeyToHex(providers.walletProvider.getCoinPublicKey(), getNetworkId()), contractState, zswapChainState), providers.walletProvider.getCoinPublicKey(), providers.walletProvider.getEncryptionPublicKey());
}
async function submitCallTx(providers, options) {
  assertIsContractAddress(options.contractAddress);
  assertDefined(options.contract.impureCircuits[options.circuitId], `Circuit '${options.circuitId}' is undefined`);
  const hasPrivateStateProvider = "privateStateProvider" in providers;
  const hasPrivateStateId = "privateStateId" in options;
  if (hasPrivateStateId && !hasPrivateStateProvider) {
    throw new IncompleteCallTxPrivateStateConfig();
  }
  const unprovenCallTxData = await createUnprovenCallTx(providers, options);
  const finalizedTxData = await submitTx(providers, {
    unprovenTx: unprovenCallTxData.private.unprovenTx,
    newCoins: unprovenCallTxData.private.newCoins,
    circuitId: options.circuitId
  });
  if (finalizedTxData.status !== SucceedEntirely) {
    throw new CallTxFailedError(finalizedTxData, options.circuitId);
  }
  if (hasPrivateStateId && hasPrivateStateProvider) {
    await providers.privateStateProvider.set(options.privateStateId, unprovenCallTxData.private.nextPrivateState);
  }
  return {
    private: unprovenCallTxData.private,
    public: {
      ...unprovenCallTxData.public,
      ...finalizedTxData
    }
  };
}
async function submitCallTxAsync(providers, options) {
  assertIsContractAddress(options.contractAddress);
  assertDefined(options.contract.impureCircuits[options.circuitId], `Circuit '${options.circuitId}' is undefined`);
  const hasPrivateStateProvider = "privateStateProvider" in providers;
  const hasPrivateStateId = "privateStateId" in options;
  if (hasPrivateStateId && !hasPrivateStateProvider) {
    throw new IncompleteCallTxPrivateStateConfig();
  }
  const unprovenCallTxData = await createUnprovenCallTx(providers, options);
  const txId = await submitTxAsync(providers, {
    unprovenTx: unprovenCallTxData.private.unprovenTx,
    newCoins: unprovenCallTxData.private.newCoins,
    circuitId: options.circuitId
  });
  return {
    txId,
    callTxData: unprovenCallTxData
  };
}
var submitInsertVerifierKeyTx = async (providers, contractAddress, circuitId, newVk) => {
  assertIsContractAddress(contractAddress);
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  assertDefined(contractState, `No contract state found on chain for contract address '${contractAddress}'`);
  assertUndefined(contractState.operation(circuitId), `Circuit '${circuitId}' is already defined for contract at address '${contractAddress}'`);
  const signingKey = await providers.privateStateProvider.getSigningKey(contractAddress);
  assertDefined(signingKey, `Signing key for contract address '${contractAddress}' not found`);
  const unprovenTx = createUnprovenInsertVerifierKeyTx(contractAddress, circuitId, newVk, contractState, signingKey);
  const submitTxResult = await submitTx(providers, { unprovenTx });
  if (submitTxResult.status !== SucceedEntirely) {
    throw new InsertVerifierKeyTxFailedError(submitTxResult);
  }
  return submitTxResult;
};
var submitRemoveVerifierKeyTx = async (providers, contractAddress, circuitId) => {
  assertIsContractAddress(contractAddress);
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  assertDefined(contractState, `No contract state found on chain for contract address '${contractAddress}'`);
  assertDefined(contractState.operation(circuitId), `Circuit '${circuitId}' not found for contract at address '${contractAddress}'`);
  const signingKey = await providers.privateStateProvider.getSigningKey(contractAddress);
  assertDefined(signingKey, `Signing key for contract address '${contractAddress}' not found`);
  const unprovenTx = createUnprovenRemoveVerifierKeyTx(contractAddress, circuitId, contractState, signingKey);
  const submitTxResult = await submitTx(providers, { unprovenTx });
  if (submitTxResult.status !== SucceedEntirely) {
    throw new RemoveVerifierKeyTxFailedError(submitTxResult);
  }
  return submitTxResult;
};
var submitReplaceAuthorityTx = (providers, contractAddress) => (
  /**
   * @param newAuthority The signing key of the new contract maintenance authority.
   *
   * @returns A promise that resolves with the finalized transaction data, or rejects if
   *          an error occurs along the way.
   *
   * @throws {ReplaceMaintenanceAuthorityTxFailedError} When transaction fails in either guaranteed or fallible phase.
   *         The error contains the finalized transaction data for debugging.
   */
  async (newAuthority) => {
    assertIsContractAddress(contractAddress);
    const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
    assertDefined(contractState, `No contract state found on chain for contract address '${contractAddress}'`);
    const currentAuthority = await providers.privateStateProvider.getSigningKey(contractAddress);
    assertDefined(currentAuthority, `Signing key for contract address '${contractAddress}' not found`);
    const unprovenTx = createUnprovenReplaceAuthorityTx(contractAddress, newAuthority, contractState, currentAuthority);
    const submitTxResult = await submitTx(providers, { unprovenTx });
    if (submitTxResult.status !== SucceedEntirely) {
      throw new ReplaceMaintenanceAuthorityTxFailedError(submitTxResult);
    }
    await providers.privateStateProvider.setSigningKey(contractAddress, newAuthority);
    return submitTxResult;
  }
);
var createCallTxOptions = (contract, circuitId, contractAddress, privateStateId, args) => {
  const callOptionsBase = {
    contract,
    circuitId,
    contractAddress
  };
  const callTxOptionsBase = args.length !== 0 ? { ...callOptionsBase, args } : callOptionsBase;
  const callTxOptions = privateStateId ? { ...callTxOptionsBase, privateStateId } : callTxOptionsBase;
  return callTxOptions;
};
var createCircuitCallTxInterface = (providers, contract, contractAddress, privateStateId) => {
  assertIsContractAddress(contractAddress);
  return getImpureCircuitIds(contract).reduce((acc, circuitId) => ({
    ...acc,
    [circuitId]: (...args) => submitCallTx(providers, createCallTxOptions(contract, circuitId, contractAddress, privateStateId, args))
  }), {});
};
var createCircuitMaintenanceTxInterface = (providers, circuitId, contractAddress) => {
  assertIsContractAddress(contractAddress);
  return {
    removeVerifierKey() {
      return submitRemoveVerifierKeyTx(providers, contractAddress, circuitId);
    },
    insertVerifierKey(newVk) {
      return submitInsertVerifierKeyTx(providers, contractAddress, circuitId, newVk);
    }
  };
};
var createCircuitMaintenanceTxInterfaces = (providers, contract, contractAddress) => {
  assertIsContractAddress(contractAddress);
  return getImpureCircuitIds(contract).reduce((acc, circuitId) => ({
    ...acc,
    [circuitId]: createCircuitMaintenanceTxInterface(providers, circuitId, contractAddress)
  }), {});
};
var createContractMaintenanceTxInterface = (providers, contractAddress) => {
  assertIsContractAddress(contractAddress);
  return {
    replaceAuthority: submitReplaceAuthorityTx(providers, contractAddress)
  };
};
var createDeployTxOptions = (deployContractOptions) => {
  const deployTxOptionsBase = {
    ...deployContractOptions,
    signingKey: deployContractOptions.signingKey ?? sampleSigningKey()
  };
  return "privateStateId" in deployContractOptions ? {
    ...deployTxOptionsBase,
    privateStateId: deployContractOptions.privateStateId,
    initialPrivateState: deployContractOptions.initialPrivateState
  } : deployTxOptionsBase;
};
async function deployContract(providers, options) {
  const deployTxData = await submitDeployTx(providers, createDeployTxOptions(options));
  return {
    deployTxData,
    callTx: createCircuitCallTxInterface(providers, options.contract, deployTxData.public.contractAddress, "privateStateId" in options ? options.privateStateId : void 0),
    circuitMaintenanceTx: createCircuitMaintenanceTxInterfaces(providers, options.contract, deployTxData.public.contractAddress),
    contractMaintenanceTx: createContractMaintenanceTxInterface(providers, deployTxData.public.contractAddress)
  };
}
var setOrGetInitialSigningKey = async (privateStateProvider, options) => {
  if (options.signingKey) {
    await privateStateProvider.setSigningKey(options.contractAddress, options.signingKey);
    return options.signingKey;
  }
  const existingSigningKey = await privateStateProvider.getSigningKey(options.contractAddress);
  if (existingSigningKey) {
    return existingSigningKey;
  }
  const freshSigningKey = sampleSigningKey();
  await privateStateProvider.setSigningKey(options.contractAddress, freshSigningKey);
  return freshSigningKey;
};
var setOrGetInitialPrivateState = async (privateStateProvider, options) => {
  const hasPrivateStateId = "privateStateId" in options;
  const hasInitialPrivateState = "initialPrivateState" in options;
  if (hasPrivateStateId) {
    if (hasInitialPrivateState) {
      await privateStateProvider.set(options.privateStateId, options.initialPrivateState);
      return options.initialPrivateState;
    }
    const currentPrivateState = await privateStateProvider.get(options.privateStateId);
    assertDefined(currentPrivateState, `No private state found at private state ID '${options.privateStateId}'`);
    return currentPrivateState;
  }
  if (hasInitialPrivateState) {
    throw new IncompleteFindContractPrivateStateConfig();
  }
  return void 0;
};
var verifierKeysEqual = (a, b) => a.length === b.length && toHex(a) === toHex(b);
var verifyContractState = (verifierKeys, contractState) => {
  const mismatchedCircuitIds = verifierKeys.reduce((acc, [circuitId, localVk]) => !contractState.operation(circuitId) || !verifierKeysEqual(localVk, contractState.operation(circuitId).verifierKey) ? [...acc, circuitId] : acc, []);
  if (mismatchedCircuitIds.length > 0) {
    throw new ContractTypeError(contractState, mismatchedCircuitIds);
  }
};
async function findDeployedContract(providers, options) {
  const { contract, contractAddress } = options;
  assertIsContractAddress(contractAddress);
  const finalizedTxData = await providers.publicDataProvider.watchForDeployTxData(contractAddress);
  const initialContractState = await providers.publicDataProvider.queryDeployContractState(contractAddress);
  assertDefined(initialContractState, `No contract deployed at contract address '${contractAddress}'`);
  const currentContractState = await providers.publicDataProvider.queryContractState(contractAddress);
  assertDefined(currentContractState, `No contract deployed at contract address '${contractAddress}'`);
  const verifierKeys = await providers.zkConfigProvider.getVerifierKeys(getImpureCircuitIds(contract));
  verifyContractState(verifierKeys, currentContractState);
  const signingKey = await setOrGetInitialSigningKey(providers.privateStateProvider, options);
  const initialPrivateState = await setOrGetInitialPrivateState(providers.privateStateProvider, options);
  return {
    deployTxData: {
      private: {
        signingKey,
        initialPrivateState
      },
      public: {
        ...finalizedTxData,
        contractAddress,
        initialContractState
      }
    },
    callTx: createCircuitCallTxInterface(providers, contract, contractAddress, "privateStateId" in options ? options.privateStateId : void 0),
    circuitMaintenanceTx: createCircuitMaintenanceTxInterfaces(providers, contract, contractAddress),
    contractMaintenanceTx: createContractMaintenanceTxInterface(providers, contractAddress)
  };
}
var getUnshieldedBalances = async (publicDataProvider, contractAddress) => {
  assertIsContractAddress(contractAddress);
  const unshieldedBalances = await publicDataProvider.queryUnshieldedBalances(contractAddress);
  assertDefined(unshieldedBalances, `No unshielded balances found at contract address '${contractAddress}'`);
  return unshieldedBalances;
};
export {
  CallTxFailedError,
  ContractTypeError,
  DeployTxFailedError,
  IncompleteCallTxPrivateStateConfig,
  IncompleteFindContractPrivateStateConfig,
  InsertVerifierKeyTxFailedError,
  RemoveVerifierKeyTxFailedError,
  ReplaceMaintenanceAuthorityTxFailedError,
  TxFailedError,
  call,
  callContractConstructor,
  createCallTxOptions,
  createCircuitCallTxInterface,
  createCircuitMaintenanceTxInterface,
  createCircuitMaintenanceTxInterfaces,
  createContractMaintenanceTxInterface,
  createUnprovenCallTx,
  createUnprovenCallTxFromInitialStates,
  createUnprovenDeployTx,
  createUnprovenDeployTxFromVerifierKeys,
  deployContract,
  findDeployedContract,
  getPublicStates,
  getStates,
  getUnshieldedBalances,
  submitCallTx,
  submitCallTxAsync,
  submitDeployTx,
  submitInsertVerifierKeyTx,
  submitRemoveVerifierKeyTx,
  submitReplaceAuthorityTx,
  submitTx,
  submitTxAsync,
  verifierKeysEqual,
  verifyContractState
};
//# sourceMappingURL=@midnight-ntwrk_midnight-js-contracts.js.map
