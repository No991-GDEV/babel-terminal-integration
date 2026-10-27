import {ID} from './core.js';
import {extractJournalPages,contentHash,documentInput,assertUniqueDocument} from './management.js';
import {legacyTextPages} from './journal-pages.js';
export function journalData(journal,user,metadata={}){
 const pages=[...journal.pages.contents].sort((a,b)=>(a.sort||0)-(b.sort||0)).filter(p=>user?.isGM||!p.testUserPermission||p.testUserPermission(user,'OBSERVER'));
 const data=extractJournalPages(pages),assets=data.assets.map((a,i)=>{
  const prefix='modules/'+ID+'/',normalized=a.path.startsWith(prefix)?{...a,path:a.path.slice(prefix.length),source:'module'}:a;
  const old=(metadata.assets||[]).find(b=>b.path===normalized.path&&b.source===normalized.source);
  return {...normalized,id:old?.id||'journal-image-'+i};
 });
 if(!metadata.assetsInJournal)for(const old of metadata.assets||[])if(!assets.some(a=>a.path===old.path&&a.source===old.source))assets.push(old);
 const legacy=legacyTextPages(journal,metadata),textPages=pages.filter(p=>p.type==='text').map(p=>({id:p.id,name:p.name,paragraphs:extractJournalPages([p]).paragraphs.flatMap(text=>text.split(/\n\s*\n/).filter(Boolean))})).filter(p=>p.paragraphs.length);
 const readerPages=legacy.length?[{id:textPages[0]?.id,name:journal.name,paragraphs:textPages.flatMap(p=>p.paragraphs)}]:textPages;
 return {title:journal.name||metadata.title,paragraphs:data.paragraphs,assets,readerPages,canConsolidate:!!user?.isGM&&legacy.length>1};
}
export const journalSourceMethods={
 async openJournal(id){
  this.assertGM();const j=this.journal(id);if(!j)throw new Error('Journal indisponível.');await j.sheet.render(true);
 },
 async registerJournal(sourceId,options,{reviewed=false,expectedHash}={}){
  this.assertGM();if(!reviewed)throw new Error('Confirme a revisão do Journal antes de registrar.');
  const source=game.journal.get(sourceId);
  if(!source||(await this.sourceJournals()).every(j=>j.id!==sourceId))throw new Error('Journal indisponível para registro.');
  const preview=await this.sourcePreview(sourceId),hash=await contentHash(preview);
  if(expectedHash!==hash)throw new Error('O Journal mudou. Carregue a prévia e revise novamente.');
  if(preview.removed)throw new Error('Este Journal contém blocos reservados. Use uma cópia revisada ou retire-os do original antes do registro direto.');
  if(source.pages.contents.some(p=>!['text','image'].includes(p.type)))throw new Error('Registro direto aceita páginas de texto e imagem. Revise os outros tipos primeiro.');
  if(source.pages.contents.some(p=>Object.values(p.ownership||{}).some(level=>level!==-1)))throw new Error('Há páginas com permissões próprias. Use uma cópia revisada ou uniformize o Journal antes do registro.');
  const info=documentInput({...options,title:source.name,paragraphs:preview.paragraphs.length?preview.paragraphs:preview.assets.length?['']:[],assets:preview.assets}),id='journal-'+source.id;
  assertUniqueDocument(await this.all(),info);
  await this.backupDocument(source);
  await source.setFlag(ID,'document',{id,group:info.group,folder:info.folder,theme:info.theme,classification:info.classification,appearance:info.appearance,origin:'journal',nativeJournal:true,assetsInJournal:true,approved:false,hasOwnPassword:false});
  return id;
 }
};
