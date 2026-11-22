import {
  CONTENT_ID,
  CONTRACT,
  EXPLORER,
  IPFS_GATEWAY,
  MASTER_HASH,
  METADATA_CID,
  mintRecord,
  REQUESTER_ID,
  TOKEN_URI,
  TX_HASH,
} from '../../test/fixtures/provenance';
import { MINT_FAILURES } from '../mint/mint-failure';
import { NO_MINT_SCOPE, PROVENANCE_SCOPE, toMintView } from '../mint/mint-view';
import {
  cacheControlOf,
  gatewayUrlOf,
  publicFailureCode,
  toProvenanceMintView,
  toProvenanceView,
  type VerificationView,
} from './provenance-view';

const OPTIONS = {
  explorerBaseUrl: `${EXPLORER}/`,
  ipfsGatewayUrl: IPFS_GATEWAY,
};

const VERIFIED: VerificationView = {
  state: 'verified',
  fixity: true,
  onChain: null,
  checkedAt: '2026-11-22T11:00:00.000Z',
};

describe('toProvenanceMintView', () => {
  it('keeps the NFT-04 MintRecord fields unchanged for every status', () => {
    for (const status of ['pending', 'confirmed', 'failed'] as const) {
      const record = mintRecord({ status });
      const view = toProvenanceMintView(record, OPTIONS, undefined);
      expect(view).toMatchObject({ ...toMintView(record, EXPLORER) });
    }
  });

  it('adds every public chain reference to a confirmed mint', () => {
    const view = toProvenanceMintView(mintRecord(), OPTIONS, VERIFIED);
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

  it('adds only explorer links to a pending mint', () => {
    const sent = toProvenanceMintView(
      mintRecord({ status: 'pending', tokenId: null, confirmedAt: null }),
      OPTIONS,
      undefined,
    );
    expect(sent.explorer).toEqual({
      transaction: `${EXPLORER}/tx/${TX_HASH}`,
      token: null,
    });
    expect(sent).not.toHaveProperty('tokenUri');
    expect(sent).not.toHaveProperty('masterHash');
    expect(sent).not.toHaveProperty('verification');

    const unsent = toProvenanceMintView(
      mintRecord({ status: 'pending', txHash: null, tokenId: null }),
      OPTIONS,
      undefined,
    );
    expect(unsent.explorer).toEqual({ transaction: null, token: null });
  });

  it('adds only a public failure code to a failed mint', () => {
    const view = toProvenanceMintView(
      mintRecord({ status: 'failed', failureCode: 'INSUFFICIENT_FUNDS' }),
      OPTIONS,
      undefined,
    );
    expect(view).toMatchObject({
      status: 'failed',
      failureCode: 'INSUFFICIENT_FUNDS',
      failureReason: MINT_FAILURES.INSUFFICIENT_FUNDS,
      tokenId: null,
    });
    expect(view).not.toHaveProperty('tokenUri');
    expect(view).not.toHaveProperty('explorer');
    expect(view).not.toHaveProperty('verification');
  });

  it('never shows an unknown internal failure code', () => {
    const view = toProvenanceMintView(
      mintRecord({ status: 'failed', failureCode: 'RPC said: key 0xdead' }),
      OPTIONS,
      undefined,
    );
    expect(view.failureCode).toBe('UNKNOWN');
    expect(JSON.stringify(view)).not.toContain('0xdead');
  });

  it('drops added values that do not have the expected public shape', () => {
    const view = toProvenanceMintView(
      mintRecord({
        txHash: 'not-a-hash',
        tokenUri: 'https://internal.example/meta.json',
        tokenId: '-1',
        masterHash: 'sha256:abc',
        metadataCid: '../x',
      }),
      OPTIONS,
      undefined,
    );
    expect(view).toMatchObject({
      explorer: { transaction: null, token: null },
      tokenUri: null,
      metadataUrl: null,
      metadataCid: null,
      masterHash: null,
    });
  });

  it('never exposes requester, idempotency or request data', () => {
    const json = JSON.stringify(
      toProvenanceMintView(mintRecord(), OPTIONS, VERIFIED),
    );
    expect(json).not.toContain(REQUESTER_ID);
    expect(json).not.toContain('secret-key-value');
    expect(json).not.toContain('req-internal-1');
    expect(json).not.toContain('attempts');
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
      toProvenanceMintView(mintRecord(), OPTIONS, VERIFIED),
    );
    expect(view.scope).toBe(PROVENANCE_SCOPE);
  });

  it('caches confirmed records briefly and nothing else', () => {
    const confirmed = (state: VerificationView['state']) =>
      toProvenanceView(
        CONTENT_ID,
        toProvenanceMintView(mintRecord(), OPTIONS, { ...VERIFIED, state }),
      );
    expect(cacheControlOf(confirmed('verified'))).toBe('public, max-age=60');
    expect(cacheControlOf(confirmed('mismatch'))).toBe('public, max-age=60');
    expect(cacheControlOf(confirmed('unverifiable'))).toBe(
      'public, max-age=15',
    );
    expect(cacheControlOf(toProvenanceView(CONTENT_ID, null))).toBe('no-store');
    const pending = toProvenanceMintView(
      mintRecord({ status: 'pending' }),
      OPTIONS,
      undefined,
    );
    expect(cacheControlOf(toProvenanceView(CONTENT_ID, pending))).toBe(
      'no-store',
    );
  });
});
