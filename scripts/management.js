import {randomUUID} from './crypto-runtime.js';
import {digest,fold} from './core.js';
import {filename} from './terminal-files.js';
export function folderPath(value='') {
  if(String(value).includes('..'))throw new Error('Use pastas dentro do acervo, sem ..');
  return String(value).split('/').map(s=>fold(s).trim().replace(/[^a-z0-9 -]/g,'').replace(/\s+/g,'-')).filter(Boolean).join('/').slice(0,200);
}
export function imagePath(value,{demo=false}={}) {
  const path=String(value||'').trim();
  if(demo&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(path)&&path.length<2800000)return path;
  if(!path||/[<>"\x00-\x1f]/.test(path)||path.includes('..')||path.startsWith('//')||/^(?!https?:)[a-z]+:/i.test(path)||!/\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(path))throw new Error('Selecione um caminho de imagem válido pelo navegador de arquivos.');
  return path;
}
export function documentInput(data,{demo=false}={}) {
  const title=String(data.title||'').trim(),group=folderPath(data.group||'geral').replaceAll('/','-');
  const paragraphs=Array.isArray(data.paragraphs)?data.paragraphs.map(String):String(data.text||'').split(/\n\s*\n/).filter(s=>s.trim());
  if(!title||title.length>140||!paragraphs.length||paragraphs.join('\n').length>120000)throw new Error('Informe título e texto; limite de 120 mil caracteres.');
  const appearance={title:String(data.appearance?.title||'').slice(0,100),subtitle:String(data.appearance?.subtitle||'').slice(0,160),ascii:String(data.appearance?.ascii||'').slice(0,6000),accent:String(data.appearance?.accent||'')};
  if(appearance.accent&&!/^#[a-f0-9]{6}$/i.test(appearance.accent))throw new Error('Cor inválida.');
  const assets=(data.assets||[]).map((a,i)=>({id:a.id||`anexo-${randomUUID()}`,title:String(a.title||`Imagem ${i+1}`).slice(0,140),path:imagePath(a.path,{demo}),source:a.source==='module'?'module':'world'}));
  if(assets.length>20)throw new Error('Limite de 20 imagens por documento.');
  return {title,group:group||'geral',folder:folderPath(data.folder),paragraphs,theme:String(data.theme||'babel'),classification:String(data.classification||'ARQUIVO LOCAL').slice(0,100),appearance,assets};
}
export function contentSnapshot(doc) {
  return {title:doc.title,paragraphs:doc.paragraphs||[],assets:doc.assets||[],group:doc.group||'',folder:doc.folder||'',theme:doc.theme||'babel',classification:doc.classification||'',appearance:doc.appearance||{},...(doc.references?{references:doc.references}:{}),...(doc.category?{category:doc.category}:{})};
}
export const contentHash=doc=>digest(JSON.stringify(contentSnapshot(doc)));
export function assertUniqueDocument(docs,doc,id){if(docs.some(d=>d.id!==id&&filename(d)===filename(doc)))throw new Error('Já existe esse nome de arquivo na pasta. Mude o título ou a pasta.');}
export async function packageDecision(existing,incoming){
  if(existing?.trashed)return 'trashed';
  if(!existing)return 'create-pending';
  if(existing.localEdited||!existing.installedHash||await contentHash(existing)!==existing.installedHash)return 'conflict';
  return await contentHash(incoming)===existing.packageHash?'unchanged':'update';
}
export function extractJournalPages(pages){
  const paragraphs=[],assets=[];let removed=0;
  for(const page of pages){
    const html=document.createElement('div');html.innerHTML=page.text?.content||'';
    for(const secret of html.querySelectorAll('.secret,[data-visibility="gm"],script,style,iframe,object')){secret.remove();removed++;}
    for(const quote of html.querySelectorAll('blockquote'))if(/apenas.*mestre|somente.*mestre|gm.only|\[!(danger|secret)\]/i.test(quote.textContent)){quote.remove();removed++;}
    for(const img of html.querySelectorAll('img')){try{assets.push({title:img.alt||page.name||'Imagem',path:imagePath(img.getAttribute('src')),source:'world'});}catch{}img.remove();}
    // Do not resolve UUIDs or reveal destinations of source-only links.
    for(const block of html.querySelectorAll('p,div,li,h1,h2,h3,h4,section,br'))block.append(document.createTextNode('\n\n'));
    let text=html.textContent.replace(/@UUID\[[^\]]+\](?:\{([^}]+)\})?/g,(_,label)=>label||'[referência omitida]');
    text=text.replace(/^.*\[!(?:danger|secret)\].*(?:\n>.*)*/gmi,()=>{removed++;return '';});
    if(text.trim())paragraphs.push(text.trim());
    if(page.type==='image'&&(page.src||page.image?.src)){try{assets.push({title:page.name||'Imagem',path:imagePath(page.src||page.image.src),source:'world'});}catch{}}
  }
  return {paragraphs,assets,removed};
}
