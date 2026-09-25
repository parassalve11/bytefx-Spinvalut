"use client";

import { motion } from "framer-motion";

import { clsx } from "@/lib/clsx";
import { MODES } from "@/lib/modes";

/** Quick Draw / Grand Finale switch. Both share the reel; only the spin differs. */
export default function ModeTabs({ mode, onChange, disabled }) {
  const modes = Object.values(MODES);

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div
        role="group"
        aria-label="Draw mode"
        className="inline-flex rounded-full border border-accent-from/20 bg-bg-panel p-1 shadow-[0_22px_60px_-32px_rgba(0,0,0,0.85)]"
      >
        {modes.map((m) => {
          const selected = m.id === mode;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(m.id)}
              className={clsx(
                "relative rounded-full px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors sm:px-6",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-from/70",
                "disabled:cursor-not-allowed disabled:opacity-50",
                selected ? "text-accent-from" : "text-text-muted hover:text-text-primary",
              )}
            >
              {selected ? (
                <motion.span
                  layoutId="mode-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-full border border-accent-from/20 bg-accent-from/10"
                />
              ) : null}
              <span className="relative z-10">{m.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-text-primary/80 [text-shadow:0_1px_12px_rgba(7,9,15,0.8)]">{MODES[mode]?.hint}</p>
    </div>
  );
}
