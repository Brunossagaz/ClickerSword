/* ---------------------------------------------------------------------
   WITCH MODULE (witch.js)
   Madame Morgana, a bruxa que só aparece na praça à noite (CITY_MAP.npcs,
   schedule 'night'). Clicar nela (ver CityMapModule.say) abre uma conversa
   de verdade em vez do balão:
   - 1ª vez: apresentação (DIALOGUES.witchIntro), que já anuncia o 1º pedido.
   - Depois: saudação (lembra a resposta da apresentação) + menu de
     respostas: Alquimia, entregar pedido pronto, pedir trabalho novo, falar
     do selo (lore por capítulo) ou se despedir. Textos em WITCH_TEXTS.
   Pedidos dela são QUEST_DEFS com giver:'witch' (anunciados aqui, entregues
   na janela de Missões, só à noite). A Alquimia (ALCHEMY_RECIPES) libera
   ao concluir o 1º pedido e abre a janela #alchemyModal.
--------------------------------------------------------------------- */
const WitchModule = {
  isNight(){
    return typeof CityMapModule !== 'undefined' && CityMapModule.daylight < 0.5;
  },
  // entregar pedidos da bruxa: à noite e na cidade (é lá que ela está)
  canTrade(){
    return !state.currentDungeon && this.isNight();
  },
  alchemyUnlocked(){
    return !!state.quests.witchMoonHerbs;
  },
  quests(){
    return QUEST_DEFS.filter(q => q.giver === 'witch');
  },
  nextToAnnounce(){
    return this.quests().find(q => !QuestModule.isAnnounced(q) && state.story.chapter >= (q.requiresChapter || 0)) || null;
  },

  talk(){
    if(!state.witch.met){
      DialogueModule.play('witchIntro', { onEnd: () => {
        state.witch.met = true;
        AchievementsModule.unlock('witchMet');
        this.announceNext(true);
      } });
      return;
    }
    const greet = WITCH_TEXTS.greetings.find(g => DialogueModule.matches(g.when)) || WITCH_TEXTS.greetings[WITCH_TEXTS.greetings.length - 1];
    const choices = [];
    if(this.alchemyUnlocked()) choices.push({ id: 'alquimia', text: 'Quero usar o caldeirão.', action: 'witchAlchemy' });
    const ready = this.quests().some(q => QuestModule.isAnnounced(q) && !QuestModule.isComplete(q.key) && QuestModule.objectivesMet(q));
    if(ready) choices.push({ id: 'entregar', text: 'Trouxe o que você pediu.', action: 'witchMissions' });
    else if(this.nextToAnnounce()) choices.push({ id: 'pedido', text: 'Tem algum trabalho pra mim?', action: 'witchAnnounce' });
    choices.push({ id: 'selo', text: 'O que você sabe sobre o selo?', action: 'witchLore' });
    choices.push({ id: 'tchau', text: 'Até logo.', reply: 'Bons sonhos... se conseguir tê-los.' });
    DialogueModule.play({ lines: [{ speaker: 'morgana', text: greet.text, choices }] });
  },
  // anuncia o próximo pedido liberado pelo capítulo atual
  announceNext(fromIntro){
    const q = this.nextToAnnounce();
    if(!q){
      if(!fromIntro) DialogueModule.play({ lines: [{ speaker: 'morgana', text: 'Nada por agora. Volte quando a dungeon tiver mudado você um pouco mais.' }] });
      return;
    }
    QuestModule.announce(q.key);
    DialogueModule.play({ lines: [
      { speaker: 'morgana', text: WITCH_TEXTS.questIntro[q.key] || q.desc },
      { speaker: 'morgana', text: 'Anotei na sua janela de *Missões*. E lembre: entregas só à noite.' },
    ] });
  },
  lore(){
    const text = WITCH_TEXTS.lore[Math.min(state.story.chapter, WITCH_TEXTS.lore.length - 1)];
    DialogueModule.play({ lines: [{ speaker: 'morgana', text }] });
  },

  // ---- Alquimia
  recipes(){
    return ALCHEMY_RECIPES.filter(r => !r.floor || !MAPS[r.floor] || DungeonModule.isUnlocked(r.floor));
  },
  maxTimes(r){
    return Math.min(...r.inputs.map(i => Math.floor((state.inventory[i.itemKey] || 0) / i.qty)));
  },
  transmute(key, times){
    const r = ALCHEMY_RECIPES.find(x => x.key === key);
    if(!r || !this.alchemyUnlocked()) return;
    const n = Math.min(times, this.maxTimes(r));
    if(n <= 0) return;
    for(const i of r.inputs) state.inventory[i.itemKey] -= i.qty * n;
    state.inventory[r.output.itemKey] = (state.inventory[r.output.itemKey] || 0) + r.output.qty * n;
    AchievementsModule.unlock('alchemyFirst');
    if(r.output.itemKey === 'arcaneCrystal') AchievementsModule.unlock('alchemyCrystal');
    SaveModule.save();
    const out = ITEM_DEFS.find(d => d.key === r.output.itemKey);
    UI.showToast('TRANSMUTAÇÃO', `O caldeirão borbulha... +${r.output.qty * n}x ${out.name}.`);
    UI.renderAll();
  },
  openAlchemy(){
    document.getElementById('alchemyModal').classList.add('open');
    this.renderAlchemy();
  },
  renderAlchemy(){
    const el = document.getElementById('alchemyList');
    if(!el || !document.getElementById('alchemyModal').classList.contains('open')) return;
    const name = k => { const d = ITEM_DEFS.find(i => i.key === k); return d ? d.name : k; };
    const icon = k => { const d = ITEM_DEFS.find(i => i.key === k); return d ? d.icon : ''; };
    el.innerHTML = '';
    for(const r of this.recipes()){
      const max = this.maxTimes(r);
      const row = document.createElement('div');
      row.className = 'shop-row alchemy-row' + (max > 0 ? '' : ' disabled');
      const inputs = r.inputs.map(i => {
        const have = state.inventory[i.itemKey] || 0;
        return `<div class="recipe-material ${have >= i.qty ? 'met' : 'unmet'}">${QuestModule.esc(name(i.itemKey))}: ${UI.fmt(have)}/${i.qty}</div>`;
      }).join('');
      row.innerHTML = `
        <div class="shop-info">
          <div class="name"><div class="icon icon-${icon(r.output.itemKey)}"></div>${r.output.qty}x ${QuestModule.esc(name(r.output.itemKey))}</div>
          <div class="recipe-materials">${inputs}</div>
        </div>
        <div class="alchemy-btns">
          <button class="buy-btn" data-alch="${r.key}" data-times="1" ${max > 0 ? '' : 'disabled'}>Transmutar</button>
          <button class="small-btn" data-alch="${r.key}" data-times="${max}" ${max > 1 ? '' : 'disabled'}>Tudo (${max}x)</button>
        </div>`;
      el.appendChild(row);
    }
  },

  init(){
    Object.assign(DialogueModule.actions, {
      witchAlchemy: () => this.openAlchemy(),
      witchMissions: () => QuestModule.openMissions(),
      witchAnnounce: () => this.announceNext(false),
      witchLore: () => this.lore(),
    });
    const modal = document.getElementById('alchemyModal');
    document.getElementById('alchemyCloseBtn').addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if(e.target === modal){ modal.classList.remove('open'); return; }
      const b = e.target.closest('[data-alch]');
      if(b && !b.disabled) this.transmute(b.dataset.alch, Number(b.dataset.times) || 1);
    });
  },
};
