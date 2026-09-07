import { authenticate } from '@/lib/server/bytefx';
import { createSession, rateLimitLogin, clearLoginAttempts } from '@/lib/server/session';
import { ensureGiveaway } from '@/lib/server/draws';
import { AppError, failure, json, readBody, requireSameOrigin } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function POST(request) {
  try {
    requireSameOrigin(request);
    const { email, password } = await readBody(request);
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254 || typeof password !== 'string' || !password || password.length > 512) throw new AppError('Enter your ByteFX email and password.');
    rateLimitLogin(email.trim());
    const { token, profile } = await authenticate(email.trim(), password);
    await createSession(token, profile);
    ensureGiveaway(profile.id);
    clearLoginAttempts(email.trim());
    return json({ profile: { id: profile.id, name: profile.name } });
  } catch (error) { return failure(error); }
}
