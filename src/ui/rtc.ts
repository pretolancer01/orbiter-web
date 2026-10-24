export type Signal={description?:RTCSessionDescriptionInit;candidate?:RTCIceCandidateInit};
type Peer={pc:RTCPeerConnection;polite:boolean;makingOffer:boolean;ignoreOffer:boolean;pending:RTCIceCandidateInit[];stream:MediaStream};
export class RtcRoom {
  private peers=new Map<string,Peer>();private mic:MediaStream|null=null;private rawMic:MediaStream|null=null;private micContext:AudioContext|null=null;private micGate:GainNode|null=null;private micTimer:number|null=null;private sensitivity=100;private noiseSuppression=true;private screen:MediaStream|null=null;private iceServers:RTCIceServer[]=[{urls:'stun:stun.l.google.com:19302'}];
  constructor(private selfId:()=>string,private send:(to:string,data:Signal)=>void,private media:(id:string,stream:MediaStream|null)=>void,private status:(text:string)=>void){}
  configureIceServers(servers:RTCIceServer[]){this.iceServers=servers;for(const peer of this.peers.values())peer.pc.setConfiguration({iceServers:servers})}
  private tracks(){return [...(this.mic?.getTracks()||[]),...(this.screen?.getTracks()||[])].filter(t=>t.readyState==='live')}
  private create(id:string){const existing=this.peers.get(id);if(existing)return existing;const pc=new RTCPeerConnection({iceServers:this.iceServers});const peer:Peer={pc,polite:this.selfId()>id,makingOffer:false,ignoreOffer:false,pending:[],stream:new MediaStream()};this.peers.set(id,peer);
    for(const track of this.tracks())pc.addTrack(track,track.kind==='video'?this.screen!:this.mic?.getTracks().includes(track)?this.mic!:this.screen!);
    pc.onicecandidate=e=>{if(e.candidate)this.send(id,{candidate:e.candidate.toJSON()})};
    pc.onnegotiationneeded=async()=>{try{peer.makingOffer=true;await pc.setLocalDescription();this.send(id,{description:pc.localDescription!})}catch(e){console.error(e)}finally{peer.makingOffer=false}};
    pc.ontrack=e=>{peer.stream.addTrack(e.track);this.media(id,peer.stream);e.track.onended=()=>{peer.stream.removeTrack(e.track);this.media(id,peer.stream)}};
    pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed')this.status('Falha na mídia. Redes diferentes podem exigir um servidor TURN.')};return peer;
  }
  add(id:string){this.create(id)}
  remove(id:string){const p=this.peers.get(id);if(!p)return;p.pc.close();this.peers.delete(id);this.media(id,null)}
  clear(){for(const id of [...this.peers.keys()])this.remove(id)}
  async receive(id:string,data:Signal){const p=this.create(id),pc=p.pc;try{if(data.description){const collision=data.description.type==='offer'&&(p.makingOffer||pc.signalingState!=='stable');p.ignoreOffer=!p.polite&&collision;if(p.ignoreOffer)return;await pc.setRemoteDescription(data.description);for(const candidate of p.pending.splice(0))await pc.addIceCandidate(candidate);if(data.description.type==='offer'){await pc.setLocalDescription();this.send(id,{description:pc.localDescription!})}}if(data.candidate){if(pc.remoteDescription)await pc.addIceCandidate(data.candidate);else p.pending.push(data.candidate)}}catch(e){console.error('WebRTC',e)}}
  private sync(){const live=this.tracks();for(const p of this.peers.values()){for(const sender of p.pc.getSenders())if(sender.track&&!live.includes(sender.track))p.pc.removeTrack(sender);for(const track of live)if(!p.pc.getSenders().some(s=>s.track===track))p.pc.addTrack(track,track.kind==='video'?this.screen!:this.mic?.getTracks().includes(track)?this.mic!:this.screen!)}}
  setSensitivity(value:number){this.sensitivity=Math.max(0,Math.min(100,value));if(this.sensitivity===100&&this.micGate&&this.micContext)this.micGate.gain.setTargetAtTime(1,this.micContext.currentTime,0.015)}
  setMicTransmission(enabled:boolean){for(const track of this.rawMic?.getAudioTracks()||[])track.enabled=enabled;for(const track of this.mic?.getAudioTracks()||[])track.enabled=enabled}
  async setNoiseSuppression(enabled:boolean){const track=this.rawMic?.getAudioTracks()[0];if(track)await track.applyConstraints({noiseSuppression:enabled,echoCancellation:true});this.noiseSuppression=enabled}
  private stopMic(){if(this.micTimer!==null){clearInterval(this.micTimer);this.micTimer=null}this.rawMic?.getTracks().forEach(t=>t.stop());this.rawMic=null;this.mic?.getTracks().forEach(t=>t.stop());this.mic=null;this.micGate=null;const context=this.micContext;this.micContext=null;if(context)void context.close().catch(()=>{})}
  async toggleMic(deviceId?:string,transmitImmediately=true){if(this.mic){this.stopMic();this.sync();return false}
    const audio:MediaTrackConstraints={echoCancellation:true,noiseSuppression:this.noiseSuppression};if(deviceId)audio.deviceId={exact:deviceId};
    const raw=await navigator.mediaDevices.getUserMedia({audio});
    try{const context=new AudioContext();await context.resume();const source=context.createMediaStreamSource(raw),analyser=context.createAnalyser(),gate=context.createGain(),destination=context.createMediaStreamDestination();analyser.fftSize=1024;source.connect(analyser);source.connect(gate).connect(destination);this.rawMic=raw;this.micContext=context;this.micGate=gate;this.mic=destination.stream;
      const samples=new Uint8Array(analyser.fftSize);this.micTimer=window.setInterval(()=>{if(this.sensitivity===100){gate.gain.setTargetAtTime(1,context.currentTime,0.015);return}analyser.getByteTimeDomainData(samples);let power=0;for(const sample of samples){const value=(sample-128)/128;power+=value*value}const rms=Math.sqrt(power/samples.length);const threshold=0.006+(100-this.sensitivity)*0.00075;gate.gain.setTargetAtTime(rms>=threshold?1:0,context.currentTime,rms>=threshold?0.012:0.08)},40);
      this.setMicTransmission(transmitImmediately);this.sync();return true}catch(error){raw.getTracks().forEach(t=>t.stop());this.stopMic();throw error}}
  stopShare(){if(!this.screen)return;this.screen.getTracks().forEach(t=>t.stop());this.screen=null;this.sync();this.status('Transmissão encerrada.')}
  async share(id:string,audio:boolean,height:number,fps:number,select:(id:string,audio:boolean)=>Promise<boolean>){if(!await select(id,audio))throw Error('Fonte inválida.');this.screen=await navigator.mediaDevices.getDisplayMedia({video:{height:{ideal:height},frameRate:{ideal:fps}},audio});this.screen.getVideoTracks()[0].onended=()=>this.stopShare();this.sync();this.status('Você está compartilhando. Use o botão vermelho para encerrar.');return this.screen}
  get sharing(){return !!this.screen}
  get micOn(){return !!this.mic}
  get micTransmitting(){return !!this.mic?.getAudioTracks().some(track=>track.enabled)}
  shutdown(){this.clear();this.stopShare();this.stopMic()}
}
