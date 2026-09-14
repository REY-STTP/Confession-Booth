# Confession Booth — Smart Contract Specification

## 1. Purpose

The contract provides a public, tamper-evident publication registry.

It is **not** the content database.

## 2. Minimal Contract Responsibilities

- accept publication commitment;
- emit publication event;
- optionally prevent duplicate publication IDs;
- expose verification data.

## 3. Conceptual Interface

```solidity
interface IConfessionRegistry {
    function publish(
        bytes32 confessionId,
        bytes32 contentHash,
        string calldata contentCID,
        uint16 version
    ) external;

    function exists(bytes32 confessionId) external view returns (bool);
}
```

## 4. Event

```solidity
event ConfessionPublished(
    bytes32 indexed confessionId,
    bytes32 indexed contentHash,
    string contentCID,
    uint64 timestamp,
    uint16 version
);
```

## 5. Security

Use:

- OpenZeppelin AccessControl/Ownable where administration is needed;
- reentrancy protection where applicable;
- input length limits;
- duplicate-ID protection;
- event-based indexing.

The contract should not contain an emergency function that silently rewrites historical publication data.

## 6. Upgradeability

MVP recommendation:

Prefer a small immutable registry unless upgradeability is genuinely required.

If proxy upgradeability is used:

- document admin authority;
- use a multisig;
- publish upgrade policy;
- emit upgrade events;
- audit before mainnet.

## 7. Gas Considerations

Avoid storing large strings on-chain.

A CID itself may be acceptable depending on chain costs, but a hash-only design is cheaper:

```text
confessionId
contentHash
version
```

The backend can map the hash to the content reference.

## 8. Verification

A client/verifier should be able to calculate:

`hash(retrievedContent) == onChainContentHash`

If equal, the content matches the published commitment.

## 9. Moderation

Do not pretend that an on-chain publication can be erased.

Moderation operates at the application layer:

`VISIBLE → HIDDEN/REMOVED`

Historical blockchain evidence remains immutable.
