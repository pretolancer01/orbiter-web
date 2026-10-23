// Electron provides this bridge through its preload; the web build supplies browser equivalents.
if (!(window as any).orbita) {
  const sessionKey='orbiter-web-session';
  (window as any).orbita={
    backendUrl:async()=>`${location.protocol==='https:'?'wss':'ws'}://${location.host}`,
    readSession:async()=>localStorage.getItem(sessionKey),
    writeSession:async(token:string)=>{localStorage.setItem(sessionKey,token);return true},
    clearSession:async()=>{localStorage.removeItem(sessionKey)},
    openOAuth:async(url:string)=>{window.open(url,'_blank','noopener,noreferrer');return true},
    sources:async()=>[{id:'browser',name:'Escolher tela ou janela'}],
    select:async()=>true,
  };
  // Browser login through Google needs its own public OAuth callback.
  document.getElementById('google-btn')?.classList.add('hidden');
}
