/**
 * Verifies the parts of the draw that must be exactly right, independently of
 * the browser: the reel always lands on the chosen winner, the pick is uniform,
 * eligibility filters shrink the pool, and masking hides what it claims to.
 */
import assert from "node:assert/strict";

import { offsetForIndex, indexForOffset, spinPlan, PITCH, WINDOW_RADIUS } from "../lib/reel.js";
import { spinMotion, spinDuration, MIN_FINAL_STEPS, MAX_FINAL_STEPS } from "../lib/spinAnimation.js";
import { applyCriteria, parseCriteria, DEFAULT_CRITERIA } from "../lib/eligibility.js";
import { fairPick } from "../lib/random.js";
import { maskId, maskClientId, maskEmail, maskParticipant } from "../lib/mask.js";
import { participants } from "./fixtures/participants.js";

let checks = 0;
const ok = (label) => { checks++; console.log(`  ok  ${label}`); };
const mod = (n, m) => ((n % m) + m) % m;

// 1. Landing is exact for every pool size and every winner, from every start.
console.log("\nreel landing");
let swapped = 0;
for (let len = 1; len <= 180; len++) {
  const winners = len <= 40 ? Array.from({ length: len }, (_, i) => i) : [0, 1, len >> 1, len - 2, len - 1, (len * 7) % len];
  for (const winner of winners) {
    for (const start of [0, 1, 7, len, len * 3 + 5, 999]) {
      for (const minTravel of [42, 84]) {
        const { anchor, target, order } = spinPlan(start, winner, len, minTravel);
        const landed = order ? order[mod(target, len)] : mod(target, len);

        assert.equal(landed, winner, `the card under the marker must be the winner (len=${len})`);
        assert.equal(anchor % len, mod(start, len), "re-anchor must be invisible");
        assert.ok(target - anchor >= minTravel, "must travel far enough");
        assert.equal(indexForOffset(offsetForIndex(target)), target, "the end offset decodes back to the target");

        if (order) {
          swapped++;
          assert.equal(new Set(order).size, len, "the reorder is a permutation: every client keeps one card");
          for (let d = -WINDOW_RADIUS; d <= WINDOW_RADIUS; d++) {
            const k = mod(anchor + d, len);
            assert.equal(order[k], k, "nothing on screen changes when the spin starts");
          }
          assert.ok(target - anchor <= Math.ceil(minTravel * 1.5), "large pools keep a readable travel distance");
        }
      }
    }
  }
}
assert.ok(swapped > 0, "large pools exercise the reorder path");
ok("winner lands dead centre for pools of 1..180, every start, with bounded travel on large pools");

// 1b. The motion curve: starts at 0, ends exactly at 1, only moves forward, never jerks.
console.log("\nspin motion");
for (const [base, travels] of [[4.8, [42, 55, 63]], [7.4, [84, 100, 126]]]) {
  for (const travel of travels) {
    for (let steps = MIN_FINAL_STEPS; steps <= MAX_FINAL_STEPS; steps++) {
      const duration = spinDuration(base, steps);
      const { ease, launchEnd, slowFrom, topSpeed } = spinMotion(travel, duration, steps);
      assert.equal(ease(0), 0);
      assert.equal(ease(1), 1, "the finish never moves the target");
      assert.ok(launchEnd > 0 && launchEnd < slowFrom && slowFrom < 1, "phases are ordered");
      assert.ok(topSpeed * PITCH < 7000, `top speed stays trackable (${Math.round(topSpeed * PITCH)}px/s)`);
      const frames = Math.round(duration * 240);
      let previous = 0;
      let previousSpeed = 0;
      for (let i = 1; i <= frames; i++) {
        const d = ease(i / frames);
        assert.ok(d >= previous - 1e-12, "the strip only moves forwards");
        const speed = ((d - previous) * travel * frames) / duration;
        assert.ok(Math.abs(speed - previousSpeed) < 1, `speed changes smoothly (steps=${steps})`);
        previous = d;
        previousSpeed = speed;
      }
      assert.ok(previousSpeed < 0.5, "the reel is almost still when it lands");
    }
  }
}
assert.ok(spinDuration(4.8, 8) > spinDuration(4.8, 1), "more steps means a longer spin");
for (const bad of [0, 9, 3.5, -1, "3", null]) {
  assert.throws(() => spinMotion(50, 4.8, bad), RangeError, `finalSteps ${bad} must be rejected`);
}
ok(`continuous speed for finishes ${MIN_FINAL_STEPS}..${MAX_FINAL_STEPS}, out-of-range rejected`);

// The server picks the tail with the same CSPRNG helper; check its range.
const tails = new Set();
for (let i = 0; i < 4000; i++) tails.add(fairPick(8) + 1);
assert.deepEqual([...tails].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
ok("every tail length from 1 to 8 is reachable");

// 2. Card pitch: the landing offset centres the card, not its edge.
assert.equal(offsetForIndex(0), -(168 / 2));
assert.equal(offsetForIndex(1) - offsetForIndex(0), -PITCH);
ok("offsets centre the card under the marker");

// 3. The pick is uniform across the pool.
console.log("\nfair pick");
const N = 32;
const RUNS = 320000;
const counts = new Array(N).fill(0);
for (let i = 0; i < RUNS; i++) counts[fairPick(N)]++;
const expected = RUNS / N;
const worst = Math.max(...counts.map((c) => Math.abs(c - expected) / expected));
assert.ok(counts.every((c) => c > 0), "every index must be reachable");
assert.ok(worst < 0.05, `distribution should be flat, worst deviation was ${(worst * 100).toFixed(2)}%`);
ok(`uniform over ${RUNS.toLocaleString("en-US")} draws (worst bucket ${(worst * 100).toFixed(2)}% off)`);

assert.equal(fairPick(1), 0);
assert.throws(() => fairPick(0));
ok("degenerate pool sizes handled");

// 4. Eligibility filters actually shrink the pool, and unknown values never pass.
console.log("\neligibility");
const apply = (c) => applyCriteria(participants, parseCriteria(c));

const base = apply({});
assert.equal(base.length, participants.length);
assert.ok(apply({ minNetDeposit: 1000 }).length < base.length);
assert.ok(apply({ minLots: 10 }).length < base.length);
assert.ok(apply({ fundedOnly: true }).every((p) => p.isFunded));
assert.equal(apply({ excludePreviousWinners: true }).length, base.length, "legacy exclusion cannot remove previous winners");
assert.equal(apply({ minNetDeposit: 5000 }).length, 0);
ok("each filter narrows the pool, and an impossible filter empties it");

// ByteFX does not return every field for every client. A missing figure is
// null, and null must never satisfy a threshold — treating it as 0 would let a
// client through on data we do not have, and treating it as huge would too.
const unknown = [{ id: "x", name: "Unknown", netDeposit: null, lots: null, isFunded: null, wonBefore: false }];
assert.equal(applyCriteria(unknown, parseCriteria({})).length, 1, "no threshold means everyone is in");
assert.equal(applyCriteria(unknown, parseCriteria({ minNetDeposit: 1 })).length, 0);
assert.equal(applyCriteria(unknown, parseCriteria({ minLots: 0.01 })).length, 0);
assert.equal(applyCriteria(unknown, parseCriteria({ fundedOnly: true })).length, 0);
ok("clients with unavailable figures are excluded by a threshold, never assumed to be zero");

// 4b. Criteria coming off the wire are validated, and masking is off by default.
assert.equal(DEFAULT_CRITERIA.hideSensitive, false, "privacy is off until the IB enables it");
assert.equal(parseCriteria({}).hideSensitive, false);
assert.equal(parseCriteria({ hideSensitive: false }).hideSensitive, false);
for (const bad of [{ minNetDeposit: -1 }, { minNetDeposit: 1e9 }, { minLots: "5" }, { fundedOnly: "yes" }]) {
  assert.throws(() => parseCriteria(bad), `${JSON.stringify(bad)} must be rejected`);
}
ok("criteria are validated, and masking defaults to off");

// 5. Masking hides the sensitive parts and nothing else.
console.log("\nmasking");
assert.equal(maskClientId("8420418"), "8•••••8");
const maskedEmail = maskEmail("pratik.patil@mail.com");
assert.ok(maskedEmail.startsWith("p"), "the first character survives");
assert.ok(maskedEmail.endsWith("@mail.com"), "the domain survives");
assert.ok(!maskedEmail.includes("ratik.patil"), "the local part is hidden");
assert.equal(maskedEmail.length, "pratik.patil@mail.com".length, "length is preserved");
assert.ok(!maskId("usr_10293").includes("0293"));
const masked = maskParticipant(participants[0], true);
assert.equal(masked.name, participants[0].name, "the name is meant to stay visible");
assert.notEqual(masked.clientId, participants[0].clientId);
assert.notEqual(masked.email, participants[0].email);
assert.equal(maskParticipant(participants[0], false), participants[0], "masking off is a pass-through");
ok("client id and email are masked, name and avatar are not");

// 6. Fixtures are well formed — every card must be able to show a picture.
console.log("\nfixtures");
assert.ok(participants.length >= 25 && participants.length <= 35);
const ids = new Set(participants.map((p) => p.id));
assert.equal(ids.size, participants.length, "ids must be unique");
for (const p of participants) {
  for (const key of ["id", "name", "region", "clientId", "email"]) {
    assert.ok(p[key], `${p.name} is missing ${key}`);
  }
  assert.ok(p.netDeposit > 0 && p.lots > 0);
}
ok(`${participants.length} participants, all ids unique`);

// An avatar is either a real remote photo or explicitly absent. Anything else
// (an empty string, a stale local path) would render a broken image rather than
// falling back to the default user icon.
const withPhoto = participants.filter((p) => p.avatar !== null);
const withoutPhoto = participants.filter((p) => p.avatar === null);
for (const p of withPhoto) {
  assert.match(
    p.avatar,
    /^https:\/\/images\.unsplash\.com\/photo-/,
    `${p.name} has a bad avatar URL`,
  );
}
assert.ok(withoutPhoto.length > 0, "some participants must exercise the icon fallback");
assert.equal(withPhoto.length + withoutPhoto.length, participants.length);
ok(`${withPhoto.length} Unsplash photos, ${withoutPhoto.length} falling back to the user icon`);

console.log(`\n${checks} checks passed\n`);
