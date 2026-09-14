-- 0001_init DOWN — rollback penuh (hanya untuk dev/staging; JANGAN di production berisi data).
DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS feed_scores;
DROP TABLE IF EXISTS rate_limit_buckets;
DROP TABLE IF EXISTS publications;
DROP TABLE IF EXISTS moderation_actions;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS whispers;
DROP TABLE IF EXISTS reactions;
DROP TABLE IF EXISTS confessions;
DROP TABLE IF EXISTS content_objects;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS auth_nonces;
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS publication_status;
DROP TYPE IF EXISTS mod_action;
DROP TYPE IF EXISTS report_status;
DROP TYPE IF EXISTS report_target;
DROP TYPE IF EXISTS reaction_type;
DROP TYPE IF EXISTS confession_status;
DROP TYPE IF EXISTS user_role;
DROP TYPE IF EXISTS user_status;
