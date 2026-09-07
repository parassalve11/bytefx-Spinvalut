import { destroySession } from '@/lib/server/session';
import { failure, json, requireSameOrigin } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function POST(request) {
  try { requireSameOrigin(request); await destroySession(); return json({ ok: true }); }
  catch (error) { return failure(error); }
}
