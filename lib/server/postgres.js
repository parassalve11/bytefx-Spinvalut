import pg from 'pg';

// Separate from SQLite because PostgreSQL timestamps in milliseconds need BIGINT.
export const postgresSchema = `
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, token TEXT NOT NULL, profile TEXT NOT NULL, expires BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS giveaways (id TEXT PRIMARY KEY, ib_id TEXT NOT NULL, name TEXT NOT NULL, created BIGINT NOT NULL);
    CREATE INDEX IF NOT EXISTS giveaways_owner ON giveaways(ib_id, created);
    CREATE TABLE IF NOT EXISTS snapshots (id TEXT PRIMARY KEY, ib_id TEXT NOT NULL, giveaway_id TEXT NOT NULL REFERENCES giveaways(id), payload TEXT NOT NULL, created BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS draws (id TEXT PRIMARY KEY, ib_id TEXT NOT NULL, giveaway_id TEXT NOT NULL REFERENCES giveaways(id), request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, payload TEXT NOT NULL, completed BIGINT NOT NULL DEFAULT 0, created BIGINT NOT NULL, UNIQUE(ib_id, request_id));
    CREATE UNIQUE INDEX IF NOT EXISTS one_pending_draw_per_ib ON draws(ib_id) WHERE completed = 0;
    CREATE TABLE IF NOT EXISTS login_attempts (key_hash TEXT PRIMARY KEY, attempts BIGINT NOT NULL, reset_at BIGINT NOT NULL);
  `;

function parseInteger(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new RangeError('Database integer exceeds the supported range.');
  return number;
}

// All callers supply static SQL with positional placeholders; values stay bound.
function statement(sql) {
  let parameter = 0;
  return sql.replace(/\?/g, () => '$' + (++parameter));
}

export async function openPostgres(url, configurationError = message => new Error(message)) {
  let parsed;
  try { parsed = new URL(url); } catch { throw configurationError('DATABASE_URL must be a valid PostgreSQL connection string.'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || !parsed.username || !parsed.password || parsed.pathname.length < 2) {
    throw configurationError('DATABASE_URL must include the PostgreSQL host, database, user, and password.');
  }
  // Always verify the server certificate, including with Neon sslmode=require URLs.
  for (const parameter of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) parsed.searchParams.delete(parameter);
  const pool = new pg.Pool({
    connectionString: parsed.toString(), ssl: { rejectUnauthorized: true },
    max: 3, connectionTimeoutMillis: 15000, idleTimeoutMillis: 10000,
    allowExitOnIdle: true, enableChannelBinding: true,
    types: { getTypeParser: (oid, format) => oid === 20 && format !== 'binary' ? parseInteger : pg.types.getTypeParser(oid, format) },
  });
  pool.on('error', error => console.error('SpinVault database connection:', { code: error.code || 'UNKNOWN' }));
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize first-use schema creation across independent Vercel instances.
      await client.query('SELECT pg_advisory_xact_lock(1936746862, 1)');
      await client.query(postgresSchema);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
  } catch (error) { await pool.end(); throw error; }

  const execute = (target, { sql, args }) => target.query(statement(sql), args);
  return {
    execute: query => execute(pool, query),
    close: () => pool.end(),
    async transaction() {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Transaction-scoped: compatible with Neon's pooled connections. Preserves
        // SQLite BEGIN IMMEDIATE ordering for concurrent logins and draw retries.
        await client.query('SELECT pg_advisory_xact_lock(1936746862, 2)');
      } catch (error) { await client.query('ROLLBACK').catch(() => {}); client.release(); throw error; }
      return {
        execute: query => execute(client, query),
        commit: () => client.query('COMMIT'),
        rollback: () => client.query('ROLLBACK'),
        close: () => client.release(),
      };
    },
  };
}
