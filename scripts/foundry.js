import {registerJournalRefresh} from './journal-refresh.js';
import {ID} from './core.js';
import {TerminalView} from './view.js';
import {FoundryStore} from './foundry-store.js';
import {registerJournalLauncher} from './launcher.js';

registerJournalLauncher();

let application;
class BabelApplication extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS={id:'babel-terminal',classes:['babel-foundry-window'],window:{title:'Babel — Terminal Integration',resizable:true},position:{width:1080,height:740}};
  async _renderHTML(){return document.createElement('div');}
  _replaceHTML(result,content){this.view?.destroy();result.style.height='100%';content.replaceChildren(result);this.store??=new FoundryStore();this.view=new TerminalView(result,this.store);this.ready=this.view.start();}
  async _onClose(options){this.view?.destroy();return super._onClose(options);}
}
Hooks.once('ready',()=>{
  const getApp=async()=>{application??=new BabelApplication();await application.render({force:true});await application.ready;return application;};
  game.modules.get(ID).api={
    openTerminal:async({terminalId}={})=>{const app=await getApp();if(terminalId)await app.view.home(terminalId);return app;},
    openDocument:async(id)=>{const app=await getApp();await app.view.run(`ler ${id}`);return app;},
    openMailbox:async()=>{const app=await getApp();await app.view.run('correio');return app;},
    openAdmin:async()=>{if(!game.user.isGM)return;const app=await getApp();await app.view.run('mestre');return app;}
  };
  // Receiver stays alive even while the terminal window is closed.
  const service=new FoundryStore();
  if(game.user.isGM&&service.electedGM?.id===game.user.id){
    game.modules.get(ID).api.storageReady=service.organizeJournals().then(()=>service.ensureCredentials()).catch(error=>{console.error('Babel: organização do acervo',error);ui.notifications.error('Babel: não foi possível concluir a organização. Use maintenance para conferir antes de importar.');});
  }
  // Even a brief transport interruption invalidates the old timer/roll authority.
  game.socket?.on('disconnect',()=>service.hackingDisconnected());
  Hooks.on('userConnected',(user,connected)=>{if(user.id===game.user.id&&!connected)service.hackingDisconnected();});
  let hackingTickBusy=false;
  setInterval(async()=>{if(hackingTickBusy)return;hackingTickBusy=true;try{await service.hackingTick();}catch(error){console.warn('Babel: sessão de hacking aguardando mestre',error);}finally{hackingTickBusy=false;}},3000);
  Hooks.on('createChatMessage',message=>{service.receive(message);if(message.getFlag(ID,'kind')==='mail')application?.view?.refreshUnread().catch(console.warn);if(['access-result','cipher-result','hack-result'].includes(message.getFlag(ID,'kind'))&&application?.store!==service)application?.store?.receive(message);});
  Hooks.on('preDeleteChatMessage',message=>{if(message.getFlag(ID,'kind')==='mail'){ui.notifications.warn('Correspondência de Babel preservada. Arquive no terminal; exclusão permanente ainda não está disponível no piloto.');return false;}});
  Hooks.on('renderChatMessageHTML',(message,html)=>{if(message.getFlag(ID,'kind'))html.style.display='none';});
  Hooks.on('renderChatMessage',(message,html)=>{if(message.getFlag(ID,'kind')){const element=html[0]||html;element.style.display='none';}});
  // Player journal opens are routed into our reader; a GM may still edit sources normally.
  Hooks.on('preRenderJournalEntrySheet',(app)=>{const doc=app.document;if(!game.user.isGM&&doc?.getFlag(ID,'document')){game.modules.get(ID).api.openDocument(doc.getFlag(ID,'document').id);return false;}});
  registerJournalRefresh(()=>application?.rendered?application.view:null);
  if(game.user.isGM)ui.notifications.info('Babel disponível na aba Journals.');
});
