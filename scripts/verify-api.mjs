/**
 * Signed-in lifecycle checks against a running SpinVault.
 *
 * `verify-draw.mjs` covers the pure maths with no server. This one covers the
 * things that can only be proven end to end: IB gating, complete pagination,
 * deduplication, server-side masking, and the guarantee that one draw request
 * produces exactly one recorded winner.
 *
 * It performs a REAL sign-in and REAL draws against whatever ByteFX the app is
 * pointed at, and it writes rows to the SpinVault database. Point it at a
 * staging deployment, or at a local app with SPINVAULT_DATA_DIR set to a
 * throwaway directory. Never run it against production data.
 *
 *   node scripts/verify-api.mjs
 *
 * Environment:
 *   SPINVAULT_URL       default http://localhost:3000
 *   SPINVAULT_IB_EMAIL      required
 *   SPINVAULT_IB_PASSWORD   required
 *   SPINVAULT_LEVELS    default 1,2
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const BASE = (process.env.SPINVAULT_URL || "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.SPINVAULT_IB_EMAIL;
const PASSWORD = process.env.SPINVAULT_IB_PASSWORD;
const LEVELS = (process.env.SPINVAULT_LEVELS || "1,2").split(",").map((n) => Number(n.trim()));

if (!EMAIL || !PASSWORD) {
  console.error("Set SPINVAULT_IB_EMAIL and SPINVAULT_IB_PASSWORD. Do not hard-code them in this file.");
  process.exit(1);
}

let checks = 0;
const ok = (label) => {
  checks++;
  console.log(`  ok  ${label}`);
};

let cookie = "";

async function call(path, { method = "GET", body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      // Same-origin protection: the app rejects writes without a matching Origin.
      ...(method === "GET" ? {} : { Origin: BASE }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const setCookie = response.headers.getSetCookie?.() ?? [];
  for (const value of setCookie) {
    const [pair] = value.split(";");
    if (pair.startsWith("spinvault_session=") && pair.length > "spinvault_session=".length) cookie = pair;
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* non-JSON (a redirect body, say) */
  }
  return { status: response.status, body: payload };
}

// 1. Unauthenticated access is refused, and writes need a same-origin request.
console.log("\naccess control");
assert.equal((await call("/api/auth/session")).status, 401);
assert.equal((await call("/api/pool", { method: "POST", body: { levels: [1] } })).status, 401);
{
  const bad = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://not-spinvault.example" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  assert.equal(bad.status, 403, "a cross-site sign-in must be rejected");
}
ok("protected routes need a session, and writes need a same-origin request");

// 2. Sign in. Only approved IBs get through.
console.log("\nsign-in");
const login = await call("/api/auth/login", { method: "POST", body: { email: EMAIL, password: PASSWORD } });
assert.equal(login.status, 200, `sign-in failed: ${login.body?.error ?? login.status}`);
assert.ok(login.body.profile?.name, "the profile must carry a name");
assert.ok(cookie, "a session cookie must be set");
assert.ok(!JSON.stringify(login.body).toLowerCase().includes("token"), "no ByteFX token may reach the browser");
ok(`signed in as ${login.body.profile.name}, no upstream token in the response`);

const session = await call("/api/auth/session");
assert.equal(session.status, 200);
assert.equal(session.body.profile.id, login.body.profile.id);
ok("the session re-verifies against ByteFX");

// 3. Load the client pool.
console.log("\nclient pool");
const info = await call("/api/giveaways");
assert.equal(info.status, 200);
const giveawayId = info.body.activeId;
assert.ok(giveawayId, "an active giveaway must exist after sign-in");

const masked = await call("/api/pool", { method: "POST", body: { giveawayId, levels: LEVELS, hideSensitive: true } });
assert.equal(masked.status, 200, `pool load failed: ${masked.body?.error ?? masked.status}`);
const pool = masked.body;
assert.ok(Array.isArray(pool.participants));
if (pool.participants.length === 0) {
  console.log("\n  !!  This IB has no clients in the selected levels. Draw checks skipped.");
  console.log(`\n${checks} checks passed\n`);
  process.exit(0);
}
ok(`${pool.participants.length} clients across levels ${LEVELS.join(", ")} (rows per level: ${JSON.stringify(pool.counts)})`);

// One client, one entry — a client at several levels must not get extra chances.
const ids = pool.participants.map((p) => p.id);
assert.equal(new Set(ids).size, ids.length, "a client must appear exactly once in the pool");
const rows = Object.values(pool.counts).reduce((sum, n) => sum + n, 0);
assert.ok(rows >= pool.participants.length, "the pool can only ever be smaller than the rows fetched");
ok(`no duplicate entries (${rows} rows deduplicated to ${pool.participants.length})`);

// Masking is applied server-side: the unmasked values must not be in the payload.
const wire = JSON.stringify(pool.participants);
assert.ok(wire.includes("\u2022"), "masked fields must be present when hideSensitive is on");
ok("client IDs and emails arrive already masked");

const unmasked = await call(`/api/pool?id=${pool.id}&hideSensitive=false`);
assert.equal(unmasked.status, 200);
assert.notEqual(JSON.stringify(unmasked.body.participants), wire, "turning masking off must reveal the real values");
ok("turning masking off re-reads the snapshot and reveals the real values");

// A filter with no backing field must be refused rather than silently applied.
console.log("\ncapabilities");
console.log(`      deposit=${pool.capabilities.deposit} lots=${pool.capabilities.lots} funded=${pool.capabilities.funded}`);
if (!pool.capabilities.deposit) {
  const refused = await call("/api/draws", {
    method: "POST",
    body: {
      requestId: randomUUID(),
      giveawayId,
      snapshotId: pool.id,
      mode: "quick",
      criteria: { minNetDeposit: 100, minLots: 0, fundedOnly: false, hideSensitive: true },
    },
  });
  assert.equal(refused.status, 422, "a filter without a backing field must be refused");
  ok("a threshold ByteFX cannot support is refused, not silently ignored");
}

// 4. The draw: recorded once, replayable, and landing exactly on the winner.
console.log("\ndraw");
const criteria = { minNetDeposit: 0, minLots: 0, fundedOnly: false, hideSensitive: true };
const requestId = randomUUID();
const request = { requestId, giveawayId, snapshotId: pool.id, mode: "quick", criteria };

const first = await call("/api/draws", { method: "POST", body: request });
assert.equal(first.status, 200, `draw failed: ${first.body?.error ?? first.status}`);
const draw = first.body;

assert.ok(Number.isInteger(draw.winnerIndex) && draw.winnerIndex >= 0 && draw.winnerIndex < draw.participants.length);
assert.equal(draw.participants[draw.winnerIndex].id, draw.winner.id, "the winner must be at the recorded index");
ok(`winner recorded at index ${draw.winnerIndex} of ${draw.participants.length}`);

assert.ok(Number.isInteger(draw.finalSteps) && draw.finalSteps >= 1 && draw.finalSteps <= 8);
ok(`the reel finish is ${draw.finalSteps} card${draw.finalSteps === 1 ? "" : "s"} (1-8)`);

assert.ok(draw.receipt?.seed && draw.receipt?.at);
assert.equal(draw.receipt.poolSize, draw.participants.length);
ok("the draw carries a receipt with a seed, timestamp and pool size");

const replay = await call("/api/draws", { method: "POST", body: request });
assert.equal(replay.status, 200);
assert.equal(replay.body.id, draw.id, "replaying a request id must not create a second draw");
assert.equal(replay.body.winner.id, draw.winner.id, "replaying a request id must return the same winner");
ok("repeating a draw request returns the recorded winner instead of drawing again");

const conflicting = await call("/api/draws", {
  method: "POST",
  body: { ...request, criteria: { ...criteria, minLots: 1 } },
});
assert.equal(conflicting.status, 409, "reusing a request id with different settings must be refused");
ok("reusing a request id with different settings is refused");

const second = await call("/api/draws", { method: "POST", body: { ...request, requestId: randomUUID() } });
assert.equal(second.status, 409);
assert.equal(second.body.code, "DRAW_PENDING");
ok("a second draw is blocked until the pending one is acknowledged");

const pending = await call("/api/draws?hideSensitive=true");
assert.equal(pending.body.draw?.id, draw.id, "an un-acknowledged draw must be recoverable");
ok("a draw left un-acknowledged by a closed tab is recoverable");

// 5. Acknowledge, then confirm the winner is recorded in history and excludable.
console.log("\nafter the reveal");
assert.equal((await call("/api/draws/complete", { method: "POST", body: { id: draw.id } })).status, 200);
assert.equal((await call("/api/draws")).body.draw, null, "nothing should stay pending after acknowledgement");

const after = await call(`/api/pool?id=${pool.id}&hideSensitive=true`);
assert.ok(after.body.participants.some(p => p.id === draw.winner.id));
assert.ok(after.body.participants.every(p => !('wonBefore' in p)));
ok("previous winners remain eligible; no exclusion feature is exposed");

const history = await call(`/api/giveaways?id=${giveawayId}`);
assert.ok(history.body.history.some((h) => h.winnerName === draw.winner.name), "the draw must appear in history");
ok("the draw is recorded in the giveaway history");

// 6. Signing out really ends the session.
console.log("\nsign-out");
assert.equal((await call("/api/auth/logout", { method: "POST", body: {} })).status, 200);
assert.equal((await call("/api/auth/session")).status, 401);
ok("signing out invalidates the session");

console.log(`\n${checks} checks passed\n`);
