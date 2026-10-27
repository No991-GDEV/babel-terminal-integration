import {randomUUID} from './crypto-runtime.js';
import {ID,escapeHTML} from './core.js';
import {folderPath,documentInput,assertUniqueDocument,contentHash,packageDecision,extractJournalPages} from './management.js';
import {babel as kruger} from '../content/babel.js';
const copy=value=>structuredClone(value||{});
export const foundryManagement={
  async groups(){this.assertGM();const saved=(await this.privateConfig()).getFlag(ID,'groups')||[];return [...new Map([...this.journals().map(j=>({id:j.getFlag(ID,'document').group,name:j.getFlag(ID,'document').group})),...saved].map(g=>[g.id,g])).values()];},
  async saveGroup(name){this.assertGM();const id=folderPath(name).replaceAll('/','-');if(!id)throw new Error('Informe um nome de grupo.');const config=await this.privateConfig(),groups=(config.getFlag(ID,'groups')||[]).filter(g=>g.id!==id);groups.push({id,name:String(name).slice(0,100)});await config.setFlag(ID,'groups',groups);return id;},
  async folderCatalog(){this.assertGM();return [...new Set([...(await this.privateConfig()).getFlag(ID,'folders')||[],...this.journals().map(j=>j.getFlag(ID,'document').folder||'')])].filter(Boolean);},
  async saveFolder(path){this.assertGM();const folder=folderPath(path);if(!folder)throw new Error('Informe uma pasta.');const config=await this.privateConfig();await config.setFlag(ID,'folders',[...new Set([...(config.getFlag(ID,'folders')||[]),folder])]);return folder;},
  async backupDocument(journal){this.assertGM();const config=await this.privateConfig(),versions=copy(config.getFlag(ID,'documentBackups'));versions[journal.id]=[journal.toObject(),...(versions[journal.id]||[])].slice(0,3);await config.setFlag(ID,'documentBackups',versions);},
  async writeManaged(existing,info,meta){
    this.assertGM();const pages=[{name:info.title,type:'text',sort:100000,text:{content:info.paragraphs.map(p=>`<p>${escapeHTML(p)}</p>`).join('\n'),format:1}}];
    for(const asset of info.assets||[])pages.push({name:asset.title,type:'image',sort:(pages.length+1)*100000,src:asset.source==='world'?asset.path:`modules/${ID}/${asset.path}`});
    const documentData={...info,...meta,assetsInJournal:true};delete documentData.paragraphs;delete documentData.sourceHash;delete documentData.installedHash;delete documentData.packageHash;
    const folder=await this.nativeFolder(info.folder||'');
    if(!existing)return JournalEntry.create({name:info.title,folder,ownership:{default:0},pages,flags:{[ID]:{document:documentData}}});
    await this.backupDocument(existing);
    const oldPages=existing.pages.contents.map(p=>p.id),created=await existing.createEmbeddedDocuments('JournalEntryPage',pages);
    try{await existing.update({name:info.title,...(folder?{folder}:{}),[`flags.${ID}.document`]:documentData});await existing.deleteEmbeddedDocuments('JournalEntryPage',oldPages);}
    catch(error){throw new Error(`Gravação incompleta; cópia anterior preservada na administração privada. Confira o Journal antes de repetir. ${error.message}`);}
    // Legacy backups must not remain in a player-readable Journal flag.
    if(existing.getFlag(ID,'previousVersion'))await existing.unsetFlag(ID,'previousVersion');
    return existing;
  },
  async saveDocument(data,{id=null,reviewed=false,sourceId=null}={}){
    this.assertGM();if(sourceId&&!reviewed)throw new Error('Revise e aprove a cópia do Journal primeiro.');
    const info=documentInput(data),existing=id&&this.journal(id);if(id&&(!existing||existing.getFlag(ID,'document').trashed))throw new Error('Documento ausente.');assertUniqueDocument(await this.all(),info,id);
    if(existing&&(existing.getFlag(ID,'document').nativeJournal||existing.pages.contents.filter(p=>p.type==='text').length>1))throw new Error('Edite o conteúdo deste arquivo no Journal original.');
    const previous=existing?.getFlag(ID,'document')||{},localId=id||`local-${randomUUID()}`;
    const journal=await this.writeManaged(existing,info,{id:localId,origin:previous.origin||'local',approved:previous.approved||false,hasOwnPassword:previous.hasOwnPassword||false,localEdited:true,...(previous.references?{references:previous.references}:{}),...(previous.category?{category:previous.category}:{})});
    {const config=await this.privateConfig(),links=copy(config.getFlag(ID,'sourceLinks'));if(sourceId)links[localId]=sourceId;else delete links[localId];await config.setFlag(ID,'sourceLinks',links);}
    return localId;
  },
  async documentAccess(id){this.assertGM();const j=this.journal(id);return this.users.filter(u=>!u.isGM).map(u=>({id:u.id,name:u.name,allowed:!!j?.testUserPermission(u,'OBSERVER'),pages:j?.pages.contents.filter(p=>!p.testUserPermission||p.testUserPermission(u,'OBSERVER')).length||0,totalPages:j?.pages.contents.length||0}));},
  contactJournals(){return game.journal.filter(j=>j.getFlag(ID,'contact'));},
  async contactCatalog(){this.assertGM();return this.contactJournals().map(j=>({...j.getFlag(ID,'contact'),allowed:this.users.filter(u=>!u.isGM&&j.testUserPermission(u,'OBSERVER')).map(u=>u.id)}));},
  async saveContact(data){this.assertGM();if(!data.name?.trim())throw new Error('Informe um nome.');const entry={id:data.id||`npc-${randomUUID()}`,name:data.name.trim().slice(0,100),npc:true};const ownership={default:0,...Object.fromEntries(this.users.filter(u=>!u.isGM).map(u=>[u.id,(data.allowed||[]).includes(u.id)?2:0]))};const existing=this.contactJournals().find(j=>j.getFlag(ID,'contact').id===entry.id);if(existing)await existing.update({name:entry.name,ownership,[`flags.${ID}.contact`]:entry});else await JournalEntry.create({name:entry.name,ownership,flags:{[ID]:{contact:entry}}});return entry.id;},
  async contacts(){return [...game.users.filter(u=>u.id!==this.user.id).map(u=>({id:u.id,name:u.name})),...this.contactJournals().filter(j=>this.user.isGM||j.testUserPermission(this.user,'OBSERVER')).map(j=>j.getFlag(ID,'contact'))];},
  async identity(){return {name:this.user.name,character:this.user.character?.name||'Nenhum personagem atribuído',role:this.user.isGM?'Mestre':'Jogador'};},
  async sourceJournals(){this.assertGM();return game.journal.filter(j=>!j.getFlag(ID,'privateConfig')&&!j.getFlag(ID,'document')&&!j.getFlag(ID,'cipher')&&!j.getFlag(ID,'contact')).map(j=>({id:j.id,name:j.name}));},
  async sourcePreview(id){this.assertGM();if(!(await this.sourceJournals()).some(j=>j.id===id))throw new Error('Journal indisponível para importação.');const source=game.journal.get(id);return {title:source.name,...extractJournalPages([...source.pages.contents].sort((a,b)=>(a.sort||0)-(b.sort||0)))};},
  async sourceLink(id){this.assertGM();return (await this.privateConfig()).getFlag(ID,'sourceLinks')?.[id]||null;},
  pickImage(callback){this.assertGM();const Picker=foundry.applications.apps.FilePicker.implementation;const picker=new Picker({type:'image',callback:path=>callback({title:path.split('/').pop(),path,source:'world'})});picker.render({force:true});},
  async packageDocument(id){this.assertGM();const d=kruger.documents.find(d=>d.id===id);if(!d)throw new Error('Arquivo ausente do pacote.');return structuredClone(d);},
  async packagePreview(incoming=kruger.documents){this.assertGM();return Promise.all(incoming.map(async d=>{const j=this.journal(d.id),current=j&&{...this.toDocument(j),installedHash:j.getFlag(ID,'installedHash'),packageHash:j.getFlag(ID,'packageHash')};return {id:d.id,title:d.title,decision:(await this.privateConfig()).getFlag(ID,'tombstones')?.[d.id]?'trashed':await packageDecision(current,d)};}));},
  async setup(incoming=kruger.documents,{replace=[]}={}){
    this.assertGM();const report=[];
    for(const d of incoming){const old=this.journal(d.id),current=old&&{...this.toDocument(old),installedHash:old.getFlag(ID,'installedHash'),packageHash:old.getFlag(ID,'packageHash')},decision=(await this.privateConfig()).getFlag(ID,'tombstones')?.[d.id]?'trashed':await packageDecision(current,d);report.push(`${d.title}: ${decision==='conflict'&&replace.includes(d.id)?'substituído com backup':decision}`);if(!['create-pending','update'].includes(decision)&&!(decision==='conflict'&&replace.includes(d.id)))continue;
      const previous=old?.getFlag(ID,'document')||{},journal=await this.writeManaged(old,d,{id:d.id,origin:'package',localEdited:false,approved:previous.approved||false,hasOwnPassword:previous.hasOwnPassword||false}),hash=await contentHash(d);
      await journal.setFlag(ID,'installedHash',await contentHash(this.toDocument(journal)));await journal.setFlag(ID,'packageHash',hash);
    }return report.join('\n');
  }
};
