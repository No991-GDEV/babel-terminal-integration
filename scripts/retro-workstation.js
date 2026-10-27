// Presentation only: this layer never changes Journals, access or challenge state.
import {escapeHTML as h} from './core.js';
import {PRESETS} from './company-presets.js';

export const WORKSTATIONS={
 babel:{style:'personal',label:'REDE PESSOAL',channel:'BABEL / ACERVO LOCAL'},
 kruger:{style:'industrial',label:'ENERGIA / DISTRIBUIÇÃO',channel:'KRUGER / REGISTRO CORPORATIVO'},
 callahan:{style:'workshop',label:'AUTOMATA / OFICINAS',channel:'CALLAHAN / REGISTRO INDUSTRIAL'},
 meier:{style:'structural',label:'ESTRUTURAS / ENGENHARIA',channel:'MEIER / ARQUIVO TÉCNICO'},
 atlas:{style:'transit',label:'TRANSPORTE / LINHAS VERTICAIS',channel:'ATLAS / ARQUIVO DE REDE'},
 springs:{style:'civic',label:'ÁGUA / ABASTECIMENTO',channel:'SEVEN SPRINGS / REGISTRO DE SERVIÇO'},
 ceres:{style:'cultivation',label:'CULTIVO / NUTRIÇÃO',channel:'CERES / REGISTRO CORPORATIVO'},
 vox:{style:'signal',label:'COMUNICAÇÕES / TRANSMISSÃO',channel:'VOX MERIDIAN / ARQUIVO DE REDE'},
 mrv:{style:'research',label:'PESQUISA / DOCUMENTAÇÃO',channel:'MRV / ARQUIVO CIENTÍFICO'}
};
export function workstationMotion(view){
 return !!(view.pref.effects&&!view.pref.reduce&&view.pref.speed>0&&!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
export function installRetroWorkstation(View){
 const start=View.prototype.start,brand=View.prototype.brand,draw=View.prototype.draw,escape=View.prototype.escape,update=View.prototype.updatePreferences,destroy=View.prototype.destroy;
 Object.assign(View.prototype,{
  async start(){
   this.signatureSeen=new Set();this.workstationAnimations=new Set();this.attachmentSeen=new Set();
   await start.call(this);
   if(!this.active)return;
   const plate=document.createElement('div');plate.className='bt-device-strip';
   plate.innerHTML='<span class="bt-device-name">BABEL NETWORK <span>/ ESTAÇÃO DE CONSULTA</span></span><span class="bt-device-power"><i aria-hidden="true"></i> PWR</span>';
   this.shell.prepend(plate);
   this.workstationBoot();
  },
  brand(theme='babel',appearance={}){
   brand.call(this,theme,appearance);
   const key=Object.hasOwn(PRESETS,theme)?theme:'babel',identity=WORKSTATIONS[key],node=this.root.querySelector('.bt-brand');
   this.shell.dataset.institution=key;this.shell.dataset.workstation=identity.style;
   node.insertAdjacentHTML('beforeend',`<div class="bt-brand-scope"><span>${h(identity.label)}</span><small>ESTAÇÃO DE CONSULTA</small></div>`);
   const mark=document.createElement('pre');mark.className='bt-brand-watermark';mark.setAttribute('aria-hidden','true');mark.textContent=node.querySelector('.bt-mark')?.textContent||'';node.append(mark);
   this.renderSignature(node,key);
  },
  draw(...args){
   this.finishWorkstationBoot?.();
   const result=draw.apply(this,args),page=this.output.querySelector('[data-page-body]');
   if(page){
    const identity=WORKSTATIONS[this.shell.dataset.institution]||WORKSTATIONS.babel;
    const stamp=document.createElement('div');stamp.className='bt-doc-stamp';stamp.textContent=identity.channel;page.before(stamp);
   }
   return result;
  },
  renderSignature(node,key){
   this.finishSignature?.();
   const mark=node.querySelector('.bt-mark'),signature=JSON.stringify([key,mark?.textContent,node.querySelector('h1')?.textContent]);
   if(!workstationMotion(this)||this.pref.mode==='cli'||this.signatureSeen?.has(signature)||typeof mark?.animate!=='function')return;
   this.signatureSeen?.add(signature);
   const animation=mark.animate([{clipPath:'inset(0 0 100% 0)'},{clipPath:'inset(0 0 0% 0)'}],{duration:520,easing:'steps(12,end)'});
   this.workstationAnimations?.add(animation);
   const finish=()=>{animation.cancel();this.workstationAnimations?.delete(animation);if(this.finishSignature===finish)this.finishSignature=null;};
   this.finishSignature=finish;animation.onfinish=finish;
  },
  workstationBoot(){
   if(!this.active||this.pref.mode==='cli'||!workstationMotion(this)||this.workstationBootPlayed)return;
   this.workstationBootPlayed=true;
   const overlay=document.createElement('section');overlay.className='bt-workstation-boot';overlay.setAttribute('aria-label','Inicialização da interface');
   overlay.innerHTML=`<div class="bt-startup-screen"><div class="bt-label">BABEL NETWORK / LOCAL INTERFACE</div><h2>ESTAÇÃO PESSOAL</h2><pre>OPERADOR: ${h(this.store.user.name)}\nCARREGANDO INTERFACE DE CONSULTA…</pre><div class="bt-startup-meter" aria-hidden="true"><span></span></div><button type="button">PULAR <kbd>Esc</kbd></button></div>`;
   this.shell.append(overlay);
   const previousFocus=document.activeElement,skipButton=overlay.querySelector('button');skipButton.focus({preventScroll:true});
   const timer=setTimeout(()=>this.finishWorkstationBoot?.(),620);
   this.finishWorkstationBoot=(restoreFocus=true)=>{const focused=overlay.contains(document.activeElement);clearTimeout(timer);overlay.remove();this.finishWorkstationBoot=null;if(restoreFocus&&focused){const target=previousFocus?.isConnected&&previousFocus!==document.body?previousFocus:this.pref.mode==='panel'?this.root.querySelector('.bt-sidebar [aria-current=page]'):this.input;target?.focus({preventScroll:true});}};
   skipButton.onclick=()=>{this.finishWorkstationBoot?.();this.skip();};
  },
  async escape(event){
   if(this.finishWorkstationBoot){event.preventDefault();event.stopPropagation();this.finishWorkstationBoot();this.skip();return;}
   this.finishSignature?.();
   return escape.call(this,event);
  },
  updatePreferences(){
   const result=update.call(this);
   if(this.pref.mode==='cli'||!workstationMotion(this)){this.finishWorkstationBoot?.();this.finishSignature?.();if(!workstationMotion(this))this.finishAttachment?.();}
   return result;
  },
  destroy(){
   this.finishWorkstationBoot?.(false);this.finishSignature?.();for(const animation of this.workstationAnimations||[])animation.cancel();this.workstationAnimations?.clear();
   const result=destroy.call(this);this.attachmentSeen?.clear();this.signatureSeen?.clear();return result;
  }
 });
}
