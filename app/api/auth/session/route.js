import { requireIb } from '@/lib/server/session';
import { failure, json } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function GET() {
  try { const { profile } = await requireIb(); return json({ profile: { id: profile.id, name: profile.name } }); }
  catch (error) { return failure(error); }
}
