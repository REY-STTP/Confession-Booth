# Confession Booth — Data Schema

**Database:** PostgreSQL  
**Schema version:** 1.0

## 1. Design Rules

- UUID/ULID is preferred for internal IDs.
- Blockchain IDs are stored separately.
- Wallet addresses are sensitive operational identifiers and must never be treated as public profile names.
- Content hashes are stored in canonical binary/hex form.
- Timestamps use UTC.
- All moderation actions are auditable.

## 2. Entity Relationship

```text
UserSession ────────┐
                     │
                     ▼
                 Confession
                 /    |    \
                /     |     \
          Reaction  Whisper  Report
                              │
                              ▼
                         ModerationAction

Confession ─── Publication ─── BlockchainTransaction
     │
     └──── ContentObject ─── StorageObject
```

## 3. users

Operational wallet identity.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| wallet_address | varchar(42) | unique, normalized lowercase |
| chain_id | bigint | authentication chain |
| created_at | timestamptz | |
| last_seen_at | timestamptz | nullable |
| status | enum | ACTIVE/BANNED/RESTRICTED |

Do not expose this table through public API.

## 4. auth_nonces

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | nullable until verification |
| nonce_hash | varchar | unique |
| domain | varchar | |
| issued_at | timestamptz | |
| expires_at | timestamptz | |
| consumed_at | timestamptz | nullable |

Store a hash of the nonce where practical rather than the raw challenge.

## 5. sessions

| Column | Type |
|---|---|
| id | uuid |
| user_id | uuid |
| token_hash | varchar |
| created_at | timestamptz |
| expires_at | timestamptz |
| revoked_at | timestamptz nullable |

## 6. categories

| Column | Type |
|---|---|
| id | uuid |
| slug | varchar unique |
| name | varchar |
| description | text nullable |
| is_active | boolean |
| sort_order | integer |
| created_at | timestamptz |

Suggested initial categories:

- love
- heartbreak
- secret
- life
- school
- work
- family
- funny
- sad
- deep
- midnight

## 7. content_objects

Stores content metadata and integrity information.

| Column | Type |
|---|---|
| id | uuid |
| content_hash | bytea / varchar |
| storage_provider | varchar |
| storage_cid | varchar nullable |
| encryption_version | varchar nullable |
| content_version | integer |
| created_at | timestamptz |

Do not store private keys or encryption secrets here.

## 8. confessions

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| public_id | varchar | Anonymous-facing ID |
| author_user_id | uuid | private FK |
| category_id | uuid | FK |
| content_object_id | uuid | FK |
| status | enum | PENDING/VISIBLE/QUARANTINED/HIDDEN/REMOVED (T1-028: QUARANTINED untuk triage kritis) |
| body_tsv | tsvector generated | `to_tsvector('simple', body_text)` + GIN (T1H-004 FTS; whisper juga) |
| created_at | timestamptz | UTC |
| published_at | timestamptz nullable | |
| hidden_at | timestamptz nullable | |
| version | integer | |
| moderation_score | numeric | private |

`author_user_id` must never be returned by public feed endpoints.

## 9. reactions

| Column | Type |
|---|---|
| id | uuid |
| confession_id | uuid |
| user_id | uuid |
| reaction_type | enum |
| created_at | timestamptz |

Unique constraint:

`(confession_id, user_id, reaction_type)`

Suggested types:

- UNDERSTAND
- LOVE
- SAD
- WILD
- FUNNY

## 10. whispers

| Column | Type |
|---|---|
| id | uuid |
| public_id | varchar |
| confession_id | uuid |
| author_user_id | uuid |
| content_object_id | uuid |
| status | enum |
| created_at | timestamptz |
| published_at | timestamptz nullable |

Whispers follow the same privacy model as confessions.

## 11. reports

| Column | Type |
|---|---|
| id | uuid |
| reporter_user_id | uuid nullable |
| target_type | enum |
| target_id | uuid |
| reason_code | varchar |
| details | text nullable |
| status | enum |
| created_at | timestamptz |
| resolved_at | timestamptz nullable |

Never expose reporter identity publicly.

## 12. moderation_actions

| Column | Type |
|---|---|
| id | uuid |
| moderator_user_id | uuid |
| target_type | enum |
| target_id | uuid |
| action | enum |
| reason_code | varchar |
| notes | text nullable |
| policy_version | varchar |
| created_at | timestamptz |

## 13. publications

Application-to-blockchain publication mapping.

| Column | Type |
|---|---|
| id | uuid |
| confession_id | uuid |
| chain_id | bigint |
| contract_address | varchar(42) |
| transaction_hash | varchar(66) nullable |
| block_number | bigint nullable |
| onchain_confession_id | varchar |
| content_hash | varchar |
| status | enum |
| submitted_at | timestamptz nullable |
| confirmed_at | timestamptz nullable |
| failure_reason | text nullable |

## 14. rate_limit_buckets

| Column | Type |
|---|---|
| id | uuid |
| subject_hash | varchar |
| action | varchar |
| window_start | timestamptz |
| count | integer |

Do not store unnecessary raw IP addresses. If IP-based controls are needed, prefer short-lived keyed hashes and documented retention.

## 15. feed_scores

| Column | Type |
|---|---|
| confession_id | uuid |
| score_type | varchar |
| score | numeric |
| calculated_at | timestamptz |

Primary key:

`(confession_id, score_type)`

## 16. Indexes

Recommended:

```sql
CREATE INDEX idx_confessions_feed
ON confessions (status, created_at DESC);

CREATE INDEX idx_confessions_category
ON confessions (category_id, status, created_at DESC);

CREATE INDEX idx_reactions_confession
ON reactions (confession_id, reaction_type);

CREATE INDEX idx_whispers_confession
ON whispers (confession_id, created_at ASC);

CREATE INDEX idx_reports_status
ON reports (status, created_at ASC);

CREATE INDEX idx_publications_status
ON publications (status, submitted_at ASC);
```

## 17. Public API Projection

Public confession response should resemble:

```json
{
  "id": "c_01...",
  "author": {
    "displayName": "Anonymous #4821"
  },
  "category": "heartbreak",
  "content": "...",
  "createdAt": "2026-09-14T00:00:00Z",
  "reactions": {
    "understand": 128,
    "love": 31,
    "sad": 72
  },
  "whisperCount": 21,
  "status": "visible"
}
```

It must not contain:

- wallet address;
- internal user ID;
- IP;
- session ID;
- moderation notes;
- raw storage credentials.

## 18. State Machines

### Confession

```text
PENDING
  │
  ├── publication confirmed → VISIBLE
  │
  └── failure → PENDING / FAILED

VISIBLE
  ├── moderator action → HIDDEN
  └── policy removal → REMOVED
```

### Report

```text
OPEN → REVIEWING → RESOLVED
              └→ DISMISSED
```
