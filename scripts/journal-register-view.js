import {escapeHTML as h} from './core.js';
import {contentHash} from './management.js';
import {PRESETS} from './company-presets.js';
export async function renderJournalRegistration(view){
 const s=view.store;s.assertGM();view.current=null;const sources=await s.sourceJournals();view.brand();
 view.draw(`<div class="bt-label">ARQUIVOS / JOURNAL DO FOUNDRY</div><h2>Registrar Journal existente</h2><p>O terminal lerá este mesmo Journal. Alterações de texto, título e imagens feitas no Foundry aparecerão aqui; não será criada outra cópia.</p><form class="bt-form" data-journal-register><label>Journal<select name="source" required><option value="">Selecione</option>${sources.map(j=>`<option value="${h(j.id)}">${h(j.name)}</option>`).join('')}</select></label><button type="button" data-load-journal>CONFERIR CONTEÚDO</button><label>Pasta do terminal<input name="folder" value="${h(view.folder||'')}" placeholder="companhias/kruger"></label><label>Grupo de credencial<input name="group" value="geral" required></label><label>Identidade<select name="theme">${Object.entries(PRESETS).map(([key,p])=>`<option value="${key}">${h(p.title)}</option>`).join('')}</select></label><p class="bt-muted">Use somente Journals destinados aos jogadores. O registro preserva o original e suas permissões atuais; futuras concessões e revogações pelo Babel atuarão neste mesmo Journal. Segredos devem ficar em outro Journal privado.</p><div data-journal-preview></div><label class="bt-row"><input name="reviewed" type="checkbox" required>Revisei todo o Journal, incluindo imagens: ele não contém informações exclusivas do mestre.</label><button type="submit">REGISTRAR SEM COPIAR</button><p class="bt-register-feedback" role="status"></p><div class="bt-toolbar"><button type="button" data-cmd="ls">VOLTAR</button></div></form>`);
 const form=view.output.querySelector('form'),feedback=form.querySelector('.bt-register-feedback');let reviewedSource=null,expectedHash;
 form.elements.source.onchange=()=>{reviewedSource=null;expectedHash=null;form.elements.reviewed.checked=false;form.querySelector('[data-journal-preview]').replaceChildren();};
 form.querySelector('[data-load-journal]').onclick=async()=>{try{
  const id=form.elements.source.value,preview=await s.sourcePreview(id);if(!form.isConnected||form.elements.source.value!==id)return;
  reviewedSource=id;expectedHash=await contentHash(preview);form.elements.reviewed.checked=false;
  form.querySelector('[data-journal-preview]').innerHTML=`<h3>${h(preview.title)}</h3>${preview.paragraphs.map(p=>`<p>${h(p)}</p>`).join('')}${preview.assets.map(a=>`<img src="${h(a.path)}" alt="${h(a.title)}">`).join('')}`;
  feedback.textContent=preview.removed?'Há blocos reservados: registro direto bloqueado. Use uma cópia revisada ou retire-os do original.':'Confira o conteúdo antes de registrar.';
 }catch(error){feedback.textContent=error.message;}};
 form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;try{
  if(!reviewedSource||reviewedSource!==form.elements.source.value||!form.elements.reviewed.checked)throw new Error('Carregue e revise o Journal selecionado.');
  const id=await s.registerJournal(reviewedSource,{folder:form.elements.folder.value,group:form.elements.group.value,theme:form.elements.theme.value,classification:'JOURNAL DO FOUNDRY'},{reviewed:true,expectedHash});
  await view.read(id);
 }catch(error){feedback.textContent=error.message;button.disabled=false;}};
}
