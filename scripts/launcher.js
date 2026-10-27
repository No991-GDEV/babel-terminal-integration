import {ID} from './core.js';

export function hideInternalJournals(root){
 if(!root?.querySelectorAll)return;
 for(const row of root.querySelectorAll('.directory-item[data-entry-id]')){
  const journal=globalThis.game?.journal?.get(row.dataset.entryId);
  const internal=!!journal&&(['cipher','privateConfig','contact'].some(key=>journal.getFlag(ID,key))||journal.getFlag(ID,'document')?.trashed||(!globalThis.game?.user?.isGM&&journal.getFlag(ID,'document')));
  row.classList.toggle('babel-internal-journal',internal);
 }
 for(const row of root.querySelectorAll('.directory-item.folder[data-folder-id]')){
  const folder=globalThis.game?.folders?.get(row.dataset.folderId);
  row.classList.toggle('babel-internal-journal',!!folder&&(folder.getFlag(ID,'systemFolder')||!game.user.isGM&&folder.getFlag(ID,'nativeFolder')));
 }
}

export function attachJournalLauncher(app,html){
 const root=html?.[0]||html||app?.element;
 hideInternalJournals(root);
 if(!root?.querySelector||root.querySelector('[data-babel-launch]'))return;
 const button=document.createElement('button');
 button.type='button';button.dataset.babelLaunch='true';button.className='babel-journal-launch';
 button.textContent='▣ Terminal de Babel';
 button.addEventListener('click',async()=>{
  const api=game.modules.get(ID)?.api;
  if(!api){ui.notifications.warn('Babel ainda está carregando. Aguarde a inicialização do mundo.');return;}
  button.disabled=true;
  try{await api.openTerminal();}
  catch(error){console.error('Babel: falha ao abrir terminal',error);ui.notifications.error(`Babel: ${error.message}`);}
  finally{button.disabled=false;}
 });
 // Own non-growing row: the native header is a column, so percentage
 // flex-basis on the button would incorrectly reserve vertical space.
 const row=document.createElement('div');row.className='babel-journal-tools';row.append(button);
 const header=root.querySelector('.directory-header');
 if(header)header.prepend(row);else root.prepend(row);
}

export function registerJournalLauncher(){
 // Register during module evaluation: initializeUI renders before the ready hook.
 Hooks.on('renderJournalDirectory',attachJournalLauncher);
 // Also handle a directory rendered before module initialization completes.
 Hooks.once('ready',()=>{if(ui.journal?.element)attachJournalLauncher(ui.journal,ui.journal.element);});
}
