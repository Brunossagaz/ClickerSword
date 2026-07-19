/* ---------------------------------------------------------------------
   QUEST MODULE (quests.js)
   Missões dos NPCs da cidade (Barnabé/Creiton/Clérigo) — ver QUEST_DEFS em
   config.js pra cada uma (lista de `objectives`, prédio liberado, modal/
   banner onde ela é acompanhada, texto de conclusão). Cada missão só pode
   ser concluída quando TODOS os objetivos estiverem feitos (ver
   objectiveDone/canComplete); objetivos `deliverItem` consomem o item do
   inventário ao concluir, os outros tipos só checam progresso já existente
   em `state` (nada pra consumir). `questCompleteModal` é genérico e
   reaproveitado por todas, preenchido dinamicamente com o título/texto da
   missão concluída.
--------------------------------------------------------------------- */
const QuestModule = {
  questDef(key){
    return QUEST_DEFS.find(q => q.key === key);
  },
  isComplete(key){
    return !!state.quests[key];
  },
  // Cada tipo de objetivo sabe checar seu próprio progresso a partir de
  // `state` — adicionar um tipo novo é só somar um `case` aqui.
  objectiveDone(obj){
    switch(obj.type){
      case 'deliverItem': return state.inventory[obj.itemKey] >= obj.itemQty;
      case 'defeatCycle': return state.totalCyclesCompleted >= obj.count;
      case 'ownWeapons': return WEAPON_DEFS.filter(d => state.weapons[d.key] > 0).length >= obj.count;
      default: return false;
    }
  },
  // Texto curto de progresso pro banner — "x/y" pra entrega de item,
  // check/pendente pros demais tipos (não têm uma contagem natural).
  objectiveProgressText(obj){
    if(obj.type === 'deliverItem'){
      const itemDef = ITEM_DEFS.find(i => i.key === obj.itemKey);
      const have = Math.min(state.inventory[obj.itemKey], obj.itemQty);
      return `${itemDef.name}: ${have}/${obj.itemQty}`;
    }
    return obj.label;
  },
  canComplete(key){
    return this.questDef(key).objectives.every(obj => this.objectiveDone(obj));
  },
  deliver(key){
    if(!this.canComplete(key)) return;
    const def = this.questDef(key);
    for(const obj of def.objectives){
      if(obj.type === 'deliverItem') state.inventory[obj.itemKey] -= obj.itemQty;
    }
    state.quests[key] = true;
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
  // Chamado pelo clique no prédio Ferreiro (ver ui.js) — só na 1ª vez, antes
  // de abrir o ferreiro normal. Mesmo padrão de openBarnabeIntro.
  openCreitonIntro(){
    state.metCreiton = true;
    SaveModule.save();
    document.getElementById('creitonModal').classList.add('open');
  },
  // Chamado pelo clique no prédio Igreja (ver ui.js) — só na 1ª vez, antes de
  // abrir a igreja normal. Mesmo padrão de openBarnabeIntro/openCreitonIntro,
  // só que apresenta a missão da Caverna (caveClearance) em vez de só deixar
  // o banner de progresso aparecer sozinho dentro do igrejaModal.
  openAnselmoCaveIntro(){
    state.caveQuestAnnounced = true;
    SaveModule.save();
    document.getElementById('anselmoCaveModal').classList.add('open');
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
      const canComplete = this.canComplete(def.key);
      const objectivesHtml = def.objectives.map(obj => {
        const done = this.objectiveDone(obj);
        return `<div class="quest-objective${done ? ' done' : ''}">${done ? '✓' : '○'} ${this.objectiveProgressText(obj)}</div>`;
      }).join('');
      el.innerHTML = `
        <div class="quest-banner-text">${def.bannerLabel}</div>
        ${objectivesHtml}
        <button class="buy-btn" id="questDeliverBtn-${def.key}" ${canComplete ? '' : 'disabled'}>Concluir Missão</button>`;
      if(canComplete){
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
    document.getElementById('creitonContinueBtn').addEventListener('click', () => {
      document.getElementById('creitonModal').classList.remove('open');
      document.getElementById('ferreiroModal').classList.add('open');
      UI.renderAll();
    });
    document.getElementById('anselmoCaveContinueBtn').addEventListener('click', () => {
      document.getElementById('anselmoCaveModal').classList.remove('open');
      document.getElementById('igrejaModal').classList.add('open');
      UI.renderAll();
    });
    document.getElementById('questCompleteOkBtn').addEventListener('click', () => {
      document.getElementById('questCompleteModal').classList.remove('open');
    });
  }
};
