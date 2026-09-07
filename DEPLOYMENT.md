# Showcase on Vercel with Neon

SpinVault now supports Neon PostgreSQL through DATABASE_URL. Local SQLite stays
available for development when that variable is empty. No MySQL server or SSH
tunnel is needed for this setup.

## 1. Create the free database

Create a project on the Neon Free plan at https://console.neon.tech.
Use a new database for this showcase. In Connect, enable Connection pooling and
copy the PostgreSQL connection string (the hostname contains -pooler).

Paste it into the ignored .env.local file:

~~~dotenv
DATABASE_URL=postgresql://USER:PASSWORD@YOUR-ENDPOINT-pooler.REGION.aws.neon.tech/neondb?sslmode=require
~~~

A private SPINVAULT_SESSION_SECRET has been generated in .env.local for this
workspace. Keep it stable and use the same value on Vercel. It encrypts access
tokens, client snapshots, and winner records; replacing it makes old encrypted
records unreadable. Never use NEXT_PUBLIC_ for either variable.

## 2. Initialize and verify

~~~bash
npm run db:setup
~~~

This creates the tables and indexes, checks an encrypted session write/read and
rollback, and retains no test session. The application also initializes the
schema automatically on its first database request, so manual SQL setup is
optional. The Neon role must have permission to create tables in this database.

The SQL is in database/postgres-schema.sql; the runtime schema lives in
lib/server/postgres.js. A new Neon database starts empty. Existing local SQLite
records are not uploaded automatically.

## 3. Configure Vercel

In the existing bytefx-spinvalut project, open Settings > Environment Variables
and set these for Production:

| Variable | Value |
| --- | --- |
| DATABASE_URL | The pooled Neon connection string |
| SPINVAULT_SESSION_SECRET | Copy the generated value from .env.local |
| APP_ORIGIN | https://bytefx-spinvalut.vercel.app |
| BYTEFX_API_BASE_URL | https://my.bytefx.com/api/ |

Remove old MYSQL_URL, MYSQL_SSL_CA, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, and
SPINVAULT_DATA_DIR values from Vercel if present. They are not used by Neon.
Use Node.js 24.x. Deploy this updated code and redeploy after changing environment
variables; an existing deployment does not pick up newly saved values.

Use a separate Neon database/branch for Preview if you enable it, so preview
draws do not affect the showcase history.

## 4. Check the showcase

Sign in at https://bytefx-spinvalut.vercel.app, refresh, and verify your session
persists. Load clients and verify level selection. Draw only when you intend to
record a real winner. Sign out and verify access is revoked.

DATABASE_URL is required on Vercel. Local SQLite and /tmp cannot provide shared,
persistent sessions or draw history. Missing server settings return HTTP 503
with SERVER_CONFIGURATION_ERROR; Vercel function logs identify the missing
setting. Database failures log error codes without passwords or query values.

## Local checks

~~~bash
npm run verify
npm run verify:clients
npm run lint
npm run build
~~~

The fixture checks use isolated SQLite and synthetic clients. Live Neon
connectivity is verified separately by db:setup. The API lifecycle suite in
HANDOVER.md must use an isolated test environment because it records draws.

References: [Neon Free plan](https://neon.com/pricing),
[Neon and Vercel](https://neon.com/docs/guides/vercel-manual),
[Vercel SQLite limitations](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel).
