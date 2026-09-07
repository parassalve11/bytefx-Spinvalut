import { requireIb } from '@/lib/server/session';
import { selectWinner, pendingDraw } from '@/lib/server/draws';
import { failure, json, readBody, requireSameOrigin } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function POST(request) {
  try { requireSameOrigin(request); const { profile } = await requireIb(); return json(await selectWinner(profile.id, await readBody(request))); }
  catch (error) { return failure(error); }
}
export async function GET(request) {
  try { const { profile } = await requireIb(); return json({ draw: await pendingDraw(profile.id, new URL(request.url).searchParams.get('hideSensitive') === 'true') }); }
  catch (error) { return failure(error); }
}
