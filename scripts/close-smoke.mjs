import WebSocket from 'ws';
const port=process.argv[2];if(!port)throw Error('Porta CDP necessária');
const browser=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();
const ws=new WebSocket(browser.webSocketDebuggerUrl);await new Promise(r=>ws.once('open',r));
ws.send(JSON.stringify({id:1,method:'Browser.close'}));
await new Promise(r=>setTimeout(r,250));ws.close();
