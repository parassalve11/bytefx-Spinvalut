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
    { name: error?.name || "Error", code: error?.code || error?.cause?.code || "UNKNOWN" }
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
    return new URL(value.trim()).origin;
  } catch {
    return "";
  }
}

export function requireSameOrigin(request) {
  const origin = normalizeOrigin(
    request.headers.get("origin")
  );

  const requestOrigin = normalizeOrigin(
    new URL(request.url).origin
  );

  /*
   * APP_ORIGIN may optionally contain multiple
   * comma-separated origins.
   *
   * Example:
   *
   * APP_ORIGIN=https://bytefx-spinvalut.vercel.app,http://localhost:3000
   */
  const configuredOrigins = (
    process.env.APP_ORIGIN || ""
  )
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);

  /*
   * Always include the actual origin Next.js
   * received the request on.
   */
  const allowedOrigins = new Set([
    requestOrigin,
    ...configuredOrigins,
  ]);

  const fetchSite =
    request.headers.get("sec-fetch-site");

  if (
    !origin ||
    !allowedOrigins.has(origin) ||
    fetchSite === "cross-site"
  ) {
    console.warn("Blocked request origin", {
      origin,
      requestOrigin,
      configuredOrigins,
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
      413,
      "REQUEST_TOO_LARGE"
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(
      "Invalid request.",
      400,
      "INVALID_REQUEST"
    );
  }
}
