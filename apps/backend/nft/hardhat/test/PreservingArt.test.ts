// Registers the Hardhat matchers on the chai instance that this file uses.
// On Windows, a working directory with a lowercase drive letter makes Node
// load chai twice (c:\ and C:\), and the toolbox registers them on the copy
// loaded by the config file only.
import '@nomicfoundation/hardhat-chai-matchers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

// Contract tests of nft_context.md §13.2, run on the in-memory Hardhat network.

const Category = { Painting: 0, Sculpture: 1, Craft: 2 } as const;

const ARTWORK_IDS = [
  '0d6c2f1e-8b7a-4f3e-9c1d-2a5b6c7d8e9f',
  'b3a9e4c2-1f6d-4a8b-9e7c-5d4f3a2b1c0e',
  '7e1f0a9b-3c2d-4e5f-8a6b-9c0d1e2f3a4b',
] as const;
const [PAINTING_ID, SCULPTURE_ID, CRAFT_ID] = ARTWORK_IDS;

/** Encoding of nft_context.md §8.3: keccak256 of the lowercase UUID. */
function artworkKey(artworkId: string): string {
  return ethers.id(artworkId.toLowerCase());
}

/** sha256 of the content, as the service computes it on the master file. */
function masterHash(content: string): string {
  return ethers.sha256(ethers.toUtf8Bytes(content));
}

const URI = 'ipfs://bafkreimetadata';
const TITLE = 'Paysage au coucher du soleil';

async function deployFixture() {
  const [owner, stranger] = await ethers.getSigners();
  if (owner === undefined || stranger === undefined) {
    throw new Error('The Hardhat network must provide two signers');
  }
  const contract = await ethers.deployContract('PreservingArt', [
    owner.address,
  ]);
  return { contract, owner, stranger };
}

describe('PreservingArt', () => {
  describe('deployment', () => {
    it('sets the name, symbol and owner, with no token yet', async () => {
      const { contract, owner } = await loadFixture(deployFixture);

      expect(await contract.name()).to.equal('Preserving the Art');
      expect(await contract.symbol()).to.equal('PTA');
      expect(await contract.owner()).to.equal(owner.address);
      expect(await contract.totalMinted()).to.equal(0n);
      expect(await contract.MAX_TITLE_BYTES()).to.equal(256n);
    });
  });

  describe('safeMint', () => {
    it('mints token 1 and records the artwork', async () => {
      const { contract, owner } = await loadFixture(deployFixture);
      const key = artworkKey(PAINTING_ID);
      const hash = masterHash('painting master');

      const tx = await contract.safeMint(
        owner.address,
        key,
        URI,
        TITLE,
        Category.Painting,
        hash,
      );
      const receipt = await tx.wait();
      if (receipt === null) {
        throw new Error('The mint transaction has no receipt');
      }
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      if (block === null) {
        throw new Error('The mint block is missing');
      }

      expect(await contract.ownerOf(1n)).to.equal(owner.address);
      expect(await contract.tokenURI(1n)).to.equal(URI);
      expect(await contract.tokenByArtwork(key)).to.equal(1n);
      expect(await contract.totalMinted()).to.equal(1n);

      const artwork = await contract.getArtwork(1n);
      expect(artwork.mintedAt).to.equal(BigInt(block.timestamp));
      expect(artwork.category).to.equal(BigInt(Category.Painting));
      expect(artwork.masterHash).to.equal(hash);
      expect(artwork.title).to.equal(TITLE);
    });

    it('emits ArtworkMinted with the token, key, category, hash and URI', async () => {
      const { contract, owner } = await loadFixture(deployFixture);
      const key = artworkKey(SCULPTURE_ID);
      const hash = masterHash('sculpture master');

      await expect(
        contract.safeMint(
          owner.address,
          key,
          URI,
          'Buste en bois sculpté',
          Category.Sculpture,
          hash,
        ),
      )
        .to.emit(contract, 'ArtworkMinted')
        .withArgs(1n, key, Category.Sculpture, hash, URI);
    });

    it('rejects a caller that is not the owner', async () => {
      const { contract, stranger } = await loadFixture(deployFixture);

      await expect(
        contract
          .connect(stranger)
          .safeMint(
            stranger.address,
            artworkKey(PAINTING_ID),
            URI,
            TITLE,
            Category.Painting,
            masterHash('master'),
          ),
      )
        .to.be.revertedWithCustomError(contract, 'OwnableUnauthorizedAccount')
        .withArgs(stranger.address);
    });

    it('rejects a second mint of the same artwork', async () => {
      const { contract, owner } = await loadFixture(deployFixture);
      const key = artworkKey(PAINTING_ID);
      await contract.safeMint(
        owner.address,
        key,
        URI,
        TITLE,
        Category.Painting,
        masterHash('master'),
      );

      await expect(
        contract.safeMint(
          owner.address,
          key,
          'ipfs://other',
          'Other title',
          Category.Craft,
          masterHash('other master'),
        ),
      )
        .to.be.revertedWithCustomError(contract, 'ArtworkAlreadyMinted')
        .withArgs(key, 1n);
    });

    it('rejects an empty title', async () => {
      const { contract, owner } = await loadFixture(deployFixture);

      await expect(
        contract.safeMint(
          owner.address,
          artworkKey(PAINTING_ID),
          URI,
          '',
          Category.Painting,
          masterHash('master'),
        ),
      ).to.be.revertedWithCustomError(contract, 'EmptyTitle');
    });

    it('limits the title to 256 bytes of UTF-8, not 256 characters', async () => {
      const { contract, owner } = await loadFixture(deployFixture);
      const mint = (artworkId: string, title: string) =>
        contract.safeMint(
          owner.address,
          artworkKey(artworkId),
          URI,
          title,
          Category.Painting,
          masterHash('master'),
        );
      // "é" takes two bytes in UTF-8.
      const exactly256Bytes = 'é'.repeat(128);
      const bytes257 = `${exactly256Bytes}a`;
      // 100 emojis take 400 bytes (nft_context.md §13.3).
      const hundredEmojis = '🎨'.repeat(100);

      await expect(mint(PAINTING_ID, exactly256Bytes)).to.emit(
        contract,
        'ArtworkMinted',
      );
      await expect(mint(SCULPTURE_ID, bytes257)).to.be.revertedWithCustomError(
        contract,
        'TitleTooLong',
      );
      await expect(mint(CRAFT_ID, hundredEmojis)).to.be.revertedWithCustomError(
        contract,
        'TitleTooLong',
      );
    });

    it('rejects an empty master hash', async () => {
      const { contract, owner } = await loadFixture(deployFixture);

      await expect(
        contract.safeMint(
          owner.address,
          artworkKey(PAINTING_ID),
          URI,
          TITLE,
          Category.Painting,
          ethers.ZeroHash,
        ),
      ).to.be.revertedWithCustomError(contract, 'EmptyMasterHash');
    });

    it('rejects a category outside the enum', async () => {
      const { contract, owner } = await loadFixture(deployFixture);

      await expect(
        contract.safeMint(
          owner.address,
          artworkKey(PAINTING_ID),
          URI,
          TITLE,
          3,
          masterHash('master'),
        ),
      ).to.be.reverted;
    });

    it('mints consecutive token IDs from 1', async () => {
      const { contract, owner } = await loadFixture(deployFixture);
      const categories = [
        Category.Painting,
        Category.Sculpture,
        Category.Craft,
      ] as const;

      for (const [index, artworkId] of ARTWORK_IDS.entries()) {
        await expect(
          contract.safeMint(
            owner.address,
            artworkKey(artworkId),
            `ipfs://metadata-${String(index)}`,
            `Artwork ${String(index)}`,
            categories[index] ?? Category.Painting,
            masterHash(`master ${String(index)}`),
          ),
        )
          .to.emit(contract, 'ArtworkMinted')
          .withArgs(
            BigInt(index + 1),
            artworkKey(artworkId),
            categories[index] ?? Category.Painting,
            masterHash(`master ${String(index)}`),
            `ipfs://metadata-${String(index)}`,
          );
      }

      expect(await contract.totalMinted()).to.equal(3n);
      expect(await contract.tokenByArtwork(artworkKey(CRAFT_ID))).to.equal(3n);
    });

    it('gives the same key to an uppercase and a lowercase artwork ID', async () => {
      const { contract, owner } = await loadFixture(deployFixture);
      await contract.safeMint(
        owner.address,
        artworkKey(PAINTING_ID.toUpperCase()),
        URI,
        TITLE,
        Category.Painting,
        masterHash('master'),
      );

      await expect(
        contract.safeMint(
          owner.address,
          artworkKey(PAINTING_ID),
          URI,
          TITLE,
          Category.Painting,
          masterHash('master'),
        ),
      ).to.be.revertedWithCustomError(contract, 'ArtworkAlreadyMinted');
    });
  });

  describe('verifyFixity', () => {
    it('accepts the master hash and rejects a hash altered by one byte', async () => {
      const { contract, owner } = await loadFixture(deployFixture);
      const hash = masterHash('painting master');
      await contract.safeMint(
        owner.address,
        artworkKey(PAINTING_ID),
        URI,
        TITLE,
        Category.Painting,
        hash,
      );
      const lastByte = hash.slice(-2) === '00' ? '01' : '00';
      const altered = `${hash.slice(0, -2)}${lastByte}`;

      expect(await contract.verifyFixity(1n, hash)).to.equal(true);
      expect(await contract.verifyFixity(1n, altered)).to.equal(false);
    });
  });

  describe('missing tokens', () => {
    it('rejects reads of a token that does not exist', async () => {
      const { contract } = await loadFixture(deployFixture);

      await expect(contract.getArtwork(99n))
        .to.be.revertedWithCustomError(contract, 'ERC721NonexistentToken')
        .withArgs(99n);
      await expect(contract.verifyFixity(99n, masterHash('master')))
        .to.be.revertedWithCustomError(contract, 'ERC721NonexistentToken')
        .withArgs(99n);
      await expect(contract.tokenURI(99n))
        .to.be.revertedWithCustomError(contract, 'ERC721NonexistentToken')
        .withArgs(99n);
    });

    it('returns token 0 for an artwork that was never minted', async () => {
      const { contract } = await loadFixture(deployFixture);

      expect(await contract.tokenByArtwork(artworkKey(PAINTING_ID))).to.equal(
        0n,
      );
    });
  });

  describe('supportsInterface', () => {
    it('supports ERC-165, ERC-721, ERC-721 Metadata and ERC-4906', async () => {
      const { contract } = await loadFixture(deployFixture);

      for (const interfaceId of [
        '0x01ffc9a7',
        '0x80ac58cd',
        '0x5b5e139f',
        '0x49064906',
      ]) {
        expect(await contract.supportsInterface(interfaceId)).to.equal(true);
      }
      expect(await contract.supportsInterface('0xffffffff')).to.equal(false);
    });
  });

  describe('immutability', () => {
    it('exposes no function that edits a token URI or an artwork record', async () => {
      const { contract } = await loadFixture(deployFixture);
      const writeFunctions: string[] = [];
      contract.interface.forEachFunction((fragment) => {
        if (!fragment.constant) {
          writeFunctions.push(fragment.name);
        }
      });

      // Only minting, the standard ERC-721 transfers and approvals, and
      // Ownable remain. None of them changes tokenURI or the artwork record.
      expect([...new Set(writeFunctions)].sort()).to.deep.equal([
        'approve',
        'renounceOwnership',
        'safeMint',
        'safeTransferFrom',
        'setApprovalForAll',
        'transferFrom',
        'transferOwnership',
      ]);
    });
  });
});
