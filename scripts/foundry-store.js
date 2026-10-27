import {journalData,journalSourceMethods} from './journal-source.js';
import {nativeFolders} from './native-folders.js';
import {credentialMethods} from './credentials.js';
import {installStorageMaintenance} from './world-maintenance.js';
import {journalPageMethods} from './journal-pages.js';
import {documentLifecycle} from './document-lifecycle.js';
import {randomUUID} from './crypto-runtime.js';
import {foundryMail} from './mail-management.js';
import {installFoundryHacking,hackingActor} from './foundry-hacking.js';
import {attemptKey} from './hacking-engine.js';
import {foundryManagement} from './foundry-management.js';
import {ID,digest,passwordRecord,matchesPassword,eligibleForCredential,updateDecision,escapeHTML} from './core.js';
import {sealText,unsealText,publicCipher,validateCipher,attemptAvailable} from './cipher.js';
import {nativeStatistic,skillLabel,actorSkillOptions} from './hacking-rules.js';
import {filename} from './terminal-files.js';

// World data is deliberately separate from module files and release artifacts.
let configCreation=null;
export class FoundryStore {
  constructor(){this.user=game.user;this.users=game.users.contents;this.assetBase=`modules/${ID}/`;this.queue=Promise.resolve();this.pending=new Map();}
  get gmOnline(){return game.users.some(u=>u.isGM&&u.active);}
  get electedGM(){return game.users.filter(u=>u.isGM&&u.active).sort((a,b)=>a.id.localeCompare(b.id))[0];}
  journals(){return game.journal.filter(j=>j.getFlag(ID,'document'));}
  toDocument(j){const d=j.getFlag(ID,'document');return {...d,sourceHash:j.getFlag(ID,'sourceHash'),...journalData(j,this.user,d)};}
  async list(){return this.journals().filter(j=>!j.getFlag(ID,'document').trashed&&(this.user.isGM||(j.getFlag(ID,'document').approved&&j.testUserPermission(this.user,'OBSERVER')))).map(j=>this.toDocument(j));}
  async all(){this.assertGM();return this.journals().filter(j=>!j.getFlag(ID,'document').trashed).map(j=>this.toDocument(j));}
  async get(id){return (await this.list()).find(d=>d.id===id);}
  journal(id){return this.journals().find(j=>j.getFlag(ID,'document').id===id);}
  assertGM(){if(!game.user.isGM)throw new Error('Apenas o mestre pode alterar permissões.');}
  async privateConfig(){
    this.assertGM();let journal=game.journal.find(j=>j.getFlag(ID,'privateConfig'));
    if(!journal){configCreation??=this.nativeFolder('Administração',{system:true}).then(folder=>JournalEntry.create({name:'Babel — Administração privada',folder,ownership:{default:0},flags:{[ID]:{privateConfig:true,credentials:{}}}}));try{journal=await configCreation;}finally{configCreation=null;}}
    if(journal.ownership.default!==0||Object.entries(journal.ownership).some(([id,level])=>id!=='default'&&level>0&&!game.users.get(id)?.isGM))throw new Error('A configuração privada possui permissões indevidas. Corrija antes de continuar.');
    return journal;
  }
  async configure(target,password){
    this.assertGM();if(!target.startsWith('doc:')&&!target.startsWith('group:'))throw new Error('Destino de credencial inválido.');
    const config=await this.privateConfig();const credentials=structuredClone(config.getFlag(ID,'credentials')||{});credentials[target]=await passwordRecord(password);
    await config.setFlag(ID,'credentials',credentials);
    if(target.startsWith('doc:')){const j=this.journal(target.slice(4));if(!j||j.getFlag(ID,'document').trashed)throw new Error('Documento ausente.');await j.setFlag(ID,'document',{...j.getFlag(ID,'document'),hasOwnPassword:true});}
  }
  async approve(id){this.assertGM();const j=this.journal(id);if(!j||j.getFlag(ID,'document').trashed)throw new Error('Documento ausente.');await j.setFlag(ID,'document',{...j.getFlag(ID,'document'),approved:true});}
  async access(id,userId,grant){this.assertGM();const j=this.journal(id);if(!j||j.getFlag(ID,'document').trashed||!game.users.get(userId))throw new Error('Documento ou jogador inválido.');if(grant&&!j.getFlag(ID,'document').approved)throw new Error('Aprove o documento antes de conceder acesso.');await j.update({[`ownership.${userId}`]:grant?2:0});}
  async unlock(password){
    if(!this.gmOnline)throw new Error('Mestre desconectado. Nenhum acesso foi alterado.');
    if(this.user.isGM)return this.verifyCredential(this.user.id,password);
    return this.request('access-request',{password});
  }
  async request(kind,payload){
    if(!this.gmOnline)throw new Error('Mestre desconectado. Nenhuma operação foi iniciada.');
    const id=randomUUID();
    // The payload is whispered in the native content field, not broadcast in flags or a socket.
    // In-world passphrases are not account credentials. The request is deleted after handling.
    const result=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Sem confirmação do mestre. Consulte seu acervo antes de repetir. Uma tentativa já processada pode ser recuperada.'));},45000);this.pending.set(id,{resolve,reject,timer});});
    try{await ChatMessage.create({content:escapeHTML(JSON.stringify({id,...payload})),whisper:game.users.filter(u=>u.isGM).map(u=>u.id),flags:{[ID]:{kind}}});}catch(error){const p=this.pending.get(id);clearTimeout(p?.timer);this.pending.delete(id);throw error;}
    return result;
  }
  async verifyCredential(userId,password){
    this.assertGM();if(typeof password!=='string'||password.length<4||password.length>200)throw new Error('Credencial não reconhecida.');
    const credentials=(await this.privateConfig()).getFlag(ID,'credentials')||{};
    const fingerprint=await digest(password);const unlocked=new Set();let matched=false;
    for(const [target,record]of Object.entries(credentials))if(record&&(!record.fingerprint||record.fingerprint===fingerprint)&&await matchesPassword(password,record)){
      matched=true;
      const docs=this.journals().filter(j=>eligibleForCredential(j.getFlag(ID,'document'),target));
      for(const j of docs){const id=j.getFlag(ID,'document').id;if(!unlocked.has(id))await this.access(id,userId,true);unlocked.add(id);}
    }
    if(matched)return unlocked.size;
    throw new Error('Credencial não reconhecida.');
  }
  decode(message){const el=document.createElement('div');el.innerHTML=message.content;return JSON.parse(el.textContent);}
  async receive(message){
    const kind=message.getFlag(ID,'kind');
    if(['access-result','cipher-result'].includes(kind)&&message.author?.isGM&&message.whisper.includes(this.user.id)){
      const result=this.decode(message),pending=this.pending.get(result.id);if(!pending)return;clearTimeout(pending.timer);this.pending.delete(result.id);result.error?pending.reject(new Error(result.error)):pending.resolve(kind==='cipher-result'?result.value:result.count);return;
    }
    if(!['access-request','cipher-request'].includes(kind)||this.electedGM?.id!==this.user.id)return;
    // Use the persisted native author, never an ID supplied in the request payload.
    this.queue=this.queue.catch(()=>{}).then(async()=>{
      let data;try{data=this.decode(message);}catch{return;}
      if(!message.author||typeof data.id!=='string'||data.id.length>80||!message.whisper.includes(this.user.id))return;
      const result={id:data.id};
      try{if(Date.now()-message.timestamp>60000)throw new Error('Solicitação expirada; envie novamente.');if(kind==='cipher-request')result.value=await this.resolveCipher(message.author.id,data.cipherId);else result.count=await this.verifyCredential(message.author.id,data.password);}catch(error){result.error=error.message;}
      await ChatMessage.create({content:escapeHTML(JSON.stringify(result)),whisper:[message.author.id],flags:{[ID]:{kind:kind==='cipher-request'?'cipher-result':'access-result'}}});
      await message.delete();
    });
  }
  async contacts(){return game.users.filter(u=>u.id!==this.user.id).map(u=>({id:u.id,name:u.isGM?`${u.name} / contatos de cena`:u.name}));}
  async mails(){return game.messages.filter(m=>m.getFlag(ID,'kind')==='mail'&&m.isContentVisible&&(this.user.isGM||m.author?.id===this.user.id||m.whisper.includes(this.user.id))).map(m=>{const data=this.decode(m);return {...data,id:m.id,author:m.author.id,time:m.timestamp,sender:m.author.isGM?(data.sender||m.author.name):m.author.name,to:m.whisper.filter(id=>!game.users.get(id)?.isGM||data.to.includes(id))};});}
  async send(data){
    if(!data.to?.length||data.to.some(id=>!game.users.get(id))||!data.subject?.trim()||!data.body?.trim())throw new Error('Informe destinatário, assunto e mensagem.');
    if(data.body.length>30000||data.subject.length>160)throw new Error('Mensagem muito longa. Limite: 30 mil caracteres; assunto: 160.');
    const attachments=[];
    for(const a of data.attachments||[]){const doc=await this.get(a.id);if(!doc)throw new Error('Anexo indisponível.');if(a.grant&&this.user.isGM&&!doc.approved)throw new Error('Aprove o documento antes de anexá-lo com liberação.');attachments.push({id:a.id,grant:!!a.grant&&this.user.isGM});}
    const body={to:data.to,subject:data.subject,body:data.body,sender:this.user.isGM?data.sender:this.user.name,attachments,replyTo:data.replyTo};
    const message=await ChatMessage.create({content:escapeHTML(JSON.stringify(body)),whisper:[...new Set([...data.to,...game.users.filter(u=>u.isGM).map(u=>u.id)])],flags:{[ID]:{kind:'mail'}}});
    try{for(const a of attachments)if(a.grant)for(const id of data.to)await this.access(a.id,id,true);}catch{throw new Error('Mensagem enviada, mas a liberação do anexo falhou. Confira as permissões pelo painel do mestre.');}
    return message;
  }
  async personal(key,value){if(value!==undefined)await game.user.setFlag(ID,key,value);return game.user.getFlag(ID,key);}
  cipherJournals(){return game.journal.filter(j=>j.getFlag(ID,'cipher'));}
  async ciphers(){return this.cipherJournals().filter(j=>this.user.isGM||j.testUserPermission(this.user,'OBSERVER')).map(j=>publicCipher(j.getFlag(ID,'cipher')));}
  async createCipher(data){
    this.assertGM();const {text,...info}=validateCipher(data,this.users),sealed=await sealText(text),id=`cifra-${randomUUID().slice(0,8)}`;
    if((await this.ciphers()).some(c=>filename(c,'enc')===filename(info,'enc')))throw new Error('Já existe um arquivo cifrado com esse nome. Escolha outro nome.');
    const record={...info,...sealed,id,attempts:{}},config=await this.privateConfig();
    const records=structuredClone(config.getFlag(ID,'ciphers')||{});records[id]=record;
    await config.setFlag(ID,'ciphers',records);
    await JournalEntry.create({name:info.title,folder:await this.nativeFolder('Cifras',{system:true}),ownership:{default:0,...Object.fromEntries(info.recipients.map(id=>[id,2]))},flags:{[ID]:{cipher:publicCipher(record)}}});
    return publicCipher(record);
  }
  async resetCipher(id){this.assertGM();const config=await this.privateConfig(),records=structuredClone(config.getFlag(ID,'ciphers')||{});if(!records[id])throw new Error('Arquivo indisponível.');records[id].attempts={};await config.setFlag(ID,'ciphers',records);}
  async hack(id){if(this.user.isGM)return this.resolveCipher(this.user.id,id);return this.request('cipher-request',{cipherId:id});}
  async hackingSkills(){return actorSkillOptions(game.actors?.contents||this.users.map(u=>u.character).filter(Boolean));}
  async resolveCipher(userId,id){
    this.assertGM();const user=game.users.get(userId),journal=this.cipherJournals().find(j=>j.getFlag(ID,'cipher').id===id);
    if(!user||!journal||(!user.isGM&&!journal.testUserPermission(user,'OBSERVER')))throw new Error('Arquivo indisponível.');
    if(game.system.id!=='sf2e')throw new Error('Este piloto de decifração exige o sistema SF2e.');
    const actor=hackingActor(user),key=attemptKey(user,actor);
    const config=await this.privateConfig(),records=structuredClone(config.getFlag(ID,'ciphers')||{}),record=records[id];
    if(!record)throw new Error('Configuração da cifra indisponível.');
    if(attemptAvailable(record,key)==='solved')return {...record.attempts[key].find(r=>r.degree>=2),text:await unsealText(record),cached:true};
    const stat=nativeStatistic(actor,record),action=record.category==='decipher'?'decipher-writing':'hack';
    // GM runs the assigned character's native statistic. No client-supplied total or actor is trusted.
    const roll=await stat.check.roll({dc:{value:record.dc},action,extraRollOptions:[`action:${action}`],title:`Babel / Decifração / ${record.title}`,skipDialog:true,createMessage:false});
    if(!roll)throw new Error('Rolagem cancelada. Nenhuma tentativa consumida.');
    const degree=roll.degreeOfSuccess;
    if(!Number.isInteger(degree)||degree<0||degree>3||!Number.isFinite(roll.total))throw new Error('O sistema não devolveu um resultado completo. Confira o teste com o mestre.');
    const result={degree,total:roll.total,formula:roll.formula,die:roll.dice?.[0]?.total,dc:record.dc,actor:actor.name,skill:record.skill||'computers'};
    // Save before revealing anything; repeat requests cannot farm new rolls after a success.
    if(user.isGM)result.gmTest=true;
    record.attempts[key]??=[];record.attempts[key].push(result);await config.setFlag(ID,'ciphers',records);
    await roll.toMessage({flavor:escapeHTML(`Babel / ${skillLabel(record.skill)} — decifração de arquivo`),whisper:[...new Set([userId,...game.users.filter(u=>u.isGM).map(u=>u.id)])]});
    return degree>=2?{...result,text:await unsealText(record)}:result;
  }
}
Object.assign(FoundryStore.prototype,foundryManagement,documentLifecycle);
Object.assign(FoundryStore.prototype,foundryMail);
installFoundryHacking(FoundryStore);
Object.assign(FoundryStore.prototype,journalSourceMethods,journalPageMethods);
Object.assign(FoundryStore.prototype,nativeFolders,credentialMethods);
installStorageMaintenance(FoundryStore);
