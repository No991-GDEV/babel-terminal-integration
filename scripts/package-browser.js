import {escapeHTML as h,fold} from './core.js';
import {renderPackageDocument} from './admin-view.js';
import {confirmOperation} from './lifecycle-view.js';
import {categories,catalogCategory,pilotCandidates} from './catalog.js';
const labels={'create-pending':'NOVO','update':'NOVA VERSÃO','unchanged':'INSTALADO','conflict':'EDIÇÃO LOCAL','trashed':'NA LIXEIRA'};
// Import is optional and GM-only. Opening this screen never imports content.
export async function renderPackageBrowser(view,{query='',page=0,category=''}={}){
 const s=view.store;s.assertGM();view.current=null;view.brand();
 const all=await s.packagePreview(),matches=all.filter(d=>(!category||catalogCategory(d.id)===category)&&fold(d.title).includes(fold(query))),pages=Math.max(1,Math.ceil(matches.length/10));
 page=Math.max(0,Math.min(pages-1,page));const rows=matches.slice(page*10,page*10+10),eligible=matches.filter(d=>['create-pending','update'].includes(d.decision));
 view.draw(`<div class="bt-label">MESTRE / IMPORTAÇÃO</div><h2>Acervo de Babel</h2><p class="bt-muted">Instalação opcional. Ativar o módulo não importa documentos nem libera acesso.</p><form class="bt-form" data-package-search><label>Categoria<select name="category"><option value="">Todo o acervo</option>${Object.entries(categories).map(([id,label])=>`<option value="${id}" ${id===category?'selected':''}>${h(label)}</option>`).join('')}</select></label><div class="bt-mail-search"><label>Buscar no acervo disponível<input type="search" name="query" value="${h(query)}" placeholder="Nome do documento"></label><button>BUSCAR</button></div></form><p class="bt-muted">${matches.length} arquivo(s) · página ${page+1} de ${pages}</p><div class="bt-toolbar"><button data-install ${eligible.length?'':'disabled'}>IMPORTAR RESULTADOS (${eligible.length})…</button><button data-pilot-cleanup>REVISAR ARQUIVOS DO PILOTO</button></div>${rows.map(d=>`<div class="bt-file"><span>${h(labels[d.decision]||d.decision)}</span><button data-preview-package="${h(d.id)}">${h(d.title)}</button></div>`).join('')||'<p class="bt-empty">Nenhum arquivo corresponde à busca.</p>'}<div class="bt-toolbar"><button data-package-page="${page-1}" ${page===0?'disabled':''}>← ANTERIOR</button><button data-package-page="${page+1}" ${page===pages-1?'disabled':''}>PRÓXIMA →</button><button data-cmd="admin">VOLTAR</button></div><p class="bt-muted">Novos arquivos ficam pendentes. Edições locais e itens na lixeira não são substituídos. Abra um título para conferir ou importar apenas aquele documento.</p><p class="bt-muted">Comandos: import category pessoas · import install [categoria] · import cleanup</p><p class="bt-admin-feedback" role="status"></p>`);
 const feedback=view.output.querySelector('.bt-admin-feedback'),form=view.output.querySelector('[data-package-search]');
 form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form);await renderPackageBrowser(view,{query:f.get('query'),category:f.get('category')});};
 form.elements.category.onchange=()=>renderPackageBrowser(view,{category:form.elements.category.value,query:form.elements.query.value});
 for(const b of view.output.querySelectorAll('[data-package-page]'))b.onclick=()=>renderPackageBrowser(view,{query,category,page:+b.dataset.packagePage});
 for(const b of view.output.querySelectorAll('[data-preview-package]'))b.onclick=async()=>{try{await renderPackageDocument(view,b.dataset.previewPackage);}catch(e){feedback.textContent=e.message;}};
 view.output.querySelector('[data-install]').onclick=()=>importSelection(view,eligible,{query,category,page});
 view.output.querySelector('[data-pilot-cleanup]').onclick=()=>reviewPilot(view);
}
async function importSelection(view,rows,back={}){
 if(!rows.length)throw new Error('Não há arquivos novos ou atualizações sem conflito nesta seleção.');
 const documents=await Promise.all(rows.map(d=>view.store.packageDocument(d.id)));
 confirmOperation(view,`Importar ${documents.length} arquivo(s)?`,'Serão criados Journals reais, com uma página de texto por documento e páginas de imagem. Novos arquivos ficam pendentes e sem acesso para jogadores. Conflitos são ignorados; correspondências e credenciais não mudam. Faça backup do mundo antes de continuar.',()=>view.store.setup(documents),()=>renderPackageBrowser(view,back));
}
export async function reviewPilot(view){
 const candidates=await pilotCandidates(view.store);
 view.draw(`<div class="bt-label">MESTRE / PILOTO ANTERIOR</div><h2>Arquivos substituídos pelo acervo</h2><p>Revise cada arquivo antes de retirá-lo. A lixeira preserva o Journal e suas páginas; retira o acesso dos jogadores. Nenhum correio, cifra ou arquivo criado por você entra nesta lista.</p>${candidates.map(d=>`<div class="bt-admin-card"><b>${h(d.title)}</b>${d.localEdited?'<p class="bt-muted">Possui edição local.</p>':''}<div class="bt-toolbar"><button data-pilot-open="${h(d.id)}">ABRIR</button><button data-pilot-trash="${h(d.id)}">MOVER PARA A LIXEIRA…</button></div><code>import retire ${h(d.id)}</code></div>`).join('')||'<p class="bt-empty">Nenhum arquivo antigo identificado.</p>'}<button data-cmd="import">VOLTAR</button>`);
 for(const b of view.output.querySelectorAll('[data-pilot-open]'))b.onclick=()=>view.read(b.dataset.pilotOpen);
 for(const b of view.output.querySelectorAll('[data-pilot-trash]'))b.onclick=()=>retirePilot(view,b.dataset.pilotTrash);
}
async function retirePilot(view,id){
 const d=(await pilotCandidates(view.store)).find(d=>d.id===id);if(!d)throw new Error('Arquivo antigo não encontrado.');
 confirmOperation(view,`Retirar “${d.title}”?`,'O arquivo ficará recuperável na lixeira. Confira suas alterações antes de confirmar; os jogadores perderão acesso a esta versão.',async()=>{if(!(await pilotCandidates(view.store)).some(d=>d.id===id))throw new Error('A lista mudou. Revise novamente.');await view.store.trashDocument(id);},()=>reviewPilot(view));
}
export async function packageCommand(view,args=[]){
 view.store.assertGM();const [cmd,category]=args;
 if(cmd==='cleanup')return reviewPilot(view);
 if(cmd==='retire')return retirePilot(view,category);
 if(cmd==='category'||cmd==='install'){
  if(category&&!categories[category])throw new Error('Categorias: '+Object.keys(categories).join(', '));
  if(cmd==='category')return renderPackageBrowser(view,{category:category||''});
  const rows=(await view.store.packagePreview()).filter(d=>(!category||catalogCategory(d.id)===category)&&['create-pending','update'].includes(d.decision));
  return importSelection(view,rows,{category:category||''});
 }
 return renderPackageBrowser(view,{query:args.join(' ')});
}
