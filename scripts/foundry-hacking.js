import {ID,escapeHTML} from './core.js';
import {randomUUID} from './crypto-runtime.js';
import {HackingService} from './hacking-service.js';
import {advanced} from './hacking-engine.js';
import {nativeStatistic,skillLabel} from './hacking-rules.js';

let boot=randomUUID();
let mutations=Promise.resolve();
const locked=fn=>{const next=mutations.catch(()=>{}).then(fn);mutations=next.catch(()=>{});return next;};
export function hackingActor(user,expectedId){
 // Players always use their assigned character. Only a local GM may select a token.
 let actor=user.character;
 if(user.isGM){
  const selected=globalThis.game?.user?.id===user.id?(globalThis.canvas?.tokens?.controlled||[]).map(t=>t.actor).filter(Boolean):[];
  if(expectedId)actor=[actor,...selected,game.actors?.get(expectedId)].find(a=>a?.id===expectedId);
  else if(!actor){
   if(selected.length>1)throw new Error('Selecione apenas um token para testar a decifração como mestre.');
   actor=selected[0];
  }
 }
 if(!actor||!actor.testUserPermission(user,'OWNER'))throw new Error(user.isGM?'Para testar como mestre, vincule uma ficha SF2e à sua conta ou selecione um token.':'O mestre precisa atribuir à sua conta um personagem que você controle.');
 return actor;
}
export function installFoundryHacking(Store){
 const oldHack=Store.prototype.hack,oldResolve=Store.prototype.resolveCipher,oldCreate=Store.prototype.createCipher,oldReceive=Store.prototype.receive;
 Object.assign(Store.prototype,{
  hackingService(){
   const store=this,authority=`${game.user.id}:${boot}`;
   return new HackingService({
    authority,
    assertAuthority(){if(!game.user.isGM||store.electedGM?.id!==game.user.id||authority!==`${game.user.id}:${boot}`)throw new Error('Aguarde o mestre responsável pela sessão.');},
    user:id=>game.users.get(id),
    actor:hackingActor,
    canRead(c,user){return !!store.cipherJournals().find(j=>j.getFlag(ID,'cipher').id===c.id)?.testUserPermission(user,'OBSERVER');},
    validate(actor,rule){if(game.system.id!=='sf2e')throw new Error('Este desafio exige uma ficha SF2e.');nativeStatistic(actor,rule);},
    transaction:fn=>locked(async()=>{
     const config=await store.privateConfig(),records=structuredClone(config.getFlag(ID,'ciphers')||{}),before=JSON.stringify(records);
     const result=await fn(records);
     if(before!==JSON.stringify(records))await config.setFlag(ID,'ciphers',records);
     return result;
    }),
    async roll(user,rule,support,actorId){
     const actor=this.actor(user,actorId),stat=nativeStatistic(actor,rule),action=support?'babel-support':rule.category==='decipher'?'decipher-writing':'hack';
     const roll=await stat.check.roll({dc:{value:rule.dc},action,extraRollOptions:[`action:${action}`],title:`Babel / ${support?'Apoio':'Decifração'} / ${rule.title}`,skipDialog:false,createMessage:false});
     if(!roll)return null;
     const result={degree:roll.degreeOfSuccess,total:roll.total,formula:roll.formula,die:roll.dice?.[0]?.total,dc:rule.dc,actor:actor.name,skill:rule.skill};
     // A private roll receipt is informational; persistence is completed by the service.
     try{await roll.toMessage?.({flavor:escapeHTML(`Babel / ${skillLabel(rule.skill)} / ${support?'apoio próprio de Babel':'condições da tentativa'}`),whisper:[...new Set([user.id,...game.users.filter(u=>u.isGM).map(u=>u.id)])]});}catch(e){console.warn('Babel: recibo de rolagem indisponível',e);}
     return result;
    }
   });
  },
  async hackingAction(operation,data={}){
   if(!this.gmOnline)throw new Error('Mestre desconectado. A sessão será retomada com confirmação dele.');
   if(this.user.isGM)return this.hackingService().act(this.user.id,operation,data);
   return this.request('hack-request',{operation,data});
  },
  hackingDisconnected(){boot=randomUUID();},
  async hackingTick(){if(this.electedGM?.id!==game.user.id||!game.journal.find(j=>j.getFlag(ID,'privateConfig')))return;await this.hackingService().tick();},
  async hack(id){const c=(await this.ciphers()).find(c=>c.id===id);if(c&&(c.mode==='puzzle'||c.collaborative))return this.hackingAction('prepare',{cipherId:id});return oldHack.call(this,id);},
  async resolveCipher(userId,id){
   // Also enforce this on the GM: a forged legacy request cannot bypass the puzzle.
   const c=(await this.privateConfig()).getFlag(ID,'ciphers')?.[id];
   if(c&&advanced(c))return this.hackingService().act(userId,'prepare',{cipherId:id});
   return locked(()=>oldResolve.call(this,userId,id));
  },
  createCipher(data){return locked(()=>oldCreate.call(this,data));},
  resetCipher(id){return locked(async()=>{
   this.assertGM();
   const config=await this.privateConfig(),records=structuredClone(config.getFlag(ID,'ciphers')||{});
   if(!records[id])throw new Error('Arquivo indisponível.');
   records[id].attempts=Object.fromEntries(Object.keys(records[id].attempts||{}).map(key=>[key,[]]));
   records[id].preparations=Object.fromEntries(Object.keys(records[id].preparations||{}).map(key=>[key,null]));
   await config.setFlag(ID,'ciphers',records);
  });},
  async receive(message){
   const kind=message.getFlag(ID,'kind');
   if(kind==='hack-result'){
    if(!message.author?.isGM||!message.whisper.includes(this.user.id))return;
    let r;try{r=this.decode(message);}catch{return;}
    const p=this.pending.get(r.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(r.id);r.error?p.reject(new Error(r.error)):p.resolve(r.value);return;
   }
   if(kind!=='hack-request')return oldReceive.call(this,message);
   if(this.electedGM?.id!==this.user.id||!message.author||!message.whisper.includes(this.user.id))return;
   this.hackMessages??=new Set();if(this.hackMessages.has(message.id))return;this.hackMessages.add(message.id);
   try{
    let data;try{data=this.decode(message);}catch{return;}
    if(typeof data.id!=='string'||data.id.length>80)return;
    const result={id:data.id};
    try{if(Date.now()-message.timestamp>60000)throw new Error('Solicitação expirada. Use status para recuperar a sessão.');result.value=await this.hackingService().act(message.author.id,data.operation,data.data);}catch(e){result.error=e.message;}
    await ChatMessage.create({content:escapeHTML(JSON.stringify(result)),whisper:[message.author.id],flags:{[ID]:{kind:'hack-result'}}});
    await message.delete();
   }finally{this.hackMessages.delete(message.id);}
  }
 });
}
