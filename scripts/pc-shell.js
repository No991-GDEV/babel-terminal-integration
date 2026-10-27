import {parse,fold,escapeHTML as h} from './core.js';
import {displayCommand} from './terminal-files.js';

const remembered=new Set(['listar','navegar','buscar','ler','pwd','whoami','ajuda','history','preferencias','modo']);
const blockTags='p,h1,h2,h3,h4,pre,div,dt,dd,li,tr';
function outputText(output){
 const copy=output.cloneNode(true);
 copy.querySelectorAll('form,button,[data-document-controls],.bt-private-output,.bt-toolbar,.bt-doc-stamp,script,style,[hidden]').forEach(el=>el.remove());
 if(output.classList.contains('bt-directory'))return [...copy.querySelectorAll('.bt-file>pre')].map(el=>el.textContent).join('\n')||copy.querySelector('.bt-empty')?.textContent||'';
 for(const row of copy.querySelectorAll('.bt-file')){const label=row.querySelector('pre');if(label)row.replaceWith(document.createTextNode(label.textContent+'\n'));}
 for(const el of copy.querySelectorAll(blockTags))el.append(document.createTextNode('\n'));
 return copy.textContent.replace(/\n\s*\n\s*\n/g,'\n\n').trim();
}

// Session output is local and ephemeral; it never becomes command history or world data.
export function installPCShell(View){
 const start=View.prototype.start,run=View.prototype.run,update=View.prototype.updatePreferences,key=View.prototype.key,draw=View.prototype.draw,destroy=View.prototype.destroy,cd=View.prototype.cd;
 Object.assign(View.prototype,{
  async start(){
   await start.call(this);
   this.consoleEntries=[];this.consoleOwner=this.store.user.id;
   this.consoleLog=document.createElement('div');this.consoleLog.className='bt-scrollback';this.consoleLog.setAttribute('aria-label','Saída anterior da sessão');
   this.consoleLine=document.createElement('div');this.consoleLine.className='bt-console-line';
   this.output.before(this.consoleLog,this.consoleLine);
   this.consoleWelcome=document.createElement('pre');this.consoleWelcome.className='bt-shell-welcome';
   this.consoleWelcome.textContent='BABEL OS / LOCAL SHELL\nEstação pronta. Digite help para consultar os comandos.';
   this.consoleLog.before(this.consoleWelcome);
   this.refreshShell();
   this.input.placeholder=this.pref.mode==='cli'?'':'Digite help ou use a navegação';
  },
  shellPrompt(){
   const user=fold(this.store.user.name||this.store.user.id).replace(/[^a-z0-9_-]+/g,'-').replace(/^-|-$/g,'')||'user';
   return `${user}@babel:/${this.folder||''} $`;
  },
  refreshShell(){
   if(!this.shell)return;
   const cli=this.pref.mode==='cli',form=this.root.querySelector('.bt-command'),body=this.root.querySelector('.bt-body'),content=this.root.querySelector('.bt-content');
   const focused=document.activeElement===this.input;
   const game=!!this.output?.querySelector('.bt-game,.bt-game-boot');
   if(cli&&!game&&form.parentElement!==content)content.append(form);
   else if((!cli||game)&&form.parentElement!==this.shell)body.after(form);
   if(focused&&this.pref.mode!=='panel')this.input.focus({preventScroll:true});
   if(!this.pending)this.input.placeholder=cli?'':'Digite help ou use a navegação';
   const prompt=form.querySelector('label');prompt.textContent=cli?this.shellPrompt():`babel:/${this.folder||''} $`;prompt.title='/'+(this.folder||'');
   this.root.querySelector('.bt-top>b').textContent=cli?'BABEL / LOCAL SHELL':'▣ BABEL / TERMINAL';
   this.root.querySelector('.bt-bottom>span:last-child').textContent=cli?'Tab completar · ↑↓ histórico · Ctrl+L limpar · Ctrl+C cancelar':'TAB completar · ↑ histórico · ESC cancelar / pular';
  },
  updatePreferences(){const previous=this.shell?.classList.contains('cli');update.call(this);this.refreshShell();if(previous&&this.pref.mode!=='cli'){this.consoleEntries=[];this.consoleLog?.replaceChildren();this.consoleLine?.replaceChildren();this.consoleCommand=null;}},
  async rememberConsole(){
   if(!this.consoleLog)return;
   if(this.consoleOwner!==this.store.user.id){this.consoleEntries=[];this.consoleOwner=this.store.user.id;}
   const previous=this.consoleCommand;
   if(previous?.remember&&!this.output.querySelector('form,.bt-recovered,.bt-private-output,.bt-game,.bt-hacking')){
    const text=outputText(this.output);
    this.consoleEntries.push({...previous,text:text.slice(0,16000)+(text.length>16000?'\n[… saída anterior abreviada]':'')});
   }
   const allowed=new Set((await this.store.list()).map(d=>d.id));
   this.consoleEntries=(this.consoleEntries||[]).filter(entry=>!entry.document||allowed.has(entry.document)).slice(-24);
   while(this.consoleEntries.reduce((sum,e)=>sum+e.text.length,0)>60000)this.consoleEntries.shift();
   this.consoleLog.innerHTML=this.consoleEntries.map(e=>`<section class="bt-console-entry"><div class="bt-console-line"><span>${h(e.prompt)}</span> ${h(e.command)}</div><pre>${h(e.text)}</pre></section>`).join('');
  },
  async run(text){
   const pending=!!this.pending,cli=this.pref.mode==='cli',{cmd}=pending?{cmd:''}:parse(text);
   if(!pending&&cmd)this.historyDraft='';
   if(cli&&!pending&&cmd){
    this.skip();
    if(cmd==='limpar'){this.consoleEntries=[];this.consoleLog?.replaceChildren();}
    else await this.rememberConsole();
    const command=['acessar','cifrar','passwd'].includes(cmd)?`${displayCommand(cmd)} [entrada privada]`:cmd==='correio'?'mail':displayCommand(text);
    this.consoleCommand={prompt:this.shellPrompt(),command,remember:remembered.has(cmd)};
    if(this.consoleLine)this.consoleLine.innerHTML=`<span>${h(this.consoleCommand.prompt)}</span> ${h(command)}`;
   }else if(pending)this.consoleCommand=null;
   await run.call(this,text);
   if(!this.active)return;
   if(this.consoleCommand)this.consoleCommand.document=this.current?.id||null;
   this.refreshShell();
   if(this.pref.mode==='cli'){
    if(cmd==='limpar'){this.skip();this.output.replaceChildren();this.consoleLine?.replaceChildren();this.consoleCommand=null;this.consoleWelcome?.setAttribute('hidden','');}
    if(!this.output.querySelector('.bt-game,.bt-game-boot'))this.root.querySelector('.bt-content').scrollTop=this.root.querySelector('.bt-content').scrollHeight;
   }
  },
  draw(...args){
   const result=draw.apply(this,args),label=this.output.querySelector('.bt-label'),library=label?.textContent.startsWith('BIBLIOTECA PESSOAL /');
   this.output.classList.toggle('bt-directory',!!library);
   if(library&&this.pref.mode==='cli'){
    label.textContent='/'+(this.libraryFolder||'');
    const parent=[...this.output.querySelectorAll('.bt-file>pre')].find(el=>el.textContent==='.. / VOLTAR');if(parent)parent.textContent='../';
   }
   this.refreshShell();return result;
  },
  async cd(...args){const result=await cd.apply(this,args);if(this.pref.mode==='cli'){this.skip();this.output.replaceChildren();this.output.classList.remove('bt-directory');}return result;},
  async key(event){
   if(this.pref.mode==='cli'&&event.ctrlKey&&!event.altKey&&!event.metaKey){
    const letter=event.key.toLowerCase();
    if(['l','c','u'].includes(letter)){
     if(letter==='c'&&this.input.selectionStart!==this.input.selectionEnd)return; // Preserve normal copy of a selection.
     event.preventDefault();
     event.stopPropagation?.();
     if(letter==='u'){this.input.value='';this.completion=null;this.inputRevision=(this.inputRevision||0)+1;this.root.querySelector('.bt-completion').textContent='';return;}
     if(letter==='c'){
      if(this.hackScreen||this.credentialScreen){await this.escape(event);return;}
      if(this.pending){await this.navigate('back');return;}
      this.input.value='';this.cancelPrompt();this.refreshShell();return;
     }
     if(this.pending)await this.navigate('back');
     await this.run('clear');return;
    }
   }
   const historyEnd=this.historyIndex===this.history.length;
   if(!this.pending&&event.key==='ArrowUp'&&historyEnd)this.historyDraft=this.input.value;
   await key.call(this,event);
   if(!this.pending&&event.key==='ArrowDown'&&this.historyIndex===this.history.length)this.input.value=this.historyDraft||'';
  },
  destroy(){this.consoleEntries=[];this.consoleLog?.replaceChildren();this.consoleLine?.replaceChildren();return destroy.call(this);}
 });
}
