export class AppError extends Error {
  constructor(
    message,
    status = 400,
    code = "REQUEST_FAILED"
  ) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
    },
  });
}

export function failure(error) {
  if (error instanceof AppError) {
    return json(
      {
        error: error.message,
        code: error.code,
      },
      error.status
    );
  }

  console.error(
    "SpinVault request failed:",
    error?.name || "Error"
  );

  return json(
    {
      error:
        "Unable to complete this request. Please try again.",
      code: "SERVER_ERROR",
    },
    500
  );
}

function normalizeOrigin(value) {
  if (!value) return "";

  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, "");
  }
}

export function requireSameOrigin(request) {
  const origin = normalizeOrigin(
    request.headers.get("origin")
  );

  const requestOrigin = normalizeOrigin(
    new URL(request.url).origin
  );

  const configuredOrigin = normalizeOrigin(
    process.env.APP_ORIGIN
  );

  /*
   * Allow:
   *
   * 1. The origin Next.js actually received the request on.
   * 2. The explicitly configured production origin.
   *
   * This supports:
   * - localhost
   * - Vercel production domains
   * - custom domains
   *
   * while still rejecting cross-site browser requests.
   */
  const allowedOrigins = new Set(
    [requestOrigin, configuredOrigin].filter(Boolean)
  );

  const fetchSite =
    request.headers.get("sec-fetch-site");

  if (
    !origin ||
    !allowedOrigins.has(origin) ||
    fetchSite === "cross-site"
  ) {
    console.warn("Blocked origin:", {
      origin,
      requestOrigin,
      configuredOrigin,
      fetchSite,
    });

    throw new AppError(
      "Please submit this request from SpinVault.",
      403,
      "INVALID_ORIGIN"
    );
  }
}

export async function readBody(request) {
  const text = await request.text();

  if (text.length > 10000) {
    throw new AppError(
      "Request is too large.",
      413
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(
      "Invalid request."
    );
  }
}