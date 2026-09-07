"use client";

import { useEffect, useRef, useState } from "react";

import { clsx } from "@/lib/clsx";

/** Digits with at most one decimal point, or empty while mid-edit. */
const DRAFT_PATTERN = /^\d*\.?\d*$/;

/**
 * Number field with custom steppers and a row of capsule presets.
 *
 * While the field is focused it holds a raw string draft rather than the parsed
 * number. That matters: with a plain controlled number the box can never be
 * cleared — deleting the "0" immediately snaps back to "0", so a new amount has
 * to be typed around the old one. Keeping a draft lets the field go empty, and
 * focusing selects what is there so typing simply replaces it.
 *
 * The parent still only ever receives numbers, clamped to [min, max].
 */
export default function Input({
  label,
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  prefix,
  suffix,
  presets = [],
  id,
  className,
  disabled = false,
  note,
}) {
  const [draft, setDraft] = useState(String(value));
  const focusedRef = useRef(false);

  // Track external changes (presets, steppers, a criteria reset) unless the
  // user is actively typing, in which case the draft is the source of truth.
  useEffect(() => {
    if (!focusedRef.current) setDraft(String(value));
  }, [value]);

  const clamp = (n) => Math.min(max, Math.max(min, n));

  const commit = (n) => {
    const next = Number(clamp(n).toFixed(2));
    setDraft(String(next));
    onChange(next);
  };

  const handleTyping = (raw) => {
    if (!DRAFT_PATTERN.test(raw)) return; // reject stray characters outright
    // "05" -> "5", while leaving "0" and "0.5" alone.
    const cleaned = raw.replace(/^0+(?=\d)/, "");
    setDraft(cleaned);

    if (cleaned === "" || cleaned === ".") {
      onChange(min); // an empty box reads as "no minimum"
      return;
    }
    const n = Number(cleaned);
    if (!Number.isNaN(n)) onChange(clamp(n));
  };

  return (
    <div className={clsx("min-w-0 flex flex-col gap-2.5", disabled && "opacity-50", className)}>
      <label
        htmlFor={id}
        className="text-[11px] font-medium uppercase tracking-[0.16em] text-text-muted"
      >
        {label}
      </label>

      <div
        className={clsx(
          "group flex items-center gap-2 rounded-lg border border-white/[0.07] bg-black/15 py-2 pl-3 pr-2",
          "transition focus-within:border-accent-from/50 focus-within:shadow-[0_0_0_3px_rgba(16,224,160,0.12)]",
          disabled && "cursor-not-allowed",
        )}
      >
        {prefix ? (
          <span className="shrink-0 text-sm font-medium text-text-muted">{prefix}</span>
        ) : null}

        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={disabled ? "" : draft}
          aria-label={label}
          disabled={disabled}
          placeholder={disabled ? "Unavailable" : undefined}
          onFocus={(e) => {
            focusedRef.current = true;
            e.target.select();
          }}
          onBlur={() => {
            focusedRef.current = false;
            setDraft(String(value)); // normalise whatever was left behind
          }}
          onChange={(e) => handleTyping(e.target.value)}
          className="w-full min-w-0 bg-transparent text-2xl font-medium tabular-nums text-text-primary outline-none"
        />

        {suffix ? (
          <span className="shrink-0 text-xs text-text-muted">{suffix}</span>
        ) : null}

        <div className="flex shrink-0 flex-col gap-0.5">
          <StepperButton
            label={`Increase ${label}`}
            onClick={() => commit(Number(value) + step)}
            dir="up"
            disabled={disabled}
          />
          <StepperButton
            label={`Decrease ${label}`}
            onClick={() => commit(Number(value) - step)}
            dir="down"
            disabled={disabled}
          />
        </div>
      </div>

      {note ? <p className="text-[11px] leading-snug text-text-muted/85">{note}</p> : null}

      {presets.length > 0 && !disabled ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${label} presets`}>
          {presets.map((preset) => {
            const selected = Number(value) === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => commit(preset.value)}
                className={clsx(
                  "rounded-md border px-2.5 py-1.5 text-xs font-medium transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-from/70",
                  selected
                    ? "border-accent-from/25 bg-accent-from/10 text-accent-from"
                    : "border-white/10 bg-white/[0.03] text-text-muted hover:border-accent-from/40 hover:text-text-primary",
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function StepperButton({ label, onClick, dir, disabled }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex h-[15px] w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]",
        "text-text-muted transition hover:border-accent-from/40 hover:text-accent-from active:scale-95",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:text-text-muted",
      )}
    >
      <svg viewBox="0 0 10 6" className="h-1.5 w-2.5" fill="none" aria-hidden>
        <path
          d={dir === "up" ? "M1 5l4-4 4 4" : "M1 1l4 4 4-4"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
