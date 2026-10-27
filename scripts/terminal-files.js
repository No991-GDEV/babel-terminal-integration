import {fold,parse} from './core.js';

export function filename(item, extension='txt') {
  const raw=String(item.filename||item.title||item.subject||'arquivo');
  const base=fold(raw).replace(/\.(enc|txt|eml|png|jpe?g|webp)$/i,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'arquivo';
  const stamp=extension==='eml'&&Number.isFinite(item.time)?'-'+new Date(item.time).toISOString().replace(/[^0-9]/g,''):'';
  return `${item.folder?item.folder+'/':''}${base}${stamp}.${extension}`;
}
export function imageFilename(item) {return filename(item,item.path?.match(/\.(png|jpe?g|webp)$/i)?.[1]?.toLowerCase()||'png');}
export function resolveFile(items, reference, extension='txt') {
  const name=fold(reference.trim()),matches=items.filter(item=>fold(typeof extension==='function'?extension(item):filename(item,extension))===name||fold(item.title||item.subject||'')===name);
  if(!matches.length)matches.push(...items.filter(item=>fold(typeof extension==='function'?extension(item):filename(item,extension)).split('/').at(-1)===name));
  if(matches.length>1)throw new Error('Há arquivos com o mesmo nome. Peça ao mestre para diferenciá-los; nenhum foi escolhido automaticamente.');
  if(matches.length)return matches[0];
  // Legacy IDs remain accepted but are never suggested to the player.
  return items.find(item=>item.id===reference);
}
export const englishCommand={ajuda:'help',listar:'ls',navegar:'cd',ler:'cat',buscar:'search',acessar:'unlock',imagem:'image',correio:'mail',voltar:'back',limpar:'clear',modo:'mode',preferencias:'settings',mestre:'admin',cifras:'ciphers',cifrar:'encrypt',analisar:'analyze',john:'john',cancelar:'cancel'};
export const englishMail={entrada:'inbox',enviados:'sent',arquivados:'archived',rascunho:'draft',escrever:'compose',ler:'read',responder:'reply',encaminhar:'forward',arquivar:'archive',restaurar:'restore',desarquivar:'restore'};
export function displayCommand(text) {
  const {cmd,args}=parse(text),parts=[englishCommand[cmd]||cmd,...args];
  if(cmd==='correio'&&parts[1])parts[1]=englishMail[parts[1]]||parts[1];
  return parts.join(' ');
}
export async function completionCandidates(value,store,current,commands,cwd=null) {
  const trimmed=value.trimStart(),hasSpace=/\s/.test(trimmed);
  if(!hasSpace)return commands.filter(c=>fold(c).startsWith(fold(trimmed))).map(c=>`${c} `);
  const {cmd,args}=parse(trimmed),prefix=englishCommand[cmd]||cmd;
  const parameter=trimmed.slice(trimmed.search(/\s/)).trimStart().replace(/^["']|["']$/g,'');
  let names=[];
  if(cmd==='edit'&&store.user.isGM)names=(await store.all()).map(d=>filename(d));
  else if(cmd==='trash'&&store.user.isGM)names=(await store.all()).map(d=>filename(d));
  else if(cmd==='restore'&&store.user.isGM)names=(await store.trashDocuments()).map(d=>filename(d));
  else if(cmd==='ler')names=(await store.list()).map(d=>filename(d));
  else if(cmd==='john')names=(await store.ciphers()).map(c=>filename(c,'enc'));
  else if(cmd==='analisar')names=[...(await store.list()).map(d=>filename(d)),...(await store.ciphers()).map(c=>filename(c,'enc'))];
  else if(cmd==='imagem'){const doc=current&&await store.get(current.id);names=(doc?.assets||[]).map(imageFilename);}
  else if(cmd==='navegar'||cmd==='listar'){const paths=(await store.list()).map(d=>d.folder||'');if(store.user.isGM&&store.folderCatalog)paths.push(...await store.folderCatalog());names=['/','..',...paths.flatMap(p=>p.split('/').map((_,i)=>p.split('/').slice(0,i+1).join('/')))].filter(Boolean);}
  else if(cmd==='modo')names=['cli','panel'];
  else if(cmd==='preferencias')names=['sound on','sound off','volume ','speed ','font ','effects on','effects off','static on','static off','motion on','motion off'];
  else if(cmd==='passwd'&&store.user.isGM)names=['show','folder','group','group show','inherit','generate','group generate'];
  else if(cmd==='maintenance'&&store.user.isGM)names=['backup','restore'];
  else if(cmd==='correio'){
    if(!/\s/.test(parameter))return Object.values(englishMail).filter((x,i,a)=>a.indexOf(x)===i&&x.startsWith(parameter)).map(x=>`mail ${x} `);
    const action=args[0],head=`mail ${englishMail[action]||action} `;
    const part=parameter.slice(parameter.search(/\s/)).trim().replace(/^["']|["']$/g,'');
    if(['ler','responder','encaminhar','arquivar','restaurar','desarquivar'].includes(action))return [...new Set((await store.mails()).map(m=>filename(m,'eml')))].filter(n=>fold(n).startsWith(fold(part))).sort().map(n=>head+n);
    return [];
  }
  if(cwd!==null&&['edit','trash','ler','navegar','listar'].includes(cmd)){
    const base=cwd?cwd+'/':'';
    if(parameter.startsWith('/'))names=names.map(n=>n==='..'?n:n==='/'?'/':'/'+n);
    else if(parameter.startsWith('../')){
      const prefix=parameter.match(/^(?:\.\.\/)+/)[0],up=prefix.split('/').length-1,parent=cwd.split('/').filter(Boolean).slice(0,Math.max(0,cwd.split('/').filter(Boolean).length-up)).join('/'),root=parent?parent+'/':'';
      names=names.filter(n=>n.startsWith(root)).map(n=>prefix+n.slice(root.length));
    }else if(parameter.startsWith('./'))names=names.filter(n=>n.startsWith(base)).map(n=>'./'+n.slice(base.length));
    else names=names.filter(n=>n==='..'||n==='/'||n.startsWith(base)).map(n=>n==='..'||n==='/'?n:n.slice(base.length));
  }
  return [...new Set(names)].filter(n=>fold(n).startsWith(fold(parameter))).sort().map(n=>`${prefix} ${n}`);
}
