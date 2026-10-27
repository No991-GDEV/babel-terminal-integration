import {escapeHTML as h} from './core.js';
import {localFile} from './virtual-paths.js';
import {filename,resolveFile} from './terminal-files.js';

export function confirmOperation(view,title,description,action,after=()=>view.admin()){
 view.store.assertGM();
 view.ask(`${title}\n\n${description}\n\nDigite confirm para confirmar ou cancel para sair.`,async answer=>{
  if(answer.trim().toLowerCase()!=='confirm')throw new Error('Operação cancelada.');
  await action();await after();
 });
 if(view.pref.mode!=='cli'){
  view.output.querySelector('.bt-panel-prompt')?.remove();
  view.output.insertAdjacentHTML('beforeend','<div class="bt-toolbar"><button type="button" data-confirm-operation>CONFIRMAR</button><button data-cmd="admin">CANCELAR</button></div>');
  view.output.querySelector('[data-confirm-operation]').onclick=()=>view.run('confirm');
 }
}
export async function lifecycleCommand(view,cmd,args){
 const s=view.store;s.assertGM();const reference=args.join(' ');
 if(cmd==='trash'&&!reference){
  const docs=await s.trashDocuments();
  view.draw(`<div class="bt-label">ADMINISTRAÇÃO / LIXEIRA</div><h2>Documentos removidos</h2>${docs.map(d=>`<div class="bt-admin-card"><b>${h(d.title)}</b><p>${h(filename(d))}</p><button data-restore-document="${h(d.id)}">RESTAURAR</button></div>`).join('')||'<p class="bt-empty">Lixeira vazia.</p>'}<p class="bt-muted">Restaurados voltam pendentes, sem acesso para jogadores.</p><p class="bt-muted">restore arquivo.txt · admin</p>`);
  for(const b of view.output.querySelectorAll('[data-restore-document]'))b.onclick=()=>restorePrompt(view,docs.find(d=>d.id===b.dataset.restoreDocument));
  return;
 }
 if(cmd==='trash'||cmd==='restore'){
  const docs=cmd==='trash'?await s.all():await s.trashDocuments(),doc=cmd==='trash'?localFile(docs,reference,view.folder||''):resolveFile(docs,reference);
  if(!doc)throw new Error('Documento indisponível.');
  return cmd==='trash'?trashPrompt(view,doc):restorePrompt(view,doc);
 }
 if(cmd==='folder'){
  const [operation,source,destination]=args;
  if(!['move','delete'].includes(operation)||!source)throw new Error('Use folder move origem destino ou folder delete pasta-vazia.');
  return folderPrompt(view,source,destination,{remove:operation==='delete'});
 }
}
export const trashPrompt=(view,doc)=>confirmOperation(view,`Mover “${doc.title}” para a lixeira?`,'O acesso dos jogadores será removido. Texto e imagens permanecem recuperáveis.',()=>view.store.trashDocument(doc.id),()=>{view.current=null;return view.home();});
export const restorePrompt=(view,doc)=>confirmOperation(view,`Restaurar “${doc.title}”?`,'O documento voltará pendente. Aprove e conceda acesso novamente quando desejar.',()=>view.store.restoreDocument(doc.id),()=>view.read(doc.id));
export async function folderPrompt(view,source,destination,options={}){
 const plan=await view.store.planFolder(source,destination,options);
 return confirmOperation(view,plan.remove?`Excluir a pasta vazia “${plan.from}”?`:`Mover “${plan.from}” para “${plan.to}”?`,
  plan.remove?'As subpastas vazias também serão removidas.':`${plan.changes.length} documento(s) serão movidos, incluindo subpastas. Permissões e grupos não mudam.\n${plan.changes.map(c=>c.title).join('\n')}`,
  ()=>view.store.changeFolder(source,destination,{...options,expected:plan}),async()=>{await view.cd('/');});
}
