/* ---------------------------------------------------------------------
   QUEST MODULE (quests.js)
   Missões de entrega dos NPCs da cidade (Barnabé/Creiton/Clérigo) — ver
   QUEST_DEFS em config.js pra cada uma (item pedido, prédio liberado, modal/
   banner onde ela é acompanhada, texto de conclusão). Concluir consome os
   itens do inventário e libera o prédio correspondente; `questCompleteModal`
   é genérico e reaproveitado por todas, preenchido dinamicamente com o
   título/texto da missão entregue.
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
    if(key === 'creitonMilitia'){
      // "mais um ciclo" depois desta missão dispara o aviso da Caverna (ver
      // OnboardingModule.shouldAnnounceCaverna/MonsterModule.onDeath)
      state.creitonQuestCycleSnapshot = state.totalCyclesCompleted;
    }
    SaveModule.save();
    document.getElementById(def.modalElId).classList.remove('open');
    UI.renderAll();
    document.getElementById('questCompleteTitle').textContent = def.completeTitle;
    document.getElementById('questCompleteText').textContent = def.completeText;
    document.getElementById('questCompleteModal').classList.add('open');
  },
  // Chamado pelo clique no prédio Loja (ver ui.js) — só na 1ª vez, antes de
  // abrir a loja normal.
  openBarnabeIntro(){
    state.metBarnabe = true;
    SaveModule.save();
    document.getElementById('barnabeModal').classList.add('open');
  },
  // Renderiza o banner de progresso de TODA missão ainda não concluída, cada
  // uma no seu próprio bannerElId (ver QUEST_DEFS) — chamado a cada
  // UI.renderAll(). Missões cujo banner ainda nem existe no DOM (prédio/modal
  // que hospeda o banner ainda trancado) são simplesmente ignoradas.
  renderAllQuestBanners(){
    for(const def of QUEST_DEFS){
      const el = document.getElementById(def.bannerElId);
      if(!el) continue;
      if(this.isComplete(def.key)){
        el.style.display = 'none';
        el.innerHTML = '';
        continue;
      }
      el.style.display = '';
      const itemDef = ITEM_DEFS.find(i => i.key === def.itemKey);
      const have = Math.min(state.inventory[def.itemKey], def.itemQty);
      const canDeliver = this.canDeliver(def.key);
      el.innerHTML = `
        <div class="quest-banner-text">${def.bannerLabel} — <div class="icon icon-${itemDef.icon}"></div> ${itemDef.name}: ${have}/${def.itemQty}</div>
        <button class="buy-btn" id="questDeliverBtn-${def.key}" ${canDeliver ? '' : 'disabled'}>Entregar</button>`;
      if(canDeliver){
        document.getElementById(`questDeliverBtn-${def.key}`).addEventListener('click', () => this.deliver(def.key));
      }
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
