# SpinVault — IB API integration, handover

## Run it locally

Node **22.5+** is required (`node:sqlite`).

```bash
npm install
cp .env.example .env.local
# set SPINVAULT_SESSION_SECRET to any 32+ character string
npm run dev            # http://localhost:3000  ->  redirects to /login
```

Sign in with a real ByteFX IB account. All clients load automatically; only populated network levels appear in the selector.

## Verify it

```bash
npm run verify         # 12 checks, no server needed
```

Then, with the app running, against a **throwaway** data directory:

```bash
SPINVAULT_URL=http://localhost:3000 \
SPINVAULT_IB_EMAIL=... \
SPINVAULT_IB_PASSWORD=... \
npm run verify:api     # 18 checks: real sign-in, real draw
```

`verify:api` performs a real draw and writes rows to the SpinVault database.
Point it at staging, or run the app with `SPINVAULT_DATA_DIR` set somewhere
disposable. Never point it at production data.

Both suites pass here — `verify:api` was run against a mock ByteFX that mirrors
the response shapes verified against the live account.

## What to check by hand

The reel is the one thing a script cannot judge. Worth watching:

1. Draw six or seven times and confirm the finish *feels* different each time —
   sometimes one deliberate tick, sometimes seven or eight.
2. Confirm the card under the marker is the same client the modal names, every
   time. (`npm run verify` proves the maths; this confirms the wiring.)
3. Close the winner modal, turn "Hide sensitive info" off, and draw again to
   verify that the next result shows real values. Privacy is locked during a draw.
4. Close the tab mid-spin, reopen: the recorded winner should be waiting.
5. Check the account card on a phone — it should sit above the heading, not
   over the controls.

## Two things still open with ByteFX

1. **Net deposit and funded status** are not returned per client, so those two
   controls are omitted from the UI. Adding them later requires reliable values,
   deposit currency and reporting period, plus explicit UI support.

2. **Pagination on `myclientslevelN`** was never exercised — the test account
   returned a single page. The loader handles Laravel-style `last_page`,
   `next_page_url` and `total`, and refuses to draw from a list it could not
   fetch completely. Worth confirming against an IB with a large network before
   go-live, because a silently truncated list would change everyone's odds.

## Operational notes

- `SPINVAULT_SESSION_SECRET` encrypts stored ByteFX tokens. Rotating it signs
  everyone out and is not recoverable from the database.
- `SPINVAULT_DATA_DIR` holds the SQLite file with **the giveaway results**. It
  must survive restarts and be backed up.
- Set `APP_ORIGIN` explicitly behind a proxy, or same-origin checks will reject
  writes.
- Sessions last 8 hours. Failed sign-ins are limited to 8 per email per 15 min.

## September UI update

Work is in `SpinVault-ib-api/SpinSplit`, the supplied updated project.

- Login uses the supplied ByteFX logo, an accessible password eye, and a link to the partnership page.
- The account toolbar has an explicit sign-out confirmation and a separate refresh action at the top right.
- The initial load uses a full-screen loading state. Later level, refresh, and privacy requests keep the workspace mounted with inline progress and retry; drawing is disabled until the update succeeds.
- Initial load and explicit refresh check all seven network levels. Level selection reuses the owned, unexpired full-network snapshot without refetching ByteFX clients. Only populated levels appear; All clients is first and selected on entry. Selecting a specific level keeps the other populated levels available.
- The UI keeps minimum lots and privacy. Previous-winner exclusion has been removed from the UI and server eligibility; prior winners remain eligible. Deposit and funded controls are removed because those fields are absent from the verified client response.
- Winner details label MT5 references correctly and preserve multiple accounts. Phone numbers join IDs and emails in server-side masking, off by default; the IB can enable it.
- The supplied `assets/winner-card/Throfy.webp` replaces the trophy icon; clicking it repeats the celebration. Reduced motion is respected.
- Country flags use the small [Flagpedia CDN icons](https://flagpedia.net/download/api) only when a country can be identified. A blocked flag request retains the country name.
- Only an explicit API `status` of active/inactive (or configured boolean status) is displayed as such. Missing status reads “Status not provided.” The verified account supplies phones but no client status or country values. When country is absent, libphonenumber-js infers the numbering-plan country from a valid international number before masking; the winner label identifies this as “(phone)”. Ambiguous local, invalid, and non-geographic numbers remain unknown. Trading volume is never used to infer client status.

Run `npm run verify:clients` for normalization, phone masking, network counts, pagination failure, IB isolation, and recorded-winner checks. `scripts/fixtures/bytefx-server.mjs` provides synthetic records for isolated UI tests; it is never an application fallback. `scripts/verify-ui.mjs` uses an app configured for that fixture on localhost:3104 and headless Chrome on port 9223. It covers the five requested viewport widths, login, loading, level controls, confirmation, both modes, and masked/unmasked winner details. Test databases/screenshots stay in `.review/`.

The live all-level loader was verified with 139 unique clients (2, 3, and 134 in Levels 1–3). Empty levels use HTTP 200 with JSON `status: 301`, `msg: "No data found."`, and `data: {}`; this specific response is accepted as empty. Other errors still fail the entire load.

App images use WebP: lossless ByteFX logo and app icon, plus optimized background and trophy. Original artwork is retained locally. Country inference uses [libphonenumber-js metadata](https://github.com/catamphetamine/libphonenumber-js); it identifies the phone numbering-plan country, not the person’s current location.
