import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

// Synthetic clients only. No live credentials or personal records belong here.
export const fixtureClients = [
  { name: 'Alex Morgan', email: 'alex@example.test', phone: '+919876543210', country: null, mt5id: '100101, 100102', totallots: '12.5', status: 'active' },
  { name: 'Jamie Lee', email: 'jamie@example.test', phone: '+447700900123', country: 'GB', mt5id: '200201', totallots: '3.75', status: 'inactive' },
  { name: 'Taylor Chen', email: 'taylor@example.test', phone: '+15550100999', country: null, mt5id: '', totallots: '0' },
];

export async function startBytefxFixture(port = 0) {
  const state = { delay: 0, failLevel: null, repeatPage: false, requests: [] };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    state.requests.push(url.pathname + url.search);
    const reply = (code, value) => { response.writeHead(code, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); };
    if (url.pathname === '/__test/config') {
      let body = ''; for await (const chunk of request) body += chunk;
      Object.assign(state, JSON.parse(body || '{}'));
      return reply(200, { ok: true });
    }
    if (url.pathname === '/api/login') {
      let body = ''; for await (const chunk of request) body += chunk;
      if (!body.includes('fixture-password')) return reply(400, { status: 400, msg: 'Invalid credentials', data: {} });
      const token = body.includes('other@example.test') ? 'fixture-other' : body.includes('nonib@example.test') ? 'fixture-nonib' : 'fixture-ib';
      return reply(200, { status: 200, data: { token } });
    }
    if (state.authDelay) await new Promise(resolve => setTimeout(resolve, state.authDelay));
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!['fixture-ib', 'fixture-other', 'fixture-nonib'].includes(token)) return reply(401, { message: 'Unauthenticated' });
    if (url.pathname === '/api/userdetails') return reply(200, { status: 200, data: { id: token === 'fixture-other' ? 88 : 77, name: 'Demo IB Partner', email: 'ib@example.test', is_ib: token === 'fixture-nonib' ? '0' : '2', status: 'Approved' } });
    const match = url.pathname.match(/myclientslevel([1-7])$/);
    if (!match) return reply(404, {});
    const level = Number(match[1]);
    if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
    if (state.failLevel === level) return reply(503, {});
    if (level === 1) return reply(200, { status: 200, data: [fixtureClients[0]] });
    if (level === 2) {
      const page = Number(url.searchParams.get('page') || 1);
      return reply(200, { status: 200, data: { data: [fixtureClients[state.repeatPage ? 0 : page - 1]], current_page: page, last_page: 2, total: 2 } });
    }
    if (level === 3) return reply(200, { status: 200, data: [fixtureClients[2]] });
    return reply(200, { status: 301, msg: 'No data found.', data: {} });
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return { server, state, base: `http://127.0.0.1:${server.address().port}/api/` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixture = await startBytefxFixture(Number(process.env.FIXTURE_PORT || 4112));
  console.log(`ByteFX fixture ready on ${fixture.base}`);
}
