import {randomUUID} from './crypto-runtime.js';
import {ID,escapeHTML} from './core.js';

async function prepare(store,data){
 const contacts=await store.contacts(),valid=[...contacts,store.user];
 if(!Array.isArray(data.to)||!data.to.length||data.to.some(id=>!valid.some(c=>c.id===id))||!data.subject?.trim()||!data.body?.trim())throw new Error('Informe destinatário disponível, assunto e mensagem.');
 if(data.body.length>30000||data.subject.length>160)throw new Error('Mensagem muito longa.');
 const sender=store.user.isGM&&data.senderId?(await store.contactCatalog()).find(c=>c.id===data.senderId):null;
 if(store.user.isGM&&data.senderId&&!sender)throw new Error('Remetente não cadastrado.');
 const attachments=[];
 for(const a of data.attachments||[]){const doc=await store.get(a.id);if(!doc)throw new Error('Anexo indisponível.');if(a.grant&&store.user.isGM&&!doc.approved)throw new Error('Aprove o documento antes de conceder acesso.');attachments.push({id:a.id,grant:!!a.grant&&store.user.isGM});}
 return {to:[...new Set(data.to)],subject:data.subject,body:data.body,sender:sender?.name||(store.user.isGM?data.sender:undefined)||store.user.name,senderId:sender?.id||store.user.id,attachments,replyTo:data.replyTo};
}
export const demoMail={async send(data){
 const body=await prepare(this,data),mail={...body,id:randomUUID(),author:this.user.id,time:Date.now()};
 this.state.mail.push(mail);this.save();
 for(const a of body.attachments)if(a.grant)for(const id of body.to)if(this.users.some(u=>u.id===id))await this.access(a.id,id,true);
 return mail;
}};
export const foundryMail={
 async mails(){return game.messages.filter(m=>m.getFlag(ID,'kind')==='mail'&&m.isContentVisible&&(this.user.isGM||m.author?.id===this.user.id||m.whisper.includes(this.user.id))).map(m=>{const d=this.decode(m);return {...d,id:m.id,author:m.author.id,time:m.timestamp,sender:m.author.isGM?(d.sender||m.author.name):m.author.name,senderId:m.author.isGM?(d.senderId||m.author.id):m.author.id,to:Array.isArray(d.to)?d.to:[]};});},
 async send(data){
  const body=await prepare(this,data),recipients=body.to.filter(id=>game.users.get(id));
  const message=await ChatMessage.create({content:escapeHTML(JSON.stringify(body)),whisper:[...new Set([...recipients,...game.users.filter(u=>u.isGM).map(u=>u.id)])],flags:{[ID]:{kind:'mail'}}});
  try{for(const a of body.attachments)if(a.grant)for(const id of recipients)await this.access(a.id,id,true);}catch{throw new Error('Mensagem enviada, mas a liberação do anexo falhou. Confira as permissões.');}
  return message;
 }
};
