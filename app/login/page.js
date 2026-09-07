import { redirect } from "next/navigation";

import LoginForm from "@/components/auth/LoginForm";
import DrawBackground from "@/components/draw/DrawBackground";
import Panel from "@/components/ui/Panel";
import { getSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in — SpinVault",
};

export default async function LoginPage() {
  // A session cookie alone is enough to skip the form; the draw routes still
  // re-verify IB access with ByteFX on every protected request.
  if (await getSession()) redirect("/");

  return (
    <>
      <DrawBackground phase="idle" />
      <main className="draw-page relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-4 py-12">
        <header className="flex flex-col items-center gap-4 text-center">
          <p className="brand-wordmark text-xs font-semibold uppercase tracking-[0.32em] text-text-primary/90">
            SpinVault
          </p>
          <h1 className="font-display text-[34px] font-bold uppercase leading-[1.05] tracking-[-0.04em] text-text-primary sm:text-4xl">
            Partner Draw
          </h1>
          <p className="text-sm text-text-muted">Sign in with your ByteFX IB account to draw a winner.</p>
        </header>

        <Panel className="control-deck p-6 sm:p-7">
          <LoginForm />
        </Panel>
      </main>
    </>
  );
}
