/* ---------------------------------------------------------------------
   QUEST MODULE (quests.js)
   Janela de Missões (#missionsModal, aberta pelo botão no canto da tela):
   - História: o capítulo atual (ver StoryModule.chapterMission) — conclui
     sozinho ao vencer o último ciclo do andar.
   - Pedidos da cidade: missões dos NPCs (QUEST_DEFS em config.js), que só
     aparecem depois do NPC pedir (`announcedFlag`). Cada uma só pode ser
     concluída quando TODOS os objetivos estiverem feitos (ver
     objectiveDone/canComplete); objetivos `deliverItem` consomem o item do
     inventário ao concluir, os outros só checam progresso já existente em
     `state`. Ao concluir, o NPC agradece numa conversa (DialogueModule).
   - Concluídas: lista recolhida.
   O botão do canto ganha um "!" quando alguma missão pode ser concluída.
--------------------------------------------------------------------- */
const QuestModule = {
  questDef(key){
    return QUEST_DEFS.find(q => q.key === key);
  },
  isComplete(key){
    return !!state.quests[key];
  },
  isAnnounced(def){
    return !def.announcedFlag || !!state[def.announcedFlag];
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
  // Texto curto de progresso — "x/y" pra entrega de item, o rótulo pros
  // demais tipos (não têm uma contagem natural).
  objectiveProgressText(obj){
    if(obj.type === 'deliverItem'){
      const itemDef = ITEM_DEFS.find(i => i.key === obj.itemKey);
      const have = Math.min(state.inventory[obj.itemKey], obj.itemQty);
      return `${itemDef.name}: ${UI.fmt(have)}/${obj.itemQty}`;
    }
    return obj.label;
  },
  canComplete(key){
    return this.questDef(key).objectives.every(obj => this.objectiveDone(obj));
  },
  pending(){
    return QUEST_DEFS.filter(d => !this.isComplete(d.key) && this.isAnnounced(d));
  },
  deliver(key){
    if(!this.canComplete(key) || this.isComplete(key)) return;
    const def = this.questDef(key);
    for(const obj of def.objectives){
      if(obj.type === 'deliverItem') state.inventory[obj.itemKey] -= obj.itemQty;
    }
    state.quests[key] = true;
    SaveModule.save();
    UI.renderAll();
    DialogueModule.play({ lines: [{ speaker: def.speaker, text: def.completeText }] }, { immediate: true });
  },

  // Apresentações dos NPCs na 1ª visita (ver ui.js) — depois da conversa,
  // abre o prédio normal.
  openBarnabeIntro(){
    state.metBarnabe = true;
    SaveModule.save();
    DialogueModule.play('barnabeIntro', { onEnd: () => this.openBuilding('lojaModal') });
  },
  openCreitonIntro(){
    state.metCreiton = true;
    SaveModule.save();
    DialogueModule.play('creitonIntro', { onEnd: () => this.openBuilding('ferreiroModal') });
  },
  openAnselmoCaveIntro(){
    state.caveQuestAnnounced = true;
    SaveModule.save();
    DialogueModule.play('anselmoCaveIntro', { onEnd: () => this.openBuilding('igrejaModal') });
  },
  openBuilding(id){
    document.getElementById(id).classList.add('open');
    UI.renderAll();
  },

  // ---- janela de Missões
  isMissionsOpen(){
    return document.getElementById('missionsModal').classList.contains('open');
  },
  openMissions(){
    document.getElementById('missionsModal').classList.add('open');
    this.renderMissions();
  },
  // chamado a cada UI.renderAll(): o "!" do botão sempre, a lista só com a janela aberta
  render(){
    const ready = this.pending().some(d => this.canComplete(d.key));
    document.getElementById('missionsBtn').classList.toggle('has-alert', ready);
    if(this.isMissionsOpen()) this.renderMissions();
  },
  renderMissions(){
    const body = document.getElementById('missionsBody');
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const objectivesHtml = def => def.objectives.map(obj => {
      const done = this.objectiveDone(obj);
      return `<div class="quest-objective${done ? ' done' : ''}">${done ? '✓' : '○'} ${esc(this.objectiveProgressText(obj))}</div>`;
    }).join('');
    let html = '<div class="missions-section-title">História</div>';
    const ch = StoryModule.chapterMission();
    if(ch){
      const pct = Math.round(ch.progress / ch.total * 100);
      html += `
        <div class="mission-card mission-story">
          <div class="mission-chapter">${esc(ch.num)}</div>
          <div class="mission-title">${esc(ch.title)}</div>
          <div class="mission-desc">${esc(ch.text)}</div>
          <div class="quest-objective">○ ${esc(ch.objective)}</div>
          <div class="mission-progress"><div class="mission-progress-fill" style="width:${pct}%"></div><span>Ciclo ${ch.progress}/${ch.total}</span></div>
        </div>`;
    } else {
      html += '<div class="mission-card mission-story"><div class="mission-title">História concluída</div><div class="mission-desc">O selo está fechado. Por enquanto...</div></div>';
    }

    html += '<div class="missions-section-title">Pedidos da cidade</div>';
    const pending = this.pending();
    if(!pending.length) html += '<div class="footer-note">Nenhum pedido no momento. Converse com os moradores da cidade.</div>';
    for(const def of pending){
      const sp = DIALOGUE_SPEAKERS[def.speaker] || {};
      const ready = this.canComplete(def.key);
      html += `
        <div class="mission-card${ready ? ' is-ready' : ''}">
          <div class="mission-head">
            ${sp.portrait ? `<img class="mission-portrait" src="${esc(sp.portrait)}" alt="">` : ''}
            <div>
              <div class="mission-title">${esc(def.title)}</div>
              <div class="mission-giver">Pedido de ${esc(def.npc)}</div>
            </div>
          </div>
          <div class="mission-desc">${esc(def.desc || '')}</div>
          ${objectivesHtml(def)}
          <button class="buy-btn mission-deliver" data-quest="${esc(def.key)}" ${ready ? '' : 'disabled'}>Concluir Missão</button>
        </div>`;
    }

    const done = QUEST_DEFS.filter(d => this.isComplete(d.key));
    if(done.length){
      html += `<details class="missions-done"><summary>Concluídas (${done.length})</summary>` +
        done.map(d => `<div class="mission-done-row">✓ ${esc(d.title)} <span>— ${esc(d.npc)}</span></div>`).join('') +
        '</details>';
    }
    // mantém o <details> aberto/fechado entre re-renderizações
    const wasOpen = body.querySelector('.missions-done') && body.querySelector('.missions-done').open;
    body.innerHTML = html;
    if(wasOpen) body.querySelector('.missions-done').open = true;
  },

  init(){
    const modal = document.getElementById('missionsModal');
    document.getElementById('missionsBtn').addEventListener('click', () => this.openMissions());
    document.getElementById('missionsCloseBtn').addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if(e.target === modal){ modal.classList.remove('open'); return; }
      const btn = e.target.closest('.mission-deliver');
      if(btn && !btn.disabled) this.deliver(btn.dataset.quest);
    });
  }
};
