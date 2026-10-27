// Prefer WebCrypto. Some local HTTP/Electron contexts expose random values but
// not subtle/randomUUID. The bundled fallback preserves the same wire formats.
let fallback;
const noble=()=>fallback??=import('./vendor/crypto.js');
const hex=data=>Array.from(data,b=>b.toString(16).padStart(2,'0')).join('');
export function randomBytes(length){
 if(!globalThis.crypto?.getRandomValues)throw new Error('Este navegador não disponibiliza aleatoriedade segura. Abra o Foundry por localhost ou HTTPS.');
 return globalThis.crypto.getRandomValues(new Uint8Array(length));
}
export function randomUUID(){
 if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
 const b=randomBytes(16);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const s=hex(b);return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
}
export async function sha256Bytes(input){
 const subtle=globalThis.crypto?.subtle;
 return subtle?new Uint8Array(await subtle.digest('SHA-256',input)):(await noble()).sha256(input);
}
export async function passwordBytes(password,salt){
 const subtle=globalThis.crypto?.subtle;
 if(!subtle){const {pbkdf2Async,sha256}=await noble();return pbkdf2Async(sha256,password,salt,{c:120000,dkLen:32,asyncTick:10});}
 const key=await subtle.importKey('raw',password,'PBKDF2',false,['deriveBits']);
 return new Uint8Array(await subtle.deriveBits({name:'PBKDF2',salt,iterations:120000,hash:'SHA-256'},key,256));
}
export async function aesEncrypt(key,iv,plain){
 const subtle=globalThis.crypto?.subtle;
 if(!subtle)return (await noble()).gcm(key,iv).encrypt(plain);
 const imported=await subtle.importKey('raw',key,'AES-GCM',false,['encrypt']);
 return new Uint8Array(await subtle.encrypt({name:'AES-GCM',iv},imported,plain));
}
export async function aesDecrypt(key,iv,ciphertext){
 const subtle=globalThis.crypto?.subtle;
 if(!subtle)return (await noble()).gcm(key,iv).decrypt(ciphertext);
 const imported=await subtle.importKey('raw',key,'AES-GCM',false,['decrypt']);
 return new Uint8Array(await subtle.decrypt({name:'AES-GCM',iv},imported,ciphertext));
}
