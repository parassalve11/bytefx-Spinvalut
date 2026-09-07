"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { maskClientId } from "@/lib/mask";

export default function AccountCard({ profile, hideSensitive = false, disabled = false }) {
  const router = useRouter();
  const dialogRef = useRef(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const initials = (profile?.name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join("") || "IB";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (confirming && !dialog.open) dialog.showModal();
    else if (!confirming && dialog.open) dialog.close();
  }, [confirming]);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.logout();
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Couldn't sign out. Please check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="account-card" role="region" aria-label="Signed-in account">
        <span aria-hidden="true" className="account-avatar">{initials}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-from">Introducing broker</p>
          <p className="mt-1 truncate text-sm font-semibold text-text-primary" title={profile?.name}>{profile?.name || "IB Account"}</p>
          {profile?.reference ? <p className="mt-1 text-[11px] tabular-nums text-text-muted">IB #{hideSensitive ? maskClientId(profile.reference) : profile.reference}</p> : null}
        </div>
        <button type="button" onClick={() => { setError(null); setConfirming(true); }} disabled={disabled} aria-label="Sign out" title={disabled ? "Finish the draw before signing out" : "Sign out"} className="account-signout">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true"><path d="M15 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2M10 12h11m0 0-4-4m4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      <dialog ref={dialogRef} className="signout-dialog" aria-labelledby="signout-title" aria-describedby="signout-description" onCancel={(event) => { event.preventDefault(); if (!busy) setConfirming(false); }} onClick={(event) => { if (event.target === event.currentTarget && !busy) setConfirming(false); }}>
        <div className="p-6 sm:p-7">
          <h2 id="signout-title" className="font-display text-2xl font-semibold">Sign out of SpinVault?</h2>
          <p id="signout-description" className="mt-3 text-sm leading-relaxed text-text-muted">Your giveaway results are saved. You can sign in again whenever you&apos;re ready.</p>
          {error ? <p role="alert" className="mt-4 text-sm text-red-200">{error}</p> : null}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)} autoFocus>Stay signed in</Button>
            <Button disabled={busy} onClick={signOut}>{busy ? "Signing out…" : "Sign out"}</Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
