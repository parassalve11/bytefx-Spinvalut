import { requireIb } from '@/lib/server/session';
import { completeDraw } from '@/lib/server/draws';
import { failure, json, readBody, requireSameOrigin } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function POST(request) {
  try { requireSameOrigin(request); const { profile } = await requireIb(); completeDraw(profile.id, (await readBody(request)).id); return json({ ok: true }); }
  catch (error) { return failure(error); }
}
