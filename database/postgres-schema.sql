-- Created automatically on first connection by lib/server/postgres.js.
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, token TEXT NOT NULL, profile TEXT NOT NULL, expires BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS giveaways (id TEXT PRIMARY KEY, ib_id TEXT NOT NULL, name TEXT NOT NULL, created BIGINT NOT NULL);
    CREATE INDEX IF NOT EXISTS giveaways_owner ON giveaways(ib_id, created);
    CREATE TABLE IF NOT EXISTS snapshots (id TEXT PRIMARY KEY, ib_id TEXT NOT NULL, giveaway_id TEXT NOT NULL REFERENCES giveaways(id), payload TEXT NOT NULL, created BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS draws (id TEXT PRIMARY KEY, ib_id TEXT NOT NULL, giveaway_id TEXT NOT NULL REFERENCES giveaways(id), request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, payload TEXT NOT NULL, completed BIGINT NOT NULL DEFAULT 0, created BIGINT NOT NULL, UNIQUE(ib_id, request_id));
    CREATE UNIQUE INDEX IF NOT EXISTS one_pending_draw_per_ib ON draws(ib_id) WHERE completed = 0;
    CREATE TABLE IF NOT EXISTS login_attempts (key_hash TEXT PRIMARY KEY, attempts BIGINT NOT NULL, reset_at BIGINT NOT NULL);
