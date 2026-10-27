import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {FoundryStore} from '../scripts/foundry-store.js';
import {journalData} from '../scripts/journal-source.js';
import {registerJournalRefresh} from '../scripts/journal-refresh.js';
import {contentHash} from '../scripts/management.js';
import {ID} from '../scripts/core.js';
function fixture(){
 const w=new JSDOM('<main><div class="bt-content"><article><div data-reader-document></div></article></div></main>').window;globalThis.document=w.document;
 const gm={id:'gm',isGM:true},player={id:'player',isGM:false},users=[gm,player];users.contents=users;users.get=id=>users.find(u=>u.id===id);
 const flags={},cf={privateConfig:true},j={id:'native1',name:'Journal original',ownership:{default:0,player:2},pages:{contents:[{id:'p1',name:'Página',type:'text',text:{content:'<p>Original.</p>'}}]},getFlag:(_,key)=>flags[key],setFlag:async(_,key,v)=>{flags[key]=structuredClone(v);},testUserPermission:u=>u.isGM||j.ownership[u.id]>=2,toObject:()=>({name:j.name,ownership:structuredClone(j.ownership),pages:structuredClone(j.pages.contents)}),sheet:{render:async()=>{j.opened=true;}}};
 const config={id:'private',ownership:{default:0},getFlag:(_,key)=>cf[key],setFlag:async(_,key,v)=>{cf[key]=structuredClone(v);}};
 const journals=[j,config];journals.get=id=>journals.find(j=>j.id===id);globalThis.game={user:gm,users,journal:journals};
 return {s:new FoundryStore(),j,flags,cf,gm,player,journals};
}
test('native Journal is registered without a copy, page rewrite or ownership change; reads stay live',async()=>{
 const {s,j,flags,cf,journals}=fixture(),before=j.toObject();
 const preview=await s.sourcePreview(j.id),expectedHash=await contentHash(preview);
 const id=await s.registerJournal(j.id,{group:'kruger',folder:'rede',theme:'kruger'},{reviewed:true,expectedHash});
 assert.equal(journals.length,2);assert.deepEqual(j.toObject(),before);assert.equal(flags.document.approved,false);assert.equal(flags.document.nativeJournal,true);assert.ok(cf.documentBackups[j.id]);
 j.name='Título editado no Journal';j.pages.contents[0].text.content='<p>Alterado no Foundry.</p><img src="worlds/test/novo.png" alt="Novo">';
 const doc=await s.get(id);assert.equal(doc.title,j.name);assert.equal(doc.paragraphs[0],'Alterado no Foundry.');assert.equal(doc.assets[0].path,'worlds/test/novo.png');
 await s.openJournal(id);assert.equal(j.opened,true);
 await assert.rejects(s.saveDocument({title:doc.title,text:'Não achatar'},{id}),/Journal original/);
});
test('direct registration fails closed for changed review, secrets, page restrictions and player',async()=>{
 const {s,j,player}=fixture(),preview=await s.sourcePreview(j.id),expectedHash=await contentHash(preview),args={reviewed:true,expectedHash};
 await assert.rejects(s.registerJournal(j.id,{group:'g'},{}),/revisão/);
 j.pages.contents[0].text.content='<p>Outro.</p>';await assert.rejects(s.registerJournal(j.id,{group:'g'},args),/mudou/);
 j.pages.contents[0].text.content='<p>Original.</p><section class="secret">SECRETO</section>';await assert.rejects(s.registerJournal(j.id,{group:'g'},args),/reservados/);
 j.pages.contents[0].text.content='<p>Original.</p>';j.pages.contents[0].ownership={default:0};await assert.rejects(s.registerJournal(j.id,{group:'g'},args),/permissões próprias/);
 game.user=player;await assert.rejects(s.registerJournal(j.id,{group:'g'},args),/mestre/);
});
test('Journal projection follows images and title, strips GM blocks, respects page access and legacy annexes',()=>{
 fixture();const j={name:'Nativo',pages:{contents:[{type:'text',text:{content:'<p>Visível</p><section class="secret">SEGREDO<img src="privado.png"></section><img src="publico.png">'}},{type:'image',name:'Mapa',src:'mapa.png'},{type:'text',testUserPermission:()=>false,text:{content:'PÁGINA RESTRITA'}}]}};
 const d=journalData(j,{isGM:false},{title:'Antigo',assetsInJournal:true,assets:[{path:'removido.png'}]});
 assert.equal(d.title,'Nativo');assert.equal(d.assets.length,2);assert.ok(!JSON.stringify(d).includes('SEGREDO'));assert.ok(!JSON.stringify(d).includes('RESTRITA'));assert.ok(!JSON.stringify(d).includes('removido'));
 const legacy=journalData({name:'Antigo',pages:{contents:[]}},{isGM:true},{assets:[{id:'old',path:'assets/kruger.png',source:'module'}]});assert.equal(legacy.assets[0].id,'old');
});
test('Journal page hooks refresh readers without overwriting forms; revocation and deletion clear the file',async()=>{
 const {j,flags,s}=fixture();flags.document={id:'d',approved:true};
 const events={};globalThis.Hooks={on:(name,fn)=>events[name]=fn};let reads=0,homes=0;
 const view={active:true,current:{id:'d'},store:s,root:document.querySelector('main'),output:document.querySelector('article'),read:async()=>{reads++;},skip(){},cancelPrompt(){},home:async()=>{homes++;}};
 registerJournalRefresh(()=>view);events.updateJournalEntryPage({parent:j});await new Promise(r=>setTimeout(r,180));assert.equal(reads,1);
 view.pending=()=>{};events.updateJournalEntry(j);await new Promise(r=>setTimeout(r,180));assert.equal(reads,1);view.pending=null;
 events.deleteJournalEntry(j);assert.equal(homes,1);
 s.user={isGM:false};j.ownership.player=0;events.updateJournalEntry(j);assert.equal(homes,2);
});

test('package writes native image pages and remains unchanged on reimport; native edits become conflicts',async()=>{
 const {s,journals}=fixture();let creates=0;
 globalThis.JournalEntry={create:async data=>{
  creates++;const j={...structuredClone(data),id:'created',pages:{contents:data.pages.map((p,i)=>({...p,id:'page'+i,sort:i*100000}))},getFlag(_,key){return this.flags[ID][key];},async setFlag(_,key,value){this.flags[ID][key]=structuredClone(value);}};
  journals.push(j);return j;
 }};
 const incoming=[{id:'package-test',title:'Pacote',paragraphs:['Texto original.','Outro parágrafo.'],folder:'teste',group:'teste',assets:[{id:'symbol',title:'Símbolo',path:'assets/test.png',source:'module'}]}];
 await s.setup(incoming);
 const j=s.journal('package-test'),doc=s.toDocument(j);
 assert.equal(j.pages.contents.length,2);assert.equal(j.pages.contents[0].name,'Pacote');assert.equal(j.pages.contents[0].text.content,'<p>Texto original.</p>\n<p>Outro parágrafo.</p>');assert.equal(doc.readerPages.length,1);assert.deepEqual(doc.readerPages[0].paragraphs,['Texto original.','Outro parágrafo.']);assert.equal(j.pages.contents[1].type,'image');assert.equal(j.pages.contents[1].src,`modules/${ID}/assets/test.png`);
 assert.equal(doc.assets[0].id,'symbol');assert.equal(doc.assets[0].source,'module');assert.equal(j.getFlag(ID,'document').assetsInJournal,true);
 assert.equal((await s.packagePreview(incoming))[0].decision,'unchanged');
 await s.setup(incoming);assert.equal(creates,1);
 j.pages.contents[0].text.content='<p>Edição feita no Foundry.</p>';
 assert.equal((await s.packagePreview(incoming))[0].decision,'conflict');
 await s.setup(incoming);assert.equal(creates,1);assert.equal(s.toDocument(j).paragraphs[0],'Edição feita no Foundry.');
});
