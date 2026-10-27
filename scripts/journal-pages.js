import {ID,digest} from './core.js';
export function legacyTextPages(journal,metadata={}){
 if(metadata.nativeJournal||!metadata.id)return [];
 const pages=[...journal.pages.contents].filter(p=>p.type==='text').sort((a,b)=>(a.sort||0)-(b.sort||0));
 if(pages.length<2||pages.some((p,i)=>p.name!==`Trecho ${i+1}`||Object.values(p.ownership||{}).some(level=>level!==-1)||p.text?.markdown||p.text?.format===2))return [];
 return pages;
}
async function snapshot(j){return digest(JSON.stringify({name:j.name,pages:j.pages.contents.map(p=>p.toObject?p.toObject():p),metadata:j.getFlag(ID,'document')}));}
export const journalPageMethods={
 async planConsolidation(id){
  this.assertGM();const j=this.journal(id);if(!j||j.getFlag(ID,'document').trashed)throw new Error('Documento indisponível.');
  const pages=legacyTextPages(j,j.getFlag(ID,'document'));if(!pages.length)throw new Error('Este Journal não possui trechos antigos elegíveis. Páginas próprias não são unidas automaticamente.');
  return {id,count:pages.length,hash:await snapshot(j)};
 },
 async consolidateJournal(id,expected){
  this.assertGM();const plan=await this.planConsolidation(id);
  if(expected?.id!==id||expected.hash!==plan.hash)throw new Error('O Journal mudou. Confira novamente antes de unir os trechos.');
  const j=this.journal(id),pages=legacyTextPages(j,j.getFlag(ID,'document'));
  await this.backupDocument(j);
  if(await snapshot(j)!==plan.hash)throw new Error('O Journal mudou durante a conferência. Nenhuma página foi unida.');
  // Preserve the original HTML, including edits, and the first page's identity.
  const content=pages.map(p=>p.text?.content||'').join('\n');
  await j.setFlag(ID,'document',{...j.getFlag(ID,'document'),localEdited:true,nativeJournal:true});
  try{
   await j.updateEmbeddedDocuments('JournalEntryPage',[{_id:pages[0].id,name:j.name,'text.content':content}]);
   await j.deleteEmbeddedDocuments('JournalEntryPage',pages.slice(1).map(p=>p.id));
  }catch(error){throw new Error(`União incompleta. A cópia anterior está preservada; confira o Journal antes de repetir. ${error.message}`);}
  return id;
 }
};
