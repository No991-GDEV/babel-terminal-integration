// Paths belong only to the fictional library; never used for filesystem access.
import {fold} from './core.js';
import {filename,resolveFile} from './terminal-files.js';
export function resolvePath(value='',cwd=''){
 const input=String(value).trim();
 if(!input||input==='~')return '';
 const parts=input.startsWith('/')||input.startsWith('~/')?[]:cwd.split('/').filter(Boolean);
 for(const part of input.replace(/^~\//,'').split('/')){
  if(!part||part==='.')continue;
  if(part==='..'){parts.pop();continue;}
  parts.push(fold(part));
 }
 return parts.join('/');
}
export function localFile(items,reference,cwd=''){
 const path=resolvePath(reference,cwd);
 const exact=items.find(d=>filename(d)===path);
 if(exact)return exact;
 // Keep qualified old links and stable API IDs working.
 if(reference.includes('/')&&!reference.startsWith('.')&&!reference.startsWith('/')){
  const legacy=items.find(d=>filename(d)===fold(reference));if(legacy)return legacy;
 }
 const id=items.find(d=>d.id===reference);if(id)return id;
 return resolveFile(items.filter(d=>(d.folder||'')===cwd),reference);
}
