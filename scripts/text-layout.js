import {escapeHTML as h} from './core.js';
// A deliberately small plain-text formatter. No HTML, URLs or scripts are evaluated.
export function textLayout(paragraphs=[]){
 return paragraphs.flatMap(p=>p.split(/\n\s*\n/).filter(Boolean)).map(p=>{
  const lines=p.split('\n');
  if(lines.length>1&&lines.every(l=>/^\s*\|.*\|\s*$/.test(l)))return `<div class="bt-lore-table"><table>${lines.filter(l=>!/^\|[\s:|\-]+\|$/.test(l)).map((l,i)=>`<tr>${l.trim().slice(1,-1).split('|').map(c=>`<${i?'td':'th'}>${h(c.trim())}</${i?'td':'th'}>`).join('')}</tr>`).join('')}</table></div>`;
  if(lines.length>1)return lines.map(line=>{const head=line.match(/^#{2,6}\s+(.+)$/);return head?`<h3>${h(head[1])}</h3>`:`<p>${h(line)}</p>`;}).join('');
  const heading=p.match(/^#{2,6}\s+(.+)$/);
  return heading?`<h3>${h(heading[1])}</h3>`:`<p>${h(p)}</p>`;
 }).join('');
}
