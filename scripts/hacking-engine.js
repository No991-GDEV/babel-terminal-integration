import {randomUUID,randomBytes} from './crypto-runtime.js';
import {challengeRules,skillId} from './hacking-rules.js';

export const SUPPORT_NAMES={time:'Tempo',guesses:'Tentativas',analysis:'Análise'};
export const EFFECTS={time:[-30,-15,30,60],guesses:[-2,-1,1,2],analysis:[2,1,-1,-2]};
export const PROFILES=[{count:20,guesses:2,seconds:60},{count:16,guesses:3,seconds:90},{count:12,guesses:4,seconds:120},{count:8,guesses:6,seconds:180}];
export const WORDS=('ACCESS ACTIVE ACTION ACTUAL ADAPTS ADMITS ALARMS ALTERS ANCHOR ANIMAL ARCADE ARMORS ARRAYS ASPECT ATTACK BACKUP BINARY BLOCKS BORDER BRANCH BRIDGE BROKEN BUFFER BUTTON CABLES CAMERA CANCEL CANNON CARBON CASING CHANGE CHARGE CHECKS CHOOSE CIPHER CIRCUIT CLAIMS CLOSED CLOUDS COLDLY COLUMN COMBAT COMMIT COMMON CONFIG COPPER COUNTS CREATE CREDIT CRYPTO CUSTOM DANGER DAMAGE DECODE DELETE DEMAND DENIED DEPLOY DESIGN DEVICE DIRECT DISARM DOMAIN DOUBLE DRAFTS DRIVER EFFECT ENABLE ENERGY ENGINE ENIGMA ERRORS ESCAPE EVENTS EXPAND EXPECT EXPORT FACTOR FAILED FAMILY FIELDS FILTER FINISH FOLDER FORCED FORMAT FRAMES FUSION GUARDS GUIDES HANDLE HIDDEN IMPORT INSERT INSIDE INVOKE JACKET JOINED KERNEL LAYERS LETTER LIGHTS LINKED LISTEN LOCKED LOOKUP MAGNET MANAGE MANUAL MATRIX MEMORY METHOD MODULE MOTION NATIVE NESTED NEURAL NOTICE NUMBER OBJECT OFFSET ONLINE OPAQUE OPTION ORIGIN OUTPUT PACKET PANELS PARITY PASSED PAUSED PEOPLE PHRASE PILOTS PLAYER PLEASE POINTS PORTAL POWERS PRIMER PRINTS PRISON PROMPT PUBLIC PUZZLE RANDOM RANGES READER RECORD REDUCE REFINE REGION REJECT RELOAD REMOTE REMOVE RENDER REPAIR REPEAT REPORT RESCUE RESUME RETURN REVEAL REVOKE RITUAL ROBOTS ROLLED ROUTER SAFETY SAVING SCREEN SEARCH SECRET SECURE SELECT SENDER SENSOR SERIAL SERVER SHADOW SHARED SHIELD SIGNAL SILENT SIMPLE SOCKET SOURCE SPACES SPEECH SPIRIT SQUARE STABLE STATUS STORED STREAM STRIKE STRING STRONG SUBMIT SWITCH SYMBOL SYNTAX SYSTEM TARGET TEMPLE THREAD TIMERS TOKENS TRACES TRACKS TRAVEL TRIALS UNLOCK UPDATE UPLOAD USEFUL VALUES VERIFY VIOLET VISION VISUAL VOICES VOLUME WANTED WEAPON WINDOW WIRING WITHIN WORKER WRITER').split(' ').filter(w=>/^[A-Z]{6}$/.test(w));
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const pick=n=>{let v;const limit=Math.floor(4294967296/n)*n;do{v=new DataView(randomBytes(4).buffer).getUint32(0);}while(v>=limit);return v%n;};
export const likeness=(a,b)=>[...a].reduce((n,c,i)=>n+(c===b[i]?1:0),0);
export const isSolved=a=>a?.kind==='babel-hack'?a.phase==='solved':a?.degree>=2;
export const advanced=c=>c.mode==='puzzle'||!!c.supports?.length;
// GM trials must never reuse a player's actor budget or cached victory.
export const attemptKey=(user,actor)=>user.isGM?`gm:${user.id}:${actor.id}`:actor.id;
export function supportRules(data,users){
 const rules=challengeRules(data),supporters=[...new Set(data.supporters||[])];
 if(supporters.some(id=>!users.some(u=>u.id===id&&!u.isGM)))throw new Error('Aliado inválido.');
 if(!Array.isArray(data.supports||[])||(data.supports||[]).length>8)throw new Error('Cadastre até oito abordagens de apoio.');
 const supports=(data.supports||[]).map((s,i)=>{
  const title=String(s.title||'').trim(),dc=Number(s.dc),minRank=Number(s.minRank??0);
  if(!title||title.length>120||!Number.isInteger(dc)||dc<1||dc>60||!Number.isInteger(minRank)||minRank<0||minRank>4||!Object.hasOwn(EFFECTS,s.effect))throw new Error('Confira nome, perícia, CD, proficiência e efeito de cada apoio.');
  if(rules.mode==='direct'&&s.effect!=='analysis')throw new Error('Rolagem direta aceita somente apoio de Análise.');
  return {id:'apoio-'+(i+1),title,skill:skillId(s.skill),dc,minRank,effect:s.effect};
 });
 if(supports.length&&!supporters.length)throw new Error('Selecione quem pode apoiar.');
 return {supports,supporters};
}
export function totals(session){
 const out={time:0,guesses:0,analysis:0};
 for(const s of session.supports||[])if(s.state==='done')out[s.effect]+=EFFECTS[s.effect][s.roll.degree];
 out.analysis=clamp(out.analysis,-4,4);return out;
}
export function findSession(records,id){
 for(const c of Object.values(records))for(const s of [...Object.values(c.preparations||{}),...Object.values(c.attempts||{}).flat()])if(s?.kind==='babel-hack'&&s.id===id)return {c,s};
 throw new Error('Sessão indisponível.');
}
export function prepare(c,actor,userId,now=Date.now(),key=actor.id){
 const history=c.attempts?.[key]||[],solved=history.find(isSolved);
 if(solved)return solved;
 const running=history.find(s=>s.kind==='babel-hack'&&['ready','running','paused'].includes(s.phase));
 if(running)return running;
 c.preparations??={};if(c.preparations[key])return c.preparations[key];
 if(history.length>=c.maxAttempts)throw new Error('Tentativas esgotadas para este personagem. O mestre pode autorizar uma nova rodada.');
 const s={kind:'babel-hack',id:randomUUID(),actorId:actor.id,actor:actor.name,userId,phase:'preparing',created:now,supports:[],guesses:[]};
 if(key!==actor.id){s.attemptKey=key;s.gmTest=true;}
 c.preparations[key]=s;return s;
}
export function reserveSupport(c,s,actor,userId,approachId){
 if(s.phase!=='preparing')throw new Error('A preparação já terminou.');
 if(actor.id===s.actorId||userId===s.userId)throw new Error('O hacker não pode apoiar a própria tentativa.');
 if(!c.supporters?.includes(userId))throw new Error('Você não foi autorizado a apoiar este arquivo.');
 if(s.supports.some(a=>a.actorId===actor.id||a.userId===userId))throw new Error('Este aliado já apoiou esta tentativa.');
 if(s.supports.length>=3)throw new Error('Três aliados já participam desta tentativa.');
 const rule=c.supports?.find(a=>a.id===approachId);if(!rule)throw new Error('Abordagem indisponível.');
 const support={id:randomUUID(),actorId:actor.id,userId,actor:actor.name,title:rule.title,effect:rule.effect,state:'rolling'};
 s.supports.push(support);return {support,rule};
}
export function beginRoll(c,s){
 if(s.phase!=='preparing')return false;
 for(const a of s.supports)if(a.state==='rolling')a.state='cancelled';
 s.phase='rolling';s.rollToken=randomUUID();return {token:s.rollToken,dc:clamp(c.dc+totals(s).analysis,1,60)};
}
export function finishRoll(c,s,token,roll,now=Date.now()){
 if(s.phase!=='rolling'||s.rollToken!==token)return false;
 delete s.rollToken;
 if(!roll){s.phase='preparing';return false;}
 s.roll=roll;s.degree=roll.degree;s.mode=c.mode||'direct';
 if(s.mode==='direct')s.phase=roll.degree>=2?'solved':'failed';
 else{
  const profile=PROFILES[roll.degree],effects=totals(s),answer=WORDS[pick(WORDS.length)];
  // Seed candidates with both similar and dissimilar words; never derive them from the protected text.
  const others=WORDS.filter(w=>w!==answer),near=others.filter(w=>likeness(w,answer)>0);
  const candidates=[answer];
  while(candidates.length<profile.count){const pool=candidates.length<profile.count/2&&near.some(w=>!candidates.includes(w))?near:others;const word=pool[pick(pool.length)];if(!candidates.includes(word))candidates.push(word);}
  for(let i=candidates.length-1;i>0;i--){const j=pick(i+1);[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  Object.assign(s,{phase:'ready',answer,candidates,budget:clamp(profile.guesses+effects.guesses,2,8),remainingMs:clamp(profile.seconds+effects.time,45,300)*1000,guesses:[]});
 }
 // Null is deliberate: Foundry recursively merges object flags and would retain an omitted key.
 const key=s.attemptKey||s.actorId;
 s.rolledAt=now;c.attempts??={};c.attempts[key]??=[];c.attempts[key].push(s);c.preparations[key]=null;return true;
}
export function updateClock(s,authority,now=Date.now()){
 if(s.phase!=='running')return false;
 if(s.authority!==authority||now-(s.lastSeen||0)>12000){
  s.remainingMs=Math.max(0,s.deadline-(s.lastSeen||now));s.phase='paused';s.pauseReason='Conexão do mestre interrompida. Aguarde confirmação para retomar.';delete s.deadline;return true;
 }
 s.remainingMs=Math.max(0,s.deadline-now);s.lastSeen=now;
 if(!s.remainingMs){s.phase='failed';s.reason='Tempo esgotado.';delete s.deadline;}
 return true;
}
export function startPuzzle(s,authority,now=Date.now()){
 if(s.phase!=='ready')return;
 Object.assign(s,{phase:'running',authority,lastSeen:now,deadline:now+s.remainingMs});
}
export function guess(s,word,authority,now=Date.now()){
 updateClock(s,authority,now);if(s.phase==='solved'||s.phase==='failed')return;
 if(s.phase!=='running')throw new Error('Inicie o puzzle ou aguarde o mestre retomar.');
 word=String(word||'').trim().toUpperCase();
 if(!s.candidates.includes(word))throw new Error('Escolha uma palavra da lista.');
 if(s.guesses.some(g=>g.word===word))return;
 const hit=likeness(word,s.answer);s.guesses.push({word,hit});
 if(hit===6){s.phase='solved';delete s.deadline;}
 else if(s.guesses.length>=s.budget){s.phase='failed';s.reason='Palpites esgotados.';delete s.deadline;}
}
export function controlPuzzle(s,action,seconds,authority,now=Date.now()){
 updateClock(s,authority,now);
 if(!['ready','running','paused'].includes(s.phase))throw new Error('O puzzle não está ativo.');
 if(action==='pause'&&s.phase==='running'){s.phase='paused';s.pauseReason='Pausado pelo mestre.';delete s.deadline;}
 else if(action==='resume'&&s.phase==='paused'){s.phase='running';s.pauseReason='';s.authority=authority;s.lastSeen=now;s.deadline=now+s.remainingMs;}
 else if(action==='time'){
  if(!Number.isFinite(seconds)||Math.abs(seconds)>300)throw new Error('Ajuste entre −300 e +300 segundos.');
  s.remainingMs=clamp(s.remainingMs+seconds*1000,1000,300000);if(s.phase==='running')s.deadline=now+s.remainingMs;
 }
}
export function publicSession(c,s,owner=false,now=Date.now()){
 const out={kind:'babel-hack',id:s.id,cipherId:c.id,title:c.title,actor:s.actor,phase:s.phase,mode:c.mode||'direct',skill:c.skill||'computers',minRank:c.minRank||0,approach:c.approach||'',category:c.category||'hack',dc:c.dc,effects:totals(s),roll:s.roll?{...s.roll}:null,supports:s.supports.map(a=>({actor:a.actor,title:a.title,effect:a.effect,state:a.state,degree:a.roll?.degree})),approaches:(c.supports||[]).map(a=>({...a})),remainingMs:s.phase==='running'?Math.max(0,s.deadline-now):s.remainingMs,pauseReason:s.pauseReason,reason:s.reason};
 if(s.gmTest)out.gmTest=true;
 if(owner){
  out.candidates=[...(s.candidates||[])];
  // Only attempted words get positional hints. Never send the answer or future word masks.
  out.guesses=(s.guesses||[]).map(g=>({...g,matches:typeof s.answer==='string'?[...g.word].map((letter,i)=>letter===s.answer[i]):undefined}));
  out.budget=s.budget;
 }
 return out;
}
