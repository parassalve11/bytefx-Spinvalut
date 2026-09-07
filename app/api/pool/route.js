import { requireIb } from '@/lib/server/session';
import { createPool, getPool } from '@/lib/server/draws';
import { failure, json, readBody, requireSameOrigin } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function POST(request) {
  try { requireSameOrigin(request); const session = await requireIb(); return json(await createPool(session, await readBody(request))); }
  catch (error) { return failure(error); }
}
export async function GET(request) {
  try { const session = await requireIb(); const query = new URL(request.url).searchParams; return json(getPool(session.profile.id, query.get('id'), query.get('hideSensitive') === 'true')); }
  catch (error) { return failure(error); }
}
