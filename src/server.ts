import { WebSocketServer, WebSocket } from 'ws';
import { createHash, randomBytes } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { Store } from './store';

type Client={ws:WebSocket;userId:string|null;token:string|null;channelId:string|null;hits:number[]};
const send=(ws:WebSocket,data:unknown)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data))};
const clean=(v:unknown)=>typeof v==='string'?v:'';
export async function startServer(options:{host?:string;port?:number;dataDir?:string}={}){
  const webMode=process.env.ORBITER_WEB==='1'||Boolean(process.env.RENDER);
  const host=options.host||process.env.ORBITER_HOST||(webMode?'0.0.0.0':'127.0.0.1'),port=options.port||Number(process.env.PORT||process.env.ORBITER_PORT||8765);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('ORBITER_PORT inválida');
  const store=new Store(options.dataDir||process.env.ORBITER_DATA_DIR||path.join(process.cwd(),'data'));
  await store.initPersistence();
  const webRoot=path.join(__dirname,'ui');
  const webServer=webMode?createHttpServer((req,res)=>{
    const pathname=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`).pathname;
    if(pathname==='/healthz'){res.writeHead(200,{'content-type':'application/json'});res.end('{"ok":true}');return}
    if(pathname==='/ice-config'){
      void (async()=>{try{const keyId=process.env.CLOUDFLARE_TURN_KEY_ID,apiToken=process.env.CLOUDFLARE_TURN_API_TOKEN;if(!keyId||!apiToken)throw Error('TURN não configurado');const response=await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,{method:'POST',headers:{Authorization:`Bearer ${apiToken}`,'Content-Type':'application/json'},body:JSON.stringify({ttl:86400})});if(!response.ok)throw Error(`Cloudflare TURN respondeu ${response.status}`);const data=await response.json();res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data))}catch(e){console.error('TURN credentials:',e);res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({iceServers:[{urls:'stun:stun.l.google.com:19302'}]}))}})();return
    }
    const file=pathname==='/'?'index.html':pathname.startsWith('/assets/')&&/^\/assets\/[a-zA-Z0-9._-]+$/.test(pathname)?pathname.slice(1):null;
    if(!file){res.writeHead(404);res.end('Not found');return}
    const absolute=path.join(webRoot,file);
    if(!existsSync(absolute)||!statSync(absolute).isFile()){res.writeHead(404);res.end('Not found');return}
    const type=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'application/octet-stream';
    res.writeHead(200,{'content-type':type,'x-content-type-options':'nosniff','cache-control':file==='index.html'?'no-store':'public, max-age=31536000, immutable'});
    createReadStream(absolute).pipe(res);
  }):null;
  const wss=new WebSocketServer(webServer?{server:webServer,maxPayload:65536}:{host,port,maxPayload:65536});const clients=new Set<Client>();
  if(webServer)webServer.listen(port,host,()=>console.log(`Orbiter web: http://${host}:${port}`));
  const googleClientId=process.env.GOOGLE_CLIENT_ID,googleClientSecret=process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri=`http://127.0.0.1:${Number(process.env.ORBITER_OAUTH_PORT||8766)}/oauth2/callback`;
  const oauth=googleClientId?new OAuth2Client(googleClientId,googleClientSecret||undefined,redirectUri):null;
  const pending=new Map<string,{client:Client;verifier:string;at:number}>();
  function voicePresence(client:Client){return [...new Map([...clients].filter(x=>x.userId&&x.channelId&&store.data.channels.some(ch=>ch.id===x.channelId&&ch.type==='voice'&&client.userId&&store.isMember(client.userId,ch.communityId)&&store.isMember(x.userId!,ch.communityId))).map(x=>[`${x.channelId}:${x.userId}`,{userId:x.userId!,channelId:x.channelId!}])).values()];}
  function stateFor(client:Client){if(client.userId)send(client.ws,{type:'state',data:{...store.bootstrap(client.userId),voicePresence:voicePresence(client)}});}
  function broadcastPresence(){for(const client of clients)if(client.userId)send(client.ws,{type:'voice_presence',participants:voicePresence(client)});}
  function leaveChannel(c:Client){if(!c.channelId)return;const previous=c.channelId;c.channelId=null;if(![...clients].some(x=>x!==c&&x.userId===c.userId&&x.channelId===previous))broadcastChannel(previous,{type:'peer_left',id:c.userId},c);}
  function pruneChannels(){for(const c of clients)if(c.channelId&&!store.data.channels.some(ch=>ch.id===c.channelId&&c.userId&&store.isMember(c.userId,ch.communityId)))leaveChannel(c);}
  function stateForCommunity(id:string){for(const c of clients)if(c.userId&&store.isMember(c.userId,id))stateFor(c);}
  function result(c:Client,id:unknown,data:unknown){send(c.ws,{type:'result',requestId:id,ok:true,data});}
  function error(c:Client,id:unknown,e:unknown){send(c.ws,{type:'result',requestId:id,ok:false,error:e instanceof Error?e.message:'Erro inesperado.'});}
  function requireUser(c:Client){if(!c.userId)throw Error('Entre na sua conta.');return c.userId;}
  function channelFor(c:Client,id:string){const ch=store.data.channels.find(x=>x.id===id);if(!ch||!c.userId||!store.isMember(c.userId,ch.communityId))throw Error('Sem acesso ao canal.');return ch;}
  function livePeers(c:Client){return [...clients].filter(x=>x!==c&&x.userId&&x.channelId===c.channelId).map(x=>({id:x.userId,name:store.account(x.userId!)?.displayName||'Pessoa'}));}
  function broadcastChannel(channelId:string,data:unknown,exclude?:Client){for(const c of clients)if(c!==exclude&&c.channelId===channelId)send(c.ws,data);}
  async function handle(c:Client,msg:any){const id=msg.requestId;try{
    const userId=()=>requireUser(c);let out:unknown=null;
    switch(msg.type){
      case 'register':{const user=store.register(msg);const token=store.newSession(user.id);c.userId=user.id;c.token=token;out={token,user:store.publicAccount(user)};stateFor(c);break;}
      case 'login':{const user=store.login(msg.email,msg.password);const token=store.newSession(user.id);c.userId=user.id;c.token=token;out={token,user:store.publicAccount(user)};stateFor(c);break;}
      case 'resume':{const user=store.resume(msg.token);if(!user)throw Error('Sessão expirada. Entre novamente.');c.userId=user.id;c.token=msg.token;out={user:store.publicAccount(user)};stateFor(c);break;}
      case 'logout':{if(c.token)store.logout(c.token);leaveChannel(c);c.userId=null;c.token=null;out={};break;}
      case 'profile_update':out=store.publicAccount(store.profile(userId(),msg));stateFor(c);break;
      case 'create_server':{const community=store.createCommunity(userId(),msg);out=community;stateFor(c);break;}
      case 'create_channel':out=store.createChannel(userId(),msg);stateForCommunity(msg.communityId);break;
      case 'edit_channel':{const ch=store.editChannel(userId(),msg);out=ch;stateForCommunity(ch.communityId);break;}
      case 'delete_channel':{const ch=channelFor(c,msg.channelId);store.deleteChannel(userId(),msg.channelId);stateForCommunity(ch.communityId);break;}
      case 'create_category':out=store.createCategory(userId(),msg);stateForCommunity(msg.communityId);break;
      case 'create_role':out=store.createRole(userId(),msg);stateForCommunity(msg.communityId);break;
      case 'assign_role':store.assignRole(userId(),msg);stateForCommunity(msg.communityId);break;
      case 'kick_member':store.kick(userId(),msg,false);stateForCommunity(msg.communityId);for(const x of clients)if(x.userId===msg.targetId){if(x.channelId&&store.data.channels.some(ch=>ch.id===x.channelId&&ch.communityId===msg.communityId)){broadcastChannel(x.channelId,{type:'peer_left',id:x.userId},x);x.channelId=null}stateFor(x)}break;
      case 'ban_member':store.kick(userId(),msg,true);stateForCommunity(msg.communityId);for(const x of clients)if(x.userId===msg.targetId){if(x.channelId&&store.data.channels.some(ch=>ch.id===x.channelId&&ch.communityId===msg.communityId)){broadcastChannel(x.channelId,{type:'peer_left',id:x.userId},x);x.channelId=null}stateFor(x)}break;
      case 'delete_server':store.deleteCommunity(userId(),msg.communityId);for(const x of clients)if(x.userId)stateFor(x);break;
      case 'invite_create':{const invite=store.invite(userId(),msg);const base=process.env.ORBITER_INVITE_BASE_URL;out={...invite,url:base?`${base.replace(/\/$/,'')}/${invite.code}`:null};stateForCommunity(invite.communityId);break;}
      case 'invite_join':{const community=store.joinInvite(userId(),clean(msg.code));out=community;stateForCommunity(community.id);break;}
      case 'invite_revoke':{const invite=store.data.invites.find(i=>i.code===msg.code);store.revokeInvite(userId(),clean(msg.code));if(invite)stateForCommunity(invite.communityId);break;}
      case 'friend_request':{const target=store.friendRequest(userId(),clean(msg.username));out=store.publicProfile(target);for(const x of clients)if(x.userId===target.id||x.userId===c.userId)stateFor(x);break;}
      case 'friend_accept':store.acceptFriend(userId(),clean(msg.fromId));for(const x of clients)if(x.userId===msg.fromId||x.userId===c.userId)stateFor(x);break;
      case 'leave_channel':userId();leaveChannel(c);break;
      case 'select_channel':{const ch=channelFor(c,clean(msg.channelId));if(c.channelId!==ch.id){leaveChannel(c);c.channelId=ch.id;broadcastChannel(ch.id,{type:'peer_joined',id:c.userId,name:store.account(c.userId!)?.displayName},c);}out={channelId:ch.id,peers:livePeers(c)};break;}
      case 'message_send':{const item=store.message(userId(),msg);const account=store.account(userId())!;out=item;for(const x of clients)if(x.channelId===item.channelId)send(x.ws,{type:'message',message:{...item,name:account.displayName}});break;}
      case 'signal':{userId();if(!c.channelId||!msg.to||!msg.data||JSON.stringify(msg.data).length>20000)throw Error('Sinalização inválida.');channelFor(c,c.channelId);const target=[...clients].find(x=>x.userId===msg.to&&x.channelId===c.channelId);if(target)send(target.ws,{type:'signal',from:c.userId,data:msg.data});break;}
      case 'report':{userId();const reason=clean(msg.reason).trim();if(reason.length<5||reason.length>500)throw Error('Motivo inválido.');console.warn('DENÚNCIA',JSON.stringify({at:Date.now(),from:c.userId,target:msg.target,reason}));out={recorded:true};break;}
      case 'google_start':{if(!oauth||!googleClientId)throw Error('Google OAuth não configurado. Defina GOOGLE_CLIENT_ID no backend e o URI de retorno no Google Cloud Console.');const state=randomBytes(24).toString('base64url'),verifier=randomBytes(48).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');pending.set(state,{client:c,verifier,at:Date.now()});out={url:oauth.generateAuthUrl({access_type:'online',scope:['openid','email','profile'],state,code_challenge:challenge,code_challenge_method:CodeChallengeMethod.S256,prompt:'select_account'})};break;}
      default:throw Error('Ação desconhecida.');
    }
    if(['select_channel','leave_channel','logout','delete_channel','delete_server','kick_member','ban_member'].includes(msg.type)){pruneChannels();broadcastPresence();}
    await store.flush();
    result(c,id,out);
  }catch(e){error(c,id,e)}}
  wss.on('connection',ws=>{const client:Client={ws,userId:null,token:null,channelId:null,hits:[]};clients.add(client);ws.on('message',raw=>{let msg:any;try{msg=JSON.parse(raw.toString())}catch{return}if(!msg||typeof msg.type!=='string')return;const now=Date.now();client.hits=client.hits.filter(t=>now-t<10000);client.hits.push(now);if(client.hits.length>60){ws.close(4008,'Limite de mensagens');return}void handle(client,msg)});ws.on('close',()=>{leaveChannel(client);clients.delete(client);broadcastPresence()});});
  wss.on('error',e=>{if((e as NodeJS.ErrnoException).code!=='EADDRINUSE')console.error('Servidor:',e)});
  wss.on('listening',()=>console.log(`Orbiter backend: ws://${host}:${port}`));
  const oauthPort=Number(process.env.ORBITER_OAUTH_PORT||8766);
  const http=oauth?createHttpServer(async(req,res)=>{try{const url=new URL(req.url||'/',`http://127.0.0.1:${oauthPort}`);if(url.pathname!=='/oauth2/callback')throw Error('Rota não encontrada.');const state=url.searchParams.get('state')||'',record=pending.get(state);pending.delete(state);if(!record||record.client.ws.readyState!==WebSocket.OPEN||Date.now()-record.at>600000||!url.searchParams.get('code'))throw Error('Login expirado ou inválido.');const {tokens}=await oauth.getToken({code:url.searchParams.get('code')!,codeVerifier:record.verifier,redirect_uri:redirectUri});if(!tokens.id_token)throw Error('Identidade Google ausente.');const ticket=await oauth.verifyIdToken({idToken:tokens.id_token,audience:googleClientId});const payload=ticket.getPayload();if(!payload?.sub||!payload.email||!payload.email_verified)throw Error('E-mail Google não verificado.');const account=store.googleLogin(payload.sub,payload.email,payload.name||'Conta Google');const token=store.newSession(account.id);await store.flush();record.client.userId=account.id;record.client.token=token;send(record.client.ws,{type:'google_auth',token,user:store.publicAccount(account)});stateFor(record.client);res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end('<h1>Entrada concluída</h1><p>Você pode voltar ao Orbiter.</p>');}catch(e){res.writeHead(400,{'content-type':'text/plain; charset=utf-8'});res.end(e instanceof Error?e.message:'Falha de autenticação');}}):null;
  if(http){http.listen(oauthPort,'127.0.0.1');http.on('error',e=>console.error('OAuth callback:',e));}
  if(host!=='127.0.0.1'&&host!=='localhost')console.warn('Use TLS/WSS e proxy reverso para acesso externo.');
  return {wss,http,webServer,store};
}

if(require.main===module)void startServer().catch(e=>{console.error('Falha ao iniciar Orbiter:',e);process.exitCode=1});
