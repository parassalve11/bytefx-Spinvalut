"use client";

import Button from "@/components/ui/Button";

/** Primary call to action. Idle shows a gift; spinning locks and shows a spinner. */
export default function DrawButton({ onClick, isSpinning, phase, disabled = false }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        size="lg"
        onClick={onClick}
        disabled={isSpinning || disabled}
        aria-live="polite"
        className="draw-button w-full uppercase sm:w-auto sm:min-w-[260px]"
      >
        {isSpinning ? (
          <>
            <Spinner />
            {phase === "charging" ? "Preparing..." : phase === "locked" ? "Winner locked" : "Drawing..."}
          </>
        ) : (
          <>
            <GiftIcon />
            Draw Winner
          </>
        )}
      </Button>

    </div>
  );
}

function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8M3 7h18v5H3zM12 7v14M12 7S10.5 3 8.5 3a2.5 2.5 0 0 0 0 5H12zm0 0s1.5-4 3.5-4a2.5 2.5 0 0 1 0 5H12z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
