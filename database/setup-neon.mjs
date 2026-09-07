import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import nextEnv from '@next/env';
import { openPostgres } from '../lib/server/postgres.js';
import { encrypt, decrypt } from '../lib/server/store.js';

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL?.trim()) {
  console.error('Set DATABASE_URL to your Neon pooled connection string in .env.local first.');
  process.exit(1);
}
// Validate encryption configuration before connecting or creating tables.
if (!process.env.SPINVAULT_SESSION_SECRET || process.env.SPINVAULT_SESSION_SECRET.length < 32) {
  console.error('Set SPINVAULT_SESSION_SECRET to a private random value of at least 32 characters.');
  process.exit(1);
}
let database;
try {
  database = await openPostgres(process.env.DATABASE_URL.trim());
  const tx = await database.transaction();
  try {
    const id = randomUUID();
    const expires = Date.now() + 1000;
    const token = encrypt('synthetic-neon-connection-check');
    await tx.execute({ sql: 'INSERT INTO sessions (id, token, profile, expires) VALUES (?, ?, ?, ?)', args: [id, token, '{}', expires] });
    const result = await tx.execute({ sql: 'SELECT token, expires FROM sessions WHERE id = ?', args: [id] });
    assert.equal(decrypt(result.rows[0].token), 'synthetic-neon-connection-check');
    assert.equal(result.rows[0].expires, expires);
    await tx.rollback();
    assert.equal((await database.execute({ sql: 'SELECT id FROM sessions WHERE id = ?', args: [id] })).rows.length, 0);
  } catch (error) { await tx.rollback().catch(() => {}); throw error; }
  finally { tx.close(); }
  console.log('Neon schema ready. Encrypted session write/read, timestamp types, and rollback verified. No test session retained.');
} catch (error) {
  console.error('Neon setup failed:', { name: error.name, code: error.code || 'CONFIGURATION_OR_CONNECTION_ERROR' });
  process.exitCode = 1;
} finally { if (database) await database.close(); }
