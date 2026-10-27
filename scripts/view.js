import {readDocument,mergeJournalPrompt} from './document-reader.js';
import {installPCShell} from './pc-shell.js';
import {installRetroWorkstation} from './retro-workstation.js';
import {installStationEffects,normalizeMode} from './station-effects.js';
import {maintenanceScreen} from './world-maintenance.js';
import {renderJournalRegistration} from './journal-register-view.js';
import {attachDocumentControls,documentCommand,createFolder,renderFolderTools} from './context-controls.js';
import {localFile} from './virtual-paths.js';
import {packageCommand} from './package-browser.js';
import {revealAttachment} from './attachment-view.js';
import {installViewHacking} from './view-hacking.js';
import {lifecycleCommand} from './lifecycle-view.js';
import {RANKS,skillLabel} from './hacking-rules.js';
import {randomUUID} from './crypto-runtime.js';
import {installViewManagement} from './view-management.js';
import {parse,commands,aliases,fold,escapeHTML as h,THEMES,KRUGER_ASCII} from './core.js';
import {filename,imageFilename,resolveFile,englishMail,displayCommand,completionCandidates} from './terminal-files.js';
import {DEGREE_LABELS,cipherDisplay} from './cipher.js';

export class TerminalView {
  constructor(root, store) {
    this.root=root;this.store=store;this.theme='babel';this.history=[];this.historyIndex=0;this.current=null;this.pending=null;this.lines=[];this.active=true;this.frame=0;
    this.pref={mode:'cli',static:true,sound:false,volume:.12,speed:200,fontSize:15,effects:true,reduce:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false};
  }
  async start() {
    Object.assign(this.pref,await this.store.personal('preferences')||{});
    this.pref.mode=normalizeMode(this.pref.mode);
    this.root.innerHTML=`<section class="babel-terminal" aria-label="Terminal Babel"><header class="bt-top"><b>▣ BABEL / TERMINAL</b><small>AFTER ASHES · REDE 0.7.1</small></header><div class="bt-body"><nav class="bt-sidebar" aria-label="Navegação"><p>ESTAÇÃO PESSOAL</p><button data-cmd="ls">01 / ARQUIVOS</button><button data-cmd="mail">02 / CORREIO</button><button data-cmd="help">03 / MANUAL LOCAL</button><div class="bt-spacer"></div>${this.store.user.isGM?'<button data-cmd="admin">PAINEL DO MESTRE</button>':''}<button data-cmd="settings">AJUSTAR TERMINAL</button><small>REDE BABEL<br>ESTAÇÃO PESSOAL</small></nav><div class="bt-content"><div class="bt-brand"></div><details class="bt-session-log" hidden><summary>ÚLTIMOS COMANDOS</summary><div class="bt-history" hidden></div></details><article class="bt-output"></article></div></div><form class="bt-command" autocomplete="off"><label for="bt-input-${this.store.user.id}">babel:~ $</label><input id="bt-input-${this.store.user.id}" aria-label="Comando" spellcheck="false" placeholder="Digite help ou use a navegação"><span class="bt-cursor" aria-hidden="true">▌</span></form><footer class="bt-bottom"><span class="bt-status"></span><span>TAB completar · ↑ histórico · ESC pular animação</span></footer></section>`;
    this.shell=this.root.querySelector('.babel-terminal');this.output=this.root.querySelector('.bt-output');this.input=this.root.querySelector('.bt-command input');
    this.abort=new AbortController();const opts={signal:this.abort.signal};
    this.root.querySelector('.bt-command').addEventListener('submit',event=>{event.preventDefault();const text=this.input.value;this.input.value='';this.run(text);},opts);
    this.root.addEventListener('click',event=>{const b=event.target.closest('[data-cmd]');if(b){event.preventDefault();this.beep();this.navigate(b.dataset.cmd);}},opts);
    const hint=document.createElement('span');hint.className='bt-completion';hint.setAttribute('aria-live','polite');this.input.after(hint);
    this.input.addEventListener('input',()=>{this.completion=null;this.inputRevision=(this.inputRevision||0)+1;hint.textContent='';},opts);
    this.input.addEventListener('keydown',event=>this.key(event),opts);
    this.root.addEventListener('keydown',event=>{if(event.key==='Escape')this.escape(event);},{...opts,capture:true});
    const utilities=document.createElement('button');utilities.dataset.cmd='ciphers';utilities.textContent='04 / ARQUIVOS CIFRADOS';this.root.querySelector('.bt-spacer').before(utilities);
    this.root.querySelector('.bt-bottom > span:last-child').textContent='TAB completar · ↑ histórico · ESC cancelar / pular';
    this.updatePreferences();this.setSection('listar');await this.home();this.input.focus();
  }
  destroy(){this.active=false;this.abort?.abort();this.skip();this.audio?.close();}
  status(){const online=this.store.demo?this.store.state.gmOnline:this.store.gmOnline;this.root.querySelector('.bt-status').textContent=`${this.store.user.name.toUpperCase()} · ${online?'MESTRE DISPONÍVEL':'MESTRE AUSENTE'} · ${this.pref.mode==='cli'?'CONSOLE':'PAINEL'}`;}
  updatePreferences(){this.shell.classList.toggle('panel',this.pref.mode==='panel');this.shell.classList.toggle('cli',this.pref.mode==='cli');this.shell.classList.toggle('fx',this.pref.effects&&!this.pref.reduce);this.shell.classList.toggle('reduce',this.pref.reduce);this.shell.style.setProperty('--terminal-font-size',`${Math.max(12,Math.min(20,Number(this.pref.fontSize)||15))}px`);this.root.querySelector('.bt-session-log').open=this.pref.mode==='cli';this.status();}
  setSection(cmd){const nav={listar:'ls',navegar:'ls',buscar:'ls',ler:'ls',imagem:'ls',voltar:'ls',correio:'mail',acessar:'ls',ajuda:'help',cifras:'ciphers',analisar:'ciphers',john:'ciphers',cifrar:'ciphers',mestre:'admin',import:'admin',edit:'ls',preferencias:'settings'}[cmd];if(!nav)return;for(const b of this.root.querySelectorAll('.bt-sidebar [data-cmd]')){if(b.dataset.cmd===nav)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}}
  cancelPrompt(){this.pending=null;this.completion=null;this.inputRevision=(this.inputRevision||0)+1;if(this.input){this.input.type='text';this.input.autocomplete='off';this.input.value='';this.input.placeholder='Digite help ou use a navegação';}}
  navigate(command){this.credentialScreen=false;this.cancelPrompt();return this.run(command);}
  async escape(event){
    if(this.finishAttachment){event.preventDefault();event.stopPropagation();this.finishAttachment();return;}
    if(this.credentialScreen){event.preventDefault();event.stopPropagation();await this.navigate('ls');return;}
    if(this.pending){event.preventDefault();event.stopPropagation();this.cancelPrompt();this.message('Operação cancelada. Rascunhos de correio foram preservados.');return;}
    this.skip();
  }
  brand(theme='babel') {this.theme=theme;const t=THEMES[theme]||THEMES.babel;this.shell.style.setProperty('--accent',t.accent);this.root.querySelector('.bt-brand').innerHTML=`${theme==='kruger'?`<pre class="bt-mark" aria-label="Sol no aro mecânico">${h(KRUGER_ASCII)}</pre>`:'<pre class="bt-mark" aria-hidden="true">    ║╬║\n   ║╬╬║\n  ║╬╬╬║\n ╔══════╗\n ╚══════╝</pre>'}<div><h1>${h(t.title)}</h1><p>${h(t.subtitle)}</p></div>`;}
  draw(html,animate=false){this.skip();this.output.innerHTML=html;this.root.querySelector('.bt-content').scrollTop=0;if(animate)this.animate();}
  message(text,error=false){this.draw(`<p class="bt-message ${error?'bt-error':''}">${h(text)}</p>`);}
  beep(){if(!this.pref.sound||this.pref.reduce)return;try{const now=performance.now();if(now-(this.lastBeep||0)<65)return;this.lastBeep=now;this.audio??=new AudioContext();if(this.audio.state==='suspended')this.audio.resume();const o=this.audio.createOscillator(),g=this.audio.createGain();o.type='triangle';o.frequency.value=700+Math.random()*120;g.gain.value=Math.min(.2,this.pref.volume)*.15;o.connect(g);g.connect(this.audio.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,this.audio.currentTime+.035);o.stop(this.audio.currentTime+.04);}catch{/* Audio is an optional enhancement. */}}
  animate(){if(this.pref.reduce||this.pref.speed===0)return;const walker=document.createTreeWalker(this.output,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode()){const n=walker.currentNode;if(n.parentElement.closest('button,select,pre,label,.bt-page-nav'))continue;nodes.push([n,n.textContent]);}const total=nodes.reduce((n,[,t])=>n+t.length,0);this.animNodes=nodes;for(const [n]of nodes)n.textContent='';const start=performance.now(),duration=Math.min(4500,total/this.pref.speed*1000);const tick=now=>{if(!this.active)return;let remain=Math.floor(total*Math.min(1,(now-start)/duration));for(const [n,t]of nodes){n.textContent=t.slice(0,Math.max(0,remain));remain-=t.length;}this.beep();if(now-start<duration)this.frame=requestAnimationFrame(tick);else{this.frame=0;this.animNodes=null;}};this.frame=requestAnimationFrame(tick);}
  skip(){this.finishAttachment?.();if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;for(const [node,text]of this.animNodes||[])node.textContent=text;this.animNodes=null;}
  async key(event){
    this.beep();
    if(this.pending){if(event.key==='Tab')event.preventDefault();return;}
    if(event.key==='Tab'){event.preventDefault();await this.complete(event.shiftKey);return;}
    if(!['Shift','Control','Alt'].includes(event.key))this.completion=null;
    if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();this.historyIndex=Math.max(0,Math.min(this.history.length,this.historyIndex+(event.key==='ArrowUp'?-1:1)));this.input.value=this.history[this.historyIndex]||'';}
  }
  async complete(reverse=false){
    const value=this.input.value,revision=this.inputRevision||0;
    let cycle=this.completion;
    if(!cycle||cycle.last!==value){
      const choices=/^guess\s/i.test(value)?(this.hackScreen&&this.hackSession?.owner&&this.hackSession.phase==='running'?this.hackSession.candidates||[]:[]).filter(w=>w.startsWith(value.trim().split(/\s+/)[1]?.toUpperCase()||'')).map(w=>`guess ${w}`):await completionCandidates(value,this.store,this.current,commands,this.folder||'');
      if(!this.active||this.pending||this.input.value!==value||(this.inputRevision||0)!==revision)return;
      if(!choices.length){this.root.querySelector('.bt-completion').textContent='Sem correspondência';return;}
      cycle={choices,index:reverse?choices.length: -1};
    }
    cycle.index=(cycle.index+(reverse?-1:1)+cycle.choices.length)%cycle.choices.length;
    cycle.last=cycle.choices[cycle.index];this.completion=cycle;this.input.value=cycle.last;
    this.input.setSelectionRange(this.input.value.length,this.input.value.length);
    this.root.querySelector('.bt-completion').textContent=cycle.choices.length>1?`${cycle.index+1}/${cycle.choices.length} · Tab ↻`:'Completado';
  }
  async run(text){
    this.completion=null;
    this.inputRevision=(this.inputRevision||0)+1;
    const hint=this.root.querySelector('.bt-completion');if(hint)hint.textContent='';
    const sequence=this.sequence=(this.sequence||0)+1;
    try{
      this.skip();
      if(this.pending){const handler=this.pending;this.cancelPrompt();await handler(text);return;}
      const {cmd,args}=parse(text);if(!cmd)return;this.credentialScreen=false;this.setSection(cmd);
      const sensitive=['acessar','cifrar','passwd'].includes(cmd),safe=sensitive?`${displayCommand(cmd)} [conteúdo omitido]`:displayCommand(text);
      if(!sensitive&&['listar','navegar','buscar','ler','voltar','limpar','imagem','modo','preferencias','correio','mestre','cifras','analisar','john','cancelar','ajuda','whoami','history','edit','page','pwd','mkdir','folders','journal','import','trash','restore','folder','access','approve','grant','revoke','group','begin','start','guess','status','assist','aid','session','pause','resume','time'].includes(cmd))this.history.push(cmd==='correio'?'mail':cmd==='edit'?'edit':safe);this.historyIndex=this.history.length;
      this.lines.push(`> ${safe}`);this.lines=this.lines.slice(-3);const hist=this.root.querySelector('.bt-history');hist.hidden=false;hist.parentElement.hidden=false;hist.textContent=this.lines.join('\n');
      switch(cmd){
        case 'listar':await this.ls(args.join(' '));break;
        case 'journal':if(args[0]==='register')await renderJournalRegistration(this);else if(args[0]==='merge')await mergeJournalPrompt(this);else{this.store.assertGM();if(!this.current)throw new Error('Abra primeiro um arquivo.');await this.store.openJournal(this.current.id);}break;
        case 'page':if(!this.current)throw new Error('Abra primeiro um arquivo.');await readDocument(this,this.current.id,args.join(' ')||String((this.readerPageIndex||0)+1));break;
        case 'mkdir':await createFolder(this,args.join(' '));break;
        case 'folders':await renderFolderTools(this);break;
        case 'access':case 'approve':case 'grant':case 'revoke':case 'passwd':case 'group':await documentCommand(this,cmd,args);break;
        case 'pwd':this.message('/'+(this.folder||''));break;
        case 'import':await packageCommand(this,args);break;
        case 'navegar':await this.cd(args.join(' '));break;
        case 'edit':await this.editDocument(args.join(' '));break;
        case 'trash':case 'restore':case 'folder':await lifecycleCommand(this,cmd,args);break;
        case 'whoami':{const me=await this.store.identity();this.message(`${me.name}\n${me.role}\nPersonagem: ${me.character}${me.simulated?' (simulado)':''}`);break;}
        case 'history':this.message(this.history.map((c,i)=>`${i+1}  ${c}`).join('\n')||'Histórico vazio.');break;
        case 'buscar':await this.home(args.join(' '));break;
        case 'ler':await this.read(args.join(' '));break;
        case 'voltar':await this.home();break;
        case 'limpar':this.lines=[];hist.hidden=true;hist.parentElement.hidden=true;this.message('Tela limpa. Digite ls, mail ou help.');break;
        case 'imagem':await this.image(args.join(' '));break;
        case 'acessar':if(args.length)await this.unlock(args.join(' '));else this.ask('Digite a credencial. Ela não será incluída no histórico.',s=>this.unlock(s),true);break;
        case 'modo':if(!['cli','console','panel'].includes(args[0]))throw new Error('Use mode cli (console) ou mode panel.');this.pref.mode=normalizeMode(args[0]);await this.store.personal('preferences',this.pref);this.updatePreferences();this.message(`Modo ${this.pref.mode==='cli'?'console':'painel'} ativado.`);break;
        case 'preferencias':await this.preferences(args);break;
        case 'correio':await this.mailCommand(args);break;
        case 'mestre':await this.admin();break;
        case 'maintenance':await maintenanceScreen(this,args[0]||'');break;
        case 'cifras':await this.cipherList();break;
        case 'cifrar':await this.cipherAdmin();break;
        case 'analisar':await this.inspectCipher(args.join(' '));break;
        case 'john':await this.hack(args.join(' '));break;
        case 'begin':case 'start':case 'guess':case 'status':case 'assist':case 'aid':case 'session':case 'pause':case 'resume':case 'time':await this.hackingCommand(cmd,args);break;
        case 'cancelar':this.cancelPrompt();this.message('Nenhuma operação pendente.');break;
        case 'ajuda':this.brand();this.draw(`<div class="bt-label">REFERÊNCIA LOCAL</div><h2>Comandos do terminal</h2><dl class="bt-help"><div><dt><code>ls [pasta] / cd pasta / pwd</code></dt><dd>listar arquivos obtidos</dd></div><div><dt><code>search termo</code></dt><dd>pesquisar seu acervo</dd></div><div><dt><code>cat arquivo.txt</code></dt><dd>abrir documento</dd></div><div><dt><code>unlock</code></dt><dd>inserir credencial oculta</dd></div><div><dt><code>image anexo.png</code></dt><dd>abrir imagem do documento</dd></div><div><dt><code>ciphers</code></dt><dd>listar arquivos cifrados</dd></div><div><dt><code>analyze arquivo.enc</code></dt><dd>examinar sem gastar tentativa</dd></div><div><dt><code>john arquivo.enc</code></dt><dd>tentar decifrar</dd></div><div><dt><code>encrypt</code></dt><dd>ferramenta do mestre</dd></div><div><dt><code>mail inbox / sent / archived / draft</code></dt><dd>alternar caixa ou abrir rascunho</dd></div><div><dt><code>mail read arquivo.eml</code></dt><dd>ler mensagem</dd></div><div><dt><code>mail compose destinatário</code></dt><dd>escrever mensagem</dd></div><div><dt><code>mail reply / forward / archive / restore arquivo.eml</code></dt><dd>responder, encaminhar, arquivar ou restaurar</dd></div><div><dt><code>mode cli / mode panel</code></dt><dd>escolher modo de navegação</dd></div><div><dt><code>whoami / history</code></dt><dd>identidade conectada / histórico seguro</dd></div><div><dt><code>page next / page prev / page 2</code></dt><dd>navegar pelas páginas do documento</dd></div><div><dt><code>journal / journal register / journal merge</code></dt><dd>abrir original / registrar / unir trechos antigos (mestre)</dd></div><div><dt><code>mkdir nome / folders</code></dt><dd>criar / organizar pastas (mestre)</dd></div><div><dt><code>access / approve / grant "Jogador" / revoke "Jogador"</code></dt><dd>acessos do arquivo aberto (mestre)</dd></div><div><dt><code>passwd show / passwd folder / passwd group show</code></dt><dd>consultar e copiar senhas (mestre)</dd></div><div><dt><code>passwd / passwd group / passwd inherit</code></dt><dd>credencial individual / coletiva / herdar grupo (mestre)</dd></div><div><dt><code>group nome</code></dt><dd>usar ou criar grupo no arquivo aberto (mestre)</dd></div><div><dt><code>edit [arquivo.txt]</code></dt><dd>editor de documentos (mestre)</dd></div><div><dt><code>trash [arquivo.txt] / restore arquivo.txt</code></dt><dd>lixeira / restaurar (mestre)</dd></div><div><dt><code>folder move origem destino / folder delete pasta</code></dt><dd>mover ou excluir pasta vazia (mestre)</dd></div><div><dt><code>settings</code></dt><dd>ajustes pessoais</dd></div><div><dt><code>settings sound on / off</code></dt><dd>sons de interface</dd></div><div><dt><code>settings speed 200</code></dt><dd>caracteres/s; 0 = instantâneo</dd></div><div><dt><code>settings volume 12</code></dt><dd>porcentagem</dd></div><div><dt><code>settings font 16</code></dt><dd>tamanho em pixels</dd></div><div><dt><code>settings static on / off</code></dt><dd>estática opcional de CRT</dd></div><div><dt><code>settings effects on / off</code></dt><dd>efeitos de tela</dd></div><div><dt><code>settings motion on / off</code></dt><dd>movimentos e animações</dd></div><div><dt><code>back / clear / cancel</code></dt><dd>voltar, limpar tela ou cancelar</dd></div><div><dt><code>import [busca]</code></dt><dd>importar acervo (mestre)</dd></div><div><dt><code>admin</code></dt><dd>painel do mestre</dd></div></dl><p class="bt-muted">Tab completa · Shift+Tab retorna · ↑ consulta o histórico.</p>`);break;
        default:this.message(`Comando não reconhecido: ${cmd}. Digite help.`,true);
      }
    }catch(error){if(this.active&&sequence===this.sequence)this.message(error.message,true);}finally{if(this.active&&sequence===this.sequence&&this.pref.mode!=='panel')this.input.focus();}
  }
  ask(prompt,handler,password=false){this.message(prompt);this.pending=async answer=>{if(['cancel','cancelar'].includes(answer.toLowerCase())){if(password){await this.navigate('ls');return;}this.message('Operação cancelada.');return;}await handler(answer);};this.credentialScreen=password;this.input.type=password?'password':'text';this.input.placeholder=password?'Credencial · Esc para voltar aos arquivos':'Digite sua resposta · cancel para sair';this.input.focus();}
  async unlock(password){this.credentialScreen=true;this.message('Verificando a credencial com o mestre…');const target=this.output.firstElementChild;const n=await this.store.unlock(password);if(!this.active||!this.output.contains(target))return;this.brand('babel');this.message(`Credencial aceita. ${n} documento(s) disponível(is) para você.\nDigite ls para consultar.`);this.input.placeholder='Digite um comando';}
  async home(filter=''){this.current=null;this.brand();const docs=(await this.store.list()).filter(d=>!filter||fold(`${d.id} ${d.title} ${d.group} ${d.paragraphs.join(' ')}`).includes(fold(filter)));this.draw(`<div class="bt-label">BIBLIOTECA PESSOAL / ${docs.length} ARQUIVO(S)</div><h2>${filter?'Resultado da consulta':'Arquivos disponíveis'}</h2>${docs.map(d=>`<div class="bt-file"><span>${h(d.group.toUpperCase())}</span>${this.pref.mode==='cli'?`<pre>${h(filename(d))}\n${h(d.title)}</pre>`:`<button data-cmd="cat ${h(filename(d))}">${h(d.title)}</button>`}</div>`).join('')||'<p>Nenhum arquivo disponível nesta consulta.</p>'}<p class="bt-muted" style="margin-top:22px">Uma credencial pode abrir novos arquivos. Digite unlock para inseri-la.</p>`,true);}
  async read(id){await readDocument(this,id);}
  async image(id){const doc=this.current&&await this.store.get(this.current.id);const asset=resolveFile(doc?.assets||[],id,imageFilename);if(!asset)throw new Error('Anexo indisponível. Abra primeiro o documento que o contém.');revealAttachment(this,doc,asset);}
  async preferences(args=[]){this.brand();if(args.length){const [key,value]=args;const on=value==='on';if(key==='static')this.pref.static=on;else if(key==='som')this.pref.sound=on;else if(key==='efeitos')this.pref.effects=on;else if(key==='movimento')this.pref.reduce=!on;else if(key==='velocidade'&&Number.isFinite(+value))this.pref.speed=Math.max(0,Math.min(2000,+value));else if(key==='volume'&&Number.isFinite(+value))this.pref.volume=Math.max(0,Math.min(1,+value/100));else if(key==='fonte'&&Number.isFinite(+value))this.pref.fontSize=Math.max(12,Math.min(20,+value));else throw new Error('Ajuste inválido. Consulte help.');await this.store.personal('preferences',this.pref);this.updatePreferences();this.message('Preferência salva para você.');return;}
    if(this.pref.mode==='cli'){this.message(`Som: ${this.pref.sound?'on':'off'} · volume ${Math.round(this.pref.volume*100)}%\nVelocidade: ${this.pref.speed} caracteres/s · fonte: ${this.pref.fontSize}px\nEfeitos: ${this.pref.effects?'on':'off'} · estática: ${this.pref.static?'on':'off'}\nUse settings sound on, settings speed 0, settings font 16, settings effects off, settings static on ou mode panel.`);return;}
    this.draw(`<div class="bt-label">ESTAÇÃO PESSOAL / PREFERÊNCIAS</div><h2>Ajustar terminal</h2><p class="bt-muted">Preferências desta estação.</p><form class="bt-form bt-preferences"><fieldset><legend>LEITURA E NAVEGAÇÃO</legend><div class="bt-editor-grid"><label>Modo<select name="mode"><option value="cli" ${this.pref.mode==='cli'?'selected':''}>Console</option><option value="panel" ${this.pref.mode==='panel'?'selected':''}>Painel</option></select></label><label>Tamanho da fonte — IBM Plex Mono<input name="fontSize" type="number" min="12" max="20" value="${this.pref.fontSize}"></label></div><label>Caracteres por segundo (0 = instantâneo)<input name="speed" type="number" min="0" max="2000" value="${this.pref.speed}"></label></fieldset><fieldset><legend>SOM E TELA</legend><label class="bt-row"><input name="sound" type="checkbox" ${this.pref.sound?'checked':''}> Sons de teclas e interface</label><label>Volume<input name="volume" type="range" min="0" max="100" value="${this.pref.volume*100}"></label><label class="bt-row"><input name="effects" type="checkbox" ${this.pref.effects?'checked':''}> Linhas de tela</label><label class="bt-row"><input name="static" type="checkbox" ${this.pref.static?'checked':''}> Estática discreta de CRT</label><label class="bt-row"><input name="reduce" type="checkbox" ${this.pref.reduce?'checked':''}> Reduzir movimento e animações</label></fieldset><button>SALVAR PREFERÊNCIAS</button></form>`);
    this.output.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);this.pref={...this.pref,mode:f.get('mode'),sound:f.has('sound'),volume:+f.get('volume')/100,fontSize:Math.max(12,Math.min(20,+f.get('fontSize'))),speed:Math.max(0,Math.min(2000,+f.get('speed'))),effects:f.has('effects'),static:f.has('static'),reduce:f.has('reduce')};await this.store.personal('preferences',this.pref);this.updatePreferences();this.message('Preferências salvas.');};
  }
  async mailCommand(args){this.current=null;this.brand();const {args:normalized}=parse(`mail ${args.join(' ')}`);const [action='entrada',...reference]=normalized;let id=reference.join(' ');
    if(action==='escrever'){await this.compose(null,args.slice(1).join(' '));return;}
    if(action==='rascunho'){await this.compose(await this.store.personal('draft'));return;}
    const mails=await this.store.mails();const mail=resolveFile(mails,id,'eml');if(mail)id=mail.id;
    if(['ler','responder','encaminhar','arquivar','restaurar','desarquivar'].includes(action)&&!mail)throw new Error('Mensagem indisponível.');
    if(action==='arquivar'||action==='restaurar'||action==='desarquivar'){const archived=await this.store.personal('archived')||[];await this.store.personal('archived',action==='arquivar'?[...new Set([...archived,id])]:archived.filter(x=>x!==id));await this.mailCommand([action==='arquivar'?'arquivados':'entrada']);return;}
    if(action==='responder'){await this.compose({to:[(await this.store.contacts()).some(c=>c.id===mail.senderId)?mail.senderId:mail.author],subject:`Re: ${mail.subject}`,body:'',replyTo:mail.id});return;}
    if(action==='encaminhar'){await this.compose({to:[],subject:`Enc: ${mail.subject}`,body:`\n\n--- Mensagem encaminhada ---\n${mail.sender}\n${mail.body}`,attachments:(mail.attachments||[]).map(a=>({...a,grant:false}))});return;}
    if(action==='ler'){const read=await this.store.personal('read')||[];await this.store.personal('read',[...new Set([...read,id])]);const archived=(await this.store.personal('archived')||[]).includes(id),archiveAction=archived?'restaurar':'arquivar';this.draw(`<div class="bt-label">CORRESPONDÊNCIA / ${h(filename(mail,'eml'))}${archived?' / ARQUIVADA':''}</div><h2>${h(mail.subject)}</h2><p class="bt-muted">De: ${h(mail.sender)} · ${h(new Date(mail.time).toLocaleString('pt-BR'))}</p><pre>${h(mail.body)}</pre>${(await Promise.all((mail.attachments||[]).map(async a=>{const d=await this.store.get(a.id);return d?(this.pref.mode==='cli'?`<p>Anexo: cat ${h(filename(d))}</p>`:`<p>Anexo: <button data-cmd="cat ${h(filename(d))}">${h(d.title)}</button></p>`):'<p class="bt-muted">Anexo indisponível para sua credencial.</p>';}))).join('')}<div class="bt-toolbar"><button data-cmd="mail ${englishMail[archived?'arquivados':this.mailFolder||'entrada']}">← CAIXA</button><button data-cmd="mail reply ${h(filename(mail,'eml'))}">RESPONDER</button><button data-cmd="mail forward ${h(filename(mail,'eml'))}">ENCAMINHAR</button><button data-cmd="mail ${englishMail[archiveAction]} ${h(filename(mail,'eml'))}">${archiveAction.toUpperCase()}</button></div><p class="bt-muted">mail reply ${h(filename(mail,'eml'))} · mail ${englishMail[archiveAction]} ${h(filename(mail,'eml'))}<br>mail ${englishMail[archived?'arquivados':this.mailFolder||'entrada']} — voltar à caixa</p>`,true);return;}
    if(!['entrada','enviados','arquivados'].includes(action))throw new Error('Caixa desconhecida. Use mail inbox, enviados ou arquivados.');
    this.mailFolder=action;
    const archived=await this.store.personal('archived')||[],read=await this.store.personal('read')||[];
    const selected=mails.filter(m=>action==='enviados'?m.author===this.store.user.id:action==='arquivados'?archived.includes(m.id):(m.to.includes(this.store.user.id)||this.store.user.isGM)&&!archived.includes(m.id)).sort((a,b)=>b.time-a.time);
    this.draw(`<div class="bt-label">CORREIO DE BABEL / ${h(action.toUpperCase())}</div><h2>Correspondência</h2><div class="bt-toolbar bt-mail-folders" aria-label="Caixas de correspondência"><button class="bt-primary" data-cmd="mail compose">+ ESCREVER</button><button data-cmd="mail inbox">ENTRADA</button><button data-cmd="mail sent">ENVIADOS</button><button data-cmd="mail archived">ARQUIVADOS</button><button data-cmd="mail draft">RASCUNHO</button></div>${selected.map(m=>`<div class="bt-file bt-mail-item ${read.includes(m.id)?'':'bt-unread'}"><span>${read.includes(m.id)?'LIDO':'NOVO'}</span>${this.pref.mode==='cli'?`<pre>${h(filename(m,'eml'))}\n${h(m.subject)} / ${h(m.sender)}</pre>`:`<button data-cmd="mail read ${h(filename(m,'eml'))}">${h(m.subject)}<br><small>${h(m.sender)}</small></button>`}</div>`).join('')||'<p class="bt-empty">Nenhuma mensagem nesta caixa.</p>'}<p class="bt-muted" style="margin-top:20px">mail compose · mail read arquivo.eml<br>O mestre tem acesso administrativo à correspondência.</p>`,true);
  }
  async compose(draft=null,to=''){
    const contacts=await this.store.contacts();const docs=await this.store.list();const data={to:to?[to]:[],subject:'',body:'',attachments:[],...draft};
    if(this.pref.mode==='cli'){
      const save=async()=>this.store.personal('draft',data);
      const bodyStep=()=>this.ask('Escreva a mensagem linha por linha. Digite . para terminar; cancel sai sem enviar.',async function line(s){if(s!=='.'){data.body+=(data.body?'\n':'')+s;await save();this.ask('Linha salva. Continue ou digite . para terminar.',line.bind(this));}else{this.ask(`Enviar para ${data.to.join(', ')}? Digite send ou draft.`,async answer=>{if(['send','enviar'].includes(answer)){await this.store.send(data);await this.store.personal('draft',null);this.message('Mensagem enviada.');}else{await save();this.message('Rascunho salvo.');}});}}.bind(this));
      this.ask(`Destinatário (${contacts.map(c=>`${c.id}: ${c.name}`).join(' / ')}):`,async answer=>{data.to=answer.split(',').map(x=>x.trim());await save();this.ask('Assunto:',async answer=>{data.subject=answer;await save();bodyStep();});});return;
    }
    this.draw(`<h2>Nova correspondência</h2><form class="bt-form"><label>Destinatário<select name="to">${contacts.map(c=>`<option value="${h(c.id)}" ${data.to.includes(c.id)?'selected':''}>${h(c.name)}</option>`).join('')}</select></label>${this.store.user.isGM?'<label>Remetente de cena (NPC / instituição)<input name="sender" value="Mestre"></label>':''}<label>Assunto<input name="subject" value="${h(data.subject)}" maxlength="160" required></label><label>Mensagem<textarea name="body" required>${h(data.body)}</textarea></label><label>Anexo<select name="attachment"><option value="">Sem anexo</option>${docs.map(d=>`<option value="${h(d.id)}">${h(d.title)}</option>`).join('')}</select></label>${this.store.user.isGM?'<label class="bt-row"><input name="grant" type="checkbox">Conceder acesso ao anexo ao enviar</label>':''}<div class="bt-row"><button type="submit">ENVIAR</button><button type="button" id="bt-save-draft">SALVAR RASCUNHO</button></div></form>`);
    const form=this.output.querySelector('form');const collect=()=>{const f=new FormData(form);return {...data,to:[f.get('to')],senderId:f.get('senderId')||undefined,sender:f.get('sender')||undefined,subject:f.get('subject'),body:f.get('body'),attachments:f.get('attachment')?[{id:f.get('attachment'),grant:f.has('grant')}]:data.attachments};};
    form.oninput=()=>this.store.personal('draft',collect());form.onsubmit=async e=>{e.preventDefault();try{await this.store.send(collect());await this.store.personal('draft',null);this.message('Mensagem enviada.');}catch(error){this.message(error.message,true);}};
    this.output.querySelector('#bt-save-draft').onclick=async()=>{await this.store.personal('draft',collect());this.message('Rascunho salvo. Use mail draft para continuar.');};
  }
  async cipherList(){
    this.current=null;this.brand();const files=await this.store.ciphers();
    this.draw(`<div class="bt-label">FERRAMENTAS / DECIFRAÇÃO LOCAL</div><h2>Arquivos cifrados</h2><p>Examine um arquivo com <code>analyze arquivo.enc</code>. Para tentar recuperar o texto, use <code>john arquivo.enc</code>.</p>${files.map(c=>`<div class="bt-file"><span>ENC</span>${this.pref.mode==='cli'?`<pre>${h(filename(c,'enc'))}\n${h(c.title)}</pre>`:`<button data-cmd="analyze ${h(filename(c,'enc'))}">${h(c.title)}${c.title===filename(c,'enc')?'':`<small>${h(filename(c,'enc'))}</small>`}</button>`}</div>`).join('')||'<p class="bt-muted">Você ainda não recebeu arquivos cifrados.</p>'}<p class="bt-muted" style="margin-top:20px">${this.store.user.isGM?'Teste do mestre: use a ficha vinculada à sua conta ou selecione um token. As suas tentativas ficam separadas das dos jogadores; não é preciso entregar o arquivo a si mesmo.':'A tentativa usa a perícia indicada no arquivo, na ficha do personagem atribuído à sua conta. O mestre precisa estar conectado.'} Analisar não gasta tentativas nem revela o texto.</p>${this.store.demo?'<p class="bt-pilot">DEMONSTRAÇÃO: d20 + 12 simulado; não é uma ficha do Foundry.</p>':''}${this.store.user.isGM?'<div class="bt-toolbar"><button data-cmd="encrypt">CIFRAR SENHA / MENSAGEM</button></div><p class="bt-muted">encrypt — abrir a ferramenta do mestre</p>':''}`,true);
  }
  async inspectCipher(id){
    this.current=null;
    const documentFile=localFile(await this.store.list(),id,this.folder||'');
    if(documentFile&&!/\.enc$/i.test(id)){
      this.current=documentFile;
      this.brand(documentFile.theme,documentFile.appearance);this.draw(`<div class="bt-label">ANÁLISE LOCAL / ${h(filename(documentFile))}</div><h2>${h(documentFile.title)}</h2><p>Documento de texto · ${h(documentFile.classification)} · ${documentFile.assets.length} anexo(s).</p><pre>cat ${h(filename(documentFile))}</pre><div class="bt-toolbar"><button data-cmd="cat ${h(filename(documentFile))}">ABRIR DOCUMENTO</button></div>`);return;
    }
    const c=resolveFile(await this.store.ciphers(),id,'enc');if(!c)throw new Error('Arquivo indisponível. Use ciphers.');
    this.brand();this.draw(`<div class="bt-label">ANÁLISE LOCAL / ${h(filename(c,'enc'))}</div><h2>${h(c.title)}</h2>${this.store.user.isGM?'<p class="bt-pilot">TESTE DO MESTRE · Use uma ficha vinculada à conta ou um token selecionado. Não consome tentativas dos jogadores.</p>':''}<dl class="bt-spec"><dt>Formato</dt><dd>BBL-ENC / arquivo de cena</dd><dt>Abordagem</dt><dd>${h(c.approach||'Não especificada')}</dd><dt>Proficiência</dt><dd>${h(RANKS[c.minRank||0])}</dd><dt>Operação</dt><dd>${h(skillLabel(c.skill))} · CD ${c.dc}</dd><dt>Tentativas</dt><dd>${c.maxAttempts} por personagem; renovadas pelo mestre</dd></dl><pre class="bt-cipher">${h(cipherDisplay(c.ciphertext))}</pre><div class="bt-toolbar"><button data-cmd="john ${h(filename(c,'enc'))}">JOHN / TENTAR DECIFRAR</button><button data-cmd="ciphers">← ARQUIVOS CIFRADOS</button></div><p class="bt-muted">john ${h(filename(c,'enc'))} · ciphers</p>`);
  }
  async hack(id){
    if(!id){await this.cipherList();return;}
    if(this.hacking)throw new Error('Uma tentativa já está em andamento. Aguarde o resultado.');
    const c=resolveFile(await this.store.ciphers(),id,'enc');if(!c)throw new Error('Arquivo indisponível. Use ciphers.');
    this.hacking=true;this.brand();this.message(`JOHN / ${c.title}\nVerificando autorização e solicitando o teste de ${skillLabel(c.skill)}…`);
    const target=this.output.firstElementChild;
    try{
      const r=await this.store.hack(c.id);
      if(!this.active||!this.output.contains(target))return;
      if(r.kind==='babel-hack'){this.renderHacking(r);return;}
      this.draw(`<div class="bt-label">JOHN / ${h(filename(c,'enc'))}${r.simulated?' / TESTE SIMULADO':''}${r.gmTest?' / TESTE DO MESTRE':''}</div><h2>${h(DEGREE_LABELS[r.degree])}${r.cached?' — resultado recuperado':''}</h2><div class="bt-roll"><span>${h(r.actor)}</span><strong>${h(r.total)}</strong><span>${h(r.formula)} · d20: ${h(r.die??'ver rolagem')} · CD ${h(r.dc)}</span></div>${r.degree>=2?`<h3>CONTEÚDO RECUPERADO</h3><pre class="bt-recovered">${h(r.text)}</pre><p class="bt-muted">Se o conteúdo for uma credencial, use unlock para inseri-la. Use john novamente para consultar o texto recuperado.</p>`:'<p>O texto continua cifrado. O mestre pode renovar suas tentativas pelo painel. </p>'}<div class="bt-toolbar"><button data-cmd="ciphers">← ARQUIVOS CIFRADOS</button>${r.degree>=2?'<button data-cmd="unlock">INSERIR CREDENCIAL</button>':''}</div>`,true);
    }finally{this.hacking=false;}
  }
  async cipherAdmin(){
    if(!this.store.user.isGM)throw new Error('A ferramenta de cifrar é exclusiva do mestre.');
    this.brand();const files=await this.store.ciphers(),skills=await this.store.hackingSkills();
    this.draw(`<div class="bt-label">MESTRE / PREPARAÇÃO DE CENA</div><h2>Cifrar uma senha ou mensagem</h2><p>O arquivo vai somente para os jogadores selecionados. O texto original fica na administração privada; não entra no pacote do módulo.</p><form class="bt-form bt-encrypt"><fieldset><legend>ABORDAGEM E TESTE</legend><label>Tipo<select name="category"><option value="hack">Invasão tecnológica</option><option value="decipher">Decifração de texto</option></select></label><label>Perícia<select name="skill">${skills.map(s=>`<option value="${h(s.id)}" ${s.id==='computers'?'selected':''}>${h(s.name)}</option>`).join('')}</select></label><label>Proficiência mínima<select name="minRank">${RANKS.map((name,i)=>`<option value="${i}" ${i===1?'selected':''}>${h(name)}</option>`).join('')}</select></label><label>Descrição da abordagem<textarea name="approach" rows="3" maxlength="500" placeholder="O que o personagem tenta fazer?"></textarea></label></fieldset><label>Nome do arquivo para os jogadores<input name="title" maxlength="100" placeholder="credencial-relé-06.enc" required></label><label>Senha ou mensagem a recuperar<textarea name="text" maxlength="4000" placeholder="Escreva apenas conteúdo ficcional da campanha." required></textarea></label><div class="bt-editor-grid"><label>Dificuldade (CD)<input type="number" name="dc" min="1" max="60" value="20" required></label><label>Tentativas por personagem<input type="number" name="maxAttempts" min="1" max="5" value="1" required></label></div><fieldset><legend>Quem recebe o arquivo?</legend>${this.store.users.filter(u=>!u.isGM).map(u=>`<label class="bt-row"><input type="checkbox" name="recipient" value="${h(u.id)}">${h(u.name)}</label>`).join('')}</fieldset><p class="bt-muted">Ao esgotar o limite, use Renovar tentativas para permitir uma nova rodada.</p><button type="submit">CIFRAR E ENTREGAR ARQUIVO</button><p class="bt-feedback" aria-live="polite"></p></form><h3>ARQUIVOS PREPARADOS</h3>${files.map(c=>`<div class="bt-file"><pre>${h(c.title)}\n${h(filename(c,'enc'))} · CD ${c.dc}</pre><button data-reset-cipher="${h(c.id)}">RENOVAR TENTATIVAS</button></div>`).join('')||'<p class="bt-muted">Nenhum arquivo preparado ainda.</p>'}`);
    const form=this.output.querySelector('.bt-encrypt');
    form.onsubmit=async event=>{event.preventDefault();const submit=form.querySelector('[type=submit]'),feedback=form.querySelector('.bt-feedback');submit.disabled=true;
      try{const f=new FormData(form),c=await this.store.createCipher({title:f.get('title'),text:f.get('text'),dc:+f.get('dc'),maxAttempts:+f.get('maxAttempts'),recipients:f.getAll('recipient'),skill:f.get('skill'),minRank:+f.get('minRank'),category:f.get('category'),approach:f.get('approach'),mode:f.get('resolution')||'direct',...this.collectSupports(form)});form.reset();this.draw(`<div class="bt-label">ARQUIVO CIFRADO / ENTREGUE</div><h2>${h(c.title)}</h2><pre class="bt-cipher">${h(cipherDisplay(c.ciphertext))}</pre><p>Os jogadores selecionados já podem encontrar este arquivo em <code>ciphers</code>.</p><pre>analyze ${h(filename(c,'enc'))}\njohn ${h(filename(c,'enc'))}</pre><div class="bt-toolbar"><button data-cmd="encrypt">CIFRAR OUTRO ARQUIVO</button><button data-cmd="ciphers">VER ARQUIVOS</button></div>`);}
      catch(error){feedback.textContent=error.message;submit.disabled=false;}
    };
    for(const b of this.output.querySelectorAll('[data-reset-cipher]'))b.onclick=async()=>{b.disabled=true;try{await this.store.resetCipher(b.dataset.resetCipher);b.textContent='TENTATIVAS RENOVADAS';}catch(error){b.disabled=false;b.textContent=error.message;}};
  }
  async admin(){if(!this.store.user.isGM)throw new Error('Apenas o mestre.');const docs=await this.store.all();this.brand();this.draw(`<div class="bt-label">ADMINISTRAÇÃO / NÃO VISÍVEL A JOGADORES</div><h2>Controle de acesso</h2><p class="bt-muted">Importar não libera documentos. Senhas novas só valem após você aprovar os arquivos.</p><button id="bt-setup">IMPORTAR / CONFERIR PILOTO</button><form class="bt-form" style="margin-top:20px"><label>Credencial para<select name="target"><option value="group:kruger">Grupo Kruger (sem exceções individuais)</option>${docs.map(d=>`<option value="doc:${h(d.id)}">Documento: ${h(d.title)}</option>`).join('')}</select></label><label>Nova senha<input type="password" name="password" autocomplete="new-password" minlength="4" required></label><div class="bt-row"><button>SALVAR CREDENCIAL</button><button type="button" id="bt-generate">GERAR</button></div></form><h3>DOCUMENTOS</h3>${docs.map(d=>`<div class="bt-file"><span>${d.approved?'APROVADO':'PENDENTE'}</span><pre>${h(filename(d))}\n${h(d.title)}</pre><button data-approve="${h(d.id)}">APROVAR</button></div>`).join('')}<h3>CONCESSÃO INDIVIDUAL</h3><form class="bt-form bt-access"><label>Documento<select name="id">${docs.map(d=>`<option value="${h(d.id)}">${h(d.title)}</option>`).join('')}</select></label><label>Jogador<select name="user">${this.store.users.filter(u=>!u.isGM).map(u=>`<option value="${h(u.id)}">${h(u.name)}</option>`).join('')}</select></label><label>Ação<select name="action"><option value="grant">Liberar</option><option value="revoke">Revogar</option></select></label><button>APLICAR</button></form>`);
    const cipherButton=document.createElement('button');cipherButton.dataset.cmd='encrypt';cipherButton.textContent='CIFRAR SENHA / MENSAGEM';this.output.querySelector('#bt-setup').after(cipherButton);
    this.output.querySelector('#bt-setup').onclick=async()=>{try{this.message(await this.store.setup());}catch(e){this.message(e.message,true);}};
    const cred=this.output.querySelector('form');cred.onsubmit=async e=>{e.preventDefault();try{const f=new FormData(cred);await this.store.configure(f.get('target'),f.get('password'));cred.reset();this.message('Credencial salva.');}catch(error){this.message(error.message,true);}};
    this.output.querySelector('#bt-generate').onclick=()=>{const input=cred.elements.password;input.type='text';input.value=randomUUID().slice(0,13);};
    for(const button of this.output.querySelectorAll('[data-approve]'))button.onclick=async()=>{await this.store.approve(button.dataset.approve);await this.admin();};
    this.output.querySelector('.bt-access').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);await this.store.access(f.get('id'),f.get('user'),f.get('action')==='grant');this.message('Permissão atualizada.');};
  }
}
installViewManagement(TerminalView);
installViewHacking(TerminalView);
installPCShell(TerminalView);
installRetroWorkstation(TerminalView);
installStationEffects(TerminalView);
