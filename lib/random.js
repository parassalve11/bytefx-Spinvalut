/**
 * Fair pick helpers backed by the Web Crypto CSPRNG.
 *
 * `fairPick` uses rejection sampling rather than a plain `value % n`. A bare
 * modulo is very slightly biased toward the low indices whenever n does not
 * divide 2^32 evenly; discarding the ragged tail of the range removes that bias
 * entirely for the same cost in the overwhelming majority of draws.
 */

const MAX_UINT32 = 0xffffffff;

function randomUint32() {
  const buf = new Uint32Array(1);
  // Node 20 and every target browser expose the same global.
  globalThis.crypto.getRandomValues(buf);
  return buf[0];
}

/** Returns a uniformly random integer in [0, n). */
export function fairPick(n) {
  if (!Number.isInteger(n) || n <= 0) {
    throw new RangeError(`fairPick expects a positive integer, received ${n}`);
  }
  if (n === 1) return 0;

  // Largest multiple of n that fits in a uint32; anything at or above it is
  // re-rolled so every index has exactly the same number of winning values.
  const limit = Math.floor((MAX_UINT32 + 1) / n) * n;

  let value = randomUint32();
  while (value >= limit) {
    value = randomUint32();
  }
  return value % n;
}

/** A short, human-readable receipt for a draw — shown as the "fairness" note. */
export function drawSeedLabel() {
  return randomUint32().toString(16).padStart(8, "0").toUpperCase();
}
