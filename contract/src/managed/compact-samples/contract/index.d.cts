import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type UserData = { name: string;
                         email: string;
                         birthDate: string;
                         userId: bigint;
                         isValid: boolean
                       };

export type StructExample = { field1: bigint; field2: bigint; field3: bigint };

export type Witnesses<T> = {
}

export type ImpureCircuits<T> = {
  addStructNestedFieldItem(context: __compactRuntime.CircuitContext<T>,
                           key1_0: bigint,
                           key2_0: bigint,
                           value_0: StructExample): __compactRuntime.CircuitResults<T, []>;
  addFieldItem(context: __compactRuntime.CircuitContext<T>,
               key_0: bigint,
               value_0: bigint): __compactRuntime.CircuitResults<T, []>;
  addNestedFieldItem(context: __compactRuntime.CircuitContext<T>,
                     key1_0: bigint,
                     key2_0: bigint,
                     value_0: bigint): __compactRuntime.CircuitResults<T, []>;
  addStructItem(context: __compactRuntime.CircuitContext<T>,
                key_0: Uint8Array,
                value_0: UserData): __compactRuntime.CircuitResults<T, []>;
  addStringItem(context: __compactRuntime.CircuitContext<T>,
                key_0: bigint,
                value_0: string): __compactRuntime.CircuitResults<T, []>;
  addEncryptedExample(context: __compactRuntime.CircuitContext<T>,
                      key_0: bigint,
                      example_0: StructExample): __compactRuntime.CircuitResults<T, []>;
}

export type PureCircuits = {
  addEncryptedItem(key_0: bigint, userData_0: UserData): [];
  userHash(user_0: UserData): Uint8Array;
  exampleHash(example_0: StructExample): Uint8Array;
}

export type Circuits<T> = {
  addStructNestedFieldItem(context: __compactRuntime.CircuitContext<T>,
                           key1_0: bigint,
                           key2_0: bigint,
                           value_0: StructExample): __compactRuntime.CircuitResults<T, []>;
  addFieldItem(context: __compactRuntime.CircuitContext<T>,
               key_0: bigint,
               value_0: bigint): __compactRuntime.CircuitResults<T, []>;
  addNestedFieldItem(context: __compactRuntime.CircuitContext<T>,
                     key1_0: bigint,
                     key2_0: bigint,
                     value_0: bigint): __compactRuntime.CircuitResults<T, []>;
  addStructItem(context: __compactRuntime.CircuitContext<T>,
                key_0: Uint8Array,
                value_0: UserData): __compactRuntime.CircuitResults<T, []>;
  addStringItem(context: __compactRuntime.CircuitContext<T>,
                key_0: bigint,
                value_0: string): __compactRuntime.CircuitResults<T, []>;
  addEncryptedItem(context: __compactRuntime.CircuitContext<T>,
                   key_0: bigint,
                   userData_0: UserData): __compactRuntime.CircuitResults<T, []>;
  userHash(context: __compactRuntime.CircuitContext<T>, user_0: UserData): __compactRuntime.CircuitResults<T, Uint8Array>;
  addEncryptedExample(context: __compactRuntime.CircuitContext<T>,
                      key_0: bigint,
                      example_0: StructExample): __compactRuntime.CircuitResults<T, []>;
  exampleHash(context: __compactRuntime.CircuitContext<T>,
              example_0: StructExample): __compactRuntime.CircuitResults<T, Uint8Array>;
}

export type Ledger = {
  simpleMap: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): bigint;
    [Symbol.iterator](): Iterator<[bigint, bigint]>
  };
  simpleMapString: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): string;
    [Symbol.iterator](): Iterator<[bigint, string]>
  };
  simpleMapEncryptedString: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): Uint8Array;
    [Symbol.iterator](): Iterator<[bigint, Uint8Array]>
  };
  structMapExample: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): UserData;
    [Symbol.iterator](): Iterator<[Uint8Array, UserData]>
  };
  simpleNestedMap: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): {
      isEmpty(): boolean;
      size(): bigint;
      member(key_1: bigint): boolean;
      lookup(key_1: bigint): bigint;
      [Symbol.iterator](): Iterator<[bigint, bigint]>
    }
  };
  structNestedMap: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): {
      isEmpty(): boolean;
      size(): bigint;
      member(key_1: bigint): boolean;
      lookup(key_1: bigint): StructExample;
      [Symbol.iterator](): Iterator<[bigint, StructExample]>
    }
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<T, W extends Witnesses<T> = Witnesses<T>> {
  witnesses: W;
  circuits: Circuits<T>;
  impureCircuits: ImpureCircuits<T>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<T>): __compactRuntime.ConstructorResult<T>;
}

export declare function ledger(state: __compactRuntime.StateValue): Ledger;
export declare const pureCircuits: PureCircuits;
