import {ID} from './core.js';
import {folderPath,assertUniqueDocument} from './management.js';

const inside=(path,root)=>path===root||path.startsWith(root+'/');
export function folderPlan(documents,catalog,source,destination,{remove=false}={}){
 const from=folderPath(source),to=folderPath(destination);
 if(!from)throw new Error('Selecione uma pasta; a raiz não pode ser alterada.');
 const paths=[...new Set([...catalog,...documents.map(d=>d.folder||'')].flatMap(p=>p.split('/').map((_,i)=>p.split('/').slice(0,i+1).join('/'))))].filter(Boolean);
 if(!paths.includes(from))throw new Error('Pasta indisponível.');
 const affected=documents.filter(d=>inside(d.folder||'',from));
 if(remove&&affected.length)throw new Error('A pasta contém documentos, inclusive na lixeira. Mova-os antes de excluir a pasta.');
 if(!remove&&(!to||inside(to,from)))throw new Error('Escolha um novo caminho fora da própria pasta.');
 if(!remove&&paths.includes(to))throw new Error('O destino já existe. Escolha outro nome para a pasta.');
 const changes=remove?[]:affected.map(d=>({id:d.id,title:d.title,from:d.folder,to:to+d.folder.slice(from.length)}));
 const next=documents.map(d=>({...d,folder:changes.find(c=>c.id===d.id)?.to??d.folder}));
 for(const d of next.filter(d=>!d.trashed))assertUniqueDocument(next.filter(d=>!d.trashed),d,d.id);
 const folders=[...new Set(paths.filter(p=>!remove||!inside(p,from)).map(p=>!remove&&inside(p,from)?to+p.slice(from.length):p))];
 return {from,to,remove,changes,folders};
}

// Soft deletion keeps Journal UUIDs/pages and private credentials. No physical file is deleted.
export const documentLifecycle={
 async setDocumentGroup(id,name){
  this.assertGM();const d=(await this.all()).find(d=>d.id===id);if(!d)throw new Error('Documento indisponível.');
  const group=await this.saveGroup(name);
  if(this.demo){Object.assign(this.state.documents.find(d=>d.id===id),{group,localEdited:true});this.save();}
  else{const j=this.journal(id);await this.backupDocument(j);await j.setFlag(ID,'document',{...j.getFlag(ID,'document'),group,localEdited:true});}
 },
 async inheritCredential(id){
  this.assertGM();if(!(await this.all()).some(d=>d.id===id))throw new Error('Documento indisponível.');
  if(this.demo){this.state.credentials['doc:'+id]=null;this.state.documents.find(d=>d.id===id).hasOwnPassword=false;this.save();}
  else{const config=await this.privateConfig(),credentials=structuredClone(config.getFlag(ID,'credentials')||{});credentials['doc:'+id]=null;await config.setFlag(ID,'credentials',credentials);const j=this.journal(id);await j.setFlag(ID,'document',{...j.getFlag(ID,'document'),hasOwnPassword:false});}
 },
 async trashDocuments(){this.assertGM();return (this.demo?this.state.documents:this.journals().map(j=>this.toDocument(j))).filter(d=>d.trashed);},
 async trashDocument(id){
  this.assertGM();
  if(this.demo){
   const d=this.state.documents.find(d=>d.id===id);if(!d)throw new Error('Documento indisponível.');if(d.trashed)return;
   this.state.documentBackups??={};this.state.documentBackups[id]=[structuredClone(d),...(this.state.documentBackups[id]||[])].slice(0,3);
   this.state.tombstones??={};this.state.tombstones[id]=true;
   Object.assign(d,{trashed:Date.now(),approved:false,access:[]});this.save();return;
  }
  const j=this.journal(id);if(!j)throw new Error('Documento indisponível.');if(j.getFlag(ID,'document').trashed)return;
  await this.backupDocument(j);
  const config=await this.privateConfig(),stones=structuredClone(config.getFlag(ID,'tombstones')||{});stones[id]=true;
  await config.setFlag(ID,'tombstones',stones);
  const ownership=Object.fromEntries([...new Set(['default',...Object.keys(j.ownership||{}),...this.users.map(u=>u.id)])].map(key=>[key,0]));
  await j.update({ownership,[`flags.${ID}.document`]:{...j.getFlag(ID,'document'),trashed:Date.now(),approved:false}});
 },
 async restoreDocument(id){
  this.assertGM();const d=(await this.trashDocuments()).find(d=>d.id===id);if(!d)throw new Error('Documento ausente da lixeira.');
  assertUniqueDocument(await this.all(),d,id);
  if(this.demo){
   const stored=this.state.documents.find(d=>d.id===id);Object.assign(stored,{trashed:null,approved:false,access:[]});
   this.state.tombstones??={};this.state.tombstones[id]=null;this.save();return;
  }
  const j=this.journal(id);await this.backupDocument(j);
  await j.setFlag(ID,'document',{...j.getFlag(ID,'document'),trashed:null,approved:false});
  const config=await this.privateConfig(),stones=structuredClone(config.getFlag(ID,'tombstones')||{});stones[id]=null;await config.setFlag(ID,'tombstones',stones);
 },
 async planFolder(source,destination,options={}){
  this.assertGM();const docs=this.demo?this.state.documents:this.journals().map(j=>this.toDocument(j));
  return folderPlan(docs,await this.folderCatalog(),source,destination,options);
 },
 async changeFolder(source,destination,options={}){
  this.assertGM();const plan=await this.planFolder(source,destination,options);
  const credentialMove=await this.planCredentialMove(plan.from,plan.to,{remove:plan.remove});
  if(options.expected&&JSON.stringify(options.expected)!==JSON.stringify(plan))throw new Error('O conteúdo da pasta mudou. Confira a prévia novamente.');
  if(this.demo){
   this.state.documentBackups??={};
   for(const change of plan.changes){const d=this.state.documents.find(d=>d.id===change.id);this.state.documentBackups[d.id]=[structuredClone(d),...(this.state.documentBackups[d.id]||[])].slice(0,3);d.folder=change.to;d.localEdited=true;}
   this.state.folders=plan.folders;this.save();await this.applyCredentialMove(credentialMove);return;
  }
  const config=await this.privateConfig(),priorFolders=structuredClone(config.getFlag(ID,'folders')||[]),snapshots=plan.changes.map(c=>({j:this.journal(c.id),change:c})).map(x=>({...x,before:structuredClone(x.j.getFlag(ID,'document'))}));
  for(const {j}of snapshots)await this.backupDocument(j);
  const applied=[];
  try{
   for(const x of snapshots){await x.j.setFlag(ID,'document',{...x.before,folder:x.change.to,localEdited:true});applied.push(x);}
   await config.setFlag(ID,'folders',plan.folders);
   await this.applyCredentialMove(credentialMove);
  }catch(error){
   let failed=false;for(const x of applied.reverse())try{await x.j.setFlag(ID,'document',x.before);}catch{failed=true;}
   if(JSON.stringify(config.getFlag(ID,'folders')||[])!==JSON.stringify(priorFolders))try{await config.setFlag(ID,'folders',priorFolders);}catch{failed=true;}
   throw new Error(`${failed?'Alteração parcial; cópias anteriores preservadas na administração privada.':'Mudança cancelada; pastas dos documentos restauradas.'} ${error.message}`);
  }
 }
};
