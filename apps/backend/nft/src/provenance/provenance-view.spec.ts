import {
  CONTENT_ID,
  CONTRACT,
  EXPLORER,
  IPFS_GATEWAY,
  MASTER_HASH,
  METADATA_CID,
  mintRecord,
  TOKEN_URI,
  TX_HASH,
} from '../../test/fixtures/provenance';
import {
  gatewayUrlOf,
  NO_MINT_SCOPE,
  PROVENANCE_SCOPE,
  PUBLIC_FAILURES,
  publicFailureCode,
  toMintView,
  toProvenanceView,
  type VerificationView,
} from './provenance-view';

const OPTIONS = { explorerBaseUrl: `${EXPLORER}/`, ipfsGatewayUrl: IPFS_GATEWAY };

const VERIFIED: VerificationView = {
  state: 'verified',
  fixity: true,
  onChain: null,
  checkedAt: '2026-11-22T11:00:00.000Z',
};

/** Keys of the frozen contract `MintRecord`. */
const CONTRACT_KEYS = [
  'mintId',
  'contentId',
  'status',
  'network',
  'tokenId',
  'transactionHash',
  'explorerUrl',
  'failureReason',
  'requestedAt',
  'confirmedAt',
];

describe('toMintView', () => {
  it('shows every public chain reference of a confirmed mint', () => {
    const view = toMintView(mintRecord(), OPTIONS, VERIFIED);
    expect(view).toEqual({
      mintId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
      contentId: CONTENT_ID,
      status: 'confirmed',
      network: {
        name: 'Avalanche Fuji',
        chainId: 43113,
        contractAddress: CONTRACT,
      },
      tokenId: '7',
      transactionHash: TX_HASH,
      explorerUrl: `${EXPLORER}/tx/${TX_HASH}`,
      failureReason: null,
      requestedAt: '2026-11-22T10:00:00.000Z',
      confirmedAt: '2026-11-22T10:00:09.000Z',
      explorer: {
        transaction: `${EXPLORER}/tx/${TX_HASH}`,
        token: `${EXPLORER}/nft/${CONTRACT}/7`,
      },
      tokenUri: TOKEN_URI,
      metadataUrl: `https://gateway.pinata.cloud/ipfs/${METADATA_CID}`,
      metadataCid: METADATA_CID,
      masterHash: MASTER_HASH,
      mintedAt: '2026-11-22T10:00:09.000Z',
      verification: VERIFIED,
    });
  });

  it('keeps every frozen MintRecord field for each status', () => {
    for (const status of ['pending', 'confirmed', 'failed'] as const) {
      const view = toMintView(mintRecord({ status }), OPTIONS, undefined);
      expect(Object.keys(view)).toEqual(expect.arrayContaining(CONTRACT_KEYS));
    }
  });

  it('shows the transaction of a pending mint once sent, and no token data', () => {
    const view = toMintView(
      mintRecord({ status: 'pending', tokenId: null, confirmedAt: null }),
      OPTIONS,
      undefined,
    );
    expect(view).toMatchObject({
      status: 'pending',
      tokenId: null,
      transactionHash: TX_HASH,
      explorerUrl: `${EXPLORER}/tx/${TX_HASH}`,
      confirmedAt: null,
    });
    expect(view).not.toHaveProperty('tokenUri');
    expect(view).not.toHaveProperty('masterHash');
    expect(view).not.toHaveProperty('verification');
  });

  it('shows a pending mint not yet sent without links', () => {
    const view = toMintView(
      mintRecord({ status: 'pending', txHash: null, tokenId: null }),
      OPTIONS,
      undefined,
    );
    expect(view.explorerUrl).toBeNull();
    expect(view.explorer).toEqual({ transaction: null, token: null });
  });

  it('shows only the status and a public failure code of a failed mint', () => {
    const view = toMintView(
      mintRecord({ status: 'failed', failureCode: 'INSUFFICIENT_FUNDS' }),
      OPTIONS,
      undefined,
    );
    expect(view).toMatchObject({
      status: 'failed',
      failureCode: 'INSUFFICIENT_FUNDS',
      failureReason: PUBLIC_FAILURES.INSUFFICIENT_FUNDS,
      tokenId: null,
      transactionHash: null,
      explorerUrl: null,
    });
    expect(view).not.toHaveProperty('tokenUri');
    expect(view).not.toHaveProperty('explorer');
  });

  it('never shows an unknown internal failure code', () => {
    const view = toMintView(
      mintRecord({ status: 'failed', failureCode: 'RPC said: key 0xdead' }),
      OPTIONS,
      undefined,
    );
    expect(view.failureCode).toBe('UNKNOWN');
    expect(JSON.stringify(view)).not.toContain('0xdead');
  });

  it('drops stored values that do not have the expected public shape', () => {
    const view = toMintView(
      mintRecord({
        txHash: 'not-a-hash',
        tokenUri: 'https://internal.example/meta.json',
        tokenId: '-1',
        masterHash: 'sha256:abc',
      }),
      OPTIONS,
      undefined,
    );
    expect(view).toMatchObject({
      transactionHash: null,
      tokenUri: null,
      metadataUrl: null,
      tokenId: null,
      masterHash: null,
      explorerUrl: null,
    });
  });

  it('names an unknown chain by its ID', () => {
    const view = toMintView(mintRecord({ chainId: 99 }), OPTIONS, undefined);
    expect(view.network?.name).toBe('Chain 99');
  });

  it('never exposes requester or idempotency data', () => {
    const record = {
      ...mintRecord(),
      requesterId: '11111111-2222-4333-8444-555555555555',
      idempotencyKey: 'secret-key-value-123',
    };
    const json = JSON.stringify(toMintView(record, OPTIONS, VERIFIED));
    expect(json).not.toContain('11111111-2222');
    expect(json).not.toContain('secret-key-value');
  });
});

describe('helpers', () => {
  it('maps failure codes to the allowlist', () => {
    expect(publicFailureCode(null)).toBe('UNKNOWN');
    expect(publicFailureCode('toString')).toBe('UNKNOWN');
    expect(publicFailureCode('CHAIN_UNAVAILABLE')).toBe('CHAIN_UNAVAILABLE');
  });

  it('builds a gateway URL only from an ipfs URI', () => {
    expect(gatewayUrlOf(TOKEN_URI, 'https://gw.example/ipfs')).toBe(
      `https://gw.example/ipfs/${METADATA_CID}`,
    );
    expect(gatewayUrlOf('ipfs://../etc', 'https://gw.example')).toBeNull();
    expect(gatewayUrlOf(null, 'https://gw.example')).toBeNull();
  });

  it('states the scope with and without a mint', () => {
    expect(toProvenanceView(CONTENT_ID, null)).toEqual({
      contentId: CONTENT_ID,
      mint: null,
      scope: NO_MINT_SCOPE,
    });
    const view = toProvenanceView(
      CONTENT_ID,
      toMintView(mintRecord(), OPTIONS, VERIFIED),
    );
    expect(view.scope).toBe(PROVENANCE_SCOPE);
    expect(view.scope).toContain('does not prove physical authenticity');
  });
});
