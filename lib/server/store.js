import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';

let database;
let encryptionKey;
export function db() {
  if (database) return database;
  const directory = resolve(process.env.SPINVAULT_DATA_DIR || '.data');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  database = new DatabaseSync(join(directory, 'spinvault.sqlite'));
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, token TEXT NOT NULL, profile TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS giveaways (id TEXT PRIMARY KEY, ib_id TEXT NOT NULL, name TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS giveaways_owner ON giveaways(ib_id, created);
    CREATE TABLE IF NOT EXISTS snapshots (id TEXT PRIMARY KEY, ib_id TEXT NOT NULL, giveaway_id TEXT NOT NULL REFERENCES giveaways(id), payload TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS draws (id TEXT PRIMARY KEY, ib_id TEXT NOT NULL, giveaway_id TEXT NOT NULL REFERENCES giveaways(id), request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, payload TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, UNIQUE(ib_id, request_id));
    CREATE UNIQUE INDEX IF NOT EXISTS one_pending_draw_per_ib ON draws(ib_id) WHERE completed = 0;
    CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
  `);
  return database;
}

function key() {
  if (encryptionKey) return encryptionKey;
  const configured = process.env.SPINVAULT_SESSION_SECRET;
  if (configured) {
    if (configured.length < 32) throw new Error('SPINVAULT_SESSION_SECRET must contain at least 32 characters.');
    encryptionKey = createHash('sha256').update(configured).digest();
  } else {
    if (process.env.NODE_ENV === 'production') throw new Error('SPINVAULT_SESSION_SECRET is required in production.');
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
  const connection = db();
  connection.exec('BEGIN IMMEDIATE');
  try { const result = callback(connection); connection.exec('COMMIT'); return result; }
  catch (error) { connection.exec('ROLLBACK'); throw error; }
}
