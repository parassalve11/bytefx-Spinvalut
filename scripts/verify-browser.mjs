/** Browser regression check with a running app and Chrome --remote-debugging-port=9223. No test dependencies. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { participants } from './fixtures/participants.js';
const origin = process.env.DRAW_TEST_URL || 'http://127.0.0.1:3100';
const tabs = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let nextId=0; const pending=new Map(); const errors=[];
ws.addEventListener('message', ({data}) => { const m=JSON.parse(data); if(m.id) { const p=pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); } else if(m.method==='Runtime.exceptionThrown') errors.push(m.params.exceptionDetails); });
const send=(method,params={}) => new Promise((resolve,reject) => { const id=++nextId; pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params})); });
const evaluate=async expression => { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const wait=async expression => { for(let i=0;i<500;i++){ const value=await evaluate(`Boolean(${expression})`);if(value)return value;await new Promise(r=>setTimeout(r,30));}throw Error('Timed out: '+expression); };
await send('Runtime.enable'); await send('Page.enable');
await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__drawSamples=[]; const nativeRandom=crypto.getRandomValues.bind(crypto); crypto.getRandomValues=function(a){const result=nativeRandom(a);window.__drawSamples.push(Array.from(a));return result;};`});
fs.mkdirSync('.review',{recursive:true});
try {
for(const width of [1440,1280,1024,768,390]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:origin});
  await wait(`document.querySelector('.draw-button') && document.querySelector('.arena-image img')?.complete`);
  await new Promise(r=>setTimeout(r,700));
  const layout=await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,deck:document.querySelector('.control-deck').getBoundingClientRect().bottom,reel:document.querySelector('.reel-shell').getBoundingClientRect().top,image:document.querySelector('.arena-image img').naturalWidth})`);
  assert.ok(layout.scroll<=width,JSON.stringify(layout)); assert.ok(layout.deck<layout.reel); assert.ok(layout.image>0);
  if(width===1440 || width===390) { const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync('.review/idle-'+width+'.png',Buffer.from(shot.data,'base64')); }
  const grand=width===1280;
  if(grand) await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Grand Finale').click()`);
  await evaluate(`window.__drawSamples=[];document.querySelector('.draw-button').click();`);
  await wait(`document.querySelector('.draw-stage').dataset.phase==='charging'`);
  const picked=await evaluate(`({samples:window.__drawSamples,disabled:document.querySelector('.eligibility-fields').disabled,button:document.querySelector('.draw-button').disabled})`);
  assert.equal(picked.samples.length,2);assert.ok(picked.disabled && picked.button);
  // Observe real random bytes; selection itself has not been stubbed or replaced.
  const expected=participants[picked.samples[0][0]%participants.length];
  await wait(`document.querySelector('.draw-stage').dataset.phase==='locked'`);
  const landing=await evaluate(`(()=>{const c=document.querySelector('[data-locked="true"]');const r=document.querySelector('.reel-shell').getBoundingClientRect();const b=c.getBoundingClientRect();return {id:c.dataset.participantId,delta:Math.abs((b.left+b.width/2)-(r.left+r.width/2)),modal:!!document.querySelector('[role="dialog"]')};})()`);
  assert.equal(landing.id,expected.id);assert.ok(landing.delta<0.1,JSON.stringify(landing));assert.equal(landing.modal,false);
  await wait(`document.querySelector('[role="dialog"]') && document.querySelector('#winner-name').textContent`);
  assert.equal(await evaluate(`document.querySelector('#winner-name').textContent`),expected.name);
  assert.equal(await evaluate(`document.activeElement.textContent`),'Close');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  assert.equal(await evaluate(`document.activeElement.textContent`),'Draw Another');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});
  assert.equal(await evaluate(`document.activeElement.textContent`),'Close');
  console.log('ok',width,grand?'grand':'quick',expected.name,'center error',landing.delta);
}
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
await send('Page.navigate',{url:origin});await wait(`document.querySelector('.draw-button')`);await new Promise(r=>setTimeout(r,500));
const reducedStart=Date.now();await evaluate(`document.querySelector('.draw-button').click()`);await wait(`document.querySelector('#winner-name')`);assert.ok(Date.now()-reducedStart<1500);console.log('ok reduced motion');
await evaluate(`Array.from(document.querySelectorAll('[role="dialog"] button')).find(b=>b.textContent==='Draw Another').click()`);await wait(`document.querySelector('.draw-stage').dataset.phase==='charging'`);await wait(`document.querySelector('#winner-name')`);console.log('ok draw another');
await evaluate(`Array.from(document.querySelectorAll('[role="dialog"] button')).find(b=>b.textContent==='Close').click()`);await new Promise(r=>setTimeout(r,300));
await evaluate(`document.querySelector('label[for="funded-only"]').click();document.querySelector('label[for="exclude-winners"]').click();document.querySelector('label[for="hide-sensitive"]').click();`);
await new Promise(r=>setTimeout(r,200));
const filtered=participants.filter(p=>p.isFunded&&!p.wonBefore);
assert.ok((await evaluate(`document.querySelector('.control-deck [role="status"]').textContent`)).startsWith(String(filtered.length)));
await evaluate(`window.__drawSamples=[];document.querySelector('.draw-button').click()`);await wait(`document.querySelector('#winner-name')`);
const samples=await evaluate(`window.__drawSamples`);assert.equal(await evaluate(`document.querySelector('#winner-name').textContent`),filtered[samples[0][0]%filtered.length].name);
assert.ok(await evaluate(`document.querySelector('[role="dialog"] dl').textContent.includes('\u2022')`));console.log('ok combined filters and privacy');
await evaluate(`Array.from(document.querySelectorAll('[role="dialog"] button')).find(b=>b.textContent==='Close').click()`);await new Promise(r=>setTimeout(r,300));
await evaluate(`(()=>{const e=document.querySelector('#min-net-deposit');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'5000');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await new Promise(r=>setTimeout(r,300));await evaluate(`document.querySelector('.draw-button').click()`);await wait(`Array.from(document.querySelectorAll('[role="status"]')).some(e=>e.textContent.includes('No eligible'))`);console.log('ok empty pool');
assert.deepEqual(errors,[]);console.log('No browser runtime exceptions.');
} finally {ws.close();}
