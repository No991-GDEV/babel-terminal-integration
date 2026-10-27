import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {FoundryStore} from '../scripts/foundry-store.js';
import {ID,escapeHTML} from '../scripts/core.js';
import {sealText,publicCipher} from '../scripts/cipher.js';
// Deliberately model Foundry's recursive flag merge, NOT object replacement.
function merge(target,source){for(const [k,v]of Object.entries(source)){if(v&&typeof v==='object'&&!Array.isArray(v)){if(!target[k]||typeof target[k]!=='object'||Array.isArray(target[k]))target[k]={};merge(target[k],v);}else target[k]=structuredClone(v);}return target;}
async function fixture(){
 globalThis.document=new JSDOM('').window.document;
 const calls=[],messages=[],record={id:'enc',title:'File',dc:20,maxAttempts:2,mode:'puzzle',skill:'ruins-lore',minRank:2,category:'decipher',recipients:['a'],supporters:['b'],supports:[{id:'one',title:'Padrões',skill:'society',dc:15,minRank:1,effect:'analysis'}],attempts:{},...await sealText('FICTIONAL-ONLY')};
 const makeActor=(id,rank)=>({id:`actor-${id}`,name:id,testUserPermission:u=>u.id===id,getStatistic:skill=>['ruins-lore','society'].includes(skill)?{rank,check:{roll:async options=>{calls.push({id,skill,options});return {degreeOfSuccess:2,total:25,formula:'1d20+15',dice:[{total:10}],toMessage:async data=>messages.push(data)};}}}:null});
 const users=[{id:'gm',isGM:true,active:true},{id:'a',character:makeActor('a',2),active:true},{id:'b',character:makeActor('b',1),active:true},{id:'c',character:makeActor('c',2),active:true}];users.contents=users;users.get=id=>users.find(u=>u.id===id);
 const flags={ciphers:{enc:record},credentials:{untouched:true}},config={ownership:{default:0},getFlag:(_,key)=>key==='privateConfig'?true:flags[key],setFlag:async(_,key,value)=>{flags[key]=merge(flags[key]||{},value);}};
 const journal={getFlag:(_,key)=>key==='cipher'?publicCipher(record):undefined,testUserPermission:u=>u.id==='a'};
 globalThis.game={user:users[0],users,journal:[config,journal],system:{id:'sf2e'}};globalThis.ChatMessage={create:async data=>{messages.push(data);}};
 const store=new FoundryStore();return {store,flags,record,users,calls,messages};
}
test('Foundry hacking: actual adapter rolls configured Lore and support, no token or double-added modifiers',async()=>{
 const f=await fixture(),s=await f.store.resolveCipher('a','enc'),args={sessionId:s.id};assert.equal(s.phase,'preparing');assert.equal(f.calls.length,0);
 await f.store.hackingService().act('b','support',{...args,approachId:'one'});const ready=await f.store.hackingService().act('a','begin',args);
 assert.equal(f.calls[0].skill,'society');assert.equal(f.calls[0].options.action,'babel-support');assert.equal(f.calls[1].skill,'ruins-lore');assert.equal(f.calls[1].options.action,'decipher-writing');assert.equal(f.calls[1].options.dc.value,19);assert.equal(f.calls[1].options.modifiers,undefined);assert.equal(f.calls[1].options.skipDialog,false);
 assert.equal(ready.phase,'ready');assert.equal(ready.text,undefined);assert.deepEqual(f.messages[0].whisper,['b','gm']);
});
test('Foundry recursive persistence: begin clears preparation, reconnect resumes same puzzle, reset invalidates old sessions',async()=>{
 const f=await fixture(),s=await f.store.resolveCipher('a','enc'),args={sessionId:s.id};await f.store.hackingService().act('a','begin',args);
 assert.equal(f.flags.ciphers.enc.preparations['actor-a'],null);assert.equal(f.flags.ciphers.enc.attempts['actor-a'].length,1);
 const next=new FoundryStore();assert.equal((await next.resolveCipher('a','enc')).id,s.id);
 await next.resetCipher('enc');await assert.rejects(next.hackingService().act('a','status',args),/indisponível/);
 assert.equal(f.flags.ciphers.enc.attempts['actor-a'].length,0);assert.deepEqual(f.flags.credentials,{untouched:true});assert.notEqual((await next.resolveCipher('a','enc')).id,s.id);
});
test('Foundry authentication: forbidden user and too-low rank cannot consume a roll',async()=>{
 const f=await fixture();await assert.rejects(f.store.resolveCipher('c','enc'),/indisponível/);const s=await f.store.resolveCipher('a','enc'),args={sessionId:s.id};
 const original=f.users[1].character;f.users[1].character={...original,getStatistic:()=>({rank:0,check:{roll(){throw Error('must not roll');}}})};
 await assert.rejects(f.store.hackingService().act('a','begin',args),/proficiência/);assert.equal(f.calls.length,0);assert.deepEqual(f.flags.ciphers.enc.attempts,{});
 f.users[1].character=original;await assert.rejects(f.store.hackingService().act('b','begin',args),/Somente/);await assert.rejects(f.store.hackingService().act('c','status',args),/indisponível/);
});
test('Foundry transport: native author determines caller; forged actor and totals are ignored; no key in response',async()=>{
 const f=await fixture();let deleted=false;
 const message={id:'msg',author:f.users[1],timestamp:Date.now(),whisper:['gm'],getFlag:()=> 'hack-request',content:escapeHTML(JSON.stringify({id:'req',operation:'prepare',data:{cipherId:'enc',userId:'gm',actorId:'cheat',degree:3,total:999}})),delete:async()=>{deleted=true;}};
 await f.store.receive(message);assert.equal(deleted,true);const result=f.store.decode(f.messages[0]);assert.equal(result.value.actor,'a');assert.equal(result.value.phase,'preparing');assert.equal(f.calls.length,0);assert.deepEqual(f.messages[0].whisper,['a']);
 for(const key of ['key','answer','text'])assert.ok(!Object.hasOwn(result.value,key));
 message.id='other';message.author=f.users[3];message.content=escapeHTML(JSON.stringify({id:'req2',operation:'status',data:{sessionId:result.value.id,userId:'a'}}));await f.store.receive(message);assert.match(f.store.decode(f.messages[1]).error,/indisponível/);
});
test('Foundry heartbeat runs independently from UI and revocation prevents text recovery',async()=>{
 const f=await fixture(),s=await f.store.resolveCipher('a','enc'),args={sessionId:s.id};await f.store.hackingService().act('a','begin',args);await f.store.hackingService().act('a','start',args);
 const stored=f.flags.ciphers.enc.attempts['actor-a'][0];stored.deadline=Date.now()-1;stored.lastSeen=Date.now()-1000;
 await f.store.hackingTick();assert.equal(f.flags.ciphers.enc.attempts['actor-a'][0].phase,'failed');
 await f.store.resetCipher('enc');const second=await f.store.resolveCipher('a','enc');await f.store.hackingService().act('a','begin',{sessionId:second.id});await f.store.hackingService().act('a','start',{sessionId:second.id});
 const answer=f.flags.ciphers.enc.attempts['actor-a'][0].answer;
 game.journal[1].testUserPermission=()=>false;await assert.rejects(f.store.hackingService().act('a','guess',{sessionId:second.id,word:answer}),/indisponível/);
});
test('Foundry short disconnect invalidates the old GM lease and requires explicit resume',async()=>{
 const f=await fixture(),s=await f.store.resolveCipher('a','enc'),args={sessionId:s.id};await f.store.hackingService().act('a','begin',args);await f.store.hackingService().act('a','start',args);
 const old=f.store.hackingService();f.store.hackingDisconnected();await assert.rejects(old.act('a','status',args),/mestre responsável/);
 await f.store.hackingTick();assert.equal((await f.store.hackingService().act('a','status',args)).phase,'paused');
 await f.store.hackingService().act('gm','resume',args);assert.equal((await f.store.hackingService().act('a','status',args)).phase,'running');
});

test('GM puzzle trial is owned by GM, isolated from recipients and recoverable after a native roll',async()=>{
 const f=await fixture(),actor=f.users[1].character;f.users[0].character=actor;
 actor.testUserPermission=()=>true;
 const s=await f.store.hack('enc'),args={sessionId:s.id};
 assert.equal(s.owner,true);assert.equal(s.gmTest,true);assert.equal(s.phase,'preparing');
 const svc=f.store.hackingService();
 assert.deepEqual(await svc.act('b','list'),[]);
 await assert.rejects(svc.act('b','status',args),/reservada ao mestre/);
 await assert.rejects(svc.act('b','support',{...args,approachId:'one'}),/reservada ao mestre/);
 await assert.rejects(svc.act('a','guess',{...args,word:'GUARDS'}),/reservada ao mestre/);
 assert.equal((await svc.act('gm','begin',args)).phase,'ready');
 assert.equal(f.calls[0].skill,'ruins-lore');assert.deepEqual(f.messages[0].whisper,['gm']);
 assert.equal(f.flags.ciphers.enc.attempts['actor-a'],undefined);
 assert.equal(f.flags.ciphers.enc.preparations['gm:gm:actor-a'],null);
 assert.equal(f.flags.ciphers.enc.attempts['gm:gm:actor-a'].length,1);
 const running=await svc.act('gm','start',args);assert.equal(running.text,undefined);assert.equal(running.answer,undefined);
 const answer=f.flags.ciphers.enc.attempts['gm:gm:actor-a'][0].answer;
 const solved=await svc.act('gm','guess',{...args,word:answer});assert.equal(solved.phase,'solved');assert.equal(solved.text,'FICTIONAL-ONLY');
 assert.equal((await new FoundryStore().hack('enc')).id,s.id);assert.equal(f.calls.length,1);
 const player=await f.store.resolveCipher('a','enc');assert.notEqual(player.id,s.id);assert.equal(player.phase,'preparing');assert.equal(player.text,undefined);
 assert.deepEqual(f.flags.ciphers.enc.recipients,['a']);assert.deepEqual(f.flags.credentials,{untouched:true});
});

test('GM token trial pins its actor during preparation and still validates native skill and rank',async()=>{
 const f=await fixture(),actor=f.users[1].character,previous=globalThis.canvas;
 actor.testUserPermission=()=>true;game.actors=new Map([[actor.id,actor]]);
 try{
  globalThis.canvas={tokens:{controlled:[{actor}]}};
  const s=await f.store.hack('enc');
  canvas.tokens.controlled=[{actor:f.users[2].character}];
  const svc=f.store.hackingService(),args={sessionId:s.id};
  const native=actor.getStatistic;actor.getStatistic=()=>({rank:0,check:{roll(){throw Error('must not roll');}}});
  await assert.rejects(svc.act('gm','begin',args),/proficiência/);assert.equal(f.calls.length,0);
  actor.getStatistic=native;
  await svc.act('gm','begin',args);assert.equal(f.calls[0].id,'a');
  assert.equal(f.flags.ciphers.enc.attempts['gm:gm:actor-a'].length,1);
 }finally{globalThis.canvas=previous;}
});
