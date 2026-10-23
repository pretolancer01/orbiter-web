import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;probe.close();await once(probe,'close');
const dir=await mkdtemp(join(tmpdir(),'orbiter-rtc-'));
const child=spawn(process.execPath,[resolve('dist/server.cjs')],{env:{...process.env,ORBITER_WEB:'1',PORT:String(port),ORBITER_DATA_DIR:dir,DATABASE_URL:'',GOOGLE_CLIENT_ID:''},stdio:['ignore','pipe','pipe']});
const relayOnly=process.env.ORBITER_TEST_RELAY==='1';
const liveIce=relayOnly?await (await fetch('https://orbiter-web.onrender.com/ice-config')).json():null;
let browser;
try{
  await Promise.race([once(child.stdout,'data'),new Promise((_,reject)=>setTimeout(()=>reject(Error('server timeout')),10000))]);
  browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required','--no-sandbox']});
  const pages=[];
  for(let n=0;n<2;n++){
    const context=await browser.newContext({permissions:['microphone','camera']});
    if(liveIce)await context.route(`http://127.0.0.1:${port}/ice-config`,route=>route.fulfill({json:liveIce}));
    await context.addInitScript(relay=>{const Base=window.RTCPeerConnection;window.__pcs=[];window.RTCPeerConnection=class extends Base{constructor(config){super(relay?{...config,iceTransportPolicy:'relay'}:config);window.__pcs.push(this)}}},relayOnly);
    const page=await context.newPage();page.on('console',msg=>{if(msg.type()==='error')console.log(`page${n} console`,msg.text())});page.on('pageerror',e=>console.log(`page${n} error`,e.message));
    await page.goto(`http://127.0.0.1:${port}/`);pages.push(page);
    await page.locator('#auth-switch').click();
    await page.locator('#display-input').fill(`Teste ${n}`);
    await page.locator('#username-input').fill(`teste${n}`);
    await page.locator('#email-input').fill(`teste${n}@example.test`);
    await page.locator('#password-input').fill('teste12345');
    await page.locator('#auth-submit').click();
    await page.locator('#app').waitFor({state:'visible'});
  }
  await pages[0].locator('#create-server-btn').click();
  await pages[0].locator('#action-confirm').click();
  await pages[0].locator('#action-fields input').first().fill('Sala de teste');
  await pages[0].locator('#action-confirm').click();
  await pages[0].waitForTimeout(1000);
  console.log('create status',await pages[0].evaluate(()=>({error:document.querySelector('#action-error')?.textContent,community:document.querySelector('#community-title')?.textContent,modal:!document.querySelector('#action-modal')?.classList.contains('hidden')})));
  await pages[0].locator('#community-menu').click();
  await pages[0].locator('#action-confirm').click();
  const invite=await pages[0].locator('#action-fields input').first().inputValue();
  await pages[0].locator('#action-cancel').click();
  await pages[1].locator('#create-server-btn').click();
  await pages[1].locator('#action-fields select').selectOption('join');
  await pages[1].locator('#action-confirm').click();
  await pages[1].locator('#action-fields input').first().fill(invite);
  await pages[1].locator('#action-confirm').click();
  for(const p of pages){await p.setViewportSize({width:1366,height:768});await p.locator('#voice-channels .channel').first().click();await p.locator('#mic-btn').click()}
  assert.equal(await pages[0].locator('.conversation').isVisible(),false);
  assert.equal(await pages[0].locator('#call-stage').isVisible(),true);
  await pages[0].locator('#chat-toggle').click();
  assert.equal(await pages[0].locator('.conversation').isVisible(),true);
  const layout=await pages[0].evaluate(()=>({pageScroll:document.documentElement.scrollHeight>innerHeight,stage:document.querySelector('#call-stage').getBoundingClientRect().width,controls:document.querySelector('#mic-btn').getBoundingClientRect().bottom}));
  assert.equal(layout.pageScroll,false);
  assert.ok(layout.stage>250);
  assert.ok(layout.controls<768);
  await pages[0].locator('#chat-toggle').click();
  await pages[0].locator('#voice-channels .channel-chat').first().click();
  assert.equal(await pages[0].locator('.conversation').isVisible(),true);
  await pages[0].locator('#voice-channels .channel-chat').first().click();
  assert.equal(await pages[0].locator('.conversation').isVisible(),false);
  await pages[0].locator('#audio-tab').click();
  assert.equal(await pages[0].locator('#audio-panel').isVisible(),true);
  if(process.env.ORBITER_UI_PREVIEW){await pages[0].locator('#toast').waitFor({state:'hidden',timeout:7000});await pages[0].screenshot({path:resolve(process.env.ORBITER_UI_PREVIEW)})}
  const audioLayout=await pages[0].evaluate(()=>{const panel=document.querySelector('#audio-panel');return {needsScroll:panel.scrollHeight>panel.clientHeight,lastControl:document.querySelector('#mic-test-status').getBoundingClientRect().bottom,viewport:innerHeight}});
  assert.equal(audioLayout.needsScroll,false);
  assert.ok(audioLayout.lastControl<audioLayout.viewport);
  await pages[0].locator('#mic-sensitivity').fill('80');
  assert.equal(await pages[0].locator('#sensitivity-value').textContent(),'80%');
  await pages[0].locator('#noise-filter').uncheck();
  await pages[0].locator('#noise-filter').check();
  await pages[0].locator('#members-tab').click();
  await pages[0].waitForFunction(()=>document.querySelector('#remote-media audio')?.srcObject?.getAudioTracks().length>0,null,{timeout:15000});
  await pages[1].waitForFunction(()=>document.querySelector('#remote-media audio')?.srcObject?.getAudioTracks().length>0,null,{timeout:15000});
  await new Promise(r=>setTimeout(r,2000));
  for(let n=0;n<2;n++){
    const status=await pages[n].evaluate(async()=>{const audio=document.querySelector('#remote-media audio');const pc=window.__pcs[0];const stats=await pc.getStats();const pair=[...stats.values()].find(s=>s.type==='candidate-pair'&&s.nominated&&s.state==='succeeded');return {pc:pc.connectionState,ice:pc.iceConnectionState,audioTrack:audio.srcObject.getAudioTracks()[0].readyState,paused:audio.paused,currentTime:audio.currentTime,localCandidateType:pair?stats.get(pair.localCandidateId)?.candidateType:null,bytesReceived:[...stats.values()].filter(s=>s.type==='inbound-rtp'&&s.kind==='audio').map(s=>s.bytesReceived)}});
    console.log(`client${n}`,JSON.stringify(status));
    assert.equal(status.pc,'connected');
    assert.equal(status.paused,false);
    assert.ok(status.bytesReceived.some(bytes=>bytes>0));
    if(relayOnly)assert.equal(status.localCandidateType,'relay');
  }
  await pages[1].evaluate(async()=>{const stream=await navigator.mediaDevices.getUserMedia({video:true});window.__testVideo=stream;window.__pcs[0].addTrack(stream.getVideoTracks()[0],stream)});
  await pages[0].locator('#remote-media video').waitFor({state:'visible',timeout:15000});
  const videoLayout=await pages[0].evaluate(()=>{const stage=document.querySelector('#call-stage').getBoundingClientRect(),video=document.querySelector('#remote-media video').getBoundingClientRect();return {withinStage:video.left>=stage.left&&video.right<=stage.right&&video.bottom<=stage.bottom,large:video.width>300&&video.height>250}});
  assert.equal(videoLayout.withinStage,true);
  assert.equal(videoLayout.large,true);
  await pages[0].locator('#logout-btn').click();
  await pages[0].locator('#auth').waitFor({state:'visible'});
  await pages[0].reload();
  await pages[0].locator('#auth').waitFor({state:'visible'});
}finally{await browser?.close();child.kill();await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100})}
