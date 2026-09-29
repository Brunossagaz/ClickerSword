/* ---------------------------------------------------------------------
   QUEST MODULE (quests.js)
   Janela de Missões (#missionsModal, aberta pelo botão no canto da tela):
   - História: o capítulo atual (ver StoryModule.chapterMission) — conclui
     sozinho ao vencer o último ciclo do andar.
   - Pedidos da cidade e da Madame Morgana: missões de QUEST_DEFS
     (config.js), que só aparecem depois do NPC pedir (`announcedFlag`, ou
     state.questsAnnounced pras da bruxa — ver announce). Cada uma só pode
     ser concluída quando TODOS os objetivos estiverem feitos (ver
     objectiveDone/canComplete); `deliverItem` consome o item ao concluir,
     os outros tipos só checam progresso. As da bruxa (`nightOnly`) só são
     entregues à noite, na cidade, e dão `reward`.
   - Pedidos dos moradores: repetíveis, ver RequestsModule (js/requests.js).
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
    if(def.announcedFlag) return !!state[def.announcedFlag];
    if(def.giver) return !!(state.questsAnnounced && state.questsAnnounced[def.key]);
    return true;
  },
  // NPC acabou de fazer o pedido: guarda os abates de agora pros objetivos
  // 'killMonster' contarem só o que vier depois
  announce(key){
    const def = this.questDef(key);
    if(!def) return;
    state.questsAnnounced[key] = true;
    for(const obj of def.objectives){
      if(obj.type !== 'killMonster') continue;
      if(!state.questBase[key]) state.questBase[key] = {};
      state.questBase[key][obj.monster] = state.monsterKills[obj.monster] || 0;
    }
    SaveModule.save();
    UI.renderAll();
  },
  killsSince(def, obj){
    const base = (state.questBase[def.key] && state.questBase[def.key][obj.monster]) || 0;
    return Math.max(0, (state.monsterKills[obj.monster] || 0) - base);
  },
  spotVisited(def, obj){
    return !!state.spotVisits[def.key + ':' + obj.spot];
  },
  // Cada tipo de objetivo sabe checar seu próprio progresso a partir de
  // `state` — adicionar um tipo novo é só somar um `case` aqui.
  objectiveDone(obj, def){
    switch(obj.type){
      case 'deliverItem': return state.inventory[obj.itemKey] >= obj.itemQty;
      case 'defeatCycle': return state.totalCyclesCompleted >= obj.count;
      case 'ownWeapons': return WEAPON_DEFS.filter(d => state.weapons[d.key] > 0).length >= obj.count;
      case 'killMonster': return this.killsSince(def, obj) >= obj.count;
      case 'visitSpot': return this.spotVisited(def, obj);
      default: return false;
    }
  },
  // Texto curto de progresso — "x/y" pra entrega e abates, o rótulo pros demais
  objectiveProgressText(obj, def){
    if(obj.type === 'deliverItem'){
      const itemDef = ITEM_DEFS.find(i => i.key === obj.itemKey);
      const have = Math.min(state.inventory[obj.itemKey], obj.itemQty);
      return `${itemDef.name}: ${UI.fmt(have)}/${obj.itemQty}`;
    }
    if(obj.type === 'killMonster'){
      const m = MONSTER_TYPES.find(t => t.key === obj.monster);
      return `Derrotar ${RequestsModule.monsterName(m)}: ${Math.min(obj.count, this.killsSince(def, obj))}/${obj.count}`;
    }
    return obj.label;
  },
  objectivesMet(def){
    return def.objectives.every(obj => this.objectiveDone(obj, def));
  },
  canComplete(key){
    const def = this.questDef(key);
    return this.objectivesMet(def) && (!def.nightOnly || WitchModule.canTrade());
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
    const got = this.giveReward(def.reward);
    SaveModule.save();
    AchievementsModule.checkAll();
    UI.renderAll();
    const lines = [{ speaker: def.speaker, text: def.completeText }];
    if(got) lines.push({ speaker: 'narrador', text: 'Recompensa: ' + got + '.' });
    DialogueModule.play({ lines }, { immediate: true });
  },
  // { gold, items: { chave: qtd } } → devolve o texto "X moedas, 2x Cristal Arcano"
  giveReward(reward){
    if(!reward) return '';
    const parts = [];
    if(reward.gold){ state.gold += reward.gold; parts.push(`*${UI.fmt(reward.gold)} moedas*`); }
    for(const [k, q] of Object.entries(reward.items || {})){
      state.inventory[k] = (state.inventory[k] || 0) + q;
      const d = ITEM_DEFS.find(i => i.key === k);
      parts.push(`*${q}x ${d ? d.name : k}*`);
    }
    return parts.join(', ');
  },

  // ---- pontos do mapa (objetivo 'visitSpot' + visitas dos pedidos repetíveis)
  // [{ spot, night }] com missão ativa apontando pra ele agora
  activeSpots(){
    const out = [];
    for(const def of this.pending()) for(const obj of def.objectives){
      if(obj.type === 'visitSpot' && !this.spotVisited(def, obj)) out.push({ spot: obj.spot, night: !!obj.night });
    }
    for(const spot of RequestsModule.activeSpots()) out.push({ spot, night: false });
    return out;
  },
  visitSpot(spotKey){
    let hit = false;
    for(const def of this.pending()) for(const obj of def.objectives){
      if(obj.type !== 'visitSpot' || obj.spot !== spotKey || this.spotVisited(def, obj)) continue;
      hit = true;
      if(obj.night && !WitchModule.isNight()){
        UI.showToast('AINDA NÃO', 'Isso precisa ser feito à noite.');
        continue;
      }
      state.spotVisits[def.key + ':' + spotKey] = true;
      SaveModule.save();
      if(obj.visitText) DialogueModule.play({ lines: [{ speaker: 'narrador', text: obj.visitText }] });
      else UI.showToast('OBJETIVO CUMPRIDO', obj.label);
    }
    if(RequestsModule.visitSpot(spotKey)) hit = true;
    if(hit) UI.renderAll();
    return hit;
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
    RequestsModule.ensure();
    const ready = this.pending().some(d => this.objectivesMet(d)) || RequestsModule.anyReady();
    document.getElementById('missionsBtn').classList.toggle('has-alert', ready);
    if(this.isMissionsOpen()) this.renderMissions();
  },
  esc(s){
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  },
  // retrato pequeno do NPC (img, ou 1º quadro da folha de sprites — ver DIALOGUE_SPEAKERS.frame)
  portraitHtml(sp){
    if(!sp || !sp.portrait) return '';
    if(sp.frame) return `<div class="mission-portrait mission-portrait-sheet" style="background-image:url('${this.esc(sp.portrait)}');background-size:${sp.frame.cols * 100}% ${sp.frame.rows * 100}%"></div>`;
    return `<img class="mission-portrait" src="${this.esc(sp.portrait)}" alt="">`;
  },
  questCardHtml(def){
    const esc = s => this.esc(s);
    const sp = DIALOGUE_SPEAKERS[def.speaker] || {};
    const met = this.objectivesMet(def);
    const ready = this.canComplete(def.key);
    const objectives = def.objectives.map(obj => {
      const done = this.objectiveDone(obj, def);
      return `<div class="quest-objective${done ? ' done' : ''}">${done ? '✓' : '○'} ${esc(this.objectiveProgressText(obj, def))}</div>`;
    }).join('');
    const reward = def.reward ? `<div class="mission-reward">Recompensa: ${esc(this.rewardText(def.reward))}</div>` : '';
    const nightNote = def.nightOnly && met && !ready ? '<div class="mission-night">Entregue à noite, na cidade, quando a Madame Morgana aparece.</div>' : '';
    return `
      <div class="mission-card${ready ? ' is-ready' : ''}">
        <div class="mission-head">
          ${this.portraitHtml(sp)}
          <div>
            <div class="mission-title">${esc(def.title)}</div>
            <div class="mission-giver">Pedido de ${esc(def.npc)}</div>
          </div>
        </div>
        <div class="mission-desc">${esc(def.desc || '')}</div>
        ${objectives}${reward}${nightNote}
        <button class="buy-btn mission-deliver" data-quest="${esc(def.key)}" ${ready ? '' : 'disabled'}>Concluir Missão</button>
      </div>`;
  },
  rewardText(reward){
    const parts = [];
    if(reward.gold) parts.push(`${UI.fmt(reward.gold)} moedas`);
    for(const [k, q] of Object.entries(reward.items || {})){
      const d = ITEM_DEFS.find(i => i.key === k);
      parts.push(`${q}x ${d ? d.name : k}`);
    }
    return parts.join(', ');
  },
  renderMissions(){
    const body = document.getElementById('missionsBody');
    const esc = s => this.esc(s);
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

    const pending = this.pending();
    const city = pending.filter(d => !d.giver), witch = pending.filter(d => d.giver === 'witch');
    html += '<div class="missions-section-title">Pedidos da cidade</div>';
    if(!city.length) html += '<div class="footer-note">Nenhum pedido no momento. Converse com os moradores da cidade.</div>';
    for(const def of city) html += this.questCardHtml(def);
    if(witch.length){
      html += '<div class="missions-section-title">Madame Morgana</div>';
      for(const def of witch) html += this.questCardHtml(def);
    }
    html += RequestsModule.sectionHtml();

    const done = QUEST_DEFS.filter(d => this.isComplete(d.key));
    if(done.length){
      html += `<details class="missions-done"><summary>Concluídas (${done.length})</summary>` +
        done.map(d => `<div class="mission-done-row">✓ ${esc(d.title)} <span>— ${esc(d.npc)}</span></div>`).join('') +
        '</details>';
    }
    // mantém o <details> aberto/fechado entre re-renderizações
    const prev = body.querySelector('.missions-done');
    const wasOpen = prev && prev.open;
    const scroll = body.parentElement ? body.parentElement.scrollTop : 0;
    body.innerHTML = html;
    if(wasOpen) body.querySelector('.missions-done').open = true;
    if(body.parentElement) body.parentElement.scrollTop = scroll;
  },

  init(){
    const modal = document.getElementById('missionsModal');
    document.getElementById('missionsBtn').addEventListener('click', () => this.openMissions());
    document.getElementById('missionsCloseBtn').addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if(e.target === modal){ modal.classList.remove('open'); return; }
      const btn = e.target.closest('.mission-deliver');
      if(btn && !btn.disabled){ this.deliver(btn.dataset.quest); return; }
      const req = e.target.closest('[data-request]');
      if(req && !req.disabled){
        const slot = Number(req.dataset.slot);
        if(req.dataset.request === 'complete') RequestsModule.complete(slot);
        else if(req.dataset.request === 'dismiss') RequestsModule.dismiss(slot);
      }
    });
    // pedidos que voltam do tempo de espera enquanto a janela está fechada
    setInterval(() => { if(RequestsModule.ensure()) this.render(); }, 5000);
  }
};
