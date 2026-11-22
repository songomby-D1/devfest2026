import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Abi, Hex } from 'viem' with { 'resolution-mode': 'import' };
import { artworkKeyOf } from './artwork-key';
import { ChainError } from './blockchain.port';
import { PRESERVING_ART_ABI } from './preserving-art.abi';
import { viem, viemAccounts } from './viem';
import { toChainError, ViemBlockchain } from './viem-blockchain';

const {
  custom,
  encodeAbiParameters,
  encodeErrorResult,
  encodeEventTopics,
  encodeFunctionResult,
  keccak256,
  stringToHex,
  toHex,
} = viem;

const CONTRACT = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
// A deliberately trivial test key; its address is derived, never hard-coded.
const TEST_KEY: Hex = `0x${'01'.repeat(32)}`;
const TEST_ADDRESS = viemAccounts.privateKeyToAccount(TEST_KEY).address;
const ITEM = '3F2B8C1E-6A4D-4F7B-9C2E-1A2B3C4D5E6F';
const TX = `0x${'ab'.repeat(32)}`;

type Handler = (params: readonly unknown[]) => unknown;

class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: Hex,
  ) {
    super(message);
  }
}

function blockchain(
  handlers: Record<string, Handler>,
  calls: string[] = [],
): ViemBlockchain {
  return new ViemBlockchain({
    rpcUrl: 'http://127.0.0.1:8545',
    chainId: 31337,
    contractAddress: CONTRACT,
    privateKey: TEST_KEY,
    pollingIntervalMs: 5,
    transport: custom({
      // Async, so a handler that throws becomes a rejected request.
      request: async ({
        method,
        params,
      }: {
        method: string;
        params?: unknown;
      }): Promise<unknown> => {
        await Promise.resolve();
        calls.push(method);
        const handler = handlers[method];
        if (handler === undefined) throw new Error(`unexpected RPC ${method}`);
        return handler((params ?? []) as readonly unknown[]);
      },
    }),
  });
}

const CHAIN_BASICS: Record<string, Handler> = {
  eth_chainId: () => toHex(31337),
  eth_blockNumber: () => '0x10',
  eth_getTransactionCount: () => '0x0',
  eth_estimateGas: () => toHex(100_000),
  eth_maxPriorityFeePerGas: () => toHex(1_000_000_000),
  eth_gasPrice: () => toHex(2_000_000_000),
  eth_getBlockByNumber: () => ({
    number: '0x10',
    hash: `0x${'11'.repeat(32)}`,
    parentHash: `0x${'22'.repeat(32)}`,
    baseFeePerGas: toHex(1_000_000_000),
    timestamp: '0x6740a000',
    gasLimit: toHex(30_000_000),
    gasUsed: '0x0',
    transactions: [],
    logsBloom: `0x${'00'.repeat(256)}`,
    miner: TEST_ADDRESS,
    difficulty: '0x0',
    extraData: '0x',
    size: '0x0',
    sealFields: [],
    totalDifficulty: '0x0',
    uncles: [],
    nonce: '0x0000000000000000',
    receiptsRoot: `0x${'00'.repeat(32)}`,
    sha3Uncles: `0x${'00'.repeat(32)}`,
    stateRoot: `0x${'00'.repeat(32)}`,
    transactionsRoot: `0x${'00'.repeat(32)}`,
    mixHash: `0x${'00'.repeat(32)}`,
  }),
};

function receipt(status: '0x1' | '0x0', logs: unknown[] = []): unknown {
  return {
    blockHash: `0x${'11'.repeat(32)}`,
    blockNumber: '0x10',
    transactionHash: TX,
    transactionIndex: '0x0',
    from: TEST_ADDRESS,
    to: CONTRACT,
    cumulativeGasUsed: toHex(90_000),
    gasUsed: toHex(90_000),
    effectiveGasPrice: toHex(2_000_000_000),
    contractAddress: null,
    logs,
    logsBloom: `0x${'00'.repeat(256)}`,
    status,
    type: '0x2',
  };
}

function mintedLog(tokenId: bigint, address: string = CONTRACT): unknown {
  return {
    address,
    topics: encodeEventTopics({
      abi: PRESERVING_ART_ABI,
      eventName: 'ArtworkMinted',
      args: { tokenId, artworkKey: artworkKeyOf(ITEM) },
    }),
    data: encodeAbiParameters(
      [{ type: 'uint8' }, { type: 'bytes32' }, { type: 'string' }],
      [2, `0x${'a1'.repeat(32)}`, 'ipfs://bafy'],
    ),
    blockHash: `0x${'11'.repeat(32)}`,
    blockNumber: '0x10',
    transactionHash: TX,
    transactionIndex: '0x0',
    logIndex: '0x0',
    removed: false,
  };
}

const MINT = {
  contentId: ITEM,
  tokenUri: 'ipfs://bafy',
  title: 'Lamba mena',
  category: 'Craft' as const,
  masterHash: `0x${'a1'.repeat(32)}`,
};

describe('artworkKeyOf', () => {
  it('hashes the lowercase ContentId as UTF-8 (ethers.id)', () => {
    expect(artworkKeyOf(ITEM)).toBe(keccak256(stringToHex(ITEM.toLowerCase())));
    expect(artworkKeyOf(ITEM)).toBe(artworkKeyOf(ITEM.toLowerCase()));
  });
});

describe('PRESERVING_ART_ABI', () => {
  it('matches the ABI exported from the contract', () => {
    const exported = JSON.parse(
      readFileSync(join(__dirname, 'abi', 'PreservingArt.abi.json'), 'utf8'),
    ) as Abi;
    // type, name, input types, indexed flags and output types.
    const signatures = (abi: Abi): Set<string> =>
      new Set(
        abi
          .filter((item) => 'name' in item)
          .map((item) => {
            const inputs = item.inputs
              .map(
                (input) =>
                  `${input.type}${'indexed' in input && input.indexed === true ? ' indexed' : ''}`,
              )
              .join(',');
            const outputs =
              'outputs' in item
                ? item.outputs.map((output) => output.type).join(',')
                : '';
            const name = 'name' in item ? item.name : '';
            return `${item.type} ${name}(${inputs})(${outputs})`;
          }),
      );
    const full = signatures(exported);
    for (const signature of signatures(PRESERVING_ART_ABI)) {
      expect(full).toContain(signature);
    }
  });
});

describe('ViemBlockchain', () => {
  it('derives the gallery address from the key and refuses mainnets', () => {
    expect(blockchain({}).galleryAddress).toBe(TEST_ADDRESS);
    expect(blockchain({}).network).toEqual({
      name: 'Hardhat local',
      chainId: 31337,
      contractAddress: CONTRACT,
    });
    expect(
      () =>
        new ViemBlockchain({
          rpcUrl: 'http://127.0.0.1:8545',
          chainId: 43114,
          contractAddress: CONTRACT,
          privateKey: TEST_KEY,
        }),
    ).toThrow('not a supported testnet');
  });

  it('reads tokenByArtwork with the artwork key', async () => {
    let data: unknown;
    const chain = blockchain({
      eth_call: ([call]) => {
        data = (call as { data: string }).data;
        return encodeFunctionResult({
          abi: PRESERVING_ART_ABI,
          functionName: 'tokenByArtwork',
          result: 5n,
        });
      },
    });

    await expect(chain.findTokenByArtwork(ITEM)).resolves.toBe('5');
    expect(data).toContain(artworkKeyOf(ITEM).slice(2));
  });

  it('returns null for an item without a token', async () => {
    const chain = blockchain({
      eth_call: () =>
        encodeFunctionResult({
          abi: PRESERVING_ART_ABI,
          functionName: 'tokenByArtwork',
          result: 0n,
        }),
    });

    await expect(chain.findTokenByArtwork(ITEM)).resolves.toBeNull();
  });

  it('simulates, then sends safeMint to the gallery wallet with a gas margin', async () => {
    let raw: unknown;
    const calls: string[] = [];
    const chain = blockchain(
      {
        ...CHAIN_BASICS,
        eth_call: () =>
          encodeFunctionResult({
            abi: PRESERVING_ART_ABI,
            functionName: 'safeMint',
            result: 1n,
          }),
        eth_sendRawTransaction: ([tx]) => {
          raw = tx;
          return TX;
        },
      },
      calls,
    );

    await expect(chain.submitMint(MINT)).resolves.toEqual({
      kind: 'submitted',
      txHash: TX,
    });
    expect(calls).toEqual(
      expect.arrayContaining([
        'eth_call',
        'eth_estimateGas',
        'eth_sendRawTransaction',
      ]),
    );
    expect(calls.indexOf('eth_call')).toBeLessThan(
      calls.indexOf('eth_sendRawTransaction'),
    );
    // The signed transaction carries the gallery address as `to` of the token.
    expect(String(raw)).toContain(TEST_ADDRESS.slice(2).toLowerCase());
  });

  it('reports ArtworkAlreadyMinted from the simulation without sending', async () => {
    const calls: string[] = [];
    const chain = blockchain(
      {
        ...CHAIN_BASICS,
        eth_call: () => {
          throw new RpcError(
            3,
            'execution reverted',
            encodeErrorResult({
              abi: PRESERVING_ART_ABI,
              errorName: 'ArtworkAlreadyMinted',
              args: [artworkKeyOf(ITEM), 9n],
            }),
          );
        },
      },
      calls,
    );

    await expect(chain.submitMint(MINT)).resolves.toEqual({
      kind: 'already_minted',
      tokenId: '9',
    });
    expect(calls).not.toContain('eth_sendRawTransaction');
  });

  it('maps another revert to CONTRACT_REVERTED', async () => {
    const chain = blockchain({
      ...CHAIN_BASICS,
      eth_call: () => {
        throw new RpcError(
          3,
          'execution reverted',
          encodeErrorResult({
            abi: PRESERVING_ART_ABI,
            errorName: 'EmptyTitle',
          }),
        );
      },
    });

    await expect(chain.submitMint(MINT)).rejects.toMatchObject({
      code: 'CONTRACT_REVERTED',
      message: 'safeMint reverted (EmptyTitle)',
    });
  });

  it('maps an unreachable RPC to CHAIN_UNAVAILABLE without leaking detail', async () => {
    const chain = blockchain({
      eth_call: () => {
        throw new Error('connect ECONNREFUSED http://user:secret@rpc');
      },
    });

    const error = (await chain
      .findTokenByArtwork(ITEM)
      .catch((e: unknown) => e)) as ChainError;
    expect(error).toBeInstanceOf(ChainError);
    expect(error.code).toBe('CHAIN_UNAVAILABLE');
    expect(error.retryable).toBe(true);
    expect(error.message).not.toContain('secret');
  });

  it('reads the token ID from the ArtworkMinted event of the contract', async () => {
    const chain = blockchain({
      ...CHAIN_BASICS,
      eth_getTransactionReceipt: () =>
        receipt('0x1', [mintedLog(99n, `0x${'99'.repeat(20)}`), mintedLog(3n)]),
      eth_getTransactionByHash: () => null,
    });

    await expect(chain.waitForMint(TX, 1_000)).resolves.toEqual({
      kind: 'confirmed',
      tokenId: '3',
    });
  });

  it('reports a reverted receipt, and a mined transaction without the event', async () => {
    const reverted = blockchain({
      ...CHAIN_BASICS,
      eth_getTransactionReceipt: () => receipt('0x0'),
    });
    const noEvent = blockchain({
      ...CHAIN_BASICS,
      eth_getTransactionReceipt: () => receipt('0x1'),
    });

    await expect(reverted.waitForMint(TX, 1_000)).resolves.toEqual({
      kind: 'reverted',
    });
    await expect(noEvent.waitForMint(TX, 1_000)).resolves.toEqual({
      kind: 'reverted',
    });
  });

  it('tells a dropped transaction from a pending one after the timeout', async () => {
    const tx = {
      hash: TX,
      from: TEST_ADDRESS,
      to: CONTRACT,
      nonce: '0x0',
      gas: toHex(120_000),
      maxFeePerGas: toHex(3_000_000_000),
      maxPriorityFeePerGas: toHex(1_000_000_000),
      value: '0x0',
      input: '0x',
      type: '0x2',
      chainId: toHex(31337),
      blockHash: null,
      blockNumber: null,
      transactionIndex: null,
      v: '0x0',
      r: `0x${'01'.repeat(32)}`,
      s: `0x${'02'.repeat(32)}`,
      yParity: '0x0',
      accessList: [],
    };
    const dropped = blockchain({
      ...CHAIN_BASICS,
      eth_getTransactionReceipt: () => null,
      eth_getTransactionByHash: () => null,
    });
    const pending = blockchain({
      ...CHAIN_BASICS,
      eth_getTransactionReceipt: () => null,
      eth_getTransactionByHash: () => tx,
    });

    await expect(dropped.waitForMint(TX, 60)).resolves.toEqual({
      kind: 'dropped',
    });
    await expect(pending.waitForMint(TX, 60)).resolves.toEqual({
      kind: 'pending',
    });
  });
});

describe('toChainError', () => {
  it('keeps a ChainError and maps anything else to CHAIN_UNAVAILABLE', () => {
    const original = new ChainError('INSUFFICIENT_FUNDS', 'no gas');

    expect(toChainError(original)).toBe(original);
    expect(toChainError(new Error('boom')).code).toBe('CHAIN_UNAVAILABLE');
  });
});

describe('ViemBlockchain public reads (NFT-05)', () => {
  const HASH: Hex = `0x${'a1'.repeat(32)}`;

  function nonexistent(): never {
    throw new RpcError(
      3,
      'execution reverted',
      encodeErrorResult({
        abi: PRESERVING_ART_ABI,
        errorName: 'ERC721NonexistentToken',
        args: [7n],
      }),
    );
  }

  it('decodes getArtwork, verifyFixity, tokenURI and ownerOf', async () => {
    const results: Record<string, () => string> = {
      getArtwork: () =>
        encodeFunctionResult({
          abi: PRESERVING_ART_ABI,
          functionName: 'getArtwork',
          result: {
            mintedAt: 1_795_000_000n,
            category: 2,
            masterHash: HASH,
            title: 'Lamba mena',
          },
        }),
      verifyFixity: () =>
        encodeFunctionResult({
          abi: PRESERVING_ART_ABI,
          functionName: 'verifyFixity',
          result: true,
        }),
      tokenURI: () =>
        encodeFunctionResult({
          abi: PRESERVING_ART_ABI,
          functionName: 'tokenURI',
          result: 'ipfs://bafy',
        }),
      ownerOf: () =>
        encodeFunctionResult({
          abi: PRESERVING_ART_ABI,
          functionName: 'ownerOf',
          result: TEST_ADDRESS,
        }),
    };
    const selectors = Object.fromEntries(
      Object.keys(results).map((name) => [
        viem.toFunctionSelector(
          PRESERVING_ART_ABI.find(
            (item) => item.type === 'function' && item.name === name,
          ) as never,
        ),
        name,
      ]),
    );
    const chain = blockchain({
      eth_call: ([call]) => {
        const data = (call as { data: string }).data;
        const name = selectors[data.slice(0, 10)];
        if (name === undefined) throw new Error('unexpected call');
        return results[name]?.();
      },
    });

    await expect(chain.getArtwork('7')).resolves.toEqual({
      mintedAt: new Date(1_795_000_000_000),
      category: 'Craft',
      masterHash: HASH,
      title: 'Lamba mena',
    });
    await expect(chain.verifyFixity('7', HASH)).resolves.toBe(true);
    await expect(chain.tokenUri('7')).resolves.toBe('ipfs://bafy');
    await expect(chain.ownerOf('7')).resolves.toBe(TEST_ADDRESS);
  });

  it('answers null or false for a token that does not exist', async () => {
    const chain = blockchain({ eth_call: nonexistent });

    await expect(chain.getArtwork('7')).resolves.toBeNull();
    await expect(chain.verifyFixity('7', HASH)).resolves.toBe(false);
    await expect(chain.tokenUri('7')).resolves.toBeNull();
    await expect(chain.ownerOf('7')).resolves.toBeNull();
  });

  it('rejects with CHAIN_UNAVAILABLE when the RPC fails', async () => {
    const chain = blockchain({
      eth_call: () => {
        throw new RpcError(-32000, 'upstream down');
      },
    });

    await expect(chain.getArtwork('7')).rejects.toMatchObject({
      code: 'CHAIN_UNAVAILABLE',
    });
    await expect(chain.verifyFixity('7', HASH)).rejects.toMatchObject({
      code: 'CHAIN_UNAVAILABLE',
    });
  });
});
