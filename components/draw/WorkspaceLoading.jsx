"use client";

import Image from "next/image";
import logo from "@/assets/logo/bytefx.webp";
import Button from "@/components/ui/Button";

export default function WorkspaceLoading({ error, onRetry }) {
  return (
    <main
      className="draw-page flex min-h-screen items-center justify-center"
      aria-busy={!error}
    >
      <div className="flex w-full max-w-sm flex-col items-center px-6 text-center">
        {/* <Image
          src={logo}
          alt="ByteFX"
          width={132}
          priority
          className="h-auto w-[116px]"
        /> */}

        {error ? (
          <>
            <h1 className="mt-8 font-display text-xl font-semibold text-text-primary">
              Couldn&apos;t open the draw
            </h1>

            <p
              role="alert"
              className="mt-2 text-sm leading-relaxed text-text-muted"
            >
              {error}
            </p>

            <Button onClick={onRetry} className="mt-6">
              Try again
            </Button>
          </>
        ) : (
          <>
            <span
              className="mt-8 h-6 w-6 animate-spin rounded-full border-2 border-border border-t-text-primary"
              aria-hidden="true"
            />

            <h1 className="mt-5 font-display text-xl font-semibold text-text-primary">
              Getting your draw ready
            </h1>

            <p
              role="status"
              aria-live="polite"
              className="mt-2 text-sm text-text-muted"
            >
              Loading your clients...
            </p>
          </>
        )}
      </div>
    </main>
  );
}