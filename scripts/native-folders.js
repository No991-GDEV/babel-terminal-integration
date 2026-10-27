import {ID} from './core.js';
import {folderPath} from './management.js';

export const nativeSegments=path=>{const parts=folderPath(path).split('/').filter(Boolean);return parts.length>3?[...parts.slice(0,2),parts.slice(2).join(' / ')]:parts;};
let folderQueue=Promise.resolve();
// Native folders organize Journals only. Ownership always remains on each Journal.
export const nativeFolders={
 async nativeFolder(path='',{system=false}={}){
  this.assertGM();if(!globalThis.Folder||!game.folders)return null;
  const work=async()=>{
   const segments=system?['Babel — Sistema',path||'Administração']:['Babel',...nativeSegments(path)];let parent=null;
   for(let i=0;i<segments.length;i++){
    const key=(system?'system:':'library:')+segments.slice(0,i+1).join('/');
    let folder=game.folders.find(f=>f.type==='JournalEntry'&&f.getFlag(ID,'nativeFolder')===key);
    if(!folder)folder=await Folder.create({name:segments[i],type:'JournalEntry',folder:parent,sorting:'a',color:system?'#53574b':'#8c794d',flags:{[ID]:{nativeFolder:key,systemFolder:system}}});
    parent=folder.id;
   }return parent;
  };
  const result=folderQueue.catch(()=>{}).then(work);folderQueue=result;return result;
 },
 async organizeJournals(){
  this.assertGM();let moved=0;
  for(const journal of game.journal){
   const d=journal.getFlag(ID,'document'),internal=['privateConfig','cipher','contact'].find(k=>journal.getFlag(ID,k));
   if(!d&&!internal)continue;
   // Direct registrations keep a non-Babel folder chosen by their author.
   const existing=journal.folder?.id||journal.folder;
   if(d?.nativeJournal&&existing&&!game.folders?.get(existing)?.getFlag(ID,'nativeFolder'))continue;
   const folder=await this.nativeFolder(d?.trashed?'Recuperação':d?d.folder||'':internal==='cipher'?'Cifras':internal==='contact'?'Contatos':'Administração',{system:!!internal||!!d?.trashed});
   if(folder&&existing!==folder){if(d)await this.backupDocument(journal);await journal.update({folder});moved++;}
  }
  for(const path of await this.folderCatalog())await this.nativeFolder(path);
  return moved;
 }
};
