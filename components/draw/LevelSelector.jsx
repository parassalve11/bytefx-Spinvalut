"use client";

import { clsx } from "@/lib/clsx";

/** Only levels found in the completed network response are offered. */
export default function LevelSelector({ levels, counts, total, onChange, disabled }) {
  const available = Object.keys(counts ?? {}).map(Number).filter(level => counts[level] > 0).sort((a, b) => a - b);
  const selected = new Set(levels);
  const allSelected = available.every(level => selected.has(level));
  const selectLevel = (level) => {
    // The first specific choice leaves All clients; subsequent choices can combine levels.
    if (allSelected) return onChange([level]);
    const next = selected.has(level) ? available.filter(n => selected.has(n) && n !== level) : [...levels, level];
    if (next.length) onChange(next);
  };

  return (
    <div className="level-selector">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-text-muted">Client levels</p>
        <p className="text-xs text-text-muted"><span className="font-semibold tabular-nums text-text-primary">{total}</span> {total === 1 ? "client" : "clients"} selected</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Client levels">
        <button type="button" aria-pressed={allSelected} disabled={disabled || !available.length} onClick={() => onChange([1, 2, 3, 4, 5, 6, 7])} className={clsx("level-chip level-chip-all", allSelected && "is-selected")}>
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true"><path d="M2 2h4v4H2zm8 0h4v4h-4zM2 10h4v4H2zm8 0h4v4h-4z" stroke="currentColor" strokeWidth="1.2" /></svg>
          All clients
        </button>
        {available.map(level => (
          <button key={level} type="button" aria-pressed={!allSelected && selected.has(level)} disabled={disabled} onClick={() => selectLevel(level)} className={clsx("level-chip", !allSelected && selected.has(level) && "is-selected")}>
            Level {level}<span className="level-count">{counts[level]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
