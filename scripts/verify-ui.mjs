/** UI checks against the synthetic ByteFX fixture; requires Chrome on port 9223. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = 'http://localhost:3104';
const tab = await (await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id = 0; const pending = new Map(); const errors = [];
ws.addEventListener('message', ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.id) { const handler = pending.get(msg.id); pending.delete(msg.id); msg.error ? handler.reject(msg.error) : handler.resolve(msg.result); }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const requestId = ++id; pending.set(requestId, { resolve, reject }); ws.send(JSON.stringify({ id: requestId, method, params })); });
const evaluate = async expression => { const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (response.exceptionDetails) throw Error(response.exceptionDetails.text); return response.result.value; };
const wait = async expression => { for (let n = 0; n < 600; n++) { if (await evaluate(`Boolean(${expression})`)) return; await new Promise(resolve => setTimeout(resolve, 40)); } throw Error('Timed out: ' + expression); };
const click = text => evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
const fill = (selector, value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const screenshot = async name => { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(`.review/${name}.png`, Buffer.from(result.data, 'base64')); };
const ready = () => wait(`document.querySelector('.draw-stage') && !document.querySelector('.workspace-loading') && !document.querySelector('.pool-update-status [role]') && !document.querySelector('.draw-button').disabled`);
await send('Runtime.enable'); await send('Page.enable');
await send('Network.deleteCookies', { name: 'spinvault_session', url: base });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `const nativeFetch=window.fetch;window.fetch=async function(...args){const r=await nativeFetch(...args);if(args[0]==='/api/draws'&&args[1]?.method==='POST'&&r.ok)window.__recordedDraw=await r.clone().json();return r;};` });
await fetch('http://127.0.0.1:4112/__test/config', { method: 'POST', body: JSON.stringify({ delay: 180, authDelay: 100, failLevel: null }) });
try {
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: base + '/login' });
  await wait(`document.querySelector('#password')`);
  await new Promise(resolve => setTimeout(resolve, 500));
  await fill('#email', 'ib@example.test'); await fill('#password', 'fixture-password');
  await evaluate(`document.querySelector('[aria-label="Show password"]').click()`);
  assert.equal(await evaluate(`document.querySelector('#password').type`), 'text');
  await evaluate(`document.querySelector('[aria-label="Hide password"]').click()`);
  assert.equal(await evaluate(`document.querySelector('#password').type`), 'password');
  assert.equal(await evaluate(`document.querySelector('.partnership-link').href`), 'https://www.bytefx.com/partnership');
  assert.equal(await evaluate(`document.querySelector('.bytefx-signin img').alt`), 'ByteFX');
  await screenshot('login-desktop');
  await evaluate(`document.querySelector('.bytefx-signin').click()`);
  await wait(`document.querySelector('.workspace-loading')`);
  assert.equal(await evaluate(`!!document.querySelector('.draw-stage') || !!document.querySelector('.workspace-toolbar')`), false);
  await ready();
  assert.equal(await evaluate(`document.querySelector('.level-chip-all').getAttribute('aria-pressed')`), 'true');
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.level-chip:not(.level-chip-all)')).map(b=>b.textContent.slice(6,7))`), ['1', '2', '3']);
  assert.equal(await evaluate(`document.querySelector('#hide-sensitive').checked`), false);
  assert.equal(await evaluate(`!!document.querySelector('#min-net-deposit') || !!document.querySelector('#funded-only')`), false);
  assert.equal(await evaluate(`!!document.querySelector('#exclude-winners')`), false);
  assert.ok(await evaluate(`!document.body.textContent.includes('crypto.getRandomValues')`));
  await evaluate(`window.__stage = document.querySelector('.draw-stage'); window.__fullLoaderReturned = false; new MutationObserver(()=>{if(document.querySelector('.workspace-loading'))window.__fullLoaderReturned=true;}).observe(document.body,{childList:true,subtree:true});`);
  console.log('ok login, password eye, partnership link, loading gate and available levels');

  for (const width of [1440, 1280, 1024, 768, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'overflow at ' + width);
    const toolbar = await evaluate(`(()=>{const a=document.querySelector('.account-card').getBoundingClientRect();const r=document.querySelector('.refresh-clients').getBoundingClientRect();return {a:a.right,r:r.left,ay:a.bottom,ry:r.top};})()`);
    assert.ok(toolbar.a <= toolbar.r || toolbar.ay <= toolbar.ry, 'toolbar overlap at ' + width);
    if (width === 1440 || width === 390) await screenshot('workspace-' + width);
  }
  await evaluate(`document.querySelector('.level-chip:not(.level-chip-all)').click()`);
  await wait(`document.querySelector('.pool-update-status [role="status"]')`);
  assert.equal(await evaluate(`document.querySelector('.draw-stage') === window.__stage && document.querySelector('.draw-button').disabled`), true);
  await ready();
  assert.ok((await evaluate(`document.querySelector('.level-selector').textContent`)).includes('1 client selected'));
  assert.equal(await evaluate(`document.querySelectorAll('.level-chip').length`), 4);
  await click('All clients'); await ready();
  await click('Refresh clients'); await wait(`document.querySelector('.pool-update-status [role="status"]')`); await ready();
  await fetch('http://127.0.0.1:4112/__test/config', { method: 'POST', body: JSON.stringify({ failLevel: 7 }) });
  await click('Refresh clients'); await wait(`document.querySelector('.pool-update-status [role="alert"]')`);
  assert.equal(await evaluate(`document.querySelector('.draw-stage') === window.__stage && document.querySelector('.draw-button').disabled`), true);
  await fetch('http://127.0.0.1:4112/__test/config', { method: 'POST', body: JSON.stringify({ failLevel: null }) });
  await click('Try again'); await ready();
  console.log('ok responsive layout, selecting levels, refresh and failed-load recovery');

  await evaluate(`document.querySelector('.account-signout').click()`);
  await wait(`document.querySelector('.signout-dialog').open`);
  assert.equal(await evaluate(`document.activeElement.textContent`), 'Stay signed in');
  await click('Stay signed in'); assert.equal(await evaluate(`document.querySelector('.signout-dialog').open`), false);
  console.log('ok logout confirmation and cancellation');

  // A supported eligibility filter isolates one synthetic client with two MT5 accounts.
  await fill('#min-lots', '10');
  for (const mode of ['Quick Draw', 'Grand Finale']) {
    if (mode === 'Grand Finale') {
      await evaluate(`document.querySelector('label[for="hide-sensitive"]').click()`); await ready();
      await click(mode);
    }
    await evaluate(`document.querySelector('.draw-button').click()`);
    await wait(`document.querySelector('.draw-stage').dataset.phase==='locked'`);
    const delta = await evaluate(`(()=>{const c=document.querySelector('[data-locked="true"]').getBoundingClientRect();const r=document.querySelector('.reel-shell').getBoundingClientRect();return Math.abs(c.left+c.width/2-r.left-r.width/2);})()`);
    assert.ok(delta < .1);
    await wait(`document.querySelector('#winner-name')`);
    assert.equal(await evaluate(`document.querySelector('#winner-name').textContent`), await evaluate(`window.__recordedDraw.winner.name`));
    assert.equal(await evaluate(`!!document.elementFromPoint(30, 35)?.closest('.workspace-toolbar')`), false, 'modal must cover account toolbar');
    assert.equal(await evaluate(`document.querySelectorAll('.mt5-reference').length`), 2);
    assert.equal(await evaluate(`document.querySelector('.client-status').textContent`), 'Active');
    const winnerText = await evaluate(`document.querySelector('.winner-dialog').textContent`);
    assert.ok(winnerText.includes('India'));
    assert.ok(winnerText.includes('(phone)'), 'country should be inferred from phone even when masked');
    if (mode === 'Grand Finale') assert.ok(!winnerText.includes('9876543210') && !winnerText.includes('100101'));
    else assert.ok(winnerText.includes('+919876543210') && winnerText.includes('100101'));
    await new Promise(resolve => setTimeout(resolve, 1500));
    assert.ok(await evaluate(`document.querySelector('.winner-dialog img[src*="flagcdn"]')?.src.endsWith('.webp')`));
    await screenshot(mode === 'Grand Finale' ? 'winner-mobile-masked' : 'winner-mobile-details');
    await click('Close'); await ready(); await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.log('ok both modes, exact winner landing, trophy, account lists, phone privacy, country and status');

  assert.equal(await evaluate(`window.__fullLoaderReturned`), false, 'full-screen loader must never return for filters, refresh or privacy');
  assert.equal(await evaluate(`document.querySelector('.draw-stage') === window.__stage`), true, 'workspace must remain mounted');
  await evaluate(`document.querySelector('.account-signout').click()`); await wait(`document.querySelector('.signout-dialog').open`); await click('Sign out');
  await wait(`document.querySelector('#password')`);
  assert.deepEqual(errors, []);
  console.log('ok confirmed logout; no runtime exceptions');
} finally { ws.close(); }
