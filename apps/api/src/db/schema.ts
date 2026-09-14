// Drizzle schema — mirror dari docs/SCHEMA.md v1.0.
// Deviasi terdokumentasi dari SCHEMA.md (disetujui di TASKS T1-001..T1-003):
//  1. users.role ('USER'|'MODERATOR'|'ADMIN') — SCHEMA v1.0 belum punya kolom role,
//     dibutuhkan RBAC T1-003. Default 'USER'.
//  2. confessions.body_text + whispers.body_text — penyimpanan inline MVP (T1-022);
//     akan dipindah ke IPFS via StorageAdapter di Fase 1.5 tanpa ubah API.
//  3. Enum confession status mencakup 'QUARANTINED' (MODERATION.md §2).
//  4. idempotency_keys — tabel tambahan untuk Idempotency-Key 24 jam (API.md §12).

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  bigint,
  boolean,
  integer,
  text,
  timestamp,
  numeric,
  jsonb,
  uniqueIndex,
  index,
  unique,
  primaryKey,
} from 'drizzle-orm/pg-core';

export const userStatus = pgEnum('user_status', ['ACTIVE', 'BANNED', 'RESTRICTED']);
export const userRole = pgEnum('user_role', ['USER', 'MODERATOR', 'ADMIN']);
export const confessionStatus = pgEnum('confession_status', [
  'PENDING',
  'VISIBLE',
  'QUARANTINED',
  'HIDDEN',
  'REMOVED',
]);
export const reactionType = pgEnum('reaction_type', ['UNDERSTAND', 'LOVE', 'SAD', 'WILD', 'FUNNY']);
export const reportTarget = pgEnum('report_target', ['CONFESSION', 'WHISPER']);
export const reportStatus = pgEnum('report_status', ['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED']);
export const modAction = pgEnum('mod_action', ['DISMISS', 'HIDE', 'REMOVE', 'RESTRICT', 'BAN', 'RESTORE']);
export const publicationStatus = pgEnum('publication_status', [
  'PENDING_CHAIN',
  'SUBMITTED',
  'CONFIRMED',
  'FAILED',
]);

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull().unique(),
  chainId: bigint('chain_id', { mode: 'number' }).notNull(),
  role: userRole('role').notNull().default('USER'),
  createdAt: ts('created_at').notNull().defaultNow(),
  lastSeenAt: ts('last_seen_at'),
  status: userStatus('status').notNull().default('ACTIVE'),
});

export const authNonces = pgTable(
  'auth_nonces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id),
    nonceHash: varchar('nonce_hash', { length: 128 }).notNull().unique(),
    domain: varchar('domain', { length: 255 }).notNull(),
    address: varchar('address', { length: 42 }).notNull(),
    chainId: bigint('chain_id', { mode: 'number' }).notNull(),
    issuedAt: ts('issued_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    consumedAt: ts('consumed_at'),
  },
  (t) => [index('idx_nonces_expiry').on(t.expiresAt)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),
    createdAt: ts('created_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
  },
  (t) => [index('idx_sessions_user').on(t.userId)],
);

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 64 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const contentObjects = pgTable('content_objects', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentHash: varchar('content_hash', { length: 128 }).notNull().unique(),
  storageProvider: varchar('storage_provider', { length: 64 }).notNull().default('db:inline'),
  storageCid: varchar('storage_cid', { length: 256 }),
  encryptionVersion: varchar('encryption_version', { length: 32 }),
  contentVersion: integer('content_version').notNull().default(1),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const confessions = pgTable(
  'confessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicId: varchar('public_id', { length: 64 }).notNull().unique(),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    contentObjectId: uuid('content_object_id')
      .notNull()
      .references(() => contentObjects.id),
    bodyText: text('body_text').notNull(),
    displaySeed: integer('display_seed').notNull(),
    status: confessionStatus('status').notNull().default('PENDING'),
    createdAt: ts('created_at').notNull().defaultNow(),
    publishedAt: ts('published_at'),
    hiddenAt: ts('hidden_at'),
    version: integer('version').notNull().default(1),
    moderationScore: numeric('moderation_score').notNull().default('0'),
  },
  (t) => [
    index('idx_confessions_feed').on(t.status, t.createdAt),
    index('idx_confessions_category').on(t.categoryId, t.status, t.createdAt),
  ],
);

export const reactions = pgTable(
  'reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    confessionId: uuid('confession_id')
      .notNull()
      .references(() => confessions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reactionType: reactionType('reaction_type').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('uq_reaction').on(t.confessionId, t.userId, t.reactionType),
    index('idx_reactions_confession').on(t.confessionId, t.reactionType),
  ],
);

export const whispers = pgTable(
  'whispers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicId: varchar('public_id', { length: 64 }).notNull().unique(),
    confessionId: uuid('confession_id')
      .notNull()
      .references(() => confessions.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    contentObjectId: uuid('content_object_id')
      .notNull()
      .references(() => contentObjects.id),
    bodyText: text('body_text').notNull(),
    displaySeed: integer('display_seed').notNull(),
    status: confessionStatus('status').notNull().default('VISIBLE'),
    createdAt: ts('created_at').notNull().defaultNow(),
    publishedAt: ts('published_at'),
  },
  (t) => [index('idx_whispers_confession').on(t.confessionId, t.createdAt)],
);

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterUserId: uuid('reporter_user_id').references(() => users.id),
    targetType: reportTarget('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    reasonCode: varchar('reason_code', { length: 32 }).notNull(),
    details: text('details'),
    status: reportStatus('status').notNull().default('OPEN'),
    createdAt: ts('created_at').notNull().defaultNow(),
    resolvedAt: ts('resolved_at'),
  },
  (t) => [index('idx_reports_status').on(t.status, t.createdAt)],
);

export const moderationActions = pgTable('moderation_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  moderatorUserId: uuid('moderator_user_id')
    .notNull()
    .references(() => users.id),
  targetType: reportTarget('target_type').notNull(),
  targetId: uuid('target_id').notNull(),
  action: modAction('action').notNull(),
  reasonCode: varchar('reason_code', { length: 32 }).notNull(),
  notes: text('notes'),
  policyVersion: varchar('policy_version', { length: 32 }).notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const publications = pgTable(
  'publications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    confessionId: uuid('confession_id')
      .notNull()
      .references(() => confessions.id, { onDelete: 'cascade' }),
    chainId: bigint('chain_id', { mode: 'number' }).notNull(),
    contractAddress: varchar('contract_address', { length: 42 }).notNull(),
    transactionHash: varchar('transaction_hash', { length: 66 }),
    blockNumber: bigint('block_number', { mode: 'number' }),
    onchainConfessionId: varchar('onchain_confession_id', { length: 66 }).notNull(),
    contentHash: varchar('content_hash', { length: 128 }).notNull(),
    status: publicationStatus('status').notNull().default('PENDING_CHAIN'),
    submittedAt: ts('submitted_at'),
    confirmedAt: ts('confirmed_at'),
    failureReason: text('failure_reason'),
    attempts: integer('attempts').notNull().default(0),
  },
  (t) => [index('idx_publications_status').on(t.status, t.submittedAt)],
);

export const rateLimitBuckets = pgTable(
  'rate_limit_buckets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subjectHash: varchar('subject_hash', { length: 128 }).notNull(),
    action: varchar('action', { length: 64 }).notNull(),
    windowStart: ts('window_start').notNull(),
    count: integer('count').notNull().default(1),
  },
  (t) => [unique('uq_rate_bucket').on(t.subjectHash, t.action, t.windowStart)],
);

export const feedScores = pgTable(
  'feed_scores',
  {
    confessionId: uuid('confession_id')
      .notNull()
      .references(() => confessions.id, { onDelete: 'cascade' }),
    scoreType: varchar('score_type', { length: 32 }).notNull(),
    score: numeric('score').notNull().default('0'),
    calculatedAt: ts('calculated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.confessionId, t.scoreType] })],
);

export const idempotencyKeys = pgTable(  'idempotency_keys',
  {
    key: varchar('key', { length: 128 }).notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    statusCode: integer('status_code').notNull(),
    response: jsonb('response').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
  },
  (t) => [unique('uq_idempotency').on(t.key, t.userId)],
);

export const indexerState = pgTable('indexer_state', {
  name: varchar('name', { length: 64 }).primaryKey(),
  lastBlock: bigint('last_block', { mode: 'number' }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
