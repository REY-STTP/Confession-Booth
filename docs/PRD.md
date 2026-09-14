# Confession Booth — Product Requirements Document

**Status:** Draft v1.0  
**Product:** Confession Booth  
**Working codename:** UNSAID  
**Document owner:** Product & Engineering  
**Target:** Web3 / DApp anonymous confession platform

## 1. Product Vision

Confession Booth is an anonymous social feed where people can publish thoughts, secrets, feelings, and confessions without exposing a public identity.

The core product principle is:

> **Identity is optional; expression is the product.**

Blockchain is used for verifiability, ownership of actions, and tamper-evident references—not as a place to store private confession plaintext.

## 2. Problem

Traditional social platforms make users perform an identity:

- username/profile/avatar are persistent;
- social graphs expose relationships;
- public wallet addresses can reveal transaction history;
- users may avoid honest expression because posts are attached to identity.

Confession Booth should provide a lower-identity environment while still preventing spam, abuse, and manipulation.

## 3. Goals

### Primary goals

1. Publish a confession without exposing a public profile.
2. Browse a chronological and ranked confession feed.
3. React and reply anonymously.
4. Preserve verifiable publication metadata.
5. Minimize unnecessary collection of personal data.
6. Provide moderation and abuse controls.
7. Make the experience feel like a distinct "booth", not a generic social network.

### Secondary goals

- Categories and discovery.
- Trending and "Most Relatable" feeds.
- Midnight Confessions.
- Anonymous reputation/rate-limit mechanisms.
- Decentralized content references.
- Future privacy-preserving credentials / ZK mechanisms.

### Non-goals for MVP

- Direct messaging.
- Public follower/following graph.
- Public user profiles.
- Cryptocurrency payments/tipping.
- Token speculation.
- Storing plaintext confession text permanently on-chain.
- Claiming mathematically guaranteed anonymity.

## 4. Target Users

### Anonymous visitor

Can read public content and understand the product before connecting a wallet.

### Anonymous contributor

Can create confessions, reactions, and whispers while using an anonymous session.

### Moderator

Reviews reports, removes/limits abusive content, and handles moderation queues.

### Administrator

Manages configuration, categories, moderation policies, and operational health.

## 5. Core Principles

### Privacy by default

Do not expose wallet addresses in the public UI.

### Data minimization

Do not collect name, email, phone number, or unnecessary profile information for normal use.

### On-chain minimalism

Only publish information that needs blockchain verifiability.

### Honest privacy claims

The product must not claim "100% anonymous" unless the entire threat model supports that claim.

### Moderation is necessary

Anonymous does not mean consequence-free.

### Reversible UI, cautious storage

A deleted/hidden post can disappear from the application even when historical blockchain references remain.

## 6. MVP User Stories

### Discovery

- As a visitor, I can open the booth without connecting a wallet.
- As a visitor, I can browse recent confessions.
- As a visitor, I can filter by category.
- As a visitor, I can view trending confessions.

### Publishing

- As a contributor, I can connect a supported wallet.
- As a contributor, I can sign an authentication challenge.
- As a contributor, I can write a confession.
- As a contributor, I can select a category.
- As a contributor, I can publish a confession.
- As a contributor, I can see confirmation that the confession was published.

### Interaction

- As a visitor/contributor, I can react to a confession.
- As a contributor, I can submit an anonymous whisper/reply.
- I cannot see another contributor's wallet address as their identity.

### Safety

- I can report a confession.
- I can report a whisper.
- I can block/mute content locally.
- Moderators can hide content from the application.
- Rate limits prevent uncontrolled spam.

## 7. MVP Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-001 | Public feed | P0 |
| FR-002 | Wallet-based authentication | P0 |
| FR-003 | Anonymous session | P0 |
| FR-004 | Create confession | P0 |
| FR-005 | Category selection | P0 |
| FR-006 | Content validation | P0 |
| FR-007 | Reactions | P0 |
| FR-008 | Anonymous whispers | P0 |
| FR-009 | Reporting | P0 |
| FR-010 | Moderator hide/takedown | P0 |
| FR-011 | Trending feed | P1 |
| FR-012 | Midnight feed | P1 |
| FR-013 | Search | P1 |
| FR-014 | Decentralized content reference | P1 |
| FR-015 | Anonymous reputation | P2 |
| FR-016 | ZK credentials | P2 |
| FR-017 | Burn-after-reading | P2 |

## 8. Privacy Requirements

The application must:

- avoid rendering wallet addresses in normal public feed UI;
- avoid putting confession plaintext in smart-contract storage;
- separate public content identity from authentication identity;
- avoid storing raw authentication signatures longer than operationally necessary;
- document server/RPC/provider logging risks;
- minimize analytics;
- provide a privacy policy describing retained metadata;
- avoid third-party trackers by default where possible.

### Important limitation

Wallet authentication alone does **not** make a system anonymous. A public blockchain can correlate addresses, transactions, timestamps, and other activity.

The architecture should therefore distinguish:

1. **UI anonymity** — no public profile/address;
2. **application pseudonymity** — backend cannot directly display identity;
3. **network privacy** — IP/RPC metadata protection;
4. **strong anonymity** — requires a substantially stronger privacy architecture.

MVP targets (1) and partial (2), with a roadmap toward (3)/(4).

## 9. Content Rules

Default limits:

- confession: 500 Unicode characters;
- whisper: 300 Unicode characters;
- category: exactly one primary category;
- links: disabled in MVP or heavily moderated;
- HTML/script: rejected and escaped;
- excessive repeated submissions: rate-limited.

Forbidden content includes:

- credible threats;
- targeted harassment;
- doxxing;
- private credentials/secrets belonging to others;
- sexual content involving minors;
- instructions for serious wrongdoing;
- malware/phishing;
- spam and automated manipulation.

The exact policy should be implemented as a versioned Community Guidelines document.

## 10. Feed Ranking

MVP should support:

### New

Newest eligible content first.

### Trending

A time-decayed score based on:

- reactions;
- whispers;
- unique engagement;
- age.

Do not allow one wallet/session to generate unlimited ranking weight.

### Most Relatable

A reaction-specific ranking emphasizing the "I understand" reaction.

## 11. Anonymous Identity Model

Do not use the wallet address as the displayed identity.

The UI should use ephemeral/random identifiers such as:

`Anonymous #4821`

These identifiers must not be presented as cryptographic proof of anonymity.

A future implementation may derive a stable pseudonymous identity from an anonymous credential, but this should be deliberately separated from the wallet address.

## 12. Blockchain Requirements

The chain should store a minimal publication commitment/reference.

Conceptually:

`contentHash + contentCID/reference + timestamp + protocol version`

The contract must not store:

- confession plaintext;
- email;
- IP address;
- personal profile data;
- private moderation notes.

## 13. Storage Requirements

Content storage should support:

- encrypted/private payloads where appropriate;
- content addressing;
- immutable content hash verification;
- application-level moderation state;
- migration between storage providers.

The database is the application index; the blockchain is the verification layer.

## 14. Moderation

Every user-generated object must have a moderation state
(`PENDING/VISIBLE/QUARANTINED/HIDDEN/REMOVED` — 5-state, T1-028):

- `PENDING`
- `VISIBLE`
- `HIDDEN`
- `REMOVED`
- `QUARANTINED`

Moderation actions require:

- actor;
- reason;
- timestamp;
- target;
- policy version.

Never put moderation notes on-chain.

## 15. Abuse Prevention

MVP controls:

- per-session rate limits;
- wallet/signature challenge;
- proof-of-work or CAPTCHA when abuse thresholds are exceeded;
- duplicate-content detection;
- report thresholds;
- moderation queue;
- reaction velocity limits;
- backend abuse scoring.

Future:

- anonymous credentials;
- ZK proof of eligibility;
- Sybil-resistant anonymous reputation.

## 16. UX Requirements

The experience should feel:

- quiet;
- mysterious;
- private;
- simple;
- emotionally expressive;
- fast.

Avoid generic Web3 language in the primary UX.

Prefer:

`Enter the Booth`

over:

`Connect Wallet`

The wallet connection can happen behind the flow when required.

## 17. Core Screens

1. Landing / Booth entrance
2. Public feed
3. Confession composer
4. Confession detail
5. Whisper thread
6. Category feed
7. Trending
8. Midnight feed
9. Report modal
10. Wallet/session settings
11. Moderator dashboard
12. Admin configuration

## 18. Success Metrics

Privacy-respecting product metrics:

- successful confession publications;
- publication completion rate;
- average time from composer open to publish;
- reaction rate;
- whisper rate;
- returning session rate;
- report rate;
- moderation response time;
- spam rate;
- failed transaction rate.

Avoid collecting unnecessary behavioral profiles.

## 19. Non-Functional Requirements

### Performance

- initial public feed should be usable on normal mobile connections;
- API p95 target: <500 ms for ordinary read operations;
- pagination must be cursor-based.

### Availability

Target MVP: 99.5% application availability.

### Security

- CSP;
- secure headers;
- strict input validation;
- output escaping;
- CSRF protection where cookie-based state exists;
- wallet signature nonce expiration;
- replay protection;
- server-side authorization;
- secrets outside source control.

### Accessibility

Target WCAG 2.2 AA for core user flows.

## 20. Acceptance Criteria

A release is MVP-complete when:

- a visitor can browse confessions without a wallet;
- a contributor can authenticate by signing a challenge;
- a contributor can publish a confession;
- no public feed component displays the contributor's wallet address;
- content cannot inject executable HTML/JS;
- reactions and whispers work;
- reports create moderation records;
- moderators can hide reported content;
- duplicate submissions are rate-limited;
- blockchain references can be verified;
- the product clearly documents its privacy limitations.

## 21. Roadmap

### V0 — Prototype

UI + mock data.

### V1 — MVP

Authentication, confession feed, reactions, whispers, moderation, database, blockchain publication proof.

### V1.5

IPFS/content-addressed storage, better ranking, midnight feed, search.

### V2

Anonymous credentials, stronger privacy, reputation, anti-Sybil improvements.

### V3

ZK-based anonymous actions, decentralized moderation experiments, advanced privacy-preserving discovery.
