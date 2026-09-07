import { randomUUID } from 'node:crypto';
import { db, encrypt, decrypt, hash, transaction } from './store.js';
import { AppError } from './http.js';
import { phoneCountry } from './phoneCountry.js';
import { loadClients } from './bytefx.js';
import { applyCriteria, parseCriteria } from '../eligibility.js';
import { fairPick, drawSeedLabel } from '../random.js';
import { maskAccounts, maskPhone, maskEmail } from '../mask.js';

function readPayload(row) { return JSON.parse(decrypt(row.payload)); }
function presentClient(client, hide) {
  if (!client.region) {
    const region = phoneCountry(client.phone);
    if (region) client = { ...client, region, regionSource: "phone" };
  }
  return hide ? { ...client, clientId: maskAccounts(client.clientId), email: maskEmail(client.email), phone: maskPhone(client.phone) } : client;
}
export function presentDraw(draw, hide = false) {
  return { ...draw, participants: draw.participants.map(p => presentClient(p, hide)), winner: presentClient(draw.winner, hide) };
}
export function listGiveaways(ibId) {
  return db().prepare('SELECT id, name, created FROM giveaways WHERE ib_id = ? ORDER BY created DESC').all(ibId);
}
export function ensureGiveaway(ibId) {
  return transaction(connection => {
    const existing = connection.prepare('SELECT id, name, created FROM giveaways WHERE ib_id = ? ORDER BY created DESC LIMIT 1').get(ibId);
    if (existing) return existing;
    const giveaway = { id: randomUUID(), name: 'My giveaway', created: Date.now() };
    connection.prepare('INSERT INTO giveaways VALUES (?, ?, ?, ?)').run(giveaway.id, ibId, giveaway.name, giveaway.created);
    return giveaway;
  });
}
function ownedGiveaway(ibId, giveawayId) {
  const giveaway = db().prepare('SELECT * FROM giveaways WHERE id = ? AND ib_id = ?').get(giveawayId, ibId);
  if (!giveaway) throw new AppError('Giveaway not found.', 404);
  return giveaway;
}
export function createGiveaway(ibId, name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) throw new AppError('Enter a giveaway name of 1 to 80 characters.');
  return transaction(connection => {
    if (connection.prepare('SELECT id FROM draws WHERE ib_id = ? AND completed = 0').get(ibId)) throw new AppError('Reveal your pending draw before starting another giveaway.', 409, 'DRAW_PENDING');
    const giveaway = { id: randomUUID(), name: name.trim(), created: Date.now() };
    connection.prepare('INSERT INTO giveaways VALUES (?, ?, ?, ?)').run(giveaway.id, ibId, giveaway.name, giveaway.created);
    return giveaway;
  });
}
export function parseLevels(value) {
  if (!Array.isArray(value) || !value.length || value.length > 7 || value.some(v => !Number.isInteger(v) || v < 1 || v > 7)) throw new AppError('Select at least one client level from 1 to 7.');
  return [...new Set(value)].sort((a, b) => a - b);
}
function capabilities(participants) {
  const complete = key => participants.length > 0 && participants.every(p => p[key] !== null);
  return { deposit: complete('netDeposit'), lots: complete('lots'), funded: complete('isFunded') };
}
export async function createPool(session, body) {
  ownedGiveaway(session.profile.id, body.giveawayId);
  const levels = parseLevels(body.levels);
  // Discover all levels before exposing the selector; never save a partial pool.
  let network;
  if (body.sourceSnapshotId) {
    if (typeof body.sourceSnapshotId !== "string") throw new AppError("Invalid client snapshot.");
    network = snapshotFor(session.profile.id, body.sourceSnapshotId);
    if (network.giveawayId !== body.giveawayId || !network.isFullNetwork) throw new AppError('Please refresh your client list.', 409, 'POOL_EXPIRED');
    if (Date.now() - network.created > 15 * 60 * 1000) throw new AppError('Please refresh your client list.', 409, 'POOL_EXPIRED');
  } else {
    network = await loadClients(session.token, [1, 2, 3, 4, 5, 6, 7]);
  }
  const loaded = {
    counts: network.counts,
    participants: network.participants.filter(p => p.levels.some(level => levels.includes(level))),
    availableLevels: Object.keys(network.counts).map(Number).filter(level => network.counts[level] > 0),
  };
  const snapshot = { id: randomUUID(), giveawayId: body.giveawayId, ...loaded, levels: levels.filter(level => network.counts[level] > 0), created: network.created ?? Date.now(), isFullNetwork: levels.length === 7 };
  db().prepare('DELETE FROM snapshots WHERE created < ?').run(Date.now() - 24 * 60 * 60 * 1000);
  db().prepare('INSERT INTO snapshots VALUES (?, ?, ?, ?, ?)').run(snapshot.id, session.profile.id, body.giveawayId, encrypt(JSON.stringify(snapshot)), snapshot.created);
  return getPool(session.profile.id, snapshot.id, body.hideSensitive === true);
}
function snapshotFor(ibId, id) {
  const row = db().prepare('SELECT * FROM snapshots WHERE id = ? AND ib_id = ?').get(id, ibId);
  if (!row) throw new AppError('Please refresh your client list.', 409, 'POOL_EXPIRED');
  return readPayload(row);
}
export function getPool(ibId, id, hide = false) {
  const snapshot = snapshotFor(ibId, id);
  const participants = snapshot.participants;
  return { ...snapshot, participants: participants.map(p => presentClient(p, hide)), capabilities: capabilities(participants), expires: snapshot.created + 15 * 60 * 1000 };
}
export function historyFor(ibId, giveawayId) {
  ownedGiveaway(ibId, giveawayId);
  return db().prepare('SELECT id, payload, created FROM draws WHERE ib_id = ? AND giveaway_id = ? ORDER BY created DESC LIMIT 30').all(ibId, giveawayId).map(row => {
    const draw = readPayload(row);
    return { id: row.id, winnerName: draw.winner.name, at: draw.receipt.at, poolSize: draw.receipt.poolSize };
  });
}
export function pendingDraw(ibId, hide = false) {
  const row = db().prepare('SELECT payload FROM draws WHERE ib_id = ? AND completed = 0').get(ibId);
  return row ? presentDraw(readPayload(row), hide) : null;
}
export function selectWinner(ibId, body) {
  if (typeof body.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.requestId)) throw new AppError('Invalid draw request ID.');
  let criteria;
  try { criteria = parseCriteria(body.criteria); } catch (error) { throw new AppError(error.message); }
  if (!['quick', 'grand'].includes(body.mode)) throw new AppError('Choose a valid draw mode.');
  const fingerprint = hash(JSON.stringify({ snapshotId: body.snapshotId, giveawayId: body.giveawayId, criteria, mode: body.mode }));
  return transaction(connection => {
    const previous = connection.prepare('SELECT * FROM draws WHERE ib_id = ? AND request_id = ?').get(ibId, body.requestId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new AppError('This draw request was already used with different settings.', 409);
      return presentDraw(readPayload(previous), criteria.hideSensitive);
    }
    const pending = connection.prepare('SELECT id FROM draws WHERE ib_id = ? AND completed = 0').get(ibId);
    if (pending) throw new AppError('A draw is already waiting to be revealed. Recover it before drawing again.', 409, 'DRAW_PENDING');
    ownedGiveaway(ibId, body.giveawayId);
    const snapshot = snapshotFor(ibId, body.snapshotId);
    if (snapshot.giveawayId !== body.giveawayId) throw new AppError('Please reload this giveaway’s clients.', 409);
    if (Date.now() - snapshot.created > 15 * 60 * 1000) throw new AppError('Your client list has expired. Refresh clients before drawing.', 409, 'POOL_EXPIRED');
    const source = snapshot.participants;
    const available = capabilities(source);
    if ((criteria.minNetDeposit > 0 && !available.deposit) || (criteria.minLots > 0 && !available.lots) || (criteria.fundedOnly && !available.funded)) throw new AppError('The selected filter needs data ByteFX has not supplied.', 422);
    const participants = applyCriteria(source, criteria);
    if (!participants.length) throw new AppError('No eligible clients. Adjust the levels or filters and try again.', 422);
    // The original rejection-sampling algorithm runs before any animation.
    const winnerIndex = fairPick(participants.length);
    const id = randomUUID();
    const draw = {
      id, giveawayId: body.giveawayId, snapshotId: snapshot.id, mode: body.mode, criteria,
      participants, winnerIndex, winner: participants[winnerIndex], finalSteps: fairPick(8) + 1,
      receipt: { id, seed: drawSeedLabel(), at: new Date().toISOString(), poolSize: participants.length, levels: snapshot.levels },
    };
    connection.prepare('INSERT INTO draws (id, ib_id, giveaway_id, request_id, fingerprint, payload, created) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, ibId, body.giveawayId, body.requestId, fingerprint, encrypt(JSON.stringify(draw)), Date.now());
    return presentDraw(draw, criteria.hideSensitive);
  });
}
export function completeDraw(ibId, id) {
  const row = db().prepare('SELECT id FROM draws WHERE id = ? AND ib_id = ?').get(id, ibId);
  if (!row) throw new AppError('Draw not found.', 404);
  db().prepare('UPDATE draws SET completed = 1 WHERE id = ? AND ib_id = ?').run(id, ibId);
}
