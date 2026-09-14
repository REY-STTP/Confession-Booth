# Confession Booth — Privacy Principles

## What We Aim to Protect

Confession Booth is designed to avoid exposing a public identity attached to a confession.

## What We Do Not Promise

The service does not automatically guarantee perfect anonymity.

Potential correlation sources include:

- blockchain transaction history;
- RPC provider metadata;
- network/IP metadata;
- browser/device metadata;
- third-party infrastructure;
- user behavior that reveals identity.

## Data Minimization

The application should collect only what is necessary to:

- authenticate;
- publish content;
- prevent abuse;
- moderate content;
- operate the service.

## Public Data

A normal feed response should expose:

- anonymous display name;
- confession content;
- category;
- public engagement counts;
- publication metadata.

It should not expose:

- wallet address;
- internal user ID;
- IP;
- email;
- moderation data.

## Blockchain

Blockchain records are public and generally immutable.

Do not publish sensitive personal information on-chain.

## User Responsibility

Users should avoid including identifying information in their own confession, such as:

- full name;
- address;
- phone number;
- private credentials;
- unique personal details that make identification trivial.

The UI should warn users before publication.

## Privacy Evolution

Future versions may introduce stronger mechanisms such as anonymous credentials, relayers, and zero-knowledge proofs.
