import {escapeHTML as h} from './core.js';
import {DEGREE_LABELS} from './cipher.js';
import {skillLabel} from './hacking-rules.js';

const clock=ms=>`${Math.floor(Math.max(0,Math.ceil(ms/1000))/60)}:${String(Math.max(0,Math.ceil(ms/1000))%60).padStart(2,'0')}`;
const button=(cmd,text)=>`<button type="button" data-cmd="${h(cmd)}">${h(text)}</button>`;
const letters=g=>[...g.word].map((letter,i)=>`<span class="bt-letter${g.matches?.[i]?' correct':''}">${h(letter)}</span>`).join('');
const row=(g,index)=>`<li aria-label="${h(g.word)}: ${g.hit} de 6 posições corretas${g.matches?`; posições ${g.matches.map((m,i)=>m?i+1:null).filter(Boolean).join(', ')||'nenhuma'}`:''}"><span class="bt-guess-number" aria-hidden="true">&gt; ${String(index+1).padStart(2,'0')}</span><span class="bt-letter-word" aria-hidden="true">${letters(g)}</span><strong aria-hidden="true">${g.hit}/6</strong></li>`;

// Decorative bytes depend only on row position, never on the answer or protected text.
function memoryBank(words,guesses,own,playing,pref){
 const half=Math.ceil(words.length/2),noise=['{%./','[#:!','<*&=','(!:;'],tails=['.%}]',':]!|','=&>/',';!)#'];
 const address=(column,row)=>(4096+(column*(half+2)+row)*16).toString(16).toUpperCase();
 const filler=(offset,column)=>`<div class="bt-memory-filler" aria-hidden="true"><span>0x${address(column,offset)}</span><span>${['.{}%..[|]..;/:?!..','&lt;/?..#=..{.}..%&gt;..'][column]}</span></div>`;
 return [words.slice(0,half),words.slice(half)].filter(column=>column.length).map((column,columnIndex)=>`<div class="bt-memory-column">${filler(0,columnIndex)}${column.map((word,j)=>{
  const index=columnIndex*half+j,tried=guesses.find(g=>g.word===word);
  return `<div class="bt-memory-row${tried?' bt-tried':''}"><span class="bt-memory-address" aria-hidden="true">0x${address(columnIndex,j+1)}</span><span class="bt-memory-noise" aria-hidden="true">${h(noise[index%4])}</span>${pref.mode==='cli'?`<code class="bt-memory-word">${h(word)}</code>`:`<button class="bt-memory-word" type="button" ${!own||!playing||tried?'disabled':''} data-cmd="guess ${h(word)}">${h(word)}</button>`}<span class="bt-memory-noise" aria-hidden="true">${h(tails[index%4])}</span>${tried?`<small>${tried.hit}/6</small>`:''}</div>`;
 }).join('')}${filler(column.length+1,columnIndex)}</div>`).join('');
}
export function hackingScreen(s,pref){
 const guesses=s.guesses||[],last=guesses.at(-1),own=s.owner,active=['running','paused'].includes(s.phase),playing=s.phase==='running',solved=s.phase==='solved';
 const words=s.candidates||[],phase={running:'CANAL ATIVO',paused:'CANAL SUSPENSO',solved:'DECIFRAÇÃO CONCLUÍDA',failed:'SESSÃO ENCERRADA'}[s.phase];
 return `<section class="bt-hacking bt-game" aria-label="Minigame de decifração">
  <header class="bt-game-heading"><div><div class="bt-label">BABEL / DECODER${s.gmTest?' / TESTE DO MESTRE':''}</div><h2>${h(s.title)}</h2></div><span class="bt-game-state" role="status"><i aria-hidden="true"></i>${phase}</span></header>
  <div class="bt-game-dashboard bt-puzzle-meters"><div><small>TEMPO</small><strong data-hack-clock>${clock(s.remainingMs||0)}</strong></div><div><small>PALPITES RESTANTES</small><strong>${Math.max(0,(s.budget||0)-guesses.length)}<span> / ${s.budget||0}</span></strong></div><div><small>OPERADOR</small><span class="bt-game-operator">${h(s.actor)}</span></div></div>
  ${s.phase==='paused'?`<p class="bt-game-notice">Ⅱ ${h(s.pauseReason||'Aguarde o mestre retomar.')}</p>`:''}
  ${active?`<div class="bt-game-workspace"><section class="bt-game-memory" aria-label="Memória de palavras"><div class="bt-game-bar"><span>MEMORY BANK</span><small>${words.length} CANDIDATAS / 6 LETRAS</small></div><p class="bt-game-howto">${own?'Escolha uma palavra. Verde marca a letra na posição certa.':'Acompanhe os palpites do hacker. Somente ele pode responder.'}</p><div class="bt-puzzle-words">${memoryBank(words,guesses,own,playing,pref)}</div><p class="bt-game-command"><code>guess PALAVRA</code> <span>Tab completa · repetir não gasta palpite</span></p></section>
  <aside class="bt-game-feedback" aria-label="Resultado dos palpites"><div class="bt-game-bar"><span>ANALYSIS BUFFER</span><small>${String(guesses.length).padStart(2,'0')} REGISTROS</small></div>${last?`<p class="bt-game-response" role="status">&gt; ${h(last.word)}<span>${last.hit?'Correspondência parcial':'Nenhuma posição confirmada'} <strong>${last.hit}/6</strong></span></p>`:'<p class="bt-game-response" role="status">&gt; AGUARDANDO PALPITE<span>Selecione uma palavra na memória.</span></p>'}<ol class="bt-guess-log">${guesses.map(row).join('')}</ol><div class="bt-game-legend"><span><i class="correct" aria-hidden="true">A</i> correta nesta posição</span><span><i aria-hidden="true">A</i> posição não confirmada</span></div><p class="bt-muted">A palavra do puzzle não é a senha do arquivo.</p></aside></div>`:''}
  ${solved?`<div class="bt-game-outcome success"><span aria-hidden="true">[ OK ]</span><h3>Texto recuperado</h3>${own?`<pre class="bt-recovered">${h(s.text)}</pre><p>Se for uma credencial, use <code>unlock</code> para liberar os arquivos.</p>`:'<p>O texto foi entregue apenas ao hacker.</p>'}</div>`:''}
  ${s.phase==='failed'?`<div class="bt-game-outcome"><span aria-hidden="true">[ ENC ]</span><h3>O arquivo continua cifrado</h3><p>${h(s.reason||'A tentativa terminou sem recuperar o texto.')}</p></div>`:''}
  ${!active&&guesses.length?`<ol class="bt-guess-log bt-game-final-guesses">${guesses.map(row).join('')}</ol>`:''}
  <footer class="bt-game-footer"><div class="bt-toolbar">${button('ciphers','← ARQUIVOS CIFRADOS')}${button('status','ATUALIZAR')}${solved&&own?button('unlock','INSERIR CREDENCIAL'):''}${s.isGM&&active?`${button('pause','PAUSAR')}${button('resume','RETOMAR')}${button('time 30','+30 S')}${button('time -30','−30 S')}`:''}</div><p class="bt-muted">${active?'Esc sai da tela; o relógio continua enquanto a sessão estiver ativa.':'Esc volta aos arquivos cifrados.'}${s.isGM&&active?' · pause / resume / time ±SEGUNDOS':''}</p></footer>
  <details class="bt-game-report"><summary>FICHA E APOIOS</summary><p>${h(skillLabel(s.skill))} · CD ${s.roll?.dc??s.dc}${s.roll?` · ${h(DEGREE_LABELS[s.roll.degree])} · total ${s.roll.total} (${h(s.roll.formula)})`:''}</p>${s.approach?`<p>${h(s.approach)}</p>`:''}<p>Apoios: ${s.effects.time>0?'+':''}${s.effects.time}s · ${s.effects.guesses>0?'+':''}${s.effects.guesses} palpites · ${s.effects.analysis>0?'+':''}${s.effects.analysis} CD</p>${s.supports.map(a=>`<p>${h(a.actor)} — ${h(a.title)}: ${h(a.state==='done'?DEGREE_LABELS[a.degree]:a.state==='rolling'?'pendente':'cancelado')}</p>`).join('')}</details>
  <p data-hack-connection class="bt-muted" aria-live="polite"></p>
 </section>`;
}
