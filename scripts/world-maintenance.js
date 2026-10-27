import {digest} from './core.js';
import {confirmOperation} from './lifecycle-view.js';

export const maintenanceMethods={
 async journalBackup(){
  this.assertGM();if(this.demo)throw new Error('A limpeza de Journals é feita no Foundry, não na prévia.');
  await game.modules?.get('babel-terminal-integration')?.api?.storageReady;
  const data={format:'babel-journals-backup-v1',world:game.world.id,created:new Date().toISOString(),journals:game.journal.map(j=>j.toObject()),folders:game.folders.filter(f=>f.type==='JournalEntry').map(f=>f.toObject())};
  return {...data,hash:await digest(JSON.stringify(data))};
 },
 async resetJournals(backup,confirmation){
  this.assertGM();if(confirmation!==`LIMPAR ${game.world.id}`)throw new Error('Confirmação incorreta.');
  if(backup?.format!=='babel-journals-backup-v1'||backup.world!==game.world.id)throw new Error('Backup de outro mundo.');
  const {hash,...data}=backup;if(await digest(JSON.stringify(data))!==hash)throw new Error('Backup incompleto. Exporte novamente.');
  const current=await this.journalBackup();
  if(JSON.stringify(current.journals)!==JSON.stringify(backup.journals)||JSON.stringify(current.folders)!==JSON.stringify(backup.folders))throw new Error('O mundo mudou depois do backup. Exporte novamente.');
  const ids=backup.journals.map(j=>j._id);if(ids.some(id=>!id||!game.journal.get(id)))throw new Error('Journals ausentes.');
  await JournalEntry.deleteDocuments(ids);return ids.length;
 },
 async restoreJournalsBackup(backup){
  this.assertGM();if(backup?.format!=='babel-journals-backup-v1'||backup.world!==game.world.id||!Array.isArray(backup.journals)||!Array.isArray(backup.folders))throw new Error('Backup inválido ou de outro mundo.');
  const {hash,...data}=backup;if(await digest(JSON.stringify(data))!==hash)throw new Error('O backup mudou ou está incompleto.');
  if((game.journal.size??game.journal.length)>0)throw new Error('Restaure somente com a aba Journals vazia. Nenhum arquivo será sobrescrito.');
  for(const f of backup.folders){const existing=game.folders.get(f._id);if(existing&&JSON.stringify(existing.toObject())!==JSON.stringify(f))throw new Error('Uma pasta mudou. Confira o conflito antes de restaurar.');}
  const pending=backup.folders.filter(f=>!game.folders.get(f._id));
  while(pending.length){const ready=pending.filter(f=>!f.folder||game.folders.get(f.folder));if(!ready.length)throw new Error('Hierarquia de pastas inválida.');for(const f of ready){await Folder.create(f,{keepId:true});pending.splice(pending.indexOf(f),1);}}
  await JournalEntry.createDocuments(backup.journals,{keepId:true});return backup.journals.length;
 }
};
function downloadBackup(backup){
 const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=`babel-${backup.world}-journals-${Date.now()}.json`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export async function maintenanceScreen(view,operation=''){
 const s=view.store;s.assertGM();view.current=null;view.brand();
 view.draw('<div class="bt-label">MESTRE / MANUTENÇÃO</div><h2>Instalação limpa do acervo</h2><p>Limpa <strong>todos os Journals do mundo aberto</strong>, inclusive os não gerenciados pelo Babel. Fichas, cenas, sistemas e correspondências são preservados. As senhas antigas e cifras ficam somente no backup.</p><p class="bt-muted">Faça também um backup completo do mundo. A exportação contém informações do mestre: guarde-a localmente e não a publique.</p><div class="bt-maintenance-actions"><button data-backup>EXPORTAR BACKUP E CONFERIR LIMPEZA</button><button data-restore-backup>RESTAURAR BACKUP DE JOURNALS</button><button data-cmd="admin">VOLTAR</button></div><p data-maintenance-feedback role="status"></p>');
 const feedback=view.output.querySelector('[data-maintenance-feedback]');
 view.output.querySelector('[data-backup]').onclick=async()=>{
  try{const backup=await s.journalBackup();downloadBackup(backup);
   view.ask(`Backup de ${backup.journals.length} Journals exportado para Downloads. Confira se o arquivo foi salvo.\nMundo: ${backup.world}\nPara retirar TODOS os Journals deste mundo, digite LIMPAR ${backup.world}. Qualquer outra resposta cancela.`,async answer=>{
    if(answer!==`LIMPAR ${backup.world}`){view.message('Limpeza cancelada.');return;}
    const count=await s.resetJournals(backup,answer);view.cancelPrompt();view.folder='';view.libraryFolder='';view.message(`${count} Journals retirados. Backup local preservado. Use import install para conferir e importar o acervo atual; os arquivos novos começam pendentes.`);
   });
  }catch(error){feedback.textContent=error.message;}
 };
 view.output.querySelector('[data-restore-backup]').onclick=()=>{
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{try{if(!input.files?.[0])return;const backup=JSON.parse(await input.files[0].text());confirmOperation(view,'Restaurar Journals deste backup?',`${backup.journals?.length||0} Journals. Somente com a aba Journals vazia; restaura texto, imagens, permissões e senhas. Mundo: ${backup.world}.`,()=>s.restoreJournalsBackup(backup),()=>maintenanceScreen(view));}catch(error){feedback.textContent=error.message;}};input.click();
 };
 if(operation){if(!['backup','restore'].includes(operation))throw new Error('Use maintenance, maintenance backup ou maintenance restore.');view.output.querySelector(operation==='backup'?'[data-backup]':'[data-restore-backup]').click();}
}
export function installStorageMaintenance(Store){
 Object.assign(Store.prototype,maintenanceMethods);
 if(Store.name==='DemoStore')return;
 for(const name of ['saveDocument','setup','saveFolder','registerJournal','changeFolder','trashDocument','restoreDocument','saveContact']){
  const original=Store.prototype[name];Store.prototype[name]=async function(...args){const result=await original.apply(this,args);await this.organizeJournals();await this.ensureCredentials();return result;};
 }
}
