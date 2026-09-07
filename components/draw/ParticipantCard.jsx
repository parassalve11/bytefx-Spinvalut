"use client";

import { memo } from "react";

import Avatar from "@/components/ui/Avatar";
import { clsx } from "@/lib/clsx";
import { formatLots, formatMoney, UNAVAILABLE } from "@/lib/format";

/**
 * One client in the reel. Purely presentational — `isActive` is driven by
 * whichever card currently sits under the reel marker.
 *
 * Client IDs and emails arrive already masked when "Hide sensitive info" is on;
 * masking happens on the server so the unmasked values are never sent to the
 * browser at all. Nothing is re-masked here.
 */
function ParticipantCard({ participant, isActive = false, isLocked = false }) {
  const p = participant;
  const hasDeposit = p.netDeposit !== null && p.netDeposit !== undefined;
  const hasLots = p.lots !== null && p.lots !== undefined;

  return (
    <article
      data-participant-id={p.id}
      data-active={isActive}
      data-locked={isLocked}
      className={clsx(
        "participant-card flex h-full select-none flex-col items-center gap-3 rounded-2xl border px-4 py-5 text-center",
        "transition-[transform,box-shadow,border-color,background-color,opacity] duration-300 ease-out",
        isActive ? "border-accent-from/40 bg-bg-card/90" : "border-white/[0.07] bg-bg-card/55",
      )}
    >
      <div className="relative">
        <span
          aria-hidden
          className={clsx(
            "absolute -inset-1 rounded-full bg-accent-gradient transition-opacity duration-300",
            isActive ? "opacity-70 blur-[6px]" : "opacity-0",
          )}
        />
        <Avatar src={p.avatar} size={56} className="relative" />
      </div>

      <div className="min-w-0 w-full">
        <h3
          className={clsx(
            "truncate text-[15px] font-semibold leading-tight transition-colors",
            isActive ? "text-text-primary" : "text-text-primary/80",
          )}
          title={p.name}
        >
          {p.name}
        </h3>
        <p className="mt-1 truncate text-[11px] font-medium tracking-wide text-text-muted">
          {p.clientId || UNAVAILABLE}
        </p>
        <p className="truncate text-[11px] text-text-muted/80">{p.region || "\u00a0"}</p>
      </div>

      <div className="mt-auto w-full border-t border-white/[0.06] pt-3">
        {/* Whichever verified figure exists leads; a missing one is never
            rendered as $0, which would read as a real amount. */}
        <p
          className={clsx(
            "text-sm font-bold tabular-nums transition-colors",
            isActive ? "text-gradient" : "text-text-primary/70",
          )}
        >
          {hasDeposit ? formatMoney(p.netDeposit, p.currency) : hasLots ? `${formatLots(p.lots)} lots` : UNAVAILABLE}
        </p>
        <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
          {hasDeposit && hasLots
            ? `${formatLots(p.lots)} lots`
            : Array.isArray(p.levels) && p.levels.length
              ? `Level ${p.levels.join(" · ")}`
              : "\u00a0"}
        </p>
      </div>
    </article>
  );
}

export default memo(ParticipantCard);
