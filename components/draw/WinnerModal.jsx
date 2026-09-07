"use client";

import Image from "next/image";
import trophy from "@/assets/winner-card/Throfy.webp";
import { countryDetails, normalizeAccounts } from "@/lib/clientDetails";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import CountryLabel from "@/components/ui/CountryLabel";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { formatLevels, formatLots, formatMoney, UNAVAILABLE } from "@/lib/format";

const ACCENT_COLORS = ["#10E0A0", "#22C7E0", "#7DF5C8", "#F5F7FA"];

/** Two-sided burst plus a short drizzle from the top. */
function celebrate(confetti) {
  const base = { colors: ACCENT_COLORS, disableForReducedMotion: true };

  confetti({ ...base, particleCount: 70, spread: 70, startVelocity: 45, origin: { x: 0.5, y: 0.55 } });
  confetti({ ...base, particleCount: 45, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } });
  confetti({ ...base, particleCount: 45, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } });

  const end = Date.now() + 900;
  (function drizzle() {
    confetti({ ...base, particleCount: 4, spread: 90, startVelocity: 18, gravity: 0.9, origin: { x: Math.random(), y: 0 } });
    if (Date.now() < end) requestAnimationFrame(drizzle);
  })();
}

export default function WinnerModal({ open, winner, receipt, onClose, onDrawAgain }) {
  const reduced = useReducedMotion();
  const closeRef = useRef(null);
  const dialogRef = useRef(null);

  // Confetti + focus + Escape, all scoped to the open state.
  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement;
    let cancelled = false;
    import("canvas-confetti").then((mod) => {
      if (!cancelled) celebrate(mod.default);
    });

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const buttons = dialogRef.current?.querySelectorAll("button:not(:disabled)");
        if (!buttons?.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      cancelled = true;
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, onClose]);

  // Already masked server-side when "Hide sensitive info" is on.
  const p = winner ?? null;
  const country = countryDetails(p?.region);
  const accounts = normalizeAccounts(p?.clientId);

  return (
    <AnimatePresence>
      {open && p ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-bg-base/85 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="winner-name"
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="winner-dialog relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-accent-from/25 p-5 text-center shadow-glow-soft sm:p-7"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(50%_100%_at_50%_100%,rgba(16,224,160,0.28)_0%,transparent_100%)]"
            />

            <div className="relative">
              <motion.button
                type="button"
                aria-label="Celebrate the winner"
                className="winner-trophy mx-auto block rounded-full"
                whileHover={reduced ? undefined : { scale: 1.08, rotate: 3 }}
                whileTap={reduced ? undefined : { scale: 0.96 }}
                onClick={() => { if (!reduced) import("canvas-confetti").then(mod => celebrate(mod.default)); }}
              >
                <Image src={trophy} alt="" width={150} sizes="150px" className="h-32 w-32 object-contain sm:h-36 sm:w-36" />
              </motion.button>

              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.4em] text-text-muted">
                Winner
              </p>

              <Avatar
                src={p.avatar}
                size={48}
                className="mx-auto mt-4"
                ringClassName="border-2 border-accent-from/40 shadow-glow"
              />

              <h2
                id="winner-name"
                className="mt-3 break-words font-display text-2xl font-bold leading-tight text-text-primary sm:text-3xl"
              >
                {p.name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-text-muted">
                <CountryLabel country={country} inferred={p.regionSource === "phone"} />
                <span className="client-status" data-status={p.status || "unknown"}><span aria-hidden="true" />{p.status === "active" ? "Active" : p.status === "inactive" ? "Inactive" : "Status not provided"}</span>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.06] text-left">
                <Field label={accounts.length > 1 ? "MT5 accounts" : "MT5 ID"} value={accounts.length ? accounts.join(", ") : "Not provided"}>
                  {accounts.length ? <span className="flex flex-wrap gap-1.5">{accounts.map(account => <span key={account} className="mt5-reference">{account}</span>)}</span> : null}
                </Field>
                <Field label="Phone" value={p.phone || "Not provided"} />
                <Field label="Email" value={p.email || UNAVAILABLE} wide />
                <Field label="Lots Traded" value={formatLots(p.lots)} />
                <Field
                  label={p.netDeposit === null || p.netDeposit === undefined ? "Network Level" : "Net Deposit"}
                  value={
                    p.netDeposit === null || p.netDeposit === undefined
                      ? formatLevels(p.levels)
                      : formatMoney(p.netDeposit, p.currency)
                  }
                />
              </dl>

              {receipt ? (
                <p className="mt-4 text-[10px] leading-relaxed text-text-muted">
                  Draw receipt{" "}
                  <span className="font-mono text-accent-from">{receipt.seed}</span> · picked from{" "}
                  {receipt.poolSize} eligible client{receipt.poolSize === 1 ? "" : "s"}
                  {Array.isArray(receipt.levels) && receipt.levels.length
                    ? ` across level ${receipt.levels.join(" · ")}`
                    : ""}
                  {receipt.at ? ` · ${new Date(receipt.at).toLocaleString()}` : ""}
                </p>
              ) : null}

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
                <Button onClick={onDrawAgain}>Draw Another</Button>
                <Button ref={closeRef} variant="ghost" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Field({ label, value, children, wide }) {
  return (
    <div className={`winner-field px-4 py-3 ${wide ? "col-span-2" : ""}`}>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-text-primary" title={value}>
        {children || value}
      </dd>
    </div>
  );
}

