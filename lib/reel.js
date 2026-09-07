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

/**
 * Works out where a spin should start and end.
 *
 * `anchor` is a re-anchored, visually identical starting index; `target` is the
 * index the strip must land on so that `pool[winnerIndex]` finishes dead centre.
 * By construction `target % poolLength === winnerIndex`, which is the property
 * that makes the landing deterministic rather than something the animation has
 * to be trusted to get right.
 */
export function spinTarget(currentIndex, winnerIndex, poolLength, minTravel) {
  const len = poolLength;
  const phase = ((currentIndex % len) + len) % len;
  const anchor = len + phase;

  // Guarantee a decent amount of travel even when the pool is tiny.
  const loops = Math.max(2, Math.ceil(minTravel / len));
  const stepsToWinner = (((winnerIndex - phase) % len) + len) % len;

  return { anchor, target: anchor + loops * len + stepsToWinner };
}
