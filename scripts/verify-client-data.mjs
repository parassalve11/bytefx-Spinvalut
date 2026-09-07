import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { startBytefxFixture, fixtureClients } from './fixtures/bytefx-server.mjs';
import { normalizeClient } from '../lib/server/bytefx.js';
import { createPool, getPool, ensureGiveaway, selectWinner, completeDraw } from '../lib/server/draws.js';
import { normalizeAccounts, normalizeClientStatus, countryDetails } from '../lib/clientDetails.js';
import { phoneCountry } from '../lib/server/phoneCountry.js';
import { maskAccounts, maskPhone } from '../lib/mask.js';

mkdirSync('.review', { recursive: true });
process.env.SPINVAULT_DATA_DIR = mkdtempSync(resolve('.review/client-test-'));
process.env.SPINVAULT_SESSION_SECRET = 'synthetic-client-test-secret-not-for-production';
const fixture = await startBytefxFixture();
process.env.BYTEFX_API_BASE_URL = fixture.base;
try {
  assert.deepEqual(normalizeAccounts('100101, 100102;100101'), ['100101', '100102']);
  assert.equal(maskAccounts('100101, 100102'), '1••••1, 1••••2');
  assert.equal(maskPhone('+919876543210'), '+••••••••••10');
  assert.equal(normalizeClient(fixtureClients[0], 1).phone, fixtureClients[0].phone);
  assert.equal(normalizeClientStatus('active'), 'active');
  assert.equal(normalizeClientStatus('inactive'), 'inactive');
  assert.equal(normalizeClientStatus(undefined), null);
  assert.equal(normalizeClientStatus('Approved'), null);
  assert.equal(countryDetails('India').code, 'IN');
  assert.equal(countryDetails('GB').name, 'United Kingdom');
  assert.equal(countryDetails(null), null);
  for (const [phone, country] of [['+919876543210','IN'], ['00919876543210','IN'], ['919876543210','IN'], ['+1 416 555 0123','CA'], ['+1 202 555 0123','US'], ['9876543210',null], ['+80012345678',null], ['+999123456789',null], ['+••••10',null], ['invalid',null]]) assert.equal(phoneCountry(phone), country, phone);
  console.log('ok account lists, masked phones, explicit status and country flags');

  const session = { token: 'fixture-ib', profile: { id: 'test-ib' } };
  const giveaway = ensureGiveaway(session.profile.id);
  const pool = await createPool(session, { giveawayId: giveaway.id, levels: [1, 2, 3, 4, 5, 6, 7] });
  assert.deepEqual(pool.availableLevels, [1, 2, 3]);
  assert.deepEqual(pool.counts, { 1: 1, 2: 2, 3: 1, 4: 0, 5: 0, 6: 0, 7: 0 });
  assert.equal(pool.participants.length, 3);
  assert.equal(pool.participants[0].phone, fixtureClients[0].phone);
  const masked = getPool(session.profile.id, pool.id, true);
  for (const client of masked.participants) assert.ok(client.phone.includes('•'));
  assert.equal(masked.participants[0].region, 'IN');
  assert.equal(masked.participants[0].regionSource, 'phone');
  const unmasked = getPool(session.profile.id, pool.id, false);
  assert.equal(unmasked.participants[0].clientId, '100101, 100102');
  assert.equal(unmasked.participants[0].phone, fixtureClients[0].phone);
  const requestCount = fixture.state.requests.length;
  const subset = await createPool(session, { giveawayId: giveaway.id, levels: [1], sourceSnapshotId: pool.id });
  assert.equal(fixture.state.requests.length, requestCount, 'level selection must not refetch ByteFX clients');
  assert.equal(subset.created, pool.created, 'switching levels cannot extend snapshot lifetime');
  await assert.rejects(createPool(session, { giveawayId: giveaway.id, levels: [2], sourceSnapshotId: subset.id }), /refresh/);
  const anotherSession = { ...session, profile: { id: 'another-ib' } };
  const anotherGiveaway = ensureGiveaway('another-ib');
  await assert.rejects(createPool(anotherSession, { giveawayId: anotherGiveaway.id, levels: [1], sourceSnapshotId: pool.id }), /refresh/);
  assert.equal(subset.participants.length, 1);
  assert.deepEqual(subset.availableLevels, [1, 2, 3]);
  assert.throws(() => getPool('another-ib', pool.id), /refresh/);
  console.log('ok complete network counts, subset selection, deduplication and IB isolation');

  const input = { requestId: randomUUID(), giveawayId: giveaway.id, snapshotId: pool.id, mode: 'quick', criteria: { hideSensitive: true } };
  const draw = selectWinner(session.profile.id, input);
  assert.ok(draw.winner.phone.includes('•'));
  assert.equal(selectWinner(session.profile.id, input).winner.id, draw.winner.id);
  assert.equal(draw.participants[draw.winnerIndex].id, draw.winner.id);
  completeDraw(session.profile.id, draw.id);
  const repeat = selectWinner(session.profile.id, { ...input, requestId: randomUUID(), snapshotId: subset.id, criteria: { hideSensitive: false, excludePreviousWinners: true } });
  completeDraw(session.profile.id, repeat.id);
  const again = selectWinner(session.profile.id, { ...input, requestId: randomUUID(), snapshotId: subset.id });
  assert.equal(again.winner.id, repeat.winner.id, 'previous winner stays eligible even with legacy exclusion input');
  completeDraw(session.profile.id, again.id);
  const realNow = Date.now;
  Date.now = () => pool.created + 16 * 60 * 1000;
  try { await assert.rejects(createPool(session, { giveawayId: giveaway.id, levels: [1], sourceSnapshotId: pool.id }), /refresh/); }
  finally { Date.now = realNow; }
  console.log('ok draw/retry privacy, repeat-winner eligibility and snapshot expiration');

  fixture.state.failLevel = 7;
  await assert.rejects(createPool(session, { giveawayId: giveaway.id, levels: [1] }), /could not load/);
  fixture.state.failLevel = null;
  fixture.state.repeatPage = true;
  await assert.rejects(createPool(session, { giveawayId: giveaway.id, levels: [1, 2] }), /repeated a page/);
  console.log('ok failed levels and repeated pages never produce a partial pool');
} finally { await new Promise(resolve => fixture.server.close(resolve)); }
