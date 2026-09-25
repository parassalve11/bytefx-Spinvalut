/**
 * The reel's motion, as a single easing curve with continuous speed.
 *
 * The previous keyframe version joined four easing segments. Speed jumped at
 * two of the joins, and at the start of the finishing "tail" the strip came to
 * a complete stop before lurching forward again. This version builds the
 * motion from a speed profile instead, so the reel never stops early and never
 * jerks:
 *
 *   launch  — speed ramps smoothly from 0 to cruise
 *   cruise  — constant top speed
 *   brake   — speed eases down to a slow crawl
 *   crawl   — the last `finalSteps` cards tick past and the reel settles
 *
 * `finalSteps` (1..8, drawn per spin on the server) sets how many cards pass
 * during the crawl, so one draw ends on a single deliberate tick and another
 * rolls through seven or eight. Everything here is presentation: the curve
 * always starts at 0 and ends at exactly 1, so the target — and therefore the
 * winner — never moves.
 */

export const MIN_FINAL_STEPS = 1;
export const MAX_FINAL_STEPS = 8;
export const DEFAULT_FINAL_STEPS = 3;

/** Below this speed (cards per second) individual cards can be read. */
const READABLE_SPEED = 9;

function assertSteps(finalSteps) {
  if (!Number.isInteger(finalSteps) || finalSteps < MIN_FINAL_STEPS || finalSteps > MAX_FINAL_STEPS) {
    throw new RangeError(`Final steps must be between ${MIN_FINAL_STEPS} and ${MAX_FINAL_STEPS}.`);
  }
}

/** Longer crawls get a little more wall-clock time. */
export function spinDuration(base, finalSteps = DEFAULT_FINAL_STEPS) {
  assertSteps(finalSteps);
  return Number((base * (1 + (finalSteps - DEFAULT_FINAL_STEPS) * 0.045)).toFixed(3));
}

/**
 * Builds the motion for a spin of `travel` cards lasting `duration` seconds.
 *
 * Returns `ease(u)` mapping normalised time to normalised distance, plus the
 * distance fractions at which the launch ends and at which the reel becomes
 * slow enough to read (used for the "slowing" phase and its tick effects).
 */
export function spinMotion(travel, duration, finalSteps = DEFAULT_FINAL_STEPS) {
  assertSteps(finalSteps);
  if (!(travel > 0) || !(duration > 0)) throw new RangeError("Travel and duration must be positive.");

  // Crawl: speed falls from `crawl` to 0 as (1 - s)^q, covering `tail` cards.
  const tail = Math.min(finalSteps, travel / 4);
  const q = 1.5;
  const crawl = 3 + finalSteps * 0.75; // cards per second entering the crawl
  const crawlTime = Math.min((tail * (q + 1)) / crawl, duration * 0.45);
  const crawlSpeed = (tail * (q + 1)) / crawlTime; // exact, after the clamp

  // Launch / cruise / brake share what is left.
  const main = duration - crawlTime;
  const launchTime = main * 0.12;
  const brakeTime = main * 0.5;
  const cruiseTime = main - launchTime - brakeTime;
  const p = 2; // brake shape: speed = crawl + (top - crawl)(1 - s)^p

  // Solve for top speed so the whole journey is exactly `travel` cards.
  const top =
    (travel - tail - crawlSpeed * brakeTime * (p / (p + 1))) /
    (launchTime / 2 + cruiseTime + brakeTime / (p + 1));
  if (!(top > crawlSpeed)) {
    // Too short a trip for a full profile: fall back to a plain ease-out.
    const easeOut = (u) => 1 - (1 - Math.min(Math.max(u, 0), 1)) ** 3;
    return { ease: easeOut, launchEnd: 0, slowFrom: 0.6 };
  }

  const t1 = launchTime;
  const t2 = t1 + cruiseTime;
  const t3 = t2 + brakeTime;
  const d1 = (top * launchTime) / 2;
  const d2 = d1 + top * cruiseTime;
  const d3 = d2 + brakeTime * (crawlSpeed + (top - crawlSpeed) / (p + 1));

  const distanceAt = (t) => {
    if (t <= 0) return 0;
    if (t < t1) {
      const s = t / launchTime; // smoothstep speed ramp, integrated
      return top * launchTime * (s ** 3 - s ** 4 / 2);
    }
    if (t < t2) return d1 + top * (t - t1);
    if (t < t3) {
      const s = (t - t2) / brakeTime;
      return d2 + brakeTime * (crawlSpeed * s + ((top - crawlSpeed) * (1 - (1 - s) ** (p + 1))) / (p + 1));
    }
    if (t < duration) {
      const s = (t - t3) / crawlTime;
      return d3 + (crawlSpeed * crawlTime * (1 - (1 - s) ** (q + 1))) / (q + 1);
    }
    return travel;
  };

  const ease = (u) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    return Math.min(1, distanceAt(u * duration) / travel);
  };

  // First moment in the brake where the strip is slow enough to read.
  let slowFrom = d3 / travel;
  if (crawlSpeed < READABLE_SPEED && top > READABLE_SPEED) {
    const s = 1 - ((READABLE_SPEED - crawlSpeed) / (top - crawlSpeed)) ** (1 / p);
    slowFrom = distanceAt(t2 + s * brakeTime) / travel;
  } else if (top <= READABLE_SPEED) {
    slowFrom = d2 / travel;
  }

  return { ease, launchEnd: d1 / travel, slowFrom, topSpeed: top };
}
