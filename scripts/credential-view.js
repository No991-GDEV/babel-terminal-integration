import {escapeHTML as h} from './core.js';
import {resolvePath} from './virtual-paths.js';
import {filename} from './terminal-files.js';
export async function showCredentials(view,targets){
 view.store.assertGM();const owner=view.store.user.id,sequence=view.sequence,docs=await view.store.all(),info=await view.store.credentialInfo(targets);if(!view.active||owner!==view.store.user.id||sequence!==view.sequence)return;view.skip();
 const label=target=>target.startsWith('doc:')?'Documento: '+(docs.find(d=>d.id===target.slice(4))?.title||'Arquivo'):target.startsWith('folder:')?'Pasta: /'+target.slice(7):'Grupo: '+target.slice(6);
 view.draw(`<div class="bt-label">MESTRE / CREDENCIAIS</div><h2>Senhas do acervo</h2><section class="bt-private-output"><p class="bt-muted">Somente o mestre. Copie e entregue na mesa. Arquivos pendentes continuam bloqueados; senhas de pasta respeitam exceções individuais.</p>${info.map((entry,i)=>`<div class="bt-form"><label>${h(label(entry.target))}<input data-secret="${i}" readonly aria-label="Senha ficcional" value="${h(entry.password||'')}" placeholder="Senha antiga: redefina para poder consultá-la"></label><div class="bt-toolbar"><button data-copy="${i}" ${entry.password?'':'disabled'}>COPIAR SENHA</button><button data-reset="${i}">DEFINIR NOVA SENHA</button></div></div>`).join('')}<p data-credential-feedback role="status"></p></section><p class="bt-muted">passwd show · passwd folder · passwd group show</p><div class="bt-toolbar"><button data-cmd="${view.current?'cat /'+h(filename(view.current)):'ls'}">VOLTAR</button></div>`);
 const feedback=view.output.querySelector('[data-credential-feedback]');
 for(const button of view.output.querySelectorAll('[data-copy]'))button.onclick=async()=>{const input=view.output.querySelector(`[data-secret="${button.dataset.copy}"]`);input.focus();input.select();try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(input.value);feedback.textContent='Senha copiada.';}catch{feedback.textContent='Senha selecionada. Use Ctrl+C para copiar.';}};
 for(const button of view.output.querySelectorAll('[data-reset]'))button.onclick=()=>{const target=info[+button.dataset.reset].target;view.ask('Nova senha ficcional (4 a 200 caracteres). Só esta credencial será alterada.',async password=>{await view.store.configure(target,password,{exclusive:target.startsWith('doc:')&&!!view.current?.hasOwnPassword});await showCredentials(view,targets);});view.input.type='password';const panel=view.output.querySelector('.bt-panel-prompt input');if(panel)panel.type='password';};
}
export async function folderCredentials(view,path=''){
 view.store.assertGM();const target=path?resolvePath(path,view.folder||''):view.libraryFolder||view.folder||'';
 if(!target||!(await view.folders()).includes(target))throw new Error('Entre numa pasta com cd antes de usar passwd folder.');
 return showCredentials(view,['folder:'+target]);
}
