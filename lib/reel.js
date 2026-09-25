/**
 * Pure reel geometry and spin maths — no React, no DOM, so it can be reasoned
 * about (and tested) on its own.
 *
 * The reel renders the eligible pool repeated end to end. Because the strip is
 * periodic with a period of `poolLength` cards, any two offsets that differ by
 * a whole number of pool-lengths are visually identical. That is what lets the
 * reel silently re-anchor before every spin instead of letting the offset grow
 * without bound over a long session.
 */

export const CARD_WIDTH = 168;
export const CARD_GAP = 16;
export const PITCH = CARD_WIDTH + CARD_GAP;

/**
 * How many cards either side of centre the reel actually mounts. Generous
 * enough to cover very wide viewports and to absorb the frame or two by which
 * React can trail the strip during the fastest part of a spin.
 */
export const WINDOW_RADIUS = 12;

/** Translation that centres strip index `k` under the marker. */
export function offsetForIndex(k) {
  return -(k * PITCH + CARD_WIDTH / 2);
}

/** Which strip index sits under the marker at a given translation. */
export function indexForOffset(x) {
  return Math.round((-x - CARD_WIDTH / 2) / PITCH);
}

const mod = (n, m) => ((n % m) + m) % m;

/**
 * Works out where a spin starts, where it ends, and — for large pools — the
 * order the reel should show the cards in while it spins.
 *
 * `anchor` is a re-anchored, visually identical starting index; `target` is the
 * strip index that lands under the marker. `order` is either null (the reel
 * keeps the pool order) or a permutation of pool indices to render instead.
 * Either way, `order[target % len]` (or `target % len` itself) is the winner,
 * so the card under the marker always matches the recorded result.
 *
 * Why the permutation exists: with a fixed card order the distance to the
 * winner can be anything up to a full pool length. For a 139-client network
 * the old "two full loops" rule meant 280–420 cards in under five seconds —
 * far past the point where the eye can follow a strip, and fast enough to
 * strobe. Travel is now kept between `minTravel` and `maxTravel` cards. When
 * the winner's natural position falls outside that range, the winner swaps
 * places with the card that would have landed there. Both cards are chosen
 * outside the strip that is on screen when the spin starts, so nothing
 * visibly changes; the pool, and every client's single entry, are untouched.
 */
export function spinPlan(currentIndex, winnerIndex, poolLength, minTravel, maxTravel = Math.ceil(minTravel * 1.5)) {
  const len = poolLength;
  const phase = mod(currentIndex, len);
  const anchor = len + phase;

  // Smallest travel >= minTravel that lands on the winner in pool order.
  const natural = minTravel + mod(winnerIndex - phase - minTravel, len);
  if (natural <= maxTravel) return { anchor, target: anchor + natural, order: null };

  // Pool indices visible when the spin starts. Neither swapped card may be one of them.
  const visible = new Set();
  for (let d = -WINDOW_RADIUS; d <= WINDOW_RADIUS; d++) visible.add(mod(phase + d, len));

  if (!visible.has(winnerIndex)) {
    const span = maxTravel - minTravel + 1;
    const start = mod(winnerIndex * 7 + len, span);
    for (let i = 0; i < span; i++) {
      const travel = minTravel + mod(start + i, span);
      const slot = mod(phase + travel, len);
      if (visible.has(slot)) continue;
      const order = Array.from({ length: len }, (_, k) => k);
      order[slot] = winnerIndex;
      order[winnerIndex] = slot;
      return { anchor, target: anchor + travel, order };
    }
  }

  // Fall back to the plain periodic landing (always correct, just longer).
  return { anchor, target: anchor + natural, order: null };
}

/** Kept for existing callers: the target without any reordering. */
export function spinTarget(currentIndex, winnerIndex, poolLength, minTravel) {
  const plan = spinPlan(currentIndex, winnerIndex, poolLength, minTravel, Infinity);
  return { anchor: plan.anchor, target: plan.target };
}
