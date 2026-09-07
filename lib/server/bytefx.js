import { createHash } from 'node:crypto';
import { AppError } from './http.js';
import { phoneCountry } from './phoneCountry.js';
import { normalizeAccounts, normalizeClientStatus } from '../clientDetails.js';

export async function bytefx(path, { token, form } = {}) {
  const base = new URL(process.env.BYTEFX_API_BASE_URL || 'https://my.bytefx.com/api/');
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new AppError('The API connection must use HTTPS.', 503);
  const url = new URL(path.replace(/^\//, ''), base.href.endsWith('/') ? base : base.href + '/');
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new AppError('Invalid API path.', 400);
  let response;
  try {
    response = await fetch(url, {
      method: form ? 'POST' : 'GET',
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
  } catch { throw new AppError('ByteFX is unavailable. Please try again shortly.', 502, 'UPSTREAM_UNAVAILABLE'); }
  if (response.status === 401) throw new AppError(form ? 'Email or password was not accepted.' : 'Your session has expired. Please sign in again.', 401, 'UNAUTHENTICATED');
  // IB permission is established by /userdetails, not by /login. A 403 on the
  // sign-in itself means the credentials were refused or the account is locked
  // — reporting it as "not an IB" would send the IB to the wrong support desk.
  if (response.status === 403) {
    if (form) throw new AppError('Email or password was not accepted.', 400);
    throw new AppError('This ByteFX account does not have permission to access IB clients.', 403, 'IB_REQUIRED');
  }
  if (response.status === 429) throw new AppError('Too many requests. Please wait a moment and try again.', 429);
  if (!response.ok) throw new AppError(form && response.status < 500 ? 'Email or password was not accepted.' : 'ByteFX could not load the requested data.', form ? 400 : 502);
  let body;
  try { body = await response.json(); } catch { throw new AppError('ByteFX returned an unexpected response.', 502); }
  if (body?.success === false || body?.status === false || body?.status === 0 || body?.status === 'error' || (typeof body?.status === 'number' && body.status >= 400)) throw new AppError(form ? 'Email or password was not accepted.' : 'ByteFX could not load this information.', form ? 400 : 502);
  return body;
}

export function atPath(object, path) {
  return path ? path.split('.').reduce((value, key) => value?.[key], object) : object;
}

function config(name, defaults) {
  try { return { ...defaults, ...JSON.parse(process.env[name] || '{}') }; }
  catch { throw new AppError('The ByteFX field mapping needs configuration.', 503, 'API_MAPPING_REQUIRED'); }
}

export function normalizeProfile(body) {
  const record = process.env.BYTEFX_PROFILE_PATH !== undefined ? atPath(body, process.env.BYTEFX_PROFILE_PATH) : (body.data?.user ?? body.data ?? body.user ?? body);
  const map = config('BYTEFX_PROFILE_FIELDS', { id: 'id', name: 'name', email: 'email', isIb: 'is_ib' });
  const flag = atPath(record, map.isIb);
  const allowed = JSON.parse(process.env.BYTEFX_IB_ALLOWED_VALUES || '[2,"2"]');
  if (!allowed.includes(flag)) {
    if (flag === undefined) throw new AppError('IB access could not be verified. The ByteFX account mapping needs configuration.', 403, 'API_MAPPING_REQUIRED');
    throw new AppError('An approved IB account is required to use SpinVault.', 403, 'IB_REQUIRED');
  }
  if (record.status !== 'Approved') throw new AppError('Your ByteFX account must be approved to use SpinVault.', 403, 'IB_REQUIRED');
  const id = atPath(record, map.id);
  const name = atPath(record, map.name);
  if ((typeof id !== 'string' && typeof id !== 'number') || !String(id) || typeof name !== 'string' || !name.trim()) throw new AppError('The ByteFX profile fields need configuration.', 502, 'API_MAPPING_REQUIRED');
  return { id: String(id), name, email: String(atPath(record, map.email) || '') };
}

export async function authenticate(email, password) {
  const form = new FormData();
  form.set('email', email); form.set('password', password);
  const result = await bytefx('login', { form });
  const token = process.env.BYTEFX_TOKEN_PATH ? atPath(result, process.env.BYTEFX_TOKEN_PATH) : (result.data?.access_token ?? result.data?.token ?? result.access_token ?? result.token);
  if (typeof token !== 'string' || !token) throw new AppError('The ByteFX login response needs configuration.', 502, 'API_MAPPING_REQUIRED');
  const profile = normalizeProfile(await bytefx('userdetails', { token }));
  return { token, profile };
}

function amount(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function normalizeClient(record, level) {
  const map = config('BYTEFX_CLIENT_FIELDS', { id: 'email', name: 'name', clientId: 'mt5id', email: 'email', phone: 'phone', status: 'status', region: 'country', netDeposit: 'net_deposit', lots: 'totallots', isFunded: 'is_funded', currency: 'currency' });
  const get = key => atPath(record, map[key]);
  const id = get('id'); const name = get('name');
  if ((typeof id !== 'number' && typeof id !== 'string') || !String(id) || typeof name !== 'string' || !name.trim()) throw new AppError('Client identity fields need configuration. No partial draw pool has been loaded.', 502, 'API_MAPPING_REQUIRED');
  const funded = get('isFunded');
  const currency = get('currency') || process.env.BYTEFX_DEPOSIT_CURRENCY || null;
  // The existing deposit control is denominated in USD. Unknown or mixed currencies cannot be compared to it.
  const netDeposit = currency === 'USD' ? amount(get('netDeposit')) : null;
  const apiRegion = String(get('region') || '').trim();
  const inferredRegion = phoneCountry(get('phone'));
  return {
    id: createHash('sha256').update(String(id).trim().toLowerCase()).digest('hex'), name: name.trim(), clientId: normalizeAccounts(get('clientId')).join(', '),
    email: String(get('email') || ''), phone: String(get('phone') || ''), status: normalizeClientStatus(get('status')), region: apiRegion || inferredRegion || '', regionSource: apiRegion ? 'api' : inferredRegion ? 'phone' : null, avatar: null,
    netDeposit, lots: amount(get('lots')), isFunded: [true, 1, '1'].includes(funded) ? true : [false, 0, '0'].includes(funded) ? false : null,
    currency, levels: [level],
  };
}

function pageData(body) {
  const value = process.env.BYTEFX_CLIENTS_PATH !== undefined ? atPath(body, process.env.BYTEFX_CLIENTS_PATH) : (Array.isArray(body) ? body : body.data);
  // ByteFX uses JSON status 301 + "No data found." with HTTP 200 for empty levels.
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0 && (body.status === 200 || (body.status === 301 && body.msg === 'No data found.'))) return { rows: [], meta: {} };
  if (Array.isArray(value)) return { rows: value, meta: body.meta ?? body };
  if (Array.isArray(value?.data)) return { rows: value.data, meta: { ...value, ...body.meta } };
  throw new AppError('The ByteFX client-list response needs configuration.', 502, 'API_MAPPING_REQUIRED');
}

export async function loadClients(token, levels) {
  const counts = {}; const combined = new Map();
  for (const level of levels) {
    const rows = []; const seenPages = new Set();
    for (let page = 1; ; page++) {
      if (page > 500) throw new AppError('The client list could not be loaded completely.', 502);
      const body = await bytefx(`myclientslevel${level}?page=${page}`, { token });
      const { rows: batch, meta } = pageData(body);
      const signature = JSON.stringify(batch);
      if (seenPages.has(signature) && batch.length) throw new AppError('ByteFX pagination repeated a page. Please refresh the client list.', 502);
      seenPages.add(signature); rows.push(...batch);
      const current = Number(meta.current_page ?? page);
      const last = meta.last_page == null ? null : Number(meta.last_page);
      if (last !== null && (!Number.isInteger(last) || last < 1 || current !== page)) throw new AppError('Invalid ByteFX pagination.', 502);
      const hasNext = last !== null ? page < last : Boolean(meta.next_page_url ?? body.links?.next);
      if (!hasNext) {
        if (meta.total !== undefined && Number(meta.total) !== rows.length) throw new AppError('The client list is incomplete. Drawing is unavailable until all clients load.', 502);
        break;
      }
    }
    counts[level] = rows.length;
    for (const raw of rows) {
      const client = normalizeClient(raw, level);
      const prior = combined.get(client.id);
      if (!prior) combined.set(client.id, client);
      else {
        // Never sum repeated client rows: doing so would inflate eligibility.
        if (['name', 'netDeposit', 'lots', 'isFunded', 'currency'].some(key => prior[key] !== client[key])) throw new AppError('Duplicate client records contain conflicting values. Please refresh or contact support.', 502);
        if (!prior.levels.includes(level)) prior.levels.push(level);
      }
    }
  }
  return { participants: [...combined.values()], counts };
}
