import {escapeHTML as h} from './core.js';
import {filename} from './terminal-files.js';
import {workstationMotion} from './retro-workstation.js';
export function revealAttachment(view,doc,asset){
 view.draw(`<div class="bt-label">VISUALIZADOR DE ANEXOS</div><h2>${h(asset.title)}</h2><p class="bt-transfer" role="status">Recebendo anexo…</p><div class="bt-attachment-frame" aria-busy="true"><img alt="${h(asset.title)}"><span class="bt-attachment-scan" aria-hidden="true"></span></div><div class="bt-toolbar"><button data-skip-image>PULAR RENDERIZAÇÃO</button><button data-cmd="cat /${h(filename(doc))}">← DOCUMENTO</button></div><p class="bt-muted">Esc pula a renderização · cat /${h(filename(doc))}</p>`);
 const frame=view.output.querySelector('.bt-attachment-frame'),img=frame.querySelector('img'),status=view.output.querySelector('.bt-transfer'),button=view.output.querySelector('[data-skip-image]');
 let animation=null,scanAnimation=null,skipped=false,loaded=false;
 view.attachmentSeen??=new Set();
 const cacheKey=JSON.stringify([view.store.user.id,doc.id,asset.source,asset.path]),animate=workstationMotion(view)&&!view.attachmentSeen.has(cacheKey);
 if(animate)img.style.clipPath='inset(0 0 100% 0)';else button.hidden=true;
 const finish=()=>{
  skipped=true;animation?.cancel();scanAnimation?.cancel();animation=null;scanAnimation=null;img.style.clipPath='none';frame.classList.remove('rendering');button.hidden=true;
  if(loaded){view.attachmentSeen.add(cacheKey);frame.setAttribute('aria-busy','false');status.textContent='Anexo recebido.';}
  if(view.finishAttachment===finish)view.finishAttachment=null;
 };
 view.finishAttachment=finish;button.onclick=finish;
 img.onload=()=>{
  if(!view.active||!frame.isConnected)return;
  loaded=true;
  view.attachmentTone?.();
  if(!animate||skipped||typeof img.animate!=='function'){finish();return;}
  status.textContent='Renderizando anexo…';frame.classList.add('rendering');
  const duration=Math.max(350,Math.min(1000,650*200/view.pref.speed));
  animation=img.animate([{clipPath:'inset(0 0 100% 0)'},{clipPath:'inset(0 0 0% 0)'}],{duration,easing:'steps(30, end)',fill:'forwards'});
  const scan=frame.querySelector('.bt-attachment-scan');if(typeof scan.animate==='function')scanAnimation=scan.animate([{top:'0%'},{top:'100%'}],{duration,easing:'linear',fill:'forwards'});
  animation.onfinish=finish;
 };
 img.onerror=()=>{if(!frame.isConnected)return;finish();frame.setAttribute('aria-busy','false');status.textContent='Imagem indisponível. Confira o caminho instalado no servidor.';};
 img.src=asset.source==='world'?asset.path:view.store.assetBase+asset.path;
}
