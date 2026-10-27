import {escapeHTML as h} from './core.js';
import {localFile} from './virtual-paths.js';
import {filename,imageFilename} from './terminal-files.js';
import {attachDocumentControls} from './context-controls.js';
import {confirmOperation} from './lifecycle-view.js';
import {textLayout} from './text-layout.js';

export async function readDocument(view,reference,step=null){
 const doc=localFile(await view.store.list(),reference,view.folder||'');
 if(!doc)throw new Error('Arquivo indisponível. Use ls para consultar seu acervo.');
 const pages=doc.readerPages?.length?doc.readerPages:[{id:'body',name:doc.title,paragraphs:doc.paragraphs}],same=view.current?.id===doc.id;
 let index=same?pages.findIndex(p=>p.id===view.readerPageId):0;
 if(index<0)index=Math.min(view.readerPageIndex||0,pages.length-1);
 if(step!==null){
  if(step==='next')index++;else if(step==='prev')index--;else if(/^\d+$/.test(step)&&Number(step)>0)index=Number(step)-1;else throw new Error('Use page next, page prev ou page 2.');
  if(index<0||index>=pages.length)throw new Error('Não há outra página nessa direção.');
 }
 const page=pages[index];view.current=doc;view.readerPageId=page.id;view.readerPageIndex=index;view.brand(doc.theme,doc.appearance);
 const pager=pages.length>1?`<nav class="bt-toolbar bt-page-nav" aria-label="Páginas do documento">${view.pref.mode==='cli'?'':`<button data-cmd="page prev" ${index===0?'disabled':''}>← ANTERIOR</button>`}<span>PÁGINA ${index+1} / ${pages.length}</span>${view.pref.mode==='cli'?'':`<button data-cmd="page next" ${index===pages.length-1?'disabled':''}>PRÓXIMA →</button>`}</nav>`:'';
 view.draw(`<div class="bt-label" data-reader-document>${h(doc.classification)} / ${h(filename(doc))}</div><h2>${h(doc.title)}</h2>${view.store.user.isGM?`<div class="bt-toolbar"><button data-cmd="edit /${h(filename(doc))}">EDITAR ARQUIVO</button>${doc.canConsolidate?'<button data-cmd="journal merge">UNIR TRECHOS ANTIGOS</button>':''}</div><details data-document-controls></details>`:''}${pager}${pages.length>1?`<h3>${h(page.name||'Página '+(index+1))}</h3>`:''}<section data-page-body>${textLayout(page.paragraphs)}</section>${pager}${pages.length>1?'<p class="bt-muted">page next · page prev · page 2</p>':''}${doc.assets.length?'<h3>ANEXOS DO DOCUMENTO</h3>':''}${doc.assets.map(a=>`<div class="bt-file"><span>IMAGEM</span>${view.pref.mode==='cli'?`<pre>image ${h(imageFilename(a))} — ${h(a.title)}</pre>`:`<button data-cmd="image ${h(imageFilename(a))}">${h(a.title)} ↗</button>`}</div>`).join('')}<div class="bt-toolbar"><button data-cmd="back">← BIBLIOTECA</button></div>`,true);

 const references=(await view.store.list()).filter(d=>(doc.references||[]).includes(d.id));
 if(references.length)view.output.insertAdjacentHTML('beforeend',`<h3>DOCUMENTOS RELACIONADOS DISPONÍVEIS</h3>${references.map(d=>`<div class="bt-file"><span>TXT</span>${view.pref.mode==='cli'?`<pre>cat /${h(filename(d))}</pre>`:`<button data-cmd="cat /${h(filename(d))}">${h(d.title)}</button>`}</div>`).join('')}`);
 await attachDocumentControls(view,doc);
}

export async function mergeJournalPrompt(view){
 view.store.assertGM();if(!view.current)throw new Error('Abra primeiro um arquivo.');
 const id=view.current.id,plan=await view.store.planConsolidation(id);
 confirmOperation(view,'Unir os trechos antigos?',`${plan.count} páginas serão reunidas em uma página de texto, preservando o HTML e suas edições. Imagens, credenciais e permissões não mudam. Uma cópia privada será guardada. Links diretos para páginas removidas deixarão de funcionar; o Journal e a primeira página mantêm seus identificadores. Faça backup do mundo antes de continuar.`,()=>view.store.consolidateJournal(id,plan),()=>view.read(id));
}
