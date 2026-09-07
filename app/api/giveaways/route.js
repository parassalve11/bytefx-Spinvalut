import { requireIb } from '@/lib/server/session';
import { createGiveaway, listGiveaways, ensureGiveaway, historyFor } from '@/lib/server/draws';
import { failure, json, readBody, requireSameOrigin } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function GET(request) {
  try { const { profile } = await requireIb(); const active = ensureGiveaway(profile.id); const id = new URL(request.url).searchParams.get('id') || active.id; return json({ giveaways: listGiveaways(profile.id), activeId: id, history: historyFor(profile.id, id) }); }
  catch (error) { return failure(error); }
}
export async function POST(request) {
  try { requireSameOrigin(request); const { profile } = await requireIb(); return json(createGiveaway(profile.id, (await readBody(request)).name), 201); }
  catch (error) { return failure(error); }
}
