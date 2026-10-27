import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {registerJournalLauncher,attachJournalLauncher,hideInternalJournals} from '../scripts/launcher.js';
import {ID} from '../scripts/core.js';
import {readFileSync} from 'node:fs';

test('Compact launcher has its own fixed-height row without changing native actions/search/list',()=>{
 const css=readFileSync(new URL('../styles/terminal.css',import.meta.url),'utf8');
 const dom=new JSDOM(`<style>${css}</style><section><header class="directory-header"><div class="header-actions"><button>Create Entry</button><button>Create Folder</button></div><search><input></search></header><ol class="directory-list"><li>Babel — Administração privada</li></ol></section>`);
 globalThis.document=dom.window.document;const root=document.querySelector('section'),actions=root.querySelector('.header-actions'),search=root.querySelector('search'),list=root.querySelector('ol');
 const nativeHTML=[actions,search,list].map(el=>el.outerHTML);attachJournalLauncher({},root);
 const row=root.querySelector('.babel-journal-tools'),button=row.querySelector('button');
 assert.equal(row.parentElement,root.querySelector('header'));assert.notEqual(row.parentElement,actions);
 assert.deepEqual([actions,search,list].map(el=>el.outerHTML),nativeHTML);
 const rowStyle=dom.window.getComputedStyle(row),buttonStyle=dom.window.getComputedStyle(button);
 assert.equal(rowStyle.height,'32px');assert.equal(rowStyle.flexGrow,'0');assert.equal(buttonStyle.height,'32px');assert.equal(buttonStyle.flexBasis,'auto');assert.equal(buttonStyle.marginBottom,'0px');
});

test('Launcher registers before ready, survives initial-render timing, and never duplicates',async()=>{
 const dom=new JSDOM('<section><header class="directory-header"><button>Create Entry</button></header></section>');globalThis.document=dom.window.document;
 const hooks={},once={};globalThis.Hooks={on:(name,fn)=>hooks[name]=fn,once:(name,fn)=>once[name]=fn};
 const root=document.querySelector('section');globalThis.ui={journal:{element:root},notifications:{warn(){},error(){}}};let opened=0;
 globalThis.game={modules:new Map([[ID,{api:{openTerminal:async()=>{opened++;}}}]])};
 registerJournalLauncher();assert.equal(typeof hooks.renderJournalDirectory,'function');
 // Foundry's sidebar renders before ready.
 hooks.renderJournalDirectory({},root);assert.equal(root.querySelectorAll('[data-babel-launch]').length,1);
 once.ready();assert.equal(root.querySelectorAll('[data-babel-launch]').length,1);
 root.querySelector('[data-babel-launch]').click();await new Promise(r=>setImmediate(r));assert.equal(opened,1);
 // A subsequent partial render removes header content; hook restores the button.
 root.querySelector('header').replaceChildren();hooks.renderJournalDirectory({},root);assert.equal(root.querySelectorAll('[data-babel-launch]').length,1);
});
test('Launcher ready fallback covers an already rendered directory and handles missing API safely',()=>{
 const dom=new JSDOM('<section></section>');globalThis.document=dom.window.document;let warn=0;const root=document.querySelector('section');globalThis.game={modules:new Map()};globalThis.ui={notifications:{warn(){warn++;}}};
 attachJournalLauncher({element:root});root.querySelector('button').click();assert.equal(warn,1);assert.equal(root.querySelector('button').type,'button');
});

test('Internal Journals hidden on each render, even with existing launch button; native Journals untouched',()=>{
 const w=new JSDOM('<section class="directory"><header class="directory-header"></header><ol>'+['cipher','privateConfig','document','contact','ordinary'].map(id=>`<li class="directory-item" data-entry-id="${id}">${id}</li>`).join('')+'</ol></section>').window;
 globalThis.document=w.document;const journals=new Map(['cipher','privateConfig','document','contact','ordinary'].map(id=>[id,{getFlag:(_,key)=>key===id&&id!=='ordinary'}]));globalThis.game={journal:journals};
 const root=document.querySelector('section');attachJournalLauncher({},root);attachJournalLauncher({},root);
 assert.equal(root.querySelectorAll('.babel-internal-journal').length,4);assert.equal(root.querySelectorAll('.directory-item').length,5);assert.equal(journals.size,5);assert.equal(root.querySelector('[data-entry-id=ordinary]').classList.contains('babel-internal-journal'),false);
 root.querySelector('[data-entry-id=cipher]').classList.remove('babel-internal-journal');attachJournalLauncher({},root);assert.equal(root.querySelectorAll('.babel-internal-journal').length,4);
 game.user={isGM:true};hideInternalJournals(root);assert.equal(root.querySelector('[data-entry-id=document]').classList.contains('babel-internal-journal'),false);assert.equal(root.querySelectorAll('.babel-internal-journal').length,3);
});

test('Foundry styling does not shift checkbox markers or center file labels',()=>{
 const css=readFileSync(new URL('../styles/terminal.css',import.meta.url),'utf8');const w=new JSDOM(`<style>${css}</style><section class="babel-terminal"><form class="bt-form"><input type="checkbox" checked></form><div class="bt-file"><span>ENC</span><button>teste.enc</button></div></section>`).window;
 const box=w.getComputedStyle(w.document.querySelector('input')),button=w.getComputedStyle(w.document.querySelector('button'));
 assert.equal(box.padding,'0px');assert.equal(box.margin,'0px');assert.equal(box.flexBasis,'18px');assert.equal(box.appearance,'auto');assert.equal(button.alignItems,'flex-start');assert.equal(button.textAlign,'left');
 assert.match(css,/input\[type=checkbox\]::after\{content:none!important;display:none!important\}/);
});
