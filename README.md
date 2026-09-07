# SpinVault

**One Draw · One Winner · Provably Fair**

An IB-only giveaway app. A ByteFX Introducing Broker signs in, picks which
levels of their own client network are eligible, and draws a winner. Clients
stream past in a horizontal slot-machine reel, the reel decelerates onto one
winner, and a confetti modal reveals their details.

Every client on screen is a real client of the signed-in IB, fetched from the
ByteFX API. There is deliberately **no demo pool to fall back on**: if the API
call fails, the draw stays disabled and says so.

## Running it

Requires **Node 22.5 or newer** — the store uses the built-in `node:sqlite`.

```bash
npm install
cp .env.example .env.local     # set SPINVAULT_SESSION_SECRET
npm run dev                    # http://localhost:3000
npm run verify                 # draw maths, fairness, filters, masking
npm run build
```

## Architecture

```
browser  ──HttpOnly session cookie──▶  Next.js route handlers  ──Bearer token──▶  ByteFX
```

The ByteFX token never reaches the browser. It is encrypted (AES-256-GCM) and
stored server-side against a session ID; the browser only ever holds an opaque
cookie. Every protected request re-verifies IB access with ByteFX before
returning client data, so a revoked account loses access on its next action
rather than at its next sign-in.

| Route | Purpose |
| --- | --- |
| `POST /api/auth/login` | Exchanges credentials with ByteFX, confirms IB access, opens a session |
| `POST /api/auth/logout` | Destroys the session |
| `GET /api/auth/session` | Re-verifies the session against ByteFX |
| `POST /api/pool` | Loads every page of the selected client levels, snapshots the result |
| `GET /api/pool` | Re-reads an existing snapshot (used when masking is toggled) |
| `GET/POST /api/giveaways` | Lists and creates giveaways, returns winner history |
| `POST /api/draws` | Selects and **records** the winner, before any animation |
| `GET /api/draws` | Returns a draw not yet acknowledged (crash recovery) |
| `POST /api/draws/complete` | Acknowledges a revealed draw |

## Signing in

Only ByteFX accounts with `is_ib = 2` and `status = "Approved"` are admitted; a
successful password check alone is not enough. Failed sign-ins are rate limited
to 8 per email per 15 minutes. Sessions last 8 hours.

## Client levels

Levels 1 to 7 map to depth in the IB's network. All clients is selected on load;
only populated levels are shown, and any combination can be chosen.

A level is fetched **completely** — every page — before a draw is allowed. A
partial fetch would silently shrink the pool and quietly change everyone's
odds, so an incomplete or self-contradicting page response fails the load
rather than producing a smaller pool.

One client, one entry. A client who appears at more than one level, or who owns
several trading accounts, is deduplicated on a stable backend ID and carries a
list of the levels they appeared at.

## What can be filtered on

Only fields ByteFX actually returns for every loaded client. As verified
against a live IB account, the client-level endpoints supply names, emails,
MT5 account references, phone numbers and total lots — but **not** per-client net
deposits or funded status.

| Control | Status |
| --- | --- |
| Minimum lots traded | Live, from `totallots` |
| Hide sensitive info | Live, applied server-side |
| Minimum net deposit | Not shown — no backing field |
| Funded clients only | Not shown — no backing field |

Deposit and funded controls can be added when ByteFX supplies reliable values.
A missing figure is never treated as `0`: a client with an
unknown value is excluded by a threshold rather than admitted on data we do not
have.

## Privacy

**"Hide sensitive info" is off by default** and the IB can turn it on
to mask MT5 IDs, email addresses, and phone numbers in server responses.
Enabling privacy also immediately masks details already displayed on screen.
Turning it off re-reads the stored snapshot rather than reloading ByteFX clients.

## How the draw works

The important property is that **the winner is chosen before the animation
starts**. The spin is a visualisation of a decision already made, not the thing
that makes the decision. That decision now happens on the server, where the
browser cannot influence it.

1. The snapshot is filtered to an eligible list with `applyCriteria` — the same
   function on both sides, so what the reel shows and what the server drew from
   cannot disagree.
2. `fairPick(pool.length)` picks the winning index using `crypto.getRandomValues`.
3. The winner, the participant list, the criteria and a receipt are **written to
   the database** before the response is sent.
4. Only then does the browser animate. `spinTarget()` works out a strip index
   congruent to the winner index modulo the pool size, several loops further
   along the reel.
5. After a 320ms charge, Framer Motion launches, cruises, and slows the strip to
   the unchanged `offsetForIndex(target)`. The winning card locks for 420ms,
   then the modal opens. Filters, levels and repeat draws are locked throughout.
   Reduced motion skips the travelling reel and settles on the same target.

### Drawing exactly once

A draw carries a client-generated `requestId`. Repeating the request with that
same ID returns the **recorded** winner instead of drawing again, so a retry
after a dropped connection cannot quietly produce a second winner. Reusing an
ID with different settings is refused outright.

Only one draw per IB may be un-acknowledged at a time. If the tab is closed
mid-spin, the recorded winner is recovered and shown on the next visit — a
closed browser cannot be used to discard an unwanted result and try again.

### The randomised finish

The reel used to settle over a fixed three cards. Each draw now picks its own
tail length of **1 to 8 cards**, server-side, with the same CSPRNG:

- one draw finishes with a single deliberate tick, another with seven or eight;
- longer tails start their settle earlier and get more wall-clock time, so they
  do not rattle through;
- the reel only ever moves forwards, and lands on the exact same target.

This randomises the *presentation*, never the winner. With a small pool the
same client may appear more than once among those last cards — they are reel
positions, not eight distinct clients.

Because `target % pool.length === winnerIndex` by construction, the card that
ends up under the centre marker is *always* the drawn winner. `npm run verify`
asserts this for every pool size from 1 to 40, every winner, and every possible
starting position.

`fairPick` uses rejection sampling rather than a bare `value % n`. A plain
modulo skews very slightly toward the low indices whenever `n` does not divide
2³² evenly; discarding the ragged tail of the range removes that bias at
effectively no cost.

### Reel mechanics

The reel repeats the pool end to end, which makes the strip periodic: any two
offsets a whole number of pool-lengths apart show exactly the same thing. Two
consequences fall out of that:

- Before every spin the strip silently **re-anchors** to an equivalent low
  index, so the offset never grows without bound over a long session.
- Only a **window** of cards around the marker is mounted (`WINDOW_RADIUS`),
  positioned absolutely at `index * PITCH`. A fast spin mounts ~25 cards, not
  hundreds.

The strip is moved by a Framer Motion value, so spinning does not re-render
React — only the active card index crossing a card boundary does.

## Layout

```
app/
  layout.js              fonts, metadata, page background
  page.js                session gate -> DrawWorkspace
  login/page.js          sign-in screen
  api/                   auth, pool, giveaways, draws route handlers
  globals.css            theme variables, grain, reel edge mask
components/
  auth/                  LoginForm, AccountCard
  layout/                Header, Footer
  draw/                  DrawWorkspace, LevelSelector, ModeTabs, SlotReel,
                         ParticipantCard, DrawButton, EligibilityPanel,
                         WinnerModal, DrawBackground
  ui/                    Panel, Badge, Button, Input, Toggle, Avatar
lib/
  api.js                 browser -> own API, with typed errors
  useDraw.js             the draw state machine, server-backed
  eligibility.js         criteria parsing + filtering (shared client/server)
  reel.js                pure reel geometry (no React)
  spinAnimation.js       keyframes + timing for the 1-8 card finish
  random.js              crypto-backed uniform pick
  mask.js                client id / email masking
  format.js              display helpers that respect unavailable fields
  modes.js               Quick Draw / Grand Finale
  server/
    bytefx.js            ByteFX client, normalisation, full pagination
    session.js           session lifecycle, IB verification, rate limiting
    store.js             SQLite + AES-256-GCM token encryption
    draws.js             giveaways, snapshots, selection, history
scripts/
  verify-draw.mjs        the checks behind `npm run verify`
  verify-api.mjs         signed-in lifecycle checks against a running app
  fixtures/              test data for verify-draw (NOT used by the app)
```

`lib/reel.js` and `lib/spinAnimation.js` are deliberately free of React and the
DOM so the landing guarantee can be tested directly in Node.

## Profile pictures

ByteFX does not supply client photos, so `avatar` is `null` and every card falls
back to the default user icon. `components/ui/Avatar.jsx` renders the photo when there is one
and the default user icon otherwise — and it treats a photo that *fails to
load* exactly like a missing one, so a dead URL degrades to the icon rather
than a broken-image box.

Because the reel recycles card instances as the strip moves, the failure is
tracked by URL rather than as a boolean, so the fallback resets correctly when a
card is reused for a different participant. `useDraw` warms the browser cache
with every photo on mount, which stops cards popping in mid-spin.

## Eligibility inputs

Each threshold has a row of capsule presets (Any / $100 / $250 / $500 / $1,000,
and Any / 1 / 2.5 / 5 / 10) so the common cases are one tap.

The field itself holds a raw string draft while focused rather than a parsed
number. This matters: a plain controlled number field can never be cleared —
deleting the "0" snaps straight back to "0", so a new amount has to be typed
around the old one. With a draft the box can go empty (read as "no minimum"),
focusing selects what is there so typing simply replaces it, leading zeros are
normalised away, and non-numeric input is rejected. The parent only ever
receives clamped numbers.

## Theme

Dark "midnight aurora": near-black indigo grounds with an emerald → cyan accent
gradient, glassy panels, a soft glow on the active card, and subtle grain.
Tokens live in both `tailwind.config.js` and as CSS variables in
`app/globals.css`.

| Token | Value |
| --- | --- |
| `bg.base` / `bg.panel` / `bg.card` | `#07090F` / `#12131C` / `#1A1C28` |
| `accent.from` → `accent.to` | `#10E0A0` → `#22C7E0` |
| `text.primary` / `text.muted` | `#F5F7FA` / `#8A90A6` |

Display type is Space Grotesk, body is Inter, both via `next/font`.

Tailwind's default opacity scale is sparse (5, 10, 20, 25…), and the design
leans on in-between values like `/8` and `/35`, so the scale is widened to every
integer step in `tailwind.config.js`.

## Deliberately out of scope

Multiple named giveaways in the UI (the API supports them; the page uses one
per IB), CSV import, payments/CRM, on-chain proof of fairness, analytics, i18n,
and deployment config. The fairness note in the footer describes only what the
app actually does today: a CSPRNG pick made and recorded before the reel moves.

## Still to confirm with ByteFX

- Whether per-client **net deposit** and **funded status** can be exposed on the
  client-level endpoints, and in which currency and over what reporting period.
  Until then those two filters stay switched off.
- Whether `myclientslevelN` paginates for large networks, and in what shape.
  The loader handles Laravel-style `last_page` / `next_page_url` / `total` and
  refuses to draw from an incomplete list; the verified test account was small
  enough to return a single page.

## Browser verification

`scripts/verify-browser.mjs` uses Node 22+ and an existing headless Chrome
debugging session on port 9223; it adds no dependencies. Run the app on port
3100 (or set `DRAW_TEST_URL`), then run `node scripts/verify-browser.mjs`.
The script checks 1440, 1280, 1024, 768, and 390px layouts, both modes, real
crypto selection against the centered card and modal, keyboard focus, reduced
motion, repeat draws, combined filters, privacy, and the empty-pool message.
Screenshots are written to the ignored `.review/` directory.
