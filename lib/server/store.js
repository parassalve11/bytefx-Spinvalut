import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { AppError } from './http.js';

let database;
let encryptionKey;
let queue = Promise.resolve();
const schema = `
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, token TEXT NOT NULL, profile TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS giveaways (id TEXT PRIMARY KEY, ib_id TEXT NOT NULL, name TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS giveaways_owner ON giveaways(ib_id, created);
    CREATE TABLE IF NOT EXISTS snapshots (id TEXT PRIMARY KEY, ib_id TEXT NOT NULL, giveaway_id TEXT NOT NULL REFERENCES giveaways(id), payload TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS draws (id TEXT PRIMARY KEY, ib_id TEXT NOT NULL, giveaway_id TEXT NOT NULL REFERENCES giveaways(id), request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, payload TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, UNIQUE(ib_id, request_id));
    CREATE UNIQUE INDEX IF NOT EXISTS one_pending_draw_per_ib ON draws(ib_id) WHERE completed = 0;
    CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
  `;

function configurationError(detail) {
  // Only fixed configuration guidance is logged, never tokens or query values.
  console.error('SpinVault configuration:', detail);
  return new AppError('The server is not configured for sign-in. Please contact the administrator.', 503, 'SERVER_CONFIGURATION_ERROR');
}

async function openDatabase() {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const { openPostgres } = await import('./postgres.js');
    return openPostgres(url, configurationError);
  }
  if (process.env.VERCEL) throw configurationError('Set DATABASE_URL to the Neon pooled connection string on Vercel. Local SQLite, including /tmp, is not persistent or shared.');
  const { DatabaseSync } = await import('node:sqlite');
  const directory = resolve(process.env.SPINVAULT_DATA_DIR || '.data');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const local = new DatabaseSync(join(directory, 'spinvault.sqlite'));
  try { local.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;' + schema); }
  catch (error) { local.close(); throw error; }
  const client = {
    async execute({ sql, args }) {
      return { rows: local.prepare(sql.replace(/\bkey_hash\b/g, 'key')).all(...args) };
    },
    async transaction() {
      local.exec('BEGIN IMMEDIATE');
      let closed = false;
      return {
        execute: client.execute,
        async commit() { local.exec('COMMIT'); closed = true; },
        async rollback() { local.exec('ROLLBACK'); closed = true; },
        close() { if (!closed) local.exec('ROLLBACK'); },
      };
    },
  };
  return client;
}

function connection() {
  if (!database) database = openDatabase().catch(error => { database = undefined; throw error; });
  return database;
}

function serialized(callback) {
  // Async callers must not interleave operations on the local SQLite connection.
  // Remote write transactions also acquire a database lock across Vercel instances.
  const result = queue.then(callback);
  queue = result.catch(() => {});
  return result;
}

function adapter(execute) {
  return { prepare(sql) {
    return {
      run: (...args) => execute({ sql, args }),
      get: async (...args) => (await execute({ sql, args })).rows[0],
      all: async (...args) => (await execute({ sql, args })).rows.map(row => ({ ...row })),
    };
  } };
}

const store = adapter(statement => serialized(async () => (await connection()).execute(statement)));
export function db() { return store; }

function key() {
  if (encryptionKey) return encryptionKey;
  const configured = process.env.SPINVAULT_SESSION_SECRET;
  if (configured) {
    if (configured.length < 32) throw configurationError('SPINVAULT_SESSION_SECRET must contain at least 32 characters.');
    encryptionKey = createHash('sha256').update(configured).digest();
  } else {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.DATABASE_URL) throw configurationError('SPINVAULT_SESSION_SECRET is required in production and with a remote database.');
    const directory = resolve(process.env.SPINVAULT_DATA_DIR || '.data');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const path = join(directory, 'session.key');
    try { encryptionKey = readFileSync(path); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      try { writeFileSync(path, randomBytes(32), { flag: 'wx', mode: 0o600 }); }
      catch (writeError) { if (writeError.code !== 'EEXIST') throw writeError; }
      encryptionKey = readFileSync(path);
    }
  }
  return encryptionKey;
}

export function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}
export function decrypt(value) {
  const data = Buffer.from(value, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}
export function hash(value) { return createHash('sha256').update(value).digest('hex'); }
export function transaction(callback) {
  return serialized(async () => {
    const tx = await (await connection()).transaction('write');
    try {
      const result = await callback(adapter(statement => tx.execute(statement)));
      await tx.commit();
      return result;
    } catch (error) {
      try { await tx.rollback(); } catch { /* Preserve the original failure. */ }
      throw error;
    } finally { tx.close(); }
  });
}
