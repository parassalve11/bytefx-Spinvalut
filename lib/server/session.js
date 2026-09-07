import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { db, encrypt, decrypt, hash } from './store.js';
import { bytefx, normalizeProfile } from './bytefx.js';
import { AppError } from './http.js';

const COOKIE = 'spinvault_session';
const SESSION_MS = 8 * 60 * 60 * 1000;
const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' };

export async function createSession(token, profile) {
  await destroySession();
  const sessionId = randomBytes(32).toString('base64url');
  db().prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  db().prepare('INSERT INTO sessions (id, token, profile, expires) VALUES (?, ?, ?, ?)').run(hash(sessionId), encrypt(token), JSON.stringify(profile), Date.now() + SESSION_MS);
  (await cookies()).set(COOKIE, sessionId, { ...cookieOptions, maxAge: SESSION_MS / 1000 });
}
export async function getSession() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const row = db().prepare('SELECT * FROM sessions WHERE id = ? AND expires > ?').get(hash(value), Date.now());
  if (!row) return null;
  return { sessionId: row.id, token: decrypt(row.token), profile: JSON.parse(row.profile) };
}
export async function requireIb() {
  const session = await getSession();
  if (!session) throw new AppError('Please sign in to continue.', 401, 'UNAUTHENTICATED');
  try {
    const profile = normalizeProfile(await bytefx('userdetails', { token: session.token }));
    if (profile.id !== session.profile.id) throw new AppError('Please sign in again.', 401, 'UNAUTHENTICATED');
    return { ...session, profile };
  } catch (error) {
    if (error.status === 401 || error.status === 403) db().prepare('DELETE FROM sessions WHERE id = ?').run(session.sessionId);
    throw error;
  }
}
export async function destroySession() {
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  if (value) db().prepare('DELETE FROM sessions WHERE id = ?').run(hash(value));
  jar.set(COOKIE, '', { ...cookieOptions, maxAge: 0 });
}
export function rateLimitLogin(email) {
  const key = hash(email.toLowerCase());
  const now = Date.now();
  db().prepare('DELETE FROM login_attempts WHERE reset_at < ?').run(now);
  const attempt = db().prepare('SELECT * FROM login_attempts WHERE key = ?').get(key);
  if (attempt?.attempts >= 8) throw new AppError('Too many login attempts. Please try again in 15 minutes.', 429);
  db().prepare('INSERT INTO login_attempts (key, attempts, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1').run(key, now + 15 * 60 * 1000);
}
export function clearLoginAttempts(email) { db().prepare('DELETE FROM login_attempts WHERE key = ?').run(hash(email.toLowerCase())); }
