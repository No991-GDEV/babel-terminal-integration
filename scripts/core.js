import {randomUUID,sha256Bytes,passwordBytes} from './crypto-runtime.js';
export const ID = "babel-terminal-integration";
export const aliases = {help:"ajuda",ls:"listar",cd:"navegar",cat:"ler",read:"ler",search:"buscar",unlock:"acessar",image:"imagem",mail:"correio",back:"voltar",clear:"limpar",mode:"modo",settings:"preferencias",decrypt:"john",decifrar:"john",encrypt:"cifrar",ciphers:"cifras",file:"analisar"};
Object.assign(aliases,{analyze:'analisar',analyse:'analisar',analys:'analisar',admin:'mestre',cancel:'cancelar',grep:'buscar'});
export const commands = ['help','ls','cd','cat','page','search','unlock','image','mail','back','clear','mode','settings','ciphers','analyze','john','encrypt','cancel','admin','edit','whoami','history'];
commands.push('journal','mkdir','folders','access','approve','grant','revoke','passwd','group','pwd','import','trash','restore','folder','begin','start','guess','status','assist','aid','session','pause','resume','time','maintenance');
export function parse(input) {
  const words = input.trim().match(/"[^"\n]*"|'[^'\n]*'|\S+/g) || [];
  const [first = "", ...args] = words.map(s => s.replace(/^(["'])(.*)\1$/, "$2"));
  const cmd = first.toLowerCase();
  const normalized=Object.hasOwn(aliases,cmd)?aliases[cmd]:cmd;
  const subcommands=normalized==='correio'?{inbox:'entrada',sent:'enviados',archived:'arquivados',draft:'rascunho',compose:'escrever',write:'escrever',read:'ler',reply:'responder',forward:'encaminhar',archive:'arquivar',restore:'restaurar'}:normalized==='preferencias'?{sound:'som',effects:'efeitos',motion:'movimento',speed:'velocidade',font:'fonte'}:{};
  if(Object.hasOwn(subcommands,args[0]))args[0]=subcommands[args[0]];
  return {cmd: normalized, args};
}
export const fold = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function visibleDocuments(documents, user) {
  return documents.filter(d => !d.trashed && (user.isGM || (d.approved && d.access?.includes(user.id))));
}
export function eligibleForCredential(doc, target) {
  if (doc.trashed || !doc.approved) return false;
  if (target.startsWith("doc:")) return doc.id === target.slice(4);
  if(target.startsWith('folder:')){const path=target.slice(7);return !!path&&!doc.hasOwnPassword&&(doc.folder===path||doc.folder?.startsWith(path+'/'));}
  return target === `group:${doc.group}` && !doc.hasOwnPassword;
}
export function canReadMail(mail, user) {
  return user.isGM || mail.author === user.id || mail.to.includes(user.id);
}
export function updateDecision(existing, incomingHash, currentHash) {
  if (!existing) return "create-pending";
  if (currentHash !== existing.sourceHash) return "conflict";
  return incomingHash === existing.sourceHash ? "unchanged" : "update";
}
export async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  return [...await sha256Bytes(bytes)].map(b => b.toString(16).padStart(2,"0")).join("");
}
export async function passwordRecord(password, salt = randomUUID()) {
  if (typeof password!=='string'||password.length < 4||password.length>200) throw new Error("Use de quatro a 200 caracteres.");
  const bits = await passwordBytes(new TextEncoder().encode(password),new TextEncoder().encode(salt));
  return {salt, hash:[...new Uint8Array(bits)].map(b=>b.toString(16).padStart(2,"0")).join("")};
}
export async function matchesPassword(password, record) {
  return record && (await passwordRecord(password, record.salt)).hash === record.hash;
}
export function escapeHTML(value) {return String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export const THEMES = {
  babel: {title:"BABEL", subtitle:"REDE PESSOAL / AFTER ASHES", accent:"#d4b081", code:"BBL"},
  kruger: {title:"KRUGER", subtitle:"ENERGY CORPORATION / ARQUIVO DE REDE", accent:"#f4ac47", code:"KRG"}
};
export const KRUGER_ASCII = String.raw`             \   |   /
           .--=======--.
       ---/   .-----.   \---
         |   /  /|   \   |
       ==|  |  /_|_   |  |==
         |   \   |/  /   |
       ---\   '-----'   /---
           '--=======--'
             /   |   \
`;
