import test from 'node:test';
import assert from 'node:assert/strict';
import {sealText,unsealText,publicCipher} from '../scripts/cipher.js';
import {passwordRecord,matchesPassword,digest} from '../scripts/core.js';
import {randomUUID,randomBytes,aesEncrypt} from '../scripts/crypto-runtime.js';
const native=globalThis.crypto;
async function withoutSubtle(fn){
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 Object.defineProperty(globalThis,'crypto',{value:{getRandomValues:a=>native.getRandomValues(a)},configurable:true});
 try{return await fn();}finally{Object.defineProperty(globalThis,'crypto',descriptor);}
}
test('No subtle/importKey: decrypts existing WebCrypto AES-GCM files and vice versa, preserving authentication',async()=>{
 const text='Senha fictícia — maçã 日本語',old=await sealText(text);
 const next=await withoutSubtle(async()=>{
  assert.equal(globalThis.crypto.subtle,undefined);assert.equal(await unsealText(old),text);
  const created=await sealText(text);assert.equal(await unsealText(created),text);
  const tampered={...old,ciphertext:(old.ciphertext.startsWith('00')?'01':'00')+old.ciphertext.slice(2)};
  await assert.rejects(unsealText(tampered));
  assert.ok(!JSON.stringify(publicCipher({...created,id:'x',text})).includes(created.key));
  return created;
 });
 assert.equal(await unsealText(next),text);
});
test('HTTP fallback preserves PBKDF2 credentials, SHA-256 package hashes and secure UUIDs',async()=>{
 const password='Senha ficcional com ç',before=await passwordRecord(password,'same-salt');
 const after=await withoutSubtle(async()=>{
  assert.equal(await matchesPassword(password,before),true);assert.equal(await matchesPassword('errada',before),false);
  assert.equal(await digest('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const ids=Array.from({length:40},()=>randomUUID());assert.equal(new Set(ids).size,40);for(const id of ids)assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  return passwordRecord(password,'same-salt');
 });assert.deepEqual(after,before);
});
test('No insecure random fallback; malformed keys never become a new cipher',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');Object.defineProperty(globalThis,'crypto',{value:{},configurable:true});
 try{assert.throws(()=>randomBytes(32),/aleatoriedade segura/);assert.throws(()=>randomUUID(),/aleatoriedade segura/);}finally{Object.defineProperty(globalThis,'crypto',descriptor);}
 await assert.rejects(unsealText({key:'abc',iv:'123',ciphertext:'x'}),/incompleto/);
});
