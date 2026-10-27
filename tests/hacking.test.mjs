import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../scripts/hacking-engine.js';
import {challengeRules,nativeStatistic,actorSkillOptions} from '../scripts/hacking-rules.js';
import {sealText,validateCipher,attemptAvailable} from '../scripts/cipher.js';
import {HackingService} from '../scripts/hacking-service.js';
const actor={id:'a',name:'Hacker'},users=[{id:'gm',isGM:true},...['a','b','c','d','e'].map(id=>({id}))];
const cipher=()=>({id:'file',title:'Relé',mode:'puzzle',dc:20,maxAttempts:2,attempts:{},supports:[],supporters:['b','c','d','e'],recipients:['a']});
const roll=degree=>({degree,total:degree*10+8,formula:'1d20 + 12',die:8,dc:20});
function ready(degree=2){const c=cipher(),s=E.prepare(c,actor,'a',1000),t=E.beginRoll(c,s);E.finishRoll(c,s,t.token,roll(degree),1000);return {c,s};}

test('hacking rules: legacy defaults, arbitrary native Lore and minimum rank',()=>{
 assert.deepEqual(challengeRules({}),{skill:'computers',minRank:0,mode:'direct',category:'hack',approach:''});
 const stat={rank:2,check:{roll(){}}},a={getStatistic:id=>id==='babel-lore'?stat:null,skills:{'babel-lore':{label:'Babel Lore'}}};
 assert.equal(nativeStatistic(a,{skill:'babel-lore',minRank:2}),stat);assert.throws(()=>nativeStatistic(a,{skill:'babel-lore',minRank:3}),/proficiência/);
 assert.throws(()=>nativeStatistic(a,{skill:'computers'}),/nativo/);assert.throws(()=>challengeRules({skill:'__proto__'}),/inválido/);
 assert.ok(actorSkillOptions([a]).some(s=>s.id==='babel-lore'&&s.name==='Babel Lore'));
});
test('support config: explicit invitations, valid approaches, direct mode only Analysis',()=>{
 const base={title:'Arquivo',text:'Senha',dc:20,maxAttempts:1,recipients:['a'],supporters:['b'],supports:[{title:'Identificar padrão',skill:'society',dc:15,effect:'analysis'}]};
 assert.equal(validateCipher(base,users).supports[0].skill,'society');
 assert.throws(()=>validateCipher({...base,supporters:[]},users),/quem pode apoiar/);
 assert.throws(()=>validateCipher({...base,supports:[{...base.supports[0],effect:'time'}]},users),/somente/);
 assert.throws(()=>validateCipher({...base,supporters:['gm']},users),/Aliado/);
});
test('all support effects and limits match the approved guide',()=>{
 assert.deepEqual(E.EFFECTS,{time:[-30,-15,30,60],guesses:[-2,-1,1,2],analysis:[2,1,-1,-2]});
 for(const effect of Object.keys(E.EFFECTS))for(let degree=0;degree<4;degree++){
  const s={supports:[{state:'done',effect,roll:roll(degree)}]};assert.equal(E.totals(s)[effect],E.EFFECTS[effect][degree]);
 }
 assert.equal(E.totals({supports:[1,2,3].map(()=>({state:'done',effect:'analysis',roll:roll(3)}))}).analysis,-4);
 assert.equal(E.totals({supports:[1,2,3].map(()=>({state:'done',effect:'analysis',roll:roll(0)}))}).analysis,4);
 for(const [degree,supportDegree,budget,seconds]of [[0,0,2,45],[3,3,8,300]]){
  const c=cipher(),s=E.prepare(c,actor,'a');s.supports=[{state:'done',effect:'guesses',roll:roll(supportDegree)},...Array.from({length:2},()=>({state:'done',effect:'time',roll:roll(supportDegree)}))];
  const t=E.beginRoll(c,s);E.finishRoll(c,s,t.token,roll(degree));assert.equal(s.budget,budget);assert.equal(s.remainingMs,seconds*1000);
 }
});
test('support reserves once per ally and actor, never self, maximum three',()=>{
 const c=cipher(),s=E.prepare(c,actor,'a');c.supports=[{id:'one',skill:'society',effect:'analysis',dc:15}];
 assert.throws(()=>E.reserveSupport(c,s,actor,'a','one'),/própria/);
 E.reserveSupport(c,s,{id:'b',name:'B'},'b','one');
 assert.throws(()=>E.reserveSupport(c,s,{id:'b',name:'B'},'c','one'),/já apoiou/);
 assert.throws(()=>E.reserveSupport(c,s,{id:'different'},'b','one'),/já apoiou/);
 E.reserveSupport(c,s,{id:'c'},'c','one');E.reserveSupport(c,s,{id:'d'},'d','one');
 assert.throws(()=>E.reserveSupport(c,s,{id:'e'},'e','one'),/Três/);
 E.beginRoll(c,s);assert.ok(s.supports.every(a=>a.state==='cancelled'));
});
test('four roll degrees produce independent, unique six-letter puzzles; no premature victory',()=>{
 assert.equal(E.WORDS.length,new Set(E.WORDS).size);assert.ok(E.WORDS.every(w=>/^[A-Z]{6}$/.test(w)));
 for(let degree=0;degree<4;degree++){
  const {c,s}=ready(degree),profile=E.PROFILES[degree];
  assert.equal(s.phase,'ready');assert.equal(E.isSolved(s),false);assert.equal(attemptAvailable(c,'a'),'ready');
  assert.equal(s.candidates.length,profile.count);assert.equal(new Set(s.candidates).size,profile.count);assert.ok(s.candidates.includes(s.answer));
  assert.equal(s.budget,profile.guesses);assert.equal(s.remainingMs,profile.seconds*1000);assert.equal(c.attempts.a.length,1);assert.equal(c.preparations.a,null);
  const publicData=E.publicSession(c,s,true);assert.ok(!('answer'in publicData));assert.ok(!('key'in publicData));assert.ok(!('text'in publicData));
  assert.equal(E.prepare(c,actor,'a').id,s.id);
 }
});
test('cancelled native roll consumes no main attempt; stale token never finishes one',()=>{
 const c=cipher(),s=E.prepare(c,actor,'a'),t=E.beginRoll(c,s);assert.equal(E.beginRoll(c,s),false);
 assert.equal(E.finishRoll(c,s,'fake',roll(3)),false);assert.equal(s.phase,'rolling');
 E.finishRoll(c,s,t.token,null);assert.equal(s.phase,'preparing');assert.deepEqual(c.attempts,{});
});
test('duplicate guesses are free, last guess may win, close/reload retains state',()=>{
 const {c,s}=ready(0);E.startPuzzle(s,'gm',1000);
 const wrong=s.candidates.find(w=>w!==s.answer);E.guess(s,wrong,'gm',1100);E.guess(s,wrong,'gm',1200);assert.equal(s.guesses.length,1);
 assert.throws(()=>E.guess(s,'FAKE!!','gm',1300),/lista/);
 const reloaded=JSON.parse(JSON.stringify(c)),copy=reloaded.attempts.a[0];
 assert.equal(E.prepare(reloaded,actor,'a').id,s.id);E.guess(copy,copy.answer,'gm',1400);assert.equal(copy.phase,'solved');assert.equal(copy.guesses.length,2);
});
test('timeout, GM absence/change, pause and resume do not regenerate resources',()=>{
 const {s}=ready(0);E.startPuzzle(s,'gm',1000);E.updateClock(s,'gm',2000);const left=s.remainingMs;
 E.updateClock(s,'gm',20000);assert.equal(s.phase,'paused');assert.equal(s.remainingMs,left);
 E.controlPuzzle(s,'resume',0,'gm-2',21000);assert.equal(s.phase,'running');assert.equal(s.deadline,21000+left);
 E.controlPuzzle(s,'pause',0,'gm-2',22000);assert.equal(s.remainingMs,left-1000);
 E.controlPuzzle(s,'time',30,'gm-2',23000);assert.equal(s.remainingMs,left+29000);
 E.controlPuzzle(s,'resume',0,'gm-2',24000);E.updateClock(s,'gm-3',24001);assert.equal(s.phase,'paused');
 E.controlPuzzle(s,'time',-300,'gm-3',24002);E.controlPuzzle(s,'resume',0,'gm-3',24003);E.guess(s,s.answer,'gm-3',25004);assert.equal(s.phase,'failed');assert.equal(s.guesses.length,0);
});

async function fixture(){
 let records={file:{...cipher(),...await sealText('PRIVATE-TEXT')}};let pendingRoll=null;let authority='gm';let online=true;let lock=Promise.resolve();
 const a={get authority(){return authority;},assertAuthority(){if(!online)throw Error('GM offline');},user:id=>users.find(u=>u.id===id),actor:u=>({id:u.id,name:u.id}),canRead:(c,u)=>c.recipients.includes(u.id),validate(){},roll:async()=>pendingRoll?pendingRoll:roll(2),transaction(fn){const job=lock.catch(()=>{}).then(async()=>{const clone=structuredClone(records),out=await fn(clone);records=clone;return out;});lock=job.catch(()=>{});return job;}};
 return {service:new HackingService(a),get records(){return records;},defer(p){pendingRoll=p;},setAuthority(v){authority=v;},offline(){online=false;}};
}
test('service: only owner receives text after victory; helpers and outsiders never receive key/answer',async()=>{
 const f=await fixture(),svc=f.service,s=await svc.act('a','prepare',{cipherId:'file'});
 assert.equal(s.phase,'preparing');assert.equal((await svc.act('e','list')).length,1); // explicit supporter
 await assert.rejects(svc.act('b','prepare',{cipherId:'file'}),/indisponível/);
 const args={sessionId:s.id};await svc.act('a','begin',args);let status=await svc.act('a','status',args);assert.equal(status.phase,'ready');assert.equal(status.text,undefined);
 await assert.rejects(svc.act('b','guess',{...args,word:'ACCESS'}),/Somente/);
 await svc.act('a','start',args);const answer=f.records.file.attempts.a[0].answer;
 status=await svc.act('a','guess',{...args,word:answer});assert.equal(status.text,'PRIVATE-TEXT');assert.equal(status.phase,'solved');
 const helper=await svc.act('b','status',args);for(const field of ['text','answer','key','candidates'])assert.equal(helper[field],undefined);
 assert.equal((await svc.act('a','prepare',{cipherId:'file'})).text,'PRIVATE-TEXT');assert.equal(f.records.file.attempts.a.length,1);
 f.records.file.supporters=[];await assert.rejects(svc.act('b','status',args),/indisponível/);
});
test('service: cancel pending supports when main roll starts; late result cannot alter puzzle',async()=>{
 const f=await fixture();f.records.file.supports=[{id:'one',title:'Apoiar',skill:'society',dc:15,effect:'time'}];
 const s=await f.service.act('a','prepare',{cipherId:'file'}),args={sessionId:s.id};let resolve;
 f.defer(new Promise(r=>{resolve=r;}));const supporting=f.service.act('b','support',{...args,approachId:'one'});await new Promise(r=>setImmediate(r));
 f.defer(null);const main=await f.service.act('a','begin',args);assert.equal(main.phase,'ready');assert.equal(main.remainingMs,120000);
 resolve(roll(3));await supporting;const final=await f.service.act('a','status',args);assert.equal(final.supports[0].state,'cancelled');assert.equal(final.remainingMs,120000);
});
test('service: concurrent begin starts one roll, failed native roll restores preparation',async()=>{
 const f=await fixture(),s=await f.service.act('a','prepare',{cipherId:'file'}),args={sessionId:s.id};let resolve;f.defer(new Promise(r=>{resolve=r;}));
 const first=f.service.act('a','begin',args);await new Promise(r=>setImmediate(r));const second=await f.service.act('a','begin',args);assert.equal(second.phase,'rolling');
 resolve(null);await first;assert.equal((await f.service.act('a','status',args)).phase,'preparing');assert.deepEqual(f.records.file.attempts,{});
});
test('service: GM controls only, interrupted authority requires fresh confirmation, legacy successes survive',async()=>{
 const f=await fixture(),s=await f.service.act('a','prepare',{cipherId:'file'}),args={sessionId:s.id};await f.service.act('a','begin',args);await f.service.act('a','start',args);
 await assert.rejects(f.service.act('a','pause',args),/Somente o mestre/);
 f.setAuthority('newGM');await f.service.tick();assert.equal((await f.service.act('a','status',args)).phase,'paused');await f.service.act('gm','resume',args);assert.equal((await f.service.act('a','status',args)).phase,'running');
 f.records.file.attempts.a=[roll(2)];f.records.file.preparations={};const cached=await f.service.act('a','prepare',{cipherId:'file'});assert.equal(cached.cached,true);assert.equal(cached.text,'PRIVATE-TEXT');
 f.offline();await assert.rejects(f.service.act('a','prepare',{cipherId:'file'}),/offline/);
});
test('service: a read/decrypt error after winning preserves success for recovery without a new puzzle',async()=>{
 const f=await fixture(),svc=f.service,s=await svc.act('a','prepare',{cipherId:'file'}),args={sessionId:s.id};await svc.act('a','begin',args);await svc.act('a','start',args);
 const originalKey=f.records.file.key,answer=f.records.file.attempts.a[0].answer;f.records.file.key='broken';
 await assert.rejects(svc.act('a','guess',{...args,word:answer}),/incompleto/);assert.equal(f.records.file.attempts.a[0].phase,'solved');
 f.records.file.key=originalKey;const recovered=await svc.act('a','prepare',{cipherId:'file'});assert.equal(recovered.text,'PRIVATE-TEXT');assert.equal(f.records.file.attempts.a.length,1);assert.equal(Object.getOwnPropertySymbols(recovered).length,0);
});
test('service: direct mode with Analysis reveals on native success without a puzzle',async()=>{
 const f=await fixture();f.records.file.mode='direct';f.records.file.supports=[{id:'one',title:'Analisar',effect:'analysis',skill:'society',dc:15}];
 const s=await f.service.act('a','prepare',{cipherId:'file'}),args={sessionId:s.id};await f.service.act('b','support',{...args,approachId:'one'});
 const result=await f.service.act('a','begin',args);assert.equal(result.phase,'solved');assert.equal(result.text,'PRIVATE-TEXT');assert.equal(result.candidates.length,0);assert.equal(result.effects.analysis,-1);
});
