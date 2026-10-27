import {babel} from '../content/babel.js';
export const categories={pessoas:'Pessoas',lugares:'Lugares',companhias:'Companhias',familias:'Famílias nobres',instituicoes:'Instituições e facções',espectros:'Espectros e Arcanos'};
export const catalogCategory=id=>babel.documents.find(d=>d.id===id)?.category||'';
export const retiredPilotIds=new Set(['kruger-registros','kruger-servicos','kruger-dawnline','kruger-dawnline-testes']);
// Old pilot records remain recoverable. Never match local files by title alone.
export async function pilotCandidates(store){
 store.assertGM();return (await store.all()).filter(d=>retiredPilotIds.has(d.id)&&!d.nativeJournal).map(d=>({id:d.id,title:d.title,localEdited:!!d.localEdited}));
}
