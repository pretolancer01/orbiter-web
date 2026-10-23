import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import WebSocket from 'ws';

test('o site e o WebSocket usam a mesma porta com dados persistentes', {timeout:20000},async()=>{
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;probe.close();await once(probe,'close');
  const dir=await mkdtemp(join(tmpdir(),'orbiter-web-'));
  let child,ws;
  try{
    child=spawn(process.execPath,[resolve('dist/server.cjs')],{env:{...process.env,ORBITER_WEB:'1',PORT:String(port),ORBITER_DATA_DIR:dir,GOOGLE_CLIENT_ID:''},stdio:['ignore','pipe','pipe']});
    await Promise.race([new Promise(r=>child.stdout.once('data',r)),new Promise((_,reject)=>setTimeout(()=>reject(Error('site não iniciou')),5000))]);
    const base=`http://127.0.0.1:${port}`;
    const health=await fetch(base+'/healthz');assert.equal(health.status,200);assert.deepEqual(await health.json(),{ok:true});
    const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/BEM-VINDO AO ORBITER/);
    assert.equal((await fetch(base+'/package.json')).status,404);
    ws=new WebSocket(`ws://127.0.0.1:${port}`);await once(ws,'open');
    const received=[];const response=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('cadastro sem resposta')),3000);ws.on('message',raw=>{received.push(JSON.parse(raw.toString()));if(received.some(m=>m.type==='state')&&received.some(m=>m.type==='result')){clearTimeout(timer);resolve()}})});
    ws.send(JSON.stringify({type:'register',requestId:1,email:'site@example.test',password:'SenhaDoSite123!',username:'siteuser',displayName:'Pessoa Web'}));await response;
    assert.ok(received.some(m=>m.type==='result'&&m.ok&&m.data.token));
    assert.ok(received.some(m=>m.type==='state'&&m.data.user.username==='siteuser'));
  }finally{ws?.close();if(child){child.kill();if(child.exitCode===null)await once(child,'exit')}await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100})}
});
