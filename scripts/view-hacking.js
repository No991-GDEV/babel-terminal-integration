import {hackingScreen} from './hacking-screen.js';
import {escapeHTML as h} from './core.js';
import {RANKS,skillLabel} from './hacking-rules.js';
import {DEGREE_LABELS} from './cipher.js';
import {SUPPORT_NAMES,EFFECTS} from './hacking-engine.js';

const phaseLabel={preparing:'Preparação',rolling:'Aguardando a rolagem',ready:'Pronto para iniciar',running:'Decifração em andamento',paused:'Sessão pausada',solved:'Texto recuperado',failed:'Tentativa encerrada'};
const timeText=ms=>`${Math.floor(Math.max(0,Math.ceil(ms/1000))/60)}:${String(Math.max(0,Math.ceil(ms/1000))%60).padStart(2,'0')}`;
const button=(cmd,label)=>`<button type="button" data-cmd="${h(cmd)}">${h(label)}</button>`;
export function installViewHacking(View){
 const draw=View.prototype.draw,start=View.prototype.start,destroy=View.prototype.destroy,admin=View.prototype.cipherAdmin,list=View.prototype.cipherList,run=View.prototype.run,escape=View.prototype.escape;
 Object.assign(View.prototype,{
  draw(...args){this.finishGameBoot?.(false);this.shell?.classList.remove('bt-game-active');this.hackScreen=false;return draw.apply(this,args);},
  async start(){await start.call(this);this.hackTimer=setInterval(()=>this.pollHacking(),1000);this.hackTimer.unref?.();},
  destroy(){this.finishGameBoot?.(false);clearInterval(this.hackTimer);return destroy.call(this);},
  async escape(event){
   if(this.finishGameBoot){event.preventDefault();event.stopPropagation();this.finishGameBoot(true);return;}
   if(this.hackScreen&&this.shell.classList.contains('bt-game-active')){event.preventDefault();event.stopPropagation();await this.navigate('ciphers');return;}
   return escape.call(this,event);
  },
  async gameBoot(){
   if(this.pref.reduce||!this.pref.effects||this.pref.speed===0)return true;
   this.draw('<section class="bt-game-boot" aria-label="Preparando a memória"><div class="bt-label">BABEL / DECODER</div><h2>Inicializando memória</h2><pre aria-hidden="true">&gt; MOUNT LOCAL BUFFER\n&gt; ISOLATE ENCRYPTED BLOCK\n&gt; PREPARE WORD ARRAY</pre><div class="bt-boot-progress" aria-hidden="true"><span></span></div><p>O relógio ainda não começou. <kbd>Esc</kbd> pula a animação.</p></section>');
   this.shell.classList.add('bt-game-active');this.beep();
   return new Promise(resolve=>{const timer=setTimeout(()=>this.finishGameBoot?.(true),650);this.finishGameBoot=proceed=>{clearTimeout(timer);this.finishGameBoot=null;resolve(proceed);};});
  },
  async run(text){const wasPending=!!this.pending;await run.call(this,text);if(!wasPending&&['help','ajuda'].includes(text.trim().toLowerCase())&&!this.pending){this.output.insertAdjacentHTML('beforeend',`<h3>HACKING / REGRAS PRÓPRIAS DE BABEL</h3><dl class="bt-help"><div><dt>john arquivo.enc</dt><dd>preparar ou recuperar tentativa</dd></div><div><dt>begin / start</dt><dd>rolar a ficha / iniciar o relógio após ler as instruções</dd></div><div><dt>guess PALAVRA</dt><dd>palpite; Tab completa as candidatas do puzzle aberto</dd></div><div><dt>status / status list</dt><dd>atualizar sessão / listar sessões autorizadas</dd></div><div><dt>assist / session N</dt><dd>ver convites / abrir sessão pelo número exibido</dd></div><div><dt>aid N</dt><dd>apoiar com a abordagem numerada</dd></div><div><dt>pause / resume / time 30</dt><dd>mestre: pausar, retomar ou ajustar segundos</dd></div></dl><p class="bt-muted">Palpites e cronômetro pertencem ao puzzle. Cada puzzle usa uma tentativa principal. Apoiar não concede acesso ao texto.</p>`);}},
  async cipherList(){await list.call(this);this.output.insertAdjacentHTML('beforeend',`<div class="bt-toolbar">${button('assist','SESSÕES E APOIOS')}</div><p class="bt-muted">assist — convites e tentativas em andamento${this.store.user.isGM?' · pause / resume / time: controle do mestre':''}</p>`);},
  collectSupports(form){
   const supports=[...form.querySelectorAll('.bt-support-rule')].filter(row=>row.querySelector('[data-support-enabled]').checked).map(row=>({title:row.querySelector('[data-support-title]').value,skill:row.querySelector('[data-support-skill]').value,dc:+row.querySelector('[data-support-dc]').value,minRank:+row.querySelector('[data-support-rank]').value,effect:row.querySelector('[data-support-effect]').value}));
   return {supports,supporters:[...form.querySelectorAll('[name=supporter]:checked')].map(el=>el.value)};
  },
  async cipherAdmin(){
   await admin.call(this);const form=this.output.querySelector('.bt-encrypt'),skills=await this.store.hackingSkills();if(!form||!this.output.contains(form))return;
   form.querySelector('fieldset legend').insertAdjacentHTML('afterend',`<label>Resolução<select name="resolution"><option value="direct">Rolagem direta</option><option value="puzzle">Rolagem + minigame de palavras</option></select></label><p class="bt-muted">No minigame, a ficha define as condições iniciais. Até uma falha permite tentar o puzzle.</p>`);
   form.querySelector('[type=submit]').insertAdjacentHTML('beforebegin',`<fieldset class="bt-support-config"><legend>APOIOS OPCIONAIS / REGRA DE BABEL</legend><p class="bt-muted">Até três aliados por tentativa; uma rolagem por aliado. Na rolagem direta, apenas Análise. Convites permitem ver título e preparação, nunca o conteúdo recuperado.</p><div class="bt-support-rules"></div><button type="button" data-add-support>ADICIONAR ABORDAGEM</button><h4>Quem pode apoiar?</h4>${this.store.users.filter(u=>!u.isGM).map(u=>`<label class="bt-row"><input type="checkbox" name="supporter" value="${h(u.id)}">${h(u.name)}</label>`).join('')}</fieldset>`);
   const add=form.querySelector('[data-add-support]');
   const addRule=()=>{
    const host=form.querySelector('.bt-support-rules'),index=host.children.length;if(index>=8)return;
    host.insertAdjacentHTML('beforeend',`<fieldset class="bt-support-rule"><legend>Abordagem ${index+1}</legend><label class="bt-row"><input type="checkbox" data-support-enabled>Usar esta abordagem</label><label>Descrição<input data-support-title maxlength="120" placeholder="Ex.: identificar padrões da cifra"></label><div class="bt-editor-grid"><label>Perícia<select data-support-skill>${skills.map(s=>`<option value="${h(s.id)}" ${s.id==='computers'?'selected':''}>${h(s.name)}</option>`).join('')}</select></label><label>Efeito<select data-support-effect><option value="analysis">Análise / CD principal</option><option value="time">Tempo / segundos</option><option value="guesses">Tentativas / palpites</option></select></label><label>CD do apoio<input type="number" data-support-dc min="1" max="60" value="15"></label><label>Proficiência<select data-support-rank>${RANKS.map((r,i)=>`<option value="${i}">${h(r)}</option>`).join('')}</select></label></div></fieldset>`);
    add.disabled=host.children.length>=8;updateEffects();
   };
   const updateEffects=()=>{for(const sel of form.querySelectorAll('[data-support-effect]')){const direct=form.elements.resolution.value==='direct';for(const o of sel.options)o.disabled=direct&&o.value!=='analysis';if(direct)sel.value='analysis';}};
   add.onclick=addRule;form.elements.resolution.onchange=updateEffects;addRule();
   this.output.insertAdjacentHTML('beforeend',`<div class="bt-toolbar">${button('assist','ACOMPANHAR SESSÕES / RELÓGIOS')}</div>`);
  },
  async hackingCommand(cmd,args){
   if(cmd==='assist'||(cmd==='status'&&(args[0]==='list'||!this.hackSession)))return this.hackingSessions();
   if(cmd==='session'){
    const s=this.hackSessions?.[Number(args[0])-1];if(!s)throw new Error('Use assist e escolha o número exibido.');
    this.hackSession=s;return this.hackingCommand('status',[]);
   }
   if(!this.hackSession)throw new Error('Abra primeiro uma sessão com john arquivo.enc ou assist.');
   const data={sessionId:this.hackSession.id};let op=cmd;
   if(cmd==='guess')data.word=args.join(' ');
   if(cmd==='aid'){op='support';const a=this.hackSession.approaches[Number(args[0])-1];if(!a)throw new Error('Escolha uma abordagem numerada na sessão.');data.approachId=a.id;}
   if(cmd==='time'){if(!args.length)throw new Error('Informe segundos: time 30 ou time -30.');data.seconds=Number(args[0]);}
   if(this.hackRequestBusy&&op!=='status')throw new Error('Aguarde a confirmação desta operação. Use status para consultar.');
   this.hackRequestBusy=true;const sequence=this.sequence;
   try{if(cmd==='start'&&this.hackSession.phase==='ready'){const proceed=await this.gameBoot();if(!proceed||!this.active||sequence!==this.sequence)return;}const result=await this.store.hackingAction(op,data);if(this.active&&sequence===this.sequence)this.renderHacking(result);}
   finally{this.hackRequestBusy=false;}
  },
  async hackingSessions(){
   this.brand();const sessions=await this.store.hackingAction('list');this.hackSessions=sessions;
   this.draw(`<div class="bt-label">HACKING / SESSÕES AUTORIZADAS</div><h2>Preparação e acompanhamento</h2><p>Convites de apoio não dão acesso ao texto. Escolha uma sessão para acompanhar ou ajudar.</p>${sessions.map((s,i)=>`<div class="bt-file"><span>${String(i+1).padStart(2,'0')}</span>${button(`session ${i+1}`,`${s.title} / ${s.actor}`)}<small>${h(phaseLabel[s.phase])}</small></div>`).join('')||'<p class="bt-muted">Nenhuma sessão disponível. O hacker pode preparar uma usando john arquivo.enc.</p>'}<p class="bt-muted">session N — abrir · assist — atualizar</p><div class="bt-toolbar">${button('assist','ATUALIZAR')}${button('ciphers','ARQUIVOS CIFRADOS')}</div>`);
  },
  renderHacking(s){
   const preserveScroll=this.hackScreen&&this.hackSession?.id===s.id&&this.hackSession.phase===s.phase;const scroll=this.root.querySelector('.bt-content').scrollTop;
   this.hackSession=s;this.hackClockAt=Date.now();this.brand();this.setSection('john');const own=s.owner,gm=s.isGM;
   if(s.mode==='puzzle'&&(own||gm)&&['running','paused','solved','failed'].includes(s.phase)){
    this.draw(hackingScreen(s,this.pref));this.shell.classList.add('bt-game-active');this.hackScreen=true;this.hackLastPoll=Date.now();
    if(preserveScroll)this.root.querySelector('.bt-content').scrollTop=scroll;
    return;
   }
   const supportRows=s.supports.map(a=>{const delta=a.state==='done'?EFFECTS[a.effect][a.degree]:null;return `<div class="bt-support-result"><strong>${h(a.actor)}</strong><span>${h(a.title)} · ${h(SUPPORT_NAMES[a.effect])}</span><span>${h(a.state==='done'?`${DEGREE_LABELS[a.degree]} / ${delta>0?'+':''}${delta}`:a.state==='rolling'?'Rolagem pendente':'Cancelado ao iniciar')}</span></div>`;}).join('');
   const canSupport=!own&&!gm&&s.phase==='preparing';
   const candidates=s.candidates||[],guesses=s.guesses||[];
   this.draw(`<section class="bt-hacking" aria-label="Desafio de decifração"><div class="bt-label">${h(s.category==='decipher'?'DECIFRAÇÃO':'HACKING')} / DECODIFICADOR</div><h2>${h(s.title)}</h2>${s.gmTest?'<p class="bt-pilot">TESTE DO MESTRE · Tentativas separadas das dos jogadores.</p>':''}<p class="bt-hack-phase" role="status">${h(phaseLabel[s.phase])}</p><p>${h(s.actor)} · ${h(skillLabel(s.skill))} · ${h(RANKS[s.minRank])} · CD ${s.dc}${s.effects.analysis?` (${s.effects.analysis>0?'+':''}${s.effects.analysis} de apoio)`:''}</p>${s.approach?`<p>${h(s.approach)}</p>`:''}${s.roll?`<div class="bt-roll"><span>${h(DEGREE_LABELS[s.roll.degree])}</span><strong>${h(s.roll.total)}</strong><span>${h(s.roll.formula)} · d20 ${h(s.roll.die??'ver ficha')} · CD ${s.roll.dc}${s.roll.simulated?' · SIMULADO':''}</span></div>`:''}
    ${!s.gmTest&&['preparing','rolling'].includes(s.phase)?`<h3>APOIOS / ${s.supports.length} DE 3</h3><p class="bt-muted">O hacker pode começar sem apoio. Rolagens de apoio ainda pendentes serão canceladas ao começar.</p>`:''}${supportRows}
    ${canSupport?`<h3>ABORDAGENS AUTORIZADAS</h3>${s.approaches.map((a,i)=>`<div class="bt-file"><span>${i+1}</span>${button(`aid ${i+1}`,a.title)}<small>${h(skillLabel(a.skill))} · CD ${a.dc} · ${h(SUPPORT_NAMES[a.effect])}</small></div>`).join('')}<p class="bt-muted">aid N — apoiar uma única vez nesta tentativa. </p>`:''}
    ${s.phase==='preparing'&&own?`<div class="bt-toolbar">${button('begin','ROLAR A FICHA')}</div><p class="bt-muted">begin — encerrar apoios e rolar. O mestre confirma modificadores aplicáveis na ficha.</p>`:''}
    ${s.phase==='rolling'?'<p>Aguardando o mestre concluir ou cancelar a rolagem. Use status para atualizar; fechar o terminal não cria outra tentativa.</p>':''}
    ${['ready','running','paused'].includes(s.phase)?`<div class="bt-puzzle-meters"><div><small>TEMPO</small><strong data-hack-clock>${timeText(s.remainingMs)}</strong></div><div><small>PALPITES</small><strong>${own?`${Math.max(0,(s.budget||0)-guesses.length)} / ${s.budget}`:'HACKER'}</strong></div><div><small>APOIOS</small><strong>${s.effects.time>0?'+':''}${s.effects.time}s / ${s.effects.guesses>0?'+':''}${s.effects.guesses}</strong></div></div><p class="bt-muted">Escolha uma palavra de seis letras. Depois do palpite, verde e sublinhado indicam as posições corretas. Repetir uma palavra não gasta palpite.</p>${s.phase==='ready'?`<p>Encontre a palavra antes de acabar o tempo ou os palpites.</p><p class="bt-muted">O relógio começa após a animação de entrada. Você pode pulá-la com Esc.</p>${own?`<div class="bt-toolbar">${button('start','INICIAR PUZZLE')}</div><p class="bt-muted">start — iniciar relógio</p>`:''}`:''}${s.phase==='paused'?`<p class="bt-message">${h(s.pauseReason||'Aguarde o mestre retomar.')}</p>`:''}`:''}
    ${candidates.length&&['running','paused'].includes(s.phase)?`<div class="bt-puzzle-words" aria-label="Palavras candidatas">${candidates.map((word,i)=>`<div><span aria-hidden="true">0x${(4096+i*16).toString(16).toUpperCase()} &lt;#</span>${this.pref.mode==='cli'?`<code>${word}</code>`:`<button type="button" ${!own||s.phase!=='running'||guesses.some(g=>g.word===word)?'disabled':''} data-cmd="guess ${word}">${word}</button>`}<span aria-hidden="true">#&gt;</span></div>`).join('')}</div><p class="bt-muted">guess PALAVRA · Tab completa · status atualiza</p>`:''}
    ${guesses.length?`<h3>REGISTRO DE PALPITES</h3><ol class="bt-guess-log">${guesses.map(g=>`<li>${h(g.word)} — ${g.hit}/6 posições corretas</li>`).join('')}</ol>`:''}
    ${s.phase==='solved'?own?`<h3>CONTEÚDO RECUPERADO</h3><pre class="bt-recovered">${h(s.text)}</pre><p>Se for uma senha, use unlock.</p><div class="bt-toolbar">${button('unlock','INSERIR CREDENCIAL')}</div>`:'<p>Decifração concluída pelo operador.</p>':''}
    ${s.phase==='failed'?`<p class="bt-message">${h(s.reason||'O teste não recuperou o texto.')}</p>`:''}
    ${gm&&['ready','running','paused'].includes(s.phase)?`<div class="bt-toolbar">${button('pause','PAUSAR')}${button('resume','RETOMAR / CONFIRMAR')}${button('time 30','+30 SEGUNDOS')}${button('time -30','−30 SEGUNDOS')}</div><p class="bt-muted">pause · resume · time ±SEGUNDOS — acessibilidade e interrupções da mesa.</p>`:''}
    <div class="bt-toolbar">${button('status','ATUALIZAR SESSÃO')}${button('assist','SESSÕES / APOIOS')}${button('ciphers','ARQUIVOS')}</div><p data-hack-connection class="bt-muted" aria-live="polite"></p></section>`);
   this.hackScreen=true;this.hackLastPoll=Date.now();
   if(preserveScroll)this.root.querySelector('.bt-content').scrollTop=scroll;
  },
  async pollHacking(){
   if(!this.active)return;
   if(this.store.demo&&!this.demoTickBusy){this.demoTickBusy=true;try{await this.store.hackingTick();}catch{}finally{this.demoTickBusy=false;}}
   if(!this.hackScreen||!this.hackSession||this.hackPollBusy)return;
   const node=this.output.querySelector('.bt-hacking');if(!node)return;
   const online=this.store.demo?this.store.state.gmOnline:this.store.gmOnline;
   const clock=node.querySelector('[data-hack-clock]');
   if(clock)clock.textContent=online?timeText((this.hackSession.remainingMs||0)-(this.hackSession.phase==='running'?Date.now()-this.hackClockAt:0)):'AGUARDANDO GM';
   if(!online){node.querySelector('[data-hack-connection]').textContent='Mestre desconectado. Aguarde confirmação para retomar.';return;}
   if(Date.now()-this.hackLastPoll<3000||['failed','solved'].includes(this.hackSession.phase))return;
   this.hackPollBusy=true;this.hackLastPoll=Date.now();
   try{
    const s=await this.store.hackingAction('status',{sessionId:this.hackSession.id});
    if(!this.active||!this.hackScreen||!this.output.contains(node))return;
    const stable=value=>JSON.stringify({...value,remainingMs:0});
    if(stable(s)!==stable(this.hackSession))this.renderHacking(s);
    else{this.hackSession=s;this.hackClockAt=Date.now();node.querySelector('[data-hack-connection]').textContent='';}
   }catch(e){if(this.output.contains(node))node.querySelector('[data-hack-connection]').textContent=e.message;}
   finally{this.hackPollBusy=false;}
  }
 });
}
