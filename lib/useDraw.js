"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, useMotionValue, useMotionValueEvent } from "framer-motion";

import { api, ApiError } from "./api";
import { applyCriteria, DEFAULT_CRITERIA } from "./eligibility";
import { MODES } from "./modes";
import { maskAccounts, maskPhone, maskEmail } from "./mask";
import { offsetForIndex, indexForOffset, spinTarget } from "./reel";
import { spinKeyframes, spinTimes, spinDuration, SPIN_EASES, DEFAULT_FINAL_STEPS } from "./spinAnimation";

export { MODES, DEFAULT_CRITERIA };

const BUSY_PHASES = new Set(["charging", "launching", "spinning", "slowing", "locked"]);

/** Minimum time the button spends in "Preparing…", so a fast network round trip
 *  cannot make the charge flash past too quickly to read. */
const MIN_CHARGE_MS = 320;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function newRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The draw, end to end.
 *
 * The property that mattered in the foundation build is unchanged: the winner
 * is chosen before the reel moves, and the animation only replays a decision
 * already made. What changed is *where* that decision happens. Selection now
 * runs on the server, against a frozen snapshot of this IB's own clients, and
 * is written to the database before this hook hears about it. The browser
 * cannot influence it, and repeating a request returns the same recorded
 * winner rather than drawing a second time.
 */
export function useDraw({ onSignedOut } = {}) {
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);
  const [levels, setLevels] = useState([1, 2, 3, 4, 5, 6, 7]);
  const [mode, setMode] = useState("quick");
  const [status, setStatus] = useState("idle");

  const [giveaway, setGiveaway] = useState(null);
  const [history, setHistory] = useState([]);

  const [snapshotId, setSnapshotId] = useState(null);
  const [source, setSource] = useState([]);
  const [counts, setCounts] = useState({});
  const [capabilities, setCapabilities] = useState({ deposit: false, lots: false, funded: false });
  const [poolStatus, setPoolStatus] = useState("loading"); // loading | ready | error
  const [poolError, setPoolError] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [winner, setWinner] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [lockedPool, setLockedPool] = useState(null);
  const [notice, setNotice] = useState(null);

  const pool = useMemo(() => applyCriteria(source, criteria), [source, criteria]);
  /** While a draw is in flight the reel shows the exact list the server drew
   *  from, so what lands under the marker cannot disagree with the record. */
  const reelPool = lockedPool ?? pool;

  const x = useMotionValue(offsetForIndex(0));
  const [activeIndex, setActiveIndex] = useState(0);

  const animationRef = useRef(null);
  const busyRef = useRef(false);
  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const requestIdRef = useRef(null);
  const drawIdRef = useRef(null);
  const privacyVersionRef = useRef(0);
  const networkSnapshotRef = useRef(null);
  const updatingRef = useRef(false);
  const activeIndexRef = useRef(0);

  const criteriaRef = useRef(criteria);
  criteriaRef.current = criteria;
  const giveawayRef = useRef(giveaway);
  giveawayRef.current = giveaway;
  const snapshotRef = useRef(snapshotId);
  snapshotRef.current = snapshotId;
  const statusRef = useRef(status);
  statusRef.current = status;

  const say = useCallback((message, tone = "info") => setNotice({ message, tone, at: Date.now() }), []);

  const setActive = useCallback((k) => {
    activeIndexRef.current = k;
    setActiveIndex((prev) => (prev === k ? prev : k));
  }, []);

  useMotionValueEvent(x, "change", (value) => setActive(indexForOffset(value)));

  const stopAnimation = useCallback(() => {
    animationRef.current?.stop();
    animationRef.current = null;
    busyRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      stopAnimation();
      abortRef.current?.abort();
    },
    [stopAnimation],
  );

  /** Every "the session is gone" path funnels through one place. */
  const handleError = useCallback(
    (error) => {
      if (error?.name === "AbortError") return true;
      if (error instanceof ApiError && error.isSignedOut) {
        onSignedOut?.(error.message);
        return true;
      }
      return false;
    },
    [onSignedOut],
  );

  // ------------------------------------------------------------------ pool

  const loadPool = useCallback(
    async (nextLevels, { refresh = false } = {}) => {
      const giveawayId = giveawayRef.current?.id;
      if (!giveawayId) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      updatingRef.current = true;
      setPoolStatus("loading");
      setPoolError(null);
      try {
        const hide = criteriaRef.current.hideSensitive;
        let data;
        if (!refresh && networkSnapshotRef.current) {
          try {
            data = await api.loadPool(giveawayId, nextLevels, hide, controller.signal, networkSnapshotRef.current);
          } catch (error) {
            if (!(error instanceof ApiError) || !error.isPoolExpired) throw error;
          }
        }
        if (!data) {
          const network = await api.loadPool(giveawayId, [1, 2, 3, 4, 5, 6, 7], hide, controller.signal);
          if (controller.signal.aborted) return;
          networkSnapshotRef.current = network.id;
          data = nextLevels.length === 7 ? network : await api.loadPool(giveawayId, nextLevels, hide, controller.signal, network.id);
        }
        if (controller.signal.aborted) return;
        setSnapshotId(data.id);
        snapshotRef.current = data.id;
        setSource(data.participants);
        setCounts(data.counts);
        setCapabilities(data.capabilities);
        setPoolStatus("ready");
        setHasLoaded(true);
      } catch (error) {
        if (controller.signal.aborted || handleError(error)) return;
        setPoolStatus("error");
        setPoolError(error.message);
      } finally {
        if (!controller.signal.aborted) updatingRef.current = false;
      }
    },
    [handleError],
  );

  const refreshClients = useCallback(() => {
    if (busyRef.current || updatingRef.current || statusRef.current !== "idle") return;
    return loadPool(levels, { refresh: true });
  }, [loadPool, levels]);

  const changeLevels = useCallback(
    (nextLevels) => {
      if (statusRef.current !== "idle" || busyRef.current || updatingRef.current) return;
      const cleaned = [...new Set(nextLevels)].filter((n) => Number.isInteger(n) && n >= 1 && n <= 7).sort((a, b) => a - b);
      if (!cleaned.length) {
        say("Select at least one client level.", "error");
        return;
      }
      setLevels(cleaned);
      loadPool(cleaned);
    },
    [loadPool, say],
  );

  // -------------------------------------------------------------- recovery

  const showRecordedDraw = useCallback(
    (recorded, { announce } = {}) => {
      drawIdRef.current = recorded.id;
      setLockedPool(recorded.participants);
      setWinner(recorded.winner);
      setReceipt(recorded.receipt);
      const anchor = recorded.participants.length + recorded.winnerIndex;
      x.set(offsetForIndex(anchor));
      setActive(anchor);
      setStatus("revealed");
      if (announce) say(announce);
    },
    [say, setActive, x],
  );

  // Bootstrap: the giveaway, any draw a closed tab left un-revealed, then clients.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info = await api.giveaways();
        if (cancelled) return;
        const active = info.giveaways.find((g) => g.id === info.activeId) ?? info.giveaways[0] ?? null;
        setGiveaway(active);
        giveawayRef.current = active;
        setHistory(info.history);

        const pending = await api.pendingDraw(criteriaRef.current.hideSensitive);
        if (cancelled) return;
        if (pending.draw) {
          showRecordedDraw(pending.draw, {
            announce: "A draw from your last session was still waiting — this is the recorded winner.",
          });
        }
        await loadPool([1, 2, 3, 4, 5, 6, 7]);
      } catch (error) {
        if (cancelled || handleError(error)) return;
        setPoolStatus("error");
        setPoolError(error.message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Runs once; everything it needs is read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filters ByteFX cannot support must not stay switched on.
  useEffect(() => {
    setCriteria((prev) => {
      const next = { ...prev };
      if (!capabilities.deposit) next.minNetDeposit = 0;
      if (!capabilities.lots) next.minLots = 0;
      if (!capabilities.funded) next.fundedOnly = false;
      const unchanged =
        next.minNetDeposit === prev.minNetDeposit && next.minLots === prev.minLots && next.fundedOnly === prev.fundedOnly;
      return unchanged ? prev : next;
    });
  }, [capabilities]);

  // Changing who can win invalidates whatever is on the reel. Masking is
  // deliberately excluded: it changes how a card reads, not who is in the pool.
  const filterKey = `${criteria.minNetDeposit}|${criteria.minLots}|${criteria.fundedOnly}|${snapshotId}`;
  useEffect(() => {
    if (statusRef.current === "revealed" || statusRef.current === "locked" || busyRef.current) return;
    stopAnimation();
    setStatus("idle");
    setWinner(null);
    setReceipt(null);
    x.set(offsetForIndex(0));
    setActive(0);
  }, [filterKey, stopAnimation, x, setActive]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    for (const p of source) {
      if (!p.avatar) continue;
      const img = new window.Image();
      img.src = p.avatar;
    }
  }, [source]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), notice.tone === "error" ? 5200 : 3400);
    return () => clearTimeout(t);
  }, [notice]);

  // ------------------------------------------------------------------ spin

  const spinTo = useCallback(
    (recorded, config) => {
      const participants = recorded.participants;
      const finalSteps = Number.isInteger(recorded.finalSteps) ? recorded.finalSteps : DEFAULT_FINAL_STEPS;
      const { anchor, target } = spinTarget(
        activeIndexRef.current,
        recorded.winnerIndex,
        participants.length,
        config.minTravel,
      );

      x.set(offsetForIndex(anchor));
      setActive(anchor);

      const reduced = prefersReducedMotion();
      const from = offsetForIndex(anchor);
      const to = offsetForIndex(target);
      let phase = reduced ? "slowing" : "launching";
      setStatus(phase);
      if (reduced) x.set(to);

      animationRef.current = animate(x, reduced ? to : spinKeyframes(from, to, finalSteps), {
        duration: reduced ? 0.12 : spinDuration(config.duration, finalSteps),
        ...(reduced ? { ease: "easeOut" } : { times: spinTimes(finalSteps), ease: SPIN_EASES }),
        onUpdate: (value) => {
          if (reduced) return;
          const progress = (value - from) / (to - from);
          const next = progress < 0.08 ? "launching" : progress < 0.72 ? "spinning" : "slowing";
          if (next !== phase) {
            phase = next;
            setStatus(next);
          }
        },
        onComplete: () => {
          animationRef.current = null;
          x.set(to);
          setActive(target);
          setWinner(recorded.winner);
          setStatus("locked");
          timerRef.current = setTimeout(
            () => {
              timerRef.current = null;
              busyRef.current = false;
              setStatus("revealed");
            },
            reduced ? 150 : 420,
          );
        },
      });
    },
    [x, setActive],
  );

  const draw = useCallback(async () => {
    if (busyRef.current || updatingRef.current) return;
    if (poolStatus !== "ready" || !snapshotRef.current || !giveawayRef.current) {
      say("Your client list is still loading. Give it a moment.", "error");
      return;
    }
    if (!pool.length) {
      say("No eligible clients — relax a filter or add a level, then try again.", "error");
      return;
    }

    stopAnimation();
    busyRef.current = true;
    setWinner(null);
    setStatus("charging");

    requestIdRef.current ??= newRequestId();
    const startedAt = Date.now();

    try {
      const result = await api.draw({
        requestId: requestIdRef.current,
        giveawayId: giveawayRef.current.id,
        snapshotId: snapshotRef.current,
        criteria: criteriaRef.current,
        mode,
      });

      drawIdRef.current = result.id;
      setLockedPool(result.participants);
      setReceipt(result.receipt);

      await sleep(Math.max(0, MIN_CHARGE_MS - (Date.now() - startedAt)));
      if (!busyRef.current) return; // a reset landed while the request was open
      spinTo(result, MODES[mode] ?? MODES.quick);
    } catch (error) {
      busyRef.current = false;
      setStatus("idle");
      if (handleError(error)) return;

      if (error instanceof ApiError && error.isDrawPending) {
        // Another tab, or a previous session, already holds a recorded draw.
        try {
          const pending = await api.pendingDraw(criteriaRef.current.hideSensitive);
          if (pending.draw) {
            showRecordedDraw(pending.draw, { announce: "A draw was already recorded — showing that winner." });
            return;
          }
        } catch {
          /* fall through to the plain message */
        }
      }

      if (error instanceof ApiError && error.isPoolExpired) {
        say(error.message, "error");
        requestIdRef.current = null;
        loadPool(levels);
        return;
      }

      // A network failure keeps the request id, so a retry returns the *same*
      // winner instead of drawing again. Anything else recorded nothing.
      if (!(error instanceof ApiError) || error.code !== "NETWORK") requestIdRef.current = null;
      say(error.message ?? "The draw could not be completed.", "error");
    }
  }, [handleError, levels, loadPool, mode, pool.length, poolStatus, say, showRecordedDraw, spinTo, stopAnimation]);

  /** Acknowledges the recorded draw and returns the page to a drawable state. */
  const finishDraw = useCallback(async () => {
    const id = drawIdRef.current;
    drawIdRef.current = null;
    requestIdRef.current = null;
    stopAnimation();
    setStatus("idle");
    setWinner(null);
    setLockedPool(null);
    x.set(offsetForIndex(0));
    setActive(0);
    if (!id) return;
    try {
      await api.completeDraw(id);
      // Keep recorded history without changing eligibility for later draws.
      const info = await api.giveaways(giveawayRef.current?.id);
      setHistory(info.history);
    } catch (error) {
      handleError(error);
    }
  }, [handleError, setActive, stopAnimation, x]);

  const drawAgain = useCallback(async () => {
    await finishDraw();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      draw();
    }, 220);
  }, [draw, finishDraw]);

  // -------------------------------------------------------------- controls

  const updateCriteria = useCallback((patch) => {
    if (statusRef.current !== "idle" || updatingRef.current) return;
    setCriteria((prev) => ({ ...prev, ...patch }));
  }, []);

  /**
   * Masking is applied server-side when enabled. Turning it off re-reads
   * the stored snapshot; it does not reload the ByteFX client network.
   */
  const setHideSensitive = useCallback(
    async (value) => {
      if (busyRef.current || updatingRef.current || statusRef.current !== "idle") return;
      const version = ++privacyVersionRef.current;
      setCriteria((prev) => ({ ...prev, hideSensitive: value }));
      criteriaRef.current = { ...criteriaRef.current, hideSensitive: value };
      // Redact immediately; a failed response must never leave raw values visible.
      if (value) setSource(items => items.map(p => ({ ...p, clientId: maskAccounts(p.clientId), phone: maskPhone(p.phone), email: maskEmail(p.email) })));
      if (!snapshotRef.current) return;
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      updatingRef.current = true;
      setPoolError(null);
      setPoolStatus("loading");
      try {
        const data = await api.readPool(snapshotRef.current, value, controller.signal);
        if (controller.signal.aborted || version !== privacyVersionRef.current) return;
        setSource(data.participants);
        setCounts(data.counts);
        setCapabilities(data.capabilities);
        setPoolStatus("ready");
      } catch (error) {
        if (version !== privacyVersionRef.current || handleError(error)) return;
        setPoolError(error.message);
        setPoolStatus("error");
      } finally {
        if (!controller.signal.aborted && version === privacyVersionRef.current) updatingRef.current = false;
      }
    },
    [handleError],
  );

  return {
    // pool
    pool: reelPool,
    eligibleCount: pool.length,
    totalCount: source.length,
    poolStatus,
    hasLoaded,
    poolError,
    counts,
    capabilities,
    levels,
    changeLevels,
    refreshClients,
    // giveaway
    giveaway,
    history,
    // draw
    criteria,
    updateCriteria,
    setHideSensitive,
    mode,
    setMode,
    status,
    isSpinning: BUSY_PHASES.has(status),
    controlsLocked: status !== "idle" || poolStatus !== "ready",
    winner,
    receipt,
    notice,
    x,
    activeIndex,
    draw,
    reset: finishDraw,
    drawAgain,
  };
}

export default useDraw;
