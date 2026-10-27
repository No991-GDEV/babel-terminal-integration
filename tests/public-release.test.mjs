import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {babel} from '../content/babel.js';
import {releaseFiles} from '../tools/release-files.mjs';
const root=new URL('../',import.meta.url);
test('public release manifest uses a stable updater and a version-pinned ZIP without changing identity or compatibility',async()=>{
 const m=JSON.parse(await readFile(new URL('module.json',root),'utf8')),pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
 assert.equal(m.id,'babel-terminal-integration');assert.equal(m.version,pkg.version);assert.match(m.version,/^\d+\.\d+\.\d+$/);
 assert.equal(m.manifest,'https://github.com/No991-GDEV/babel-terminal-integration/releases/latest/download/module.json');
 assert.equal(m.download,`https://github.com/No991-GDEV/babel-terminal-integration/releases/download/v${m.version}/babel-terminal-integration.zip`);
 assert.deepEqual(m.compatibility,{minimum:'14.365',verified:'14.367',maximum:'14'});
 assert.equal(new URL(m.download).search,'');assert.equal(new URL(m.manifest).search,'');
});
test('public catalog is self-contained, pending and free of private export markers',async()=>{
 assert.equal(babel.documents.length,103);const ids=new Set(babel.documents.map(d=>d.id));assert.equal(ids.size,103);
 const assets=[...new Set(babel.documents.flatMap(d=>d.assets.map(a=>a.path)))];assert.equal(assets.length,80);
 for(const d of babel.documents){assert.equal(d.approved,false);assert.ok(d.paragraphs.length);for(const ref of d.references||[])assert.ok(ids.has(ref));}
 assert.doesNotMatch(JSON.stringify(babel),/obsidian:\/\/|\[\[|Apenas para o Mestre|sourcePath|sourceHash|credentialSecrets/);
 // The hash registry exists in the clean public checkout, not in the private authoring source.
 let registry;try{registry=JSON.parse(await readFile(new URL('content/assets.sha256.json',root),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 for(const asset of assets){const data=await readFile(new URL(asset,root));if(registry)assert.equal(createHash('sha256').update(data).digest('hex'),registry[asset]);}
 if(registry)assert.deepEqual(Object.keys(registry).sort(),assets.sort());
});
test('release surface excludes private files, development fixtures and authentication tooling',async()=>{
 const files=await releaseFiles();for(const file of files){assert.doesNotMatch(file,/^(?:local-reports|local-install-backups|node_modules|tests|tools|private|publication|\.local-tools|dist)\//);assert.doesNotMatch(file,/(?:^|\/)\.env/);await access(new URL(file,root));}
 assert.ok(files.includes('THIRD-PARTY-NOTICES.md'));assert.ok(files.includes('assets/fonts/LICENSE.txt'));assert.ok(files.includes('scripts/vendor/LICENSE-noble-ciphers.txt'));assert.ok(files.includes('scripts/vendor/LICENSE-noble-hashes.txt'));
 assert.ok(!files.includes('content/pilot.js'));assert.ok(!files.includes('content/kruger.js'));assert.ok(!files.includes('assets/kruger.png'));
});
