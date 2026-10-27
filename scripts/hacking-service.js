import * as E from './hacking-engine.js';
import {unsealText} from './cipher.js';
const recovery=Symbol('GM-only recovery record');

// All mutations are short transactions; native roll dialogs run outside the lock.
// The adapter supplies the authenticated user, assigned actor, private persistence and native roll.
export class HackingService {
 constructor(adapter){this.a=adapter;}
 async reply(c,s,user){
  if(s.kind!=='babel-hack')return {...s,cached:true,[recovery]:c};
  const owner=s.userId===user.id,out=E.publicSession(c,s,owner||user.isGM);
  out.owner=owner;out.isGM=!!user.isGM;
  if(owner&&s.phase==='solved')out[recovery]=c;
  return out;
 }
 async reveal(out){
  const record=out[recovery];delete out[recovery];
  if(record)out.text=await unsealText(record);
  return out;
 }
 authorize(c,s,user){
  if(user.isGM)return;
  if(s.gmTest)throw new Error('Sessão de teste reservada ao mestre.');
  if(s.userId===user.id){if(!this.a.canRead(c,user)||this.a.actor(user).id!==s.actorId)throw new Error('Arquivo ou personagem indisponível.');return;}
  if(!c.supporters?.includes(user.id))throw new Error('Sessão indisponível.');
 }
 async act(userId,operation,data={}){
  const user=this.a.user(userId);if(!user)throw new Error('Usuário indisponível.');
  if(!['prepare','list','status','begin','support','start','guess','pause','resume','time'].includes(operation))throw new Error('Operação inválida.');
  let reservation;
  const first=await this.a.transaction(async records=>{
   this.a.assertAuthority();
   if(operation==='list'){
    const out=[];
    for(const c of Object.values(records))for(const s of [...Object.values(c.preparations||{}),...Object.values(c.attempts||{}).flat()]){
     if(s?.kind!=='babel-hack'||['solved','failed'].includes(s.phase))continue;
     if(s.gmTest&&!user.isGM)continue;
     if(user.isGM||(s.userId===user.id&&this.a.canRead(c,user))||(c.supporters?.includes(user.id)&&s.userId!==user.id))out.push(await this.reply(c,s,user));
    }
    return out;
   }
   let c,s;
   if(operation==='prepare'){
    c=records[data.cipherId];
    if(!c||(!user.isGM&&!this.a.canRead(c,user)))throw new Error('Arquivo indisponível.');
    const actor=this.a.actor(user);
    s=E.prepare(c,actor,user.id,Date.now(),E.attemptKey(user,actor));
    if(s.kind!=='babel-hack')return this.reply(c,s,user);
   }else({c,s}=E.findSession(records,data.sessionId));
   this.authorize(c,s,user);
   E.updateClock(s,this.a.authority);
   const owner=s.userId===user.id;
   if(['begin','start','guess'].includes(operation)&&!owner)throw new Error('Somente o hacker pode resolver esta tentativa.');
   if(['pause','resume','time'].includes(operation)&&!user.isGM)throw new Error('Somente o mestre pode controlar o relógio.');
   if(operation==='begin'){
    const actor=this.a.actor(user,s.actorId);
    if(actor.id!==s.actorId)throw new Error('Use o personagem que iniciou esta tentativa.');
    this.a.validate(actor,c);
    const ticket=E.beginRoll(c,s);
    if(ticket){s.rollAuthority=this.a.authority;reservation={...ticket,sessionId:s.id,actorId:actor.id,rule:{...c,dc:ticket.dc},main:true};}
   }
   if(operation==='support'){
    const actor=this.a.actor(user),rule=c.supports?.find(r=>r.id===data.approachId);
    if(!rule)throw new Error('Abordagem indisponível.');this.a.validate(actor,rule);
    const ticket=E.reserveSupport(c,s,actor,user.id,data.approachId);ticket.support.authority=this.a.authority;
    reservation={token:ticket.support.id,sessionId:s.id,rule:ticket.rule,main:false};
   }
   if(operation==='start')E.startPuzzle(s,this.a.authority);
   if(operation==='guess')E.guess(s,data.word,this.a.authority);
   if(['pause','resume','time'].includes(operation))E.controlPuzzle(s,operation,Number(data.seconds),this.a.authority);
   return this.reply(c,s,user);
  });
  if(!reservation)return this.reveal(first);
  let roll,error;
  try{roll=await this.a.roll(user,reservation.rule,!reservation.main,reservation.actorId);
   if(roll&&(!Number.isInteger(roll.degree)||roll.degree<0||roll.degree>3||!Number.isFinite(roll.total)))throw new Error('O sistema não devolveu um teste completo.');
  }catch(e){error=e;roll=null;}
  const final=await this.a.transaction(async records=>{
   this.a.assertAuthority();const {c,s}=E.findSession(records,reservation.sessionId);this.authorize(c,s,user);
   if(reservation.main){
    if(s.rollAuthority===this.a.authority)E.finishRoll(c,s,reservation.token,roll);
   }else{
    const support=s.supports.find(a=>a.id===reservation.token);
    if(s.phase==='preparing'&&support?.state==='rolling'&&support.authority===this.a.authority){
     if(roll){support.state='done';support.roll=roll;}
     else s.supports=s.supports.filter(a=>a!==support); // Cancelled native dialog is not a rolled support.
    }
   }
   return this.reply(c,s,user);
  });
  if(error)throw error;
  return this.reveal(final);
 }
 async tick(){
  return this.a.transaction(async records=>{
   this.a.assertAuthority();
   for(const c of Object.values(records))for(const s of [...Object.values(c.preparations||{}),...Object.values(c.attempts||{}).flat()]){
    if(s?.kind!=='babel-hack')continue;
    E.updateClock(s,this.a.authority);
    if(s.phase==='rolling'&&s.rollAuthority!==this.a.authority){s.phase='preparing';delete s.rollToken;}
    for(const a of s.supports)if(a.state==='rolling'&&a.authority!==this.a.authority)a.state='cancelled';
   }
  });
 }
}
