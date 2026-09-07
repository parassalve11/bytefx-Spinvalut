import fs from 'node:fs';
import assert from 'node:assert/strict';
import { normalizeClient } from '../lib/server/bytefx.js';
import { normalizeAccounts } from '../lib/clientDetails.js';
import { maskPhone, maskAccounts } from '../lib/mask.js';
const text = fs.readFileSync(process.argv[2], 'utf8');
const objects = [];
for (let i = 0; i < text.length; i++) {
  if (text[i] !== '{') continue;
  let depth = 0, quoted = false, escaped = false;
  for (let j = i; j < text.length; j++) {
    const c = text[j];
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; }
    else if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) { try { objects.push(JSON.parse(text.slice(i, j + 1))); } catch {} i = j; break; }
  }
}
const responses = objects.filter(body => body.msg !== 'Login Successful.');
assert.equal(responses.length, 7);
const clients = [];
for (const [index, response] of responses.entries()) {
  assert.ok(response.status === 200 || (response.status === 301 && response.msg === 'No data found.'));
  const rows = Array.isArray(response.data) ? response.data : [];
  for (const row of rows) {
    const client = normalizeClient(row, index + 1);
    assert.ok(client.id && client.name);
    assert.notEqual(client.lots, null);
    assert.equal(client.status, null);
    assert.ok(normalizeAccounts(client.clientId).every(id => /^\d+$/.test(id)));
    if (client.phone) assert.notEqual(maskPhone(client.phone), client.phone);
    if (client.clientId) assert.notEqual(maskAccounts(client.clientId), client.clientId);
    clients.push(client);
  }
  console.log(`ok provided level ${index + 1}: ${rows.length} records parsed`);
}
assert.equal(new Set(clients.map(p => p.id)).size, 139);
console.log('ok 139 distinct client identities; all lots, MT5 references and phone masks validated without logging personal data');

console.log(JSON.stringify({ countryFromPhone: clients.filter(p => p.regionSource === "phone").length, countryUnavailable: clients.filter(p => !p.region).length }));
