"use client";

import { clsx } from "@/lib/clsx";

/** Checkbox row: label on the left, switch on the right. */
export default function Toggle({ label, description, checked, onChange, id, disabled = false }) {
  return (
    <label
      htmlFor={id}
      title={description}
      className={clsx(
        "filter-pill inline-flex items-center gap-2.5 rounded-full border px-3 py-2 transition",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        checked
          ? "border-accent-from/35 bg-accent-from/[0.06]"
          : "border-white/[0.08] bg-bg-card/50 hover:border-white/15",
      )}
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium text-text-primary">{label}</span>
        {description ? (
          <span id={`${id}-description`} className="sr-only">
            {description}
          </span>
        ) : null}
      </span>

      <span className="relative shrink-0">
        <input
          id={id}
          type="checkbox"
          aria-describedby={description ? `${id}-description` : undefined}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={clsx(
            "block h-4 w-7 rounded-full transition-colors",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-accent-from/70 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-panel",
            checked ? "bg-accent-gradient" : "bg-white/[0.12]",
          )}
        />
        <span
          aria-hidden
          className={clsx(
            "pointer-events-none absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-3" : "translate-x-0",
          )}
        />
      </span>
    </label>
  );
}
