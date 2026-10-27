// Babel house rules. These puzzle profiles are not the official SF2e Hack action.
export const SKILLS={computers:'Computers',arcana:'Arcana',crafting:'Crafting',deception:'Deception',diplomacy:'Diplomacy',intimidation:'Intimidation',medicine:'Medicine',nature:'Nature',occultism:'Occultism',performance:'Performance',piloting:'Piloting',religion:'Religion',society:'Society',stealth:'Stealth',survival:'Survival',thievery:'Thievery',acrobatics:'Acrobatics',athletics:'Athletics'};
export const RANKS=['Sem exigência','Treinado','Especialista','Mestre','Lendário'];
export const skillLabel=skill=>SKILLS[skill]||skill||'Computers';
export const skillId=value=>{
 const id=String(value||'computers').trim().toLowerCase();
 if(!/^[a-z][a-z0-9-]{0,79}$/.test(id)||['constructor','prototype','__proto__'].includes(id))throw new Error('Identificador de perícia inválido.');
 return id;
};
export function challengeRules(data){
 const skill=skillId(data.skill),minRank=Number(data.minRank??0),mode=data.mode??'direct',category=data.category??'hack';
 if(!Number.isInteger(minRank)||minRank<0||minRank>4)throw new Error('Proficiência mínima inválida.');
 if(!['direct','puzzle'].includes(mode)||!['hack','decipher'].includes(category))throw new Error('Tipo de desafio inválido.');
 const approach=String(data.approach||'').trim();
 if(approach.length>500)throw new Error('Descreva a abordagem em até 500 caracteres.');
 return {skill,minRank,mode,category,approach};
}
export function nativeStatistic(actor,rule){
 const id=skillId(rule.skill),stat=actor.getStatistic?.(id)||actor.skills?.[id];
 if(!stat?.check?.roll)throw new Error('A ficha não disponibiliza um teste nativo de '+skillLabel(id)+'. Nenhum dado substituto foi rolado.');
 const rank=Number(stat.rank??stat.proficiency?.rank??actor.skills?.[id]?.rank);
 if((rule.minRank||0)>0&&(!Number.isInteger(rank)||rank<rule.minRank))throw new Error('A perícia exige '+RANKS[rule.minRank]+'. Confira a proficiência na ficha.');
 return stat;
}
export function actorSkillOptions(actors=[]){
 const result=new Map(Object.entries(SKILLS));
 for(const actor of actors)for(const [key,stat] of Object.entries(actor.skills||{})){
  if(!/^[a-z][a-z0-9-]{0,79}$/.test(key))continue;
  result.set(key,stat.label||stat.name||SKILLS[key]||key);
 }
 return [...result].map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name));
}
