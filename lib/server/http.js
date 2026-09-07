export class AppError extends Error {
  constructor(message, status = 400, code = 'REQUEST_FAILED') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store, private' } });
}

export function failure(error) {
  if (error instanceof AppError) return json({ error: error.message, code: error.code }, error.status);
  // Upstream payloads and credentials must never be reflected in errors.
  console.error('SpinVault request failed:', error?.name || 'Error');
  return json({ error: 'Unable to complete this request. Please try again.', code: 'SERVER_ERROR' }, 500);
}

export function requireSameOrigin(request) {
  const origin = request.headers.get('origin');
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (!origin || origin !== expected || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new AppError('Please submit this request from SpinVault.', 403);
  }
}

export async function readBody(request) {
  const text = await request.text();
  if (text.length > 10000) throw new AppError('Request is too large.', 413);
  try { return JSON.parse(text); } catch { throw new AppError('Invalid request.'); }
}
