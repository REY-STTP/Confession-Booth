// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ConfessionRegistry — tamper-evident publication registry.
/// @notice Hanya menyimpan komitmen publikasi, BUKAN isi confession.
/// @dev Immutable (tanpa proxy). Tidak ada fungsi hapus/ubah histori.
///      P0 #5: publish dibatasi allowlist publisher agar ID tidak bisa di-squat
///      pihak asing (front-run). Owner = deployer; rotasi via setPublisher.
contract ConfessionRegistry {
    error EmptyContentHash();
    error EmptyConfessionId();
    error DuplicateConfession(bytes32 confessionId);
    error CidTooLong();
    error NotPublisher(address caller);
    error NotOwner(address caller);
    error ZeroAddress();

    uint256 public constant MAX_CID_LEN = 128;
    /// @notice Versi protokol saat ini (penegakan nilai di P2 — InvalidVersion).
    uint16 public constant PROTOCOL_VERSION = 1;

    address public owner;
    mapping(address => bool) public publishers;

    event PublisherUpdated(address indexed publisher, bool allowed);
    event ConfessionPublished(
        bytes32 indexed confessionId,
        bytes32 indexed contentHash,
        address indexed publisher,
        string contentCID,
        uint64 timestamp,
        uint16 version
    );

    mapping(bytes32 => bool) private _exists;

    constructor() {
        owner = msg.sender;
        publishers[msg.sender] = true;
        emit PublisherUpdated(msg.sender, true);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    /// @notice Tambah/cabut publisher. Hanya owner. Revolusi kunci = revoke + grant.
    function setPublisher(address who, bool allowed) external onlyOwner {
        if (who == address(0)) revert ZeroAddress();
        publishers[who] = allowed;
        emit PublisherUpdated(who, allowed);
    }

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
        if (!publishers[msg.sender]) revert NotPublisher(msg.sender);
        if (confessionId == bytes32(0)) revert EmptyConfessionId();
        if (contentHash == bytes32(0)) revert EmptyContentHash();
        if (bytes(contentCID).length > MAX_CID_LEN) revert CidTooLong();
        if (_exists[confessionId]) revert DuplicateConfession(confessionId);
        _exists[confessionId] = true;
        emit ConfessionPublished(
            confessionId,
            contentHash,
            msg.sender,
            contentCID,
            uint64(block.timestamp),
            version
        );
    }

    function exists(bytes32 confessionId) external view returns (bool) {
        return _exists[confessionId];
    }
}
