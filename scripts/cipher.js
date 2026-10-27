// In-world puzzles only. The key stays in the GM-only store, never in the player's file.
import {randomBytes,aesEncrypt,aesDecrypt} from './crypto-runtime.js';
import {challengeRules} from './hacking-rules.js';
import {supportRules,isSolved} from './hacking-engine.js';
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const bytes = value => Uint8Array.from(value.match(/../g) || [], b => parseInt(b, 16));
export const DEGREE_LABELS = ['Falha crítica', 'Falha', 'Sucesso', 'Sucesso crítico'];

export async function sealText(text) {
  const key = randomBytes(32), iv = randomBytes(12);
  const encrypted = await aesEncrypt(key,iv,new TextEncoder().encode(text));
  return {key:hex(key), iv:hex(iv), ciphertext:hex(encrypted)};
}
export async function unsealText(record) {
  if(!/^[a-f0-9]{64}$/i.test(record.key||'')||!/^[a-f0-9]{24}$/i.test(record.iv||'')||!/^([a-f0-9]{2}){16,}$/i.test(record.ciphertext||''))throw new Error('Registro cifrado incompleto. Peça ao mestre para conferir o arquivo; nenhuma chave foi substituída.');
  const plain = await aesDecrypt(bytes(record.key),bytes(record.iv),bytes(record.ciphertext));
  return new TextDecoder().decode(plain);
}
export function validateCipher(data, users) {
  const title = String(data.title || '').trim(), text = String(data.text || '');
  const dc = Number(data.dc), maxAttempts = Number(data.maxAttempts ?? 1);
  const recipients = [...new Set(data.recipients || [])];
  if (!title || title.length > 100 || !text.trim() || text.length > 4000) throw new Error('Informe um nome (até 100 caracteres) e a senha ou mensagem (até 4.000).');
  if (!Number.isInteger(dc) || dc < 1 || dc > 60) throw new Error('A dificuldade deve ser um número inteiro de 1 a 60.');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) throw new Error('Escolha de 1 a 5 tentativas por personagem.');
  if (!recipients.length || recipients.some(id => !users.some(u => u.id === id && !u.isGM))) throw new Error('Selecione pelo menos um jogador válido.');
  return {title, text, dc, maxAttempts, recipients, ...challengeRules(data),...supportRules(data,users)};
}
export function publicCipher(record) {
  return {id:record.id, title:record.title, ciphertext:record.ciphertext, iv:record.iv, dc:record.dc, maxAttempts:record.maxAttempts, ...challengeRules(record),collaborative:!!record.supports?.length};
}
export function attemptAvailable(record, actorId) {
  const history = record.attempts?.[actorId] || [];
  if (history.some(isSolved)) return 'solved';
  if (history.length >= record.maxAttempts) throw new Error('Tentativas esgotadas para este personagem. O mestre pode autorizar uma nova rodada.');
  return 'ready';
}
export function demoDegree(die, bonus, dc) {
  const total = die + bonus;
  let degree = total >= dc + 10 ? 3 : total >= dc ? 2 : total <= dc - 10 ? 0 : 1;
  return Math.max(0, Math.min(3, degree + (die === 20 ? 1 : die === 1 ? -1 : 0)));
}
export function cipherDisplay(ciphertext) {return (ciphertext.toUpperCase().match(/.{1,32}/g) || []).map(line => (line.match(/.{1,4}/g) || []).join(' ')).join('\n');}
