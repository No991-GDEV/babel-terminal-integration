import test from 'node:test';
import assert from 'node:assert/strict';
import {FoundryStore} from '../scripts/foundry-store.js';
import {sealText,publicCipher} from '../scripts/cipher.js';

async function fixture(degree=2){
 const record={id:'cifra-test',title:'Arquivo de teste',dc:20,maxAttempts:1,skill:'computers',attempts:{},...await sealText('SENHA FICCIONAL')};
 const calls=[];const roll={degreeOfSuccess:degree,total:24,formula:'1d20 + 12',dice:[{total:12}],toMessage:async data=>calls.push({message:data})};
 const actor={id:'actor-1',name:'Personagem A',testUserPermission:(u,p)=>u.id==='a'&&p==='OWNER',getStatistic:slug=>slug==='computers'?{check:{roll:async args=>{calls.push({roll:args});return roll;}}}:null};
 const users=[{id:'gm',isGM:true,active:true},{id:'a',isGM:false,active:true,character:actor},{id:'b',isGM:false,active:true}];
 users.contents=users;users.get=id=>users.find(u=>u.id===id);
 const journals=[{getFlag:(_,key)=>key==='cipher'?publicCipher(record):undefined,testUserPermission:(u,p)=>u.id==='a'&&p==='OBSERVER'}];
 globalThis.game={user:users[0],users,journal:journals,system:{id:'sf2e'}};
 const flags={ciphers:{'cifra-test':record}},config={getFlag:(_,key)=>flags[key],setFlag:async(_,key,value)=>{flags[key]=value;}};
 const store=new FoundryStore();store.privateConfig=async()=>config;
 return {store,record,users,actor,calls,flags,roll};
}
test('Foundry adapter contract: assigned actor native Computers is rolled by GM; result whispered only to player and GMs',async()=>{
 const f=await fixture();const result=await f.store.resolveCipher('a','cifra-test');assert.equal(result.text,'SENHA FICCIONAL');
 assert.equal(f.calls[0].roll.dc.value,20);assert.equal(f.calls[0].roll.createMessage,false);assert.equal(f.calls[0].roll.action,'hack');
 assert.deepEqual(f.calls[1].message.whisper,['a','gm']);assert.ok(!JSON.stringify(f.calls).includes('SENHA FICCIONAL'));
 const cached=await f.store.resolveCipher('a','cifra-test');assert.equal(cached.cached,true);assert.equal(f.calls.length,2);
});
test('Foundry adapter contract: unauthorized users and missing character/statistic never roll',async()=>{
 const f=await fixture();await assert.rejects(f.store.resolveCipher('b','cifra-test'),/indisponível/);
 f.users[1].character=null;await assert.rejects(f.store.resolveCipher('a','cifra-test'),/atribuir/);
 f.users[1].character=f.actor;f.actor.getStatistic=()=>null;await assert.rejects(f.store.resolveCipher('a','cifra-test'),/Computers/);assert.equal(f.calls.length,0);
});
test('Foundry adapter contract: failure never returns text; repeated failures do not farm rolls',async()=>{
 const f=await fixture(1);const result=await f.store.resolveCipher('a','cifra-test');assert.equal(result.text,undefined);
 await assert.rejects(f.store.resolveCipher('a','cifra-test'),/esgotadas/);assert.equal(f.calls.length,2);
 await f.store.resetCipher('cifra-test');await f.store.resolveCipher('a','cifra-test');assert.equal(f.calls.length,4);
});
test('Foundry adapter contract: no compatible system or degree means no fabricated success',async()=>{
 const f=await fixture();game.system.id='pf2e';await assert.rejects(f.store.resolveCipher('a','cifra-test'),/SF2e/);assert.equal(f.calls.length,0);
 game.system.id='sf2e';f.roll.degreeOfSuccess=null;await assert.rejects(f.store.resolveCipher('a','cifra-test'),/resultado completo/);assert.deepEqual(f.flags.ciphers['cifra-test'].attempts,{});
});

test('Recovered success without WebCrypto uses assigned actor, no token selection, no second roll/attempt',async()=>{
 const f=await fixture();f.record.attempts[f.actor.id]=[{degree:2,total:24,formula:'1d20 + 12',die:12,dc:20,actor:f.actor.name}];
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto'),native=globalThis.crypto;
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues:a=>native.getRandomValues(a)}});
 try{const result=await f.store.resolveCipher('a','cifra-test');assert.equal(result.cached,true);assert.equal(result.text,'SENHA FICCIONAL');assert.equal(f.calls.length,0);assert.equal(f.record.attempts[f.actor.id].length,1);}
 finally{Object.defineProperty(globalThis,'crypto',descriptor);}
});

test('GM direct trial needs no delivery, uses native assigned actor and keeps player attempts separate',async()=>{
 const f=await fixture();f.users[0].character=f.actor;
 f.actor.testUserPermission=()=>true;
 const ownershipCheck=game.journal[0].testUserPermission;
 const result=await f.store.hack('cifra-test');
 assert.equal(result.text,'SENHA FICCIONAL');assert.equal(result.gmTest,true);
 assert.deepEqual(f.calls[1].message.whisper,['gm']);
 assert.equal(f.flags.ciphers['cifra-test'].attempts['actor-1'],undefined);
 assert.equal(f.flags.ciphers['cifra-test'].attempts['gm:gm:actor-1'].length,1);
 assert.equal((await f.store.hack('cifra-test')).cached,true);assert.equal(f.calls.length,2);
 const player=await f.store.resolveCipher('a','cifra-test');assert.equal(player.cached,undefined);assert.equal(player.text,'SENHA FICCIONAL');
 assert.equal(f.calls.length,4);assert.equal(game.journal[0].testUserPermission,ownershipCheck);
 await assert.rejects(f.store.resolveCipher('b','cifra-test'),/indisponível/);
});

test('GM token fallback is explicit, rejects ambiguous selection and never supplies a player actor',async()=>{
 const f=await fixture(),previous=globalThis.canvas;f.actor.testUserPermission=()=>true;
 try{
  globalThis.canvas={tokens:{controlled:[]}};
  await assert.rejects(f.store.hack('cifra-test'),/vincule.*ou selecione um token/);
  assert.equal(f.calls.length,0);
  canvas.tokens.controlled=[{actor:f.actor},{actor:{...f.actor,id:'second'}}];
  await assert.rejects(f.store.hack('cifra-test'),/apenas um token/);
  canvas.tokens.controlled=[{actor:f.actor}];
  f.users[1].character=null;
  await assert.rejects(f.store.resolveCipher('a','cifra-test'),/atribuir/);
  assert.equal((await f.store.hack('cifra-test')).gmTest,true);assert.equal(f.calls.length,2);
 }finally{globalThis.canvas=previous;}
});
