import { viem } from './viem';

/**
 * The part of the `PreservingArt` ABI the service uses, typed for viem.
 * `abi/PreservingArt.abi.json` is the full ABI exported from the contract
 * (`feature/nft-l1`); a unit test checks that every entry here matches it.
 */
export const PRESERVING_ART_ABI = viem.parseAbi([
  'function safeMint(address to, bytes32 artworkKey, string uri, string title, uint8 category, bytes32 masterHash) returns (uint256 tokenId)',
  'function tokenByArtwork(bytes32 artworkKey) view returns (uint256 tokenId)',
  'struct Artwork { uint64 mintedAt; uint8 category; bytes32 masterHash; string title; }',
  'function getArtwork(uint256 tokenId) view returns (Artwork)',
  'function verifyFixity(uint256 tokenId, bytes32 hash) view returns (bool)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'error ERC721NonexistentToken(uint256 tokenId)',
  'event ArtworkMinted(uint256 indexed tokenId, bytes32 indexed artworkKey, uint8 category, bytes32 masterHash, string uri)',
  'error ArtworkAlreadyMinted(bytes32 artworkKey, uint256 tokenId)',
  'error EmptyTitle()',
  'error TitleTooLong()',
  'error EmptyMasterHash()',
  'error OwnableUnauthorizedAccount(address account)',
]);
