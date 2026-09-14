// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ConfessionRegistry — tamper-evident publication registry (MVP).
/// @notice Hanya menyimpan komitmen publikasi, BUKAN isi confession.
/// @dev Immutable (tanpa proxy). Tidak ada fungsi hapus/ubah histori.
contract ConfessionRegistry {
    error EmptyContentHash();
    error EmptyConfessionId();
    error DuplicateConfession(bytes32 confessionId);
    error CidTooLong();

    uint256 public constant MAX_CID_LEN = 128;

    event ConfessionPublished(
        bytes32 indexed confessionId,
        bytes32 indexed contentHash,
        string contentCID,
        uint64 timestamp,
        uint16 version
    );

    mapping(bytes32 => bool) private _exists;

    /// @param confessionId ID publikasi unik (bytes32, mis. keccak dari public_id).
    /// @param contentHash sha256 kanonis konten (32 byte).
    /// @param contentCID referensi content-addressed (boleh "" jika hash-only).
    /// @param version versi protokol.
    function publish(
        bytes32 confessionId,
        bytes32 contentHash,
        string calldata contentCID,
        uint16 version
    ) external {
        if (confessionId == bytes32(0)) revert EmptyConfessionId();
        if (contentHash == bytes32(0)) revert EmptyContentHash();
        if (bytes(contentCID).length > MAX_CID_LEN) revert CidTooLong();
        if (_exists[confessionId]) revert DuplicateConfession(confessionId);
        _exists[confessionId] = true;
        emit ConfessionPublished(confessionId, contentHash, contentCID, uint64(block.timestamp), version);
    }

    function exists(bytes32 confessionId) external view returns (bool) {
        return _exists[confessionId];
    }
}
