import {randomUUID} from './crypto-runtime.js';
import {escapeHTML as h,fold} from './core.js';
import {filename} from './terminal-files.js';
import {resolvePath} from './virtual-paths.js';
import {confirmOperation,trashPrompt,folderPrompt} from './lifecycle-view.js';
import {showCredentials,folderCredentials} from './credential-view.js';

async function currentDocument(view){
 view.store.assertGM();const d=view.current&&await view.store.get(view.current.id);
 if(!d)throw new Error('Abra o arquivo com cat antes de usar este comando.');return d;
}
export async function attachDocumentControls(view,doc){
 if(!view.store.user.isGM)return;
 const area=view.output.querySelector('[data-document-controls]'),users=await view.store.documentAccess(doc.id);
 if(view.current?.id!==doc.id||!area?.isConnected)return;
 area.innerHTML=`<summary>ACESSO E CREDENCIAL · ${doc.approved?'APROVADO':'PENDENTE'}</summary><p class="bt-muted">Grupo: ${h(doc.group)} · ${doc.hasOwnPassword?'credencial individual':'credencial do grupo'}</p><p class="bt-muted">Grupos compartilham uma senha entre arquivos. Pastas só organizam. Uma credencial individual substitui a do grupo neste arquivo.</p><div class="bt-toolbar"><button data-cmd="journal">ABRIR JOURNAL DO FOUNDRY</button>${!doc.approved?'<button data-cmd="approve">APROVAR ARQUIVO</button>':''}<button data-cmd="passwd">CREDENCIAL INDIVIDUAL</button><button data-cmd="passwd group">CREDENCIAL DO GRUPO</button>${doc.hasOwnPassword?'<button data-cmd="passwd inherit">VOLTAR À CREDENCIAL DO GRUPO</button>':''}<button data-delete-open>EXCLUIR ARQUIVO</button></div><form class="bt-form" data-context-access><label>Jogador<select name="user">${users.map(u=>`<option value="${h(u.id)}">${h(u.name)} — ${u.allowed?'com acesso':'sem acesso'}</option>`).join('')}</select></label><div class="bt-toolbar"><button name="action" value="grant" ${!doc.approved?'disabled':''}>LIBERAR</button><button name="action" value="revoke">REVOGAR</button></div></form><form class="bt-form" data-context-group><label>Grupo compartilhado (existente ou novo)<input name="group" value="${h(doc.group)}" required maxlength="100"></label><button>ALTERAR GRUPO</button></form><p class="bt-context-feedback" role="status"></p>`;
 area.querySelector('[data-delete-open]').onclick=()=>trashPrompt(view,doc);
 const form=area.querySelector('[data-context-access]');form.onsubmit=async e=>{e.preventDefault();try{await documentCommand(view,e.submitter?.value||'grant',[form.elements.user.value]);}catch(error){area.querySelector('.bt-context-feedback').textContent=error.message;}};
 const group=area.querySelector('[data-context-group]');group.onsubmit=async e=>{e.preventDefault();try{await documentCommand(view,'group',[group.elements.group.value]);}catch(error){area.querySelector('.bt-context-feedback').textContent=error.message;}};
 const roster=document.createElement('div');roster.className='bt-access-roster';roster.setAttribute('aria-label','Acesso atual dos jogadores');
 roster.innerHTML=users.map(u=>`<span class="${u.allowed?'allowed':''}">${h(u.name)} · ${u.allowed?'COM ACESSO':'SEM ACESSO'}${u.allowed&&u.pages!==undefined?` · ${u.pages}/${u.totalPages} páginas`:''}</span>`).join('')||'<span>Nenhum jogador cadastrado.</span>';
 area.querySelector('summary').after(roster);area.querySelectorAll('.bt-muted')[1].textContent='Senhas de grupo ou pasta liberam arquivos aprovados. A exceção individual bloqueia as credenciais coletivas; acessos já concedidos não mudam.';
 const see=document.createElement('button');see.dataset.cmd='passwd show';see.textContent='VER / COPIAR SENHAS';area.querySelector('.bt-toolbar').prepend(see);
}
export async function documentCommand(view,cmd,args=[]){
 if(cmd==='passwd'&&args[0]==='folder')return folderCredentials(view,args.slice(1).join(' '));
 const s=view.store,d=await currentDocument(view),back=()=>view.read(d.id);
 if(cmd==='passwd'&&(args[0]==='show'||args.join(' ')==='group show')){
  const parents=(d.folder||'').split('/').filter(Boolean).map((_,i)=>'folder:'+d.folder.split('/').slice(0,i+1).join('/'));
  return showCredentials(view,args[0]==='group'?['group:'+d.group]:['doc:'+d.id,...parents]);
 }
 if(cmd==='access'){const users=await s.documentAccess(d.id);view.message(`${filename(d)}\n${d.approved?'APROVADO':'PENDENTE'} · grupo ${d.group}\n${users.map(u=>u.name+' ['+u.id+']: '+(u.allowed?'com acesso':'sem acesso')).join('\n')}\ngrant "Jogador" · revoke "Jogador" · approve · passwd · group nome`);return;}
 if(cmd==='approve'){if(args.length)throw new Error('Use approve no arquivo aberto.');await s.approve(d.id);await back();return;}
 if(cmd==='grant'||cmd==='revoke'){
  const apply=async name=>{const matches=s.users.filter(u=>!u.isGM&&(u.id===name||fold(u.name)===fold(name)));if(matches.length!==1)throw new Error('Jogador ausente ou nome ambíguo. Use a identificação exibida em access.');await s.access(d.id,matches[0].id,cmd==='grant');await back();};
  if(!args.length){const users=s.users.filter(u=>!u.isGM);view.ask(`Qual jogador?\n${users.map(u=>u.name+' ['+u.id+']').join('\n')}`,apply);}else await apply(args.join(' '));return;
 }
 if(cmd==='group'){
  if(!args.length){view.message(`Grupo atual: ${d.group}\nGrupos compartilham credenciais; não são pastas.\ngroup nome — usar ou criar um grupo neste arquivo.\n${(await s.groups()).map(g=>g.name).join(' · ')}`);return;}
  const name=args.join(' ');confirmOperation(view,'Alterar grupo deste arquivo?',`Novo grupo: ${name}. Isso altera qual senha coletiva pode liberar este arquivo. Uma senha individual continua tendo prioridade; acessos existentes não mudam.`,()=>s.setDocumentGroup(d.id,name),back);return;
 }
 if(cmd==='passwd'){
  if(!['','group','inherit','generate','group generate'].includes(args.join(' ')))throw new Error('Use passwd ou passwd group. Digite a senha somente na entrada protegida.');
  if(args[0]==='inherit'){confirmOperation(view,'Usar a credencial do grupo?',`A senha individual deixará de liberar este arquivo; a senha do grupo ${d.group} poderá liberá-lo. Acessos já concedidos não mudam.`,()=>s.inheritCredential(d.id),back);return;}
  const target=args[0]==='group'?'group:'+d.group:'doc:'+d.id;
  view.ask(`Nova senha ficcional para ${args[0]==='group'?'o grupo '+d.group+' (vale para vários arquivos)':'este arquivo'}. Mínimo de quatro caracteres. A senha não entra no histórico.`,async password=>{await s.configure(target,password);await back();});
  view.input.type='password';view.input.autocomplete='new-password';
  const panel=view.output.querySelector('.bt-panel-prompt input');if(panel){panel.type='password';panel.autocomplete='new-password';}
  const generate=()=>{const password=randomUUID().slice(0,13);view.input.type='text';view.input.value=password;if(panel){panel.type='text';panel.value=password;}};
  if(args.includes('generate'))generate();
  if(view.pref.mode!=='cli'){const tools=document.createElement('div');tools.className='bt-toolbar';const button=document.createElement('button');button.type='button';button.textContent='GERAR SENHA';button.onclick=generate;tools.append(button);view.output.append(tools);}
 }
}
export async function createFolder(view,path=''){
 view.store.assertGM();const base=path?(view.folder||''):(view.libraryFolder||view.folder||'');
 const create=async name=>{const target=resolvePath(name,base);if(!target)throw new Error('Informe um nome de pasta.');await view.store.saveFolder(target);await view.home('',base);};
 if(path)await create(path);else view.ask(`Nome da nova pasta em /${base}:`,create);
}
export async function renderFolderTools(view){
 const s=view.store;s.assertGM();const folders=await view.folders();view.current=null;view.brand();
 view.draw(`<div class="bt-label">ARQUIVOS / PASTAS</div><h2>Organizar pastas</h2><form class="bt-form" data-form="folder-manage"><label>Pasta<select name="source" required><option value="">Selecione</option>${folders.map(p=>`<option value="${h(p)}">${h(p)}</option>`).join('')}</select></label><label>Ação<select name="operation"><option value="rename">Renomear</option><option value="move">Mover para outra pasta</option><option value="delete">Excluir pasta vazia</option></select></label><label data-folder-name>Novo nome<input name="name" required placeholder="Ex.: arquivo-tecnico"></label><label data-folder-parent hidden>Pasta de destino<select name="destination"><option value="">/ (raiz)</option></select></label><p class="bt-muted" data-folder-preview role="status">Selecione uma pasta.</p><button class="bt-primary">CONFERIR ALTERAÇÃO</button></form><p class="bt-context-feedback" role="status"></p><p class="bt-muted">mkdir nome · folder move origem destino · folder delete pasta-vazia</p><div class="bt-toolbar"><button data-cmd="ls">VOLTAR AOS ARQUIVOS</button></div>`);
 const form=view.output.querySelector('form'),hint=form.querySelector('[data-folder-preview]');
 const destination=()=>{
 const source=form.elements.source.value,parent=source.split('/').slice(0,-1).join('/');
 if(form.elements.operation.value==='delete')return '';
 if(form.elements.operation.value==='move')return [form.elements.destination.value,source.split('/').at(-1)].filter(Boolean).join('/');
 const raw=form.elements.name.value.trim();if(raw.includes('/')||raw.includes(String.fromCharCode(92))||raw.includes('..'))throw new Error('Informe apenas o novo nome, sem caminho.');
 return [parent,raw].filter(Boolean).join('/');
 };
 const update=()=>{
  const op=form.elements.operation.value,source=form.elements.source.value;form.querySelector('[data-folder-name]').hidden=op!=='rename';form.elements.name.disabled=op!=='rename';form.elements.name.required=op==='rename';form.querySelector('[data-folder-parent]').hidden=op!=='move';form.elements.destination.disabled=op!=='move';
  try{hint.textContent=!source?'Selecione uma pasta.':op==='delete'?'/'+source+' — somente se estiver vazia.':'/'+source+' → /'+destination();}catch(error){hint.textContent=error.message;}
 };
 form.elements.source.onchange=()=>{
  const source=form.elements.source.value;form.elements.name.value=source.split('/').at(-1)||'';
  form.elements.destination.innerHTML='<option value="">/ (raiz)</option>'+folders.filter(p=>p!==source&&!p.startsWith(source+'/')).map(p=>`<option value="${h(p)}">${h(p)}</option>`).join('');update();
 };
 form.elements.operation.onchange=update;form.elements.name.oninput=update;form.elements.destination.onchange=update;
 if(folders.includes(view.folder)){form.elements.source.value=view.folder;form.elements.source.onchange();}else update();
 form.onsubmit=async e=>{e.preventDefault();try{if(form.elements.operation.value==='rename'&&!form.elements.name.value.trim())throw new Error('Informe o novo nome.');await folderPrompt(view,form.elements.source.value,destination(),{remove:form.elements.operation.value==='delete'});}catch(error){view.output.querySelector('.bt-context-feedback').textContent=error.message;}};
}
