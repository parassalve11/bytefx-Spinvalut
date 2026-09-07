"use client";

/**
 * Thin wrapper around the app's own `/api/*` routes.
 *
 * The browser never talks to ByteFX directly — the ByteFX token stays on the
 * server, behind an HttpOnly session cookie. Everything here is same-origin.
 */

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
  /** The session is gone: the page has to send the IB back to sign in. */
  get isSignedOut() {
    return this.status === 401 || this.code === "UNAUTHENTICATED" || this.code === "IB_REQUIRED";
  }
  /** The cached client list is stale and has to be reloaded before drawing. */
  get isPoolExpired() {
    return this.code === "POOL_EXPIRED";
  }
  get isDrawPending() {
    return this.code === "DRAW_PENDING";
  }
}

async function request(path, { method = "GET", body, signal } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("Can't reach SpinVault. Check your connection and try again.", 0, "NETWORK");
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.error || "Something went wrong. Please try again.",
      response.status,
      payload?.code || "REQUEST_FAILED",
    );
  }
  return payload;
}

export const api = {
  login: (email, password) => request("/api/auth/login", { method: "POST", body: { email, password } }),
  logout: () => request("/api/auth/logout", { method: "POST", body: {} }),
  session: (signal) => request("/api/auth/session", { signal }),

  giveaways: (id, signal) =>
    request(`/api/giveaways${id ? `?id=${encodeURIComponent(id)}` : ""}`, { signal }),
  createGiveaway: (name) => request("/api/giveaways", { method: "POST", body: { name } }),

  /** Reloads the client levels from ByteFX and stores a fresh snapshot. */
  loadPool: (giveawayId, levels, hideSensitive, signal, sourceSnapshotId) =>
    request("/api/pool", { method: "POST", body: { giveawayId, levels, hideSensitive, sourceSnapshotId }, signal }),
  /** Re-reads an existing snapshot — no ByteFX call, used when masking changes. */
  readPool: (id, hideSensitive, signal) =>
    request(`/api/pool?id=${encodeURIComponent(id)}&hideSensitive=${hideSensitive ? "true" : "false"}`, { signal }),

  /**
   * Selects the winner. Server-side, recorded before the reel moves. Repeating
   * the call with the same `requestId` returns the same recorded winner rather
   * than drawing again, so a retry after a dropped connection is safe.
   */
  draw: (body) => request("/api/draws", { method: "POST", body }),
  pendingDraw: (hideSensitive, signal) =>
    request(`/api/draws?hideSensitive=${hideSensitive ? "true" : "false"}`, { signal }),
  completeDraw: (id) => request("/api/draws/complete", { method: "POST", body: { id } }),
};

export default api;
