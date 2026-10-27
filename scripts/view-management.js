import {escapeHTML as h,fold} from './core.js';
import {filename,resolveFile} from './terminal-files.js';
import {resolvePath,localFile} from './virtual-paths.js';
import {PRESETS} from './company-presets.js';
import {renderAdmin,renderEditor} from './admin-view.js';

export function installViewManagement(View){
 const originalAsk=View.prototype.ask,originalMail=View.prototype.mailCommand,originalCompose=View.prototype.compose;
 Object.assign(View.prototype,{
  brand(theme='babel',appearance={}){this.theme=theme;const preset=PRESETS[theme]||PRESETS.babel,t={...preset};for(const key of ['title','subtitle','ascii','accent'])if(appearance?.[key])t[key]=appearance[key];this.shell.style.setProperty('--accent',/^#[a-f0-9]{6}$/i.test(t.accent)?t.accent:PRESETS.babel.accent);this.root.querySelector('.bt-brand').innerHTML=`<pre class="bt-mark">${h(t.ascii)}</pre><div><h1>${h(t.title)}</h1><p>${h(t.subtitle)}</p></div>`;},
  async admin(){await renderAdmin(this);},
  async editDocument(reference=''){this.store.assertGM();const doc=reference?localFile(await this.store.all(),reference,this.folder||''):null;if(reference&&!doc)throw new Error('Documento indisponível.');if(doc&&(doc.nativeJournal||doc.canConsolidate||doc.readerPages?.length>1)){this.current=doc;await this.store.openJournal(doc.id);return;}await renderEditor(this,doc);},
  async folders(){const paths=(await this.store.list()).map(d=>d.folder||'');if(this.store.user.isGM)paths.push(...await this.store.folderCatalog());return [...new Set(paths.flatMap(p=>p.split('/').map((_,i)=>p.split('/').slice(0,i+1).join('/'))))].filter(Boolean).sort();},
  async directory(path){const target=resolvePath(path,this.folder||'');if(target&&!(await this.folders()).includes(target))throw new Error('Pasta indisponível.');return target;},
  async cd(path=''){this.folder=await this.directory(path);const prompt=this.root.querySelector('.bt-command label');prompt.textContent=`babel:/${this.folder} $`;prompt.title='/'+this.folder;await this.home();},
  async ls(path=''){await this.home('',path?await this.directory(path):this.folder||'');},
  async home(filter='',browseFolder=this.folder||''){
   this.current=null;this.libraryFolder=browseFolder;this.brand();const folder=browseFolder,all=await this.store.list();
   const docs=all.filter(d=>filter?fold(`${d.title} ${d.group} ${d.paragraphs.join(' ')}`).includes(fold(filter)):(d.folder||'')===folder);
   const children=filter?[]:(await this.folders()).filter(p=>p.split('/').slice(0,-1).join('/')===folder);
   const item=(cmd,label,kind)=>`<div class="bt-file"><span>${h(kind)}</span>${this.pref.mode==='cli'?`<pre>${h(label)}</pre>`:`<button data-cmd="${h(cmd)}">${h(label)}</button>`}</div>`;
   this.draw(`<div class="bt-label">BIBLIOTECA PESSOAL / ${h(folder||'/')}</div><h2>${filter?'Resultado da consulta':'Arquivos disponíveis'}</h2>${folder&&!filter?item(`cd /${folder.split('/').slice(0,-1).join('/')}`,'.. / VOLTAR','PASTA'):''}${children.map(p=>item(`cd /${p}`,p.split('/').at(-1)+'/','PASTA')).join('')}${docs.map(d=>item(`cat /${filename(d)}`,filter?filename(d):filename(d).split('/').at(-1),'TXT')).join('')}${!docs.length&&!children.length?'<p class="bt-empty">Nenhum arquivo disponível nesta consulta.</p>':''}<div class="bt-toolbar bt-library-actions"><button data-cmd="unlock">INSERIR CREDENCIAL</button>${this.store.user.isGM?'<details class="bt-library-tools"><summary>FERRAMENTAS DO MESTRE</summary><div class="bt-tools-grid"><button data-cmd="edit">NOVO DOCUMENTO</button><button data-cmd="journal register">REGISTRAR JOURNAL</button><button data-cmd="mkdir">NOVA PASTA</button><button data-cmd="folders">ORGANIZAR PASTAS</button><button data-cmd="passwd folder">SENHA DESTA PASTA</button><button data-cmd="trash">LIXEIRA</button></div></details>':''}</div><p class="bt-muted">cd pasta / cd .. — navegar · search termo — pesquisar todo o seu acervo.</p>`,true);
   await this.refreshUnread();
  },
  ask(prompt,handler,password=false){
   originalAsk.call(this,prompt,handler,password);
   if(password){this.output.insertAdjacentHTML('beforeend','<p class="bt-muted bt-credential-exit"><kbd>Esc</kbd> para voltar aos arquivos. Você também pode escolher outra seção.</p>');}
   if(this.pref.mode!=='panel')return;
   const form=document.createElement('form');form.className='bt-form bt-panel-prompt';form.innerHTML=`<label>${password?'Credencial':'Resposta'}<input type="${password?'password':'text'}" autocomplete="off" required></label><div class="bt-row"><button>CONFIRMAR</button><button type="button" data-cmd="back">CANCELAR</button></div>`;this.output.append(form);
   form.onsubmit=e=>{e.preventDefault();const input=form.querySelector('input'),answer=input.value;input.value='';this.run(answer);};form.querySelector('input').focus();
  },
  async refreshUnread(){const mails=await this.store.mails(),read=await this.store.personal('read')||[],archived=await this.store.personal('archived')||[];const count=mails.filter(m=>m.author!==this.store.user.id&&(m.to.includes(this.store.user.id)||this.store.user.isGM)&&!read.includes(m.id)&&!archived.includes(m.id)).length;const button=this.root.querySelector('[data-cmd="mail"]');if(button)button.innerHTML=`<span>02 / CORREIO</span>${count?`<span class="bt-unread-badge" aria-label="${count} nova${count>1?'s':''}">${count}<span class="bt-sr-only"> nova${count>1?'s':''}</span></span>`:''}`;},
  async mailCommand(args){
   await originalMail.call(this,args);await this.refreshUnread();if(this.pref.mode==='cli'||!this.output.querySelector('[data-cmd="mail compose"]'))return;
   this.skip();const rows=[...this.output.querySelectorAll('.bt-file')];
   const form=document.createElement('form');form.className='bt-mail-search';form.innerHTML=`<label>Pesquisar nesta caixa<input type="search" value="${h(this.mailQuery||'')}" placeholder="Assunto, remetente ou mensagem"></label><button>PESQUISAR</button>`;
   const result=document.createElement('p');result.className='bt-search-status bt-muted';result.setAttribute('role','status');result.hidden=true;
   const toolbar=this.output.querySelector('.bt-mail-folders');for(const button of toolbar.querySelectorAll('[data-cmd]'))if(button.dataset.cmd===`mail ${{entrada:'inbox',enviados:'sent',arquivados:'archived'}[this.mailFolder]}`)button.setAttribute('aria-current','page');
   const mails=await this.store.mails();const apply=()=>{this.mailQuery=form.querySelector('input').value;for(const row of rows){const reference=row.querySelector('[data-cmd]')?.dataset.cmd.slice('mail read '.length),mail=reference&&resolveFile(mails,reference,'eml');row.hidden=!!this.mailQuery&&!fold(`${mail?.subject||''} ${mail?.sender||''} ${mail?.body||''}`).includes(fold(this.mailQuery));}result.hidden=!this.mailQuery;const count=rows.filter(r=>!r.hidden).length;result.textContent=count?`${count} mensagem(ns) encontrada(s) nesta caixa.`:'Nenhuma mensagem corresponde à pesquisa.';};
   form.onsubmit=e=>{e.preventDefault();apply();};form.querySelector('input').oninput=apply;toolbar.after(form);form.after(result);apply();
  },
  async compose(draft=null,to=''){
   await originalCompose.call(this,draft,to);if(!this.store.user.isGM||this.pref.mode==='cli')return;
   const form=this.output.querySelector('form'),old=form?.querySelector('[name=sender]');if(!old)return;
   const contacts=await this.store.contactCatalog(),select=document.createElement('select');select.name='senderId';select.innerHTML=`<option value="">${h(this.store.user.name)}</option>${contacts.map(c=>`<option value="${h(c.id)}">${h(c.name)}</option>`).join('')}`;old.replaceWith(select);select.value=draft?.senderId||'';
  }
 });
}
