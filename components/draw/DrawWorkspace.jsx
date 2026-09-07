"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";

import AccountCard from "@/components/auth/AccountCard";
import WorkspaceLoading from "@/components/draw/WorkspaceLoading";
import DrawBackground from "@/components/draw/DrawBackground";
import DrawButton from "@/components/draw/DrawButton";
import EligibilityPanel from "@/components/draw/EligibilityPanel";
import ModeTabs from "@/components/draw/ModeTabs";
import SlotReel from "@/components/draw/SlotReel";
import WinnerModal from "@/components/draw/WinnerModal";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import Panel from "@/components/ui/Panel";
import { clsx } from "@/lib/clsx";
import { useDraw } from "@/lib/useDraw";

export default function DrawWorkspace({ profile }) {
  const router = useRouter();

  // A session that has expired, or an account whose IB access was withdrawn
  // mid-session, both land here. There is nothing useful left on the page.
  const onSignedOut = useCallback(() => {
    router.replace("/login");
    router.refresh();
  }, [router]);

  const {
    pool,
    eligibleCount,
    totalCount,
    poolStatus,
    hasLoaded,
    poolError,
    counts,
    capabilities,
    levels,
    changeLevels,
    refreshClients,
    giveaway,
    criteria,
    updateCriteria,
    setHideSensitive,
    mode,
    setMode,
    status,
    isSpinning,
    controlsLocked,
    winner,
    receipt,
    notice,
    x,
    activeIndex,
    draw,
    reset,
    drawAgain,
  } = useDraw({ onSignedOut });

  const emptyMessage = totalCount === 0 ? "No clients found in the selected levels." : undefined;

  return (
    <MotionConfig reducedMotion="user">
      <DrawBackground phase={status} />
      {!hasLoaded ? (
        <WorkspaceLoading error={poolStatus === "error" ? poolError : null} onRetry={() => giveaway && status === "idle" ? refreshClients() : window.location.reload()} />
      ) : (
      <>
      <div className="workspace-toolbar">
        <AccountCard profile={profile} hideSensitive={criteria.hideSensitive} disabled={status !== "idle"} />
        <button type="button" className="refresh-clients" onClick={refreshClients} disabled={status !== "idle" || poolStatus === "loading"} aria-busy={poolStatus === "loading"}>
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M5.6 7a7 7 0 0 1 11.5-2L20 8M4 16l2.9 3A7 7 0 0 0 18.4 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>Refresh clients</span>
        </button>
      </div>

      <main className="draw-page relative mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-14">
        <Header title={giveaway?.name && giveaway.name !== "My giveaway" ? giveaway.name : "Grand Draw"} />

        <Panel className="control-deck">
          <div className="pool-update-status" aria-live="polite" aria-atomic="true">
            {poolStatus === "loading" ? <span role="status" className="inline-flex items-center gap-2"><span className="pool-update-spinner" aria-hidden="true" />Updating clients…</span> : null}
            {poolStatus === "error" ? <div role="alert" className="flex flex-wrap items-center gap-3"><span>{poolError}</span><button type="button" onClick={refreshClients} className="font-semibold text-accent-from underline underline-offset-4">Try again</button></div> : null}
          </div>
          <EligibilityPanel
            criteria={criteria}
            onChange={updateCriteria}
            onHideSensitiveChange={setHideSensitive}
            eligibleCount={eligibleCount}
            totalCount={totalCount}
            capabilities={capabilities}
            levels={levels}
            counts={counts}
            onLevelsChange={changeLevels}
            onRefresh={refreshClients}
            poolStatus={poolStatus}
            poolError={poolError}
            disabled={controlsLocked}
          />
        </Panel>

        <section aria-label="Winner draw" className="draw-stage" data-phase={status}>
          <div className="flex flex-col gap-6">
            <ModeTabs mode={mode} onChange={setMode} disabled={controlsLocked} />

            <SlotReel
              pool={pool}
              x={x}
              activeIndex={activeIndex}
              isSpinning={isSpinning}
              phase={status}
              emptyMessage={emptyMessage}
            />

            {/* Deliberately still clickable when the pool is empty: the draw
                reports why it cannot run rather than going quietly dead. */}
            <DrawButton onClick={draw} isSpinning={isSpinning} phase={status} disabled={poolStatus !== "ready"} />
          </div>
        </section>

        <Footer />



        <Toast notice={notice} />
      </main>
        <WinnerModal
          open={status === "revealed"}
          winner={winner}
          receipt={receipt}
          onClose={reset}
          onDrawAgain={drawAgain}
        />
      </>
      )}
    </MotionConfig>
  );
}

/** Transient messages: an empty pool, an expired list, a recovered draw. */
function Toast({ notice }) {
  return (
    <AnimatePresence>
      {notice ? (
        <motion.div
          key={notice.at}
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className={clsx(
            "fixed inset-x-4 bottom-6 z-40 mx-auto max-w-sm rounded-full border px-5 py-3 text-center text-sm shadow-glow-soft backdrop-blur",
            notice.tone === "error"
              ? "border-red-400/30 bg-red-950/85 text-red-100"
              : "border-accent-from/25 bg-bg-panel/95 text-text-primary",
          )}
        >
          {notice.message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
