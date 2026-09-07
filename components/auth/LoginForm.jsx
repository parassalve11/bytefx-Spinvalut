"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import bytefxLogo from "@/assets/logo/bytefx.webp";
import Button from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your ByteFX email and password.");
      return;
    }
    setBusy(true);
    try {
      await api.login(email.trim(), password);
      setPassword("");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in right now. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-[11px] font-medium uppercase tracking-[0.16em] text-text-muted">ByteFX email</label>
        <input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="you@example.com" disabled={busy} className="auth-input" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[11px] font-medium uppercase tracking-[0.16em] text-text-muted">Password</label>
        <div className="relative">
          <input id="password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" disabled={busy} className="auth-input password-input" />
          <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} aria-controls="password" disabled={busy} onClick={() => setShowPassword((v) => !v)} className="password-visibility">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
              {showPassword ? <path d="m3 3 18 18" stroke="currentColor" strokeWidth="1.8" /> : null}
            </svg>
          </button>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-text-muted">
        Don&apos;t have an IB account?{" "}
        <a className="partnership-link" href="https://www.bytefx.com/partnership" target="_blank" rel="noopener noreferrer">Become a partner <span aria-hidden="true">↗</span></a>
      </p>

      {error ? <p role="alert" className="rounded-xl border border-red-400/25 bg-red-500/[0.07] px-4 py-3 text-sm text-red-200">{error}</p> : null}

      <Button type="submit" size="lg" disabled={busy} className="bytefx-signin mt-1 w-full">
        <span>{busy ? "Signing in with" : "Sign in with"}</span>
        <Image src={bytefxLogo} alt="ByteFX" width={112} className="h-auto w-28" priority />
      </Button>
      <p className="text-center text-[11px] leading-relaxed text-text-muted">SpinVault is for approved ByteFX Introducing Brokers. You will only ever see clients in your own network.</p>
    </form>
  );
}
