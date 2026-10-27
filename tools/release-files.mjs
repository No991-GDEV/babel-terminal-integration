// Explicit release surface: no vault, review reports, tests, backups or development preview.
import {readFile,readdir,mkdir,copyFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {babel} from '../content/babel.js';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function releaseFiles(){
 const files=new Set(['module.json','MASTER-GUIDE.md','THIRD-PARTY-NOTICES.md']);
 async function visit(relative){
  if(files.has(relative))return;
  if(relative.startsWith('../')||path.isAbsolute(relative))throw new Error('Dependência fora do módulo.');
  files.add(relative);const text=await readFile(path.join(root,relative),'utf8');
  if(relative.endsWith('.js'))for(const match of text.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"](\.[^'"]+)['"]/g))await visit(path.posix.normalize(path.posix.join(path.posix.dirname(relative),match[1])));
 }
 const manifest=JSON.parse(await readFile(path.join(root,'module.json'),'utf8'));
 for(const file of [...manifest.esmodules,...manifest.styles])await visit(file);
 for(const folder of ['assets/fonts','scripts/vendor'])for(const file of await readdir(path.join(root,folder)))if(file.endsWith('.txt')||file.endsWith('.woff2'))files.add(folder+'/'+file);
 for(const d of babel.documents)for(const a of d.assets)files.add(a.path);
 return [...files].sort();
}
if(process.argv.includes('--list'))console.log(JSON.stringify(await releaseFiles()));
if(process.argv.includes('--stage')){
 const manifest=JSON.parse(await readFile(path.join(root,'module.json'),'utf8'));
 const stage=path.join(root,'dist','release-'+manifest.version+'-'+Date.now(),'babel-terminal-integration');
 const files=await releaseFiles();
 for(const file of files){const destination=path.join(stage,file);await mkdir(path.dirname(destination),{recursive:true});await copyFile(path.join(root,file),destination);}
 await mkdir(path.join(root,'local-reports'),{recursive:true});
 await writeFile(path.join(root,'local-reports','release-stage.json'),JSON.stringify({stage,version:manifest.version,files},null,2));
 console.log(JSON.stringify({stage,version:manifest.version,files:files.length}));
}
