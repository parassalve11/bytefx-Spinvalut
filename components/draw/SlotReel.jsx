"use client";

import { useEffect, useId, useRef } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useTransform, useVelocity } from "framer-motion";
import { CARD_WIDTH, PITCH, WINDOW_RADIUS } from "@/lib/reel";
import ParticipantCard from "./ParticipantCard";

/** A small moving window; the unchanged reel geometry owns the center position. */
export default function SlotReel({ pool, x, activeIndex, phase = "idle", isSpinning = false, emptyMessage }) {
  const reduced = useReducedMotion();
  const filterId = useId().replace(/:/g, "");
  const blurRef = useRef(null);
  const markerRef = useRef(null);
  const velocity = useVelocity(x);
  const opacity = useTransform(velocity, (v) => reduced ? 1 : 1 - Math.min(Math.abs(v) / 12000, 0.25));
  useMotionValueEvent(velocity, "change", (v) => {
    // Horizontal blur only; no per-frame React state or layout reads.
    const amount = reduced || !isSpinning ? 0 : Math.min(Math.abs(v) / 1800, 3.5);
    blurRef.current?.setAttribute("stdDeviation", `${amount} 0`);
  });

  useEffect(() => {
    if (phase !== "slowing" || reduced) return;
    const tick = markerRef.current?.animate([
      { opacity: 1, filter: "brightness(1.8)" },
      { opacity: 0.65, filter: "brightness(1)" },
    ], { duration: 170, easing: "ease-out" });
    return () => tick?.cancel();
  }, [activeIndex, phase, reduced]);

  if (!pool.length) {
    return (
      <div className="reel-shell flex h-[290px] items-center justify-center px-6 text-center">
        <p className="max-w-xs text-sm text-text-muted">{emptyMessage ?? "No clients match the current eligibility criteria. Relax a filter above to refill the reel."}</p>
      </div>
    );
  }
  const first = activeIndex - WINDOW_RADIUS;
  const indices = Array.from({ length: WINDOW_RADIUS * 2 + 1 }, (_, i) => first + i);
  const locked = phase === "locked" || phase === "revealed";

  return (
    <div className="reel-shell relative h-[290px] select-none overflow-hidden" data-phase={phase} aria-label="Participant reel" aria-busy={isSpinning}>
      <svg className="pointer-events-none absolute h-0 w-0" aria-hidden="true">
        <defs><filter id={filterId} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur ref={blurRef} stdDeviation="0 0" /></filter></defs>
      </svg>
      <div className="center-spotlight" aria-hidden="true" />
      <div className="reel-streaks" aria-hidden="true" />
      <div className="reel-mask relative h-full">
        <motion.div style={{ x, opacity, filter: reduced ? "none" : `url(#${filterId})` }} className="reel-strip absolute left-1/2 top-0 h-full will-change-transform">
          {indices.map((k) => (
            <div key={k} className="reel-card-position absolute top-6 h-[242px]" style={{ left: k * PITCH, width: CARD_WIDTH }}>
              <ParticipantCard
                participant={pool[((k % pool.length) + pool.length) % pool.length]}
                isActive={k === activeIndex}
                isLocked={locked && k === activeIndex}
              />
            </div>
          ))}
        </motion.div>
      </div>
      <div ref={markerRef} className="center-marker" aria-hidden="true">
        <svg viewBox="0 0 20 12" className="absolute top-1 left-1/2 h-3 w-5 -translate-x-1/2"><path d="M10 11 1 1h18z" fill="currentColor" /></svg>
        <span className="absolute inset-y-5 left-1/2 w-px bg-gradient-to-b from-accent-from/25 via-transparent to-accent-from/25" />
        <svg viewBox="0 0 20 12" className="absolute bottom-1 left-1/2 h-3 w-5 -translate-x-1/2 rotate-180"><path d="M10 11 1 1h18z" fill="currentColor" /></svg>
      </div>
    </div>
  );
}
