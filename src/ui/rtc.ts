export type Signal={description?:RTCSessionDescriptionInit;candidate?:RTCIceCandidateInit};
type Peer={pc:RTCPeerConnection;polite:boolean;makingOffer:boolean;ignoreOffer:boolean;pending:RTCIceCandidateInit[];stream:MediaStream};
export class RtcRoom {
  private peers=new Map<string,Peer>();private mic:MediaStream|null=null;private screen:MediaStream|null=null;private iceServers:RTCIceServer[]=[{urls:'stun:stun.l.google.com:19302'}];
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
  async toggleMic(deviceId?:string){if(this.mic){this.mic.getTracks().forEach(t=>t.stop());this.mic=null;this.sync();return false}this.mic=await navigator.mediaDevices.getUserMedia({audio:deviceId?{deviceId:{exact:deviceId},echoCancellation:true,noiseSuppression:true}:{echoCancellation:true,noiseSuppression:true}});this.sync();return true}
  stopShare(){if(!this.screen)return;this.screen.getTracks().forEach(t=>t.stop());this.screen=null;this.sync();this.status('Transmissão encerrada.')}
  async share(id:string,audio:boolean,height:number,fps:number,select:(id:string,audio:boolean)=>Promise<boolean>){if(!await select(id,audio))throw Error('Fonte inválida.');this.screen=await navigator.mediaDevices.getDisplayMedia({video:{height:{ideal:height},frameRate:{ideal:fps}},audio});this.screen.getVideoTracks()[0].onended=()=>this.stopShare();this.sync();this.status('Você está compartilhando. Use o botão vermelho para encerrar.');return this.screen}
  get sharing(){return !!this.screen}
  shutdown(){this.clear();this.stopShare();this.mic?.getTracks().forEach(t=>t.stop());this.mic=null}
}
