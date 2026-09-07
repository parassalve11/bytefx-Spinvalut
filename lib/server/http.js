export class AppError extends Error {
  constructor(
    message,
    status = 400,
    code = "REQUEST_FAILED",
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
      error.status,
    );
  }

  // Never expose credentials or upstream payloads.
  console.error(
    "SpinVault request failed:",
    error?.name || "Error",
  );

  return json(
    {
      error:
        "Unable to complete this request. Please try again.",
      code: "SERVER_ERROR",
    },
    500,
  );
}

export function requireSameOrigin(request) {
  const origin =
    request.headers.get("origin");

  const requestOrigin =
    new URL(request.url).origin;

  const configuredOrigin =
    process.env.APP_ORIGIN?.trim();

  /*
   * LOCAL DEVELOPMENT
   *
   * Always use the actual Next.js origin.
   *
   * This prevents an APP_ORIGIN copied from
   * .env.example from blocking localhost.
   *
   * PRODUCTION
   *
   * APP_ORIGIN remains authoritative.
   */
  const expected =
    process.env.NODE_ENV === "production" &&
    configuredOrigin
      ? configuredOrigin.replace(/\/$/, "")
      : requestOrigin;

  const normalizedOrigin =
    origin?.replace(/\/$/, "");

  if (
    !origin ||
    normalizedOrigin !== expected ||
    request.headers.get(
      "sec-fetch-site",
    ) === "cross-site"
  ) {
    throw new AppError(
      "Please submit this request from SpinVault.",
      403,
    );
  }
}

export async function readBody(request) {
  const text = await request.text();

  if (text.length > 10000) {
    throw new AppError(
      "Request is too large.",
      413,
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(
      "Invalid request.",
    );
  }
}