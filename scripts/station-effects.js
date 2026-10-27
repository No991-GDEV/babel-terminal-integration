// Optional CRT grain. Pure CSS: no video, network requests or perpetual JS timer.
export const normalizeMode=value=>value==='panel'?'panel':'cli';
export function installStationEffects(View){
 const start=View.prototype.start,update=View.prototype.updatePreferences;
 Object.assign(View.prototype,{
  async start(){await start.call(this);const grain=document.createElement('div');grain.className='bt-static';grain.setAttribute('aria-hidden','true');this.shell.append(grain);},
  updatePreferences(){this.pref.mode=normalizeMode(this.pref.mode);update.call(this);this.shell.classList.toggle('static',!!this.pref.static&&!this.pref.reduce);},
  attachmentTone(){
   if(!this.pref.sound||this.pref.reduce||this.pref.volume<=0)return;
   try{this.audio??=new AudioContext();if(this.audio.state==='suspended')this.audio.resume();const now=this.audio.currentTime;
    for(const [offset,hz]of [[0,320],[.08,520],[.16,780]]){const oscillator=this.audio.createOscillator(),gain=this.audio.createGain();oscillator.type='sine';oscillator.frequency.value=hz;gain.gain.setValueAtTime(Math.min(.2,this.pref.volume)*.12,now+offset);gain.gain.exponentialRampToValueAtTime(.0001,now+offset+.065);oscillator.connect(gain);gain.connect(this.audio.destination);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};oscillator.start(now+offset);oscillator.stop(now+offset+.07);}
   }catch{/* Sound is never required to view an image. */}
  }
 });
}
