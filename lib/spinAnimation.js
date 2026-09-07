import { PITCH } from "./reel.js";

/**
 * The reel's finishing behaviour.
 *
 * A spin ends by coasting to within a short "tail" of the target and then
 * ticking through the last few cards one at a time. How many cards that tail
 * covers is drawn per spin (1..8), so no two draws finish the same way.
 *
 * Everything here is *presentation*. The target offset, and therefore the
 * winner, is decided elsewhere and never changes: `spinKeyframes` always starts
 * at `start` and ends exactly at `end`.
 */

export const MIN_FINAL_STEPS = 1;
export const MAX_FINAL_STEPS = 8;
export const DEFAULT_FINAL_STEPS = 3;

function assertSteps(finalSteps) {
  if (!Number.isInteger(finalSteps) || finalSteps < MIN_FINAL_STEPS || finalSteps > MAX_FINAL_STEPS) {
    throw new RangeError(`Final steps must be between ${MIN_FINAL_STEPS} and ${MAX_FINAL_STEPS}.`);
  }
}

/** The tail length changes the presentation, never the target or the winner. */
export function spinKeyframes(start, end, finalSteps = DEFAULT_FINAL_STEPS) {
  assertSteps(finalSteps);
  const distance = end - start;
  // Capped at a quarter of the journey so the tail can never reach back past
  // the cruise keyframe — the strip must only ever move forwards.
  const tail = Math.min(Math.abs(distance) * 0.25, PITCH * finalSteps);
  return [start, start + distance * 0.08, start + distance * 0.72, end + tail, end];
}

export const SPIN_EASES = [[0.4, 0, 1, 1], "linear", [0.12, 0.5, 0.25, 1], [0.2, 0.65, 0.25, 1]];

/**
 * Keyframe timing for a given tail length. A one-card finish should not be
 * given the same share of the timeline as an eight-card one, or the long tails
 * would rattle through. The settle segment grows with the number of steps and
 * the cruise gives way to it earlier.
 */
export function spinTimes(finalSteps = DEFAULT_FINAL_STEPS) {
  assertSteps(finalSteps);
  const settle = Math.min(0.36, 0.2 + finalSteps * 0.02);
  const cruiseEnd = 1 - settle;
  return [0, 0.08, Number((cruiseEnd * 0.58).toFixed(4)), Number(cruiseEnd.toFixed(4)), 1];
}

/** Longer tails also get a little more wall-clock time, for the same reason. */
export function spinDuration(base, finalSteps = DEFAULT_FINAL_STEPS) {
  assertSteps(finalSteps);
  return Number((base * (1 + (finalSteps - DEFAULT_FINAL_STEPS) * 0.045)).toFixed(3));
}

/** Back-compat export for the fixed three-card timing. */
export const SPIN_TIMES = spinTimes(DEFAULT_FINAL_STEPS);
