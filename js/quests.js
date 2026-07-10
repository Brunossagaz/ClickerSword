/* ---------------------------------------------------------------------
   QUEST MODULE (quests.js)
   Barnabé (dono da Loja): na 1ª vez que o jogador clica na Loja, ele se
   apresenta e oferece a missão de entregar itens pro irmão dele, Creiton
   (o Ferreiro). Concluir a missão consome os itens do inventário e libera
   o prédio correspondente (ver QUEST_DEFS em config.js).
--------------------------------------------------------------------- */
const QuestModule = {
  questDef(key){
    return QUEST_DEFS.find(q => q.key === key);
  },
  isComplete(key){
    return !!state.quests[key];
  },
  canDeliver(key){
    const def = this.questDef(key);
    return state.inventory[def.itemKey] >= def.itemQty;
  },
  deliver(key){
    if(!this.canDeliver(key)) return;
    const def = this.questDef(key);
    state.inventory[def.itemKey] -= def.itemQty;
    state.quests[key] = true;
    SaveModule.save();
    document.getElementById('lojaModal').classList.remove('open');
    UI.renderAll();
    document.getElementById('questCompleteModal').classList.add('open');
  },
  // Chamado pelo clique no prédio Loja (ver ui.js) — só na 1ª vez, antes de
  // abrir a loja normal.
  openBarnabeIntro(){
    state.metBarnabe = true;
    SaveModule.save();
    document.getElementById('barnabeModal').classList.add('open');
  },
  // Banner de progresso da missão dentro do modal da Loja — some sozinho
  // quando a missão já foi entregue.
  renderQuestBanner(){
    const el = document.getElementById('lojaQuestBanner');
    const def = this.questDef('slimeGelDelivery');
    const itemDef = ITEM_DEFS.find(i => i.key === def.itemKey);
    if(this.isComplete('slimeGelDelivery')){
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    el.style.display = '';
    const have = Math.min(state.inventory[def.itemKey], def.itemQty);
    const canDeliver = this.canDeliver('slimeGelDelivery');
    el.innerHTML = `
      <div class="quest-banner-text">🔧 Encomenda do Creiton — ${itemDef.icon} ${itemDef.name}: ${have}/${def.itemQty}</div>
      <button class="buy-btn" id="questDeliverBtn" ${canDeliver ? '' : 'disabled'}>Entregar</button>`;
    if(canDeliver){
      document.getElementById('questDeliverBtn').addEventListener('click', () => this.deliver('slimeGelDelivery'));
    }
  },
  init(){
    document.getElementById('barnabeContinueBtn').addEventListener('click', () => {
      document.getElementById('barnabeModal').classList.remove('open');
      document.getElementById('lojaModal').classList.add('open');
      UI.renderAll();
    });
    document.getElementById('questCompleteOkBtn').addEventListener('click', () => {
      document.getElementById('questCompleteModal').classList.remove('open');
    });
  }
};
