// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title PreservingArt — preservation certificates for the "Preserving the Art" gallery
contract PreservingArt is ERC721, ERC721URIStorage, Ownable {
    enum Category { Painting, Sculpture, Craft }

    struct Artwork {
        uint64 mintedAt;     // block.timestamp at mint
        Category category;
        bytes32 masterHash;  // sha256 of the master file (fixity check)
        string title;
    }

    uint256 public constant MAX_TITLE_BYTES = 256;

    uint256 private _nextTokenId = 1;
    mapping(uint256 tokenId => Artwork) private _artworks;
    mapping(bytes32 artworkKey => uint256 tokenId) public tokenByArtwork;

    event ArtworkMinted(
        uint256 indexed tokenId,
        bytes32 indexed artworkKey,
        Category category,
        bytes32 masterHash,
        string uri
    );

    error ArtworkAlreadyMinted(bytes32 artworkKey, uint256 tokenId);
    error EmptyTitle();
    error TitleTooLong();
    error EmptyMasterHash();

    constructor(address initialOwner)
        ERC721("Preserving the Art", "PTA")
        Ownable(initialOwner)
    {}

    function safeMint(
        address to,
        bytes32 artworkKey,
        string calldata uri,
        string calldata title,
        Category category,
        bytes32 masterHash
    ) external onlyOwner returns (uint256 tokenId) {
        uint256 existing = tokenByArtwork[artworkKey];
        if (existing != 0) revert ArtworkAlreadyMinted(artworkKey, existing);
        if (bytes(title).length == 0) revert EmptyTitle();
        if (bytes(title).length > MAX_TITLE_BYTES) revert TitleTooLong();
        if (masterHash == bytes32(0)) revert EmptyMasterHash();

        tokenId = _nextTokenId++;
        tokenByArtwork[artworkKey] = tokenId;
        _artworks[tokenId] = Artwork({
            mintedAt: uint64(block.timestamp),
            category: category,
            masterHash: masterHash,
            title: title
        });

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit ArtworkMinted(tokenId, artworkKey, category, masterHash, uri);
    }

    function getArtwork(uint256 tokenId) external view returns (Artwork memory) {
        _requireOwned(tokenId);
        return _artworks[tokenId];
    }

    function verifyFixity(uint256 tokenId, bytes32 hash) external view returns (bool) {
        _requireOwned(tokenId);
        return _artworks[tokenId].masterHash == hash;
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function tokenURI(uint256 tokenId)
        public view override(ERC721, ERC721URIStorage) returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721URIStorage) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
