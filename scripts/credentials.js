import {ID,passwordRecord,digest} from './core.js';
import {randomUUID} from './crypto-runtime.js';
import {folderPath} from './management.js';
let queue=Promise.resolve();
const serial=work=>{const result=queue.catch(()=>{}).then(work);queue=result;return result;};
const generate=()=>`BBL-${randomUUID().replaceAll('-','').slice(0,16).toUpperCase()}`;
async function vault(store){
 store.assertGM();if(store.demo)return {read:k=>structuredClone(store.state[k]||{}),write:async(k,v)=>{store.state[k]=v;store.save();}};
 const config=await store.privateConfig();return {read:k=>structuredClone(config.getFlag(ID,k)||{}),write:(k,v)=>config.setFlag(ID,k,v)};
}
export const credentialMethods={
 async configure(target,password,{exclusive=true}={}){
  this.assertGM();if(typeof password!=='string'||password.length>200)throw new Error('Use de 4 a 200 caracteres.');
  if(target.startsWith('doc:')){if(!(await this.all()).some(d=>d.id===target.slice(4)))throw new Error('Documento ausente.');}
  else if(target.startsWith('folder:')){if(!target.slice(7)||folderPath(target.slice(7))!==target.slice(7))throw new Error('Pasta inválida.');}
  else if(!target.startsWith('group:')||!target.slice(6))throw new Error('Destino de credencial inválido.');
  return serial(async()=>{const v=await vault(this),records=v.read('credentials');records[target]={...await passwordRecord(password),fingerprint:await digest(password)};const secrets=v.read('credentialSecrets');secrets[target]=password;
   await v.write('credentials',records);await v.write('credentialSecrets',secrets);
   if(target.startsWith('doc:')){const id=target.slice(4);if(this.demo){this.state.documents.find(d=>d.id===id).hasOwnPassword=exclusive;this.save();}else{const j=this.journal(id);await j.setFlag(ID,'document',{...j.getFlag(ID,'document'),hasOwnPassword:exclusive});}}
  });
 },
 async ensureCredentials(targets=null){
  this.assertGM();
  if(!targets){const docs=await this.all();targets=[...docs.map(d=>'doc:'+d.id),...(await this.folderCatalog()).flatMap(path=>path.split('/').map((_,i)=>'folder:'+path.split('/').slice(0,i+1).join('/')))];}
  return serial(async()=>{const v=await vault(this),records=v.read('credentials'),secrets=v.read('credentialSecrets');let count=0;
   for(const target of new Set(targets)){if(records[target])continue;if(!/^(doc|folder|group):.+/.test(target))throw new Error('Destino inválido.');const secret=generate();records[target]={...await passwordRecord(secret),fingerprint:await digest(secret)};secrets[target]=secret;count++;}
   if(count){await v.write('credentials',records);await v.write('credentialSecrets',secrets);}return count;
  });
 },
 async credentialInfo(targets){
  this.assertGM();await this.ensureCredentials(targets);const v=await vault(this),records=v.read('credentials'),secrets=v.read('credentialSecrets');
  return targets.map(target=>({target,password:records[target]?secrets[target]||null:null,legacy:!!records[target]&&!secrets[target]}));
 },
 async planCredentialMove(from,to,{remove=false}={}){
  this.assertGM();const v=await vault(this),before={credentials:v.read('credentials'),credentialSecrets:v.read('credentialSecrets')},next=structuredClone(before);
  for(const target of Object.keys(before.credentials).filter(k=>k==='folder:'+from||k.startsWith('folder:'+from+'/'))){
   const destination='folder:'+to+target.slice(('folder:'+from).length);
   if(!remove&&before.credentials[destination])throw new Error('O destino já possui uma credencial. Confira antes de mover a pasta.');
   if(!remove){next.credentials[destination]=next.credentials[target];if(next.credentialSecrets[target])next.credentialSecrets[destination]=next.credentialSecrets[target];}
   delete next.credentials[target];delete next.credentialSecrets[target];
  }
  return {before,next};
 },
 async applyCredentialMove(plan){
  this.assertGM();return serial(async()=>{const v=await vault(this);if(JSON.stringify(v.read('credentials'))!==JSON.stringify(plan.before.credentials))throw new Error('As credenciais mudaram; confira a pasta novamente.');
   try{await v.write('credentials',plan.next.credentials);await v.write('credentialSecrets',plan.next.credentialSecrets);}catch(error){await v.write('credentials',plan.before.credentials);await v.write('credentialSecrets',plan.before.credentialSecrets);throw error;}
  });
 }
};
