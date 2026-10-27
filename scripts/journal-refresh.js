import {ID} from './core.js';
export function registerJournalRefresh(getView){
 let timer;
 const changed=(journal,deleted=false)=>{
  const view=getView();if(!view?.active||!view.current||journal?.getFlag(ID,'document')?.id!==view.current.id)return;
  const id=view.current.id;
  const unavailable=deleted||journal.getFlag(ID,'document').trashed||(!view.store.user.isGM&&(!journal.getFlag(ID,'document').approved||!journal.testUserPermission(view.store.user,'OBSERVER')));
  if(unavailable){view.cancelPrompt();view.home().catch(console.warn);return;}
  clearTimeout(timer);
  timer=setTimeout(async()=>{
   if(!view.active||view.current?.id!==id)return;
   // Do not discard an unsaved form, command prompt or image being inspected.
   if(view.pending||view.output.querySelector('form.bt-editor,.bt-attachment-frame')||!view.output.querySelector('[data-reader-document]'))return;
   const scroll=view.root.querySelector('.bt-content').scrollTop,open=view.output.querySelector('[data-document-controls]')?.open;
   try{await view.read(id);view.skip();const controls=view.output.querySelector('[data-document-controls]');if(controls)controls.open=!!open;view.root.querySelector('.bt-content').scrollTop=scroll;}catch{await view.home();}
  },120);
 };
 Hooks.on('updateJournalEntry',j=>changed(j));
 Hooks.on('deleteJournalEntry',j=>changed(j,true));
 for(const event of ['createJournalEntryPage','updateJournalEntryPage','deleteJournalEntryPage'])Hooks.on(event,p=>changed(p.parent));
}
