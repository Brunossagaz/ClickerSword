/* ---------------------------------------------------------------------
   REQUESTS MODULE (requests.js)
   Pedidos repetíveis dos moradores (ver REQUEST_CONFIG em config.js),
   mostrados na janela de Missões. REQUEST_CONFIG.slots vagas; cada uma tem
   um pedido ou está esperando (state.requests.nextAt[vaga]). Tipos:
   - hunt:    derrotar N de um monstro de andar liberado (conta a partir do
              pedido: state.monsterKills - base)
   - deliver: entregar N de um material de andar liberado (consome)
   - spot:    ir até um ponto do mapa da cidade (CITY_MAP.spots) e clicar —
              conclui na hora (ver QuestModule.visitSpot/CityMapModule.onClick)
   Recompensa só em moeda, proporcional ao que foi pedido — calculada ao
   gerar e guardada no pedido (não muda depois).
   Liberam depois do 1º ciclo vencido (a Loja já está aberta).
--------------------------------------------------------------------- */
const RequestsModule = {
  unlocked(){
    return !!state.firstCycleEverCompleted;
  },
  floorsUnlocked(){
    return DUNGEON_ORDER.filter(k => MAPS[k] && DungeonModule.isUnlocked(k));
  },
  monsterName(m){
    if(!m) return '?';
    const n = m.name.toLowerCase();
    return n.charAt(0).toUpperCase() + n.slice(1);
  },
  // moedas esperadas vendendo os drops de 1 abate
  killValue(monKey){
    const m = MONSTER_TYPES.find(t => t.key === monKey);
    return ((m && m.drops) || []).reduce((s, d) => {
      const it = ITEM_DEFS.find(i => i.key === d.item);
      return s + (d.chance == null ? 1 : d.chance) * (d.qtyMin + d.qtyMax) / 2 * (it ? it.sellPrice : 0);
    }, 0);
  },
  monstersOf(floor){
    const set = new Set();
    for(const sched of Object.values(MAPS[floor].cycles || {})) for(const slot of sched){
      if(typeof slot === 'string') set.add(slot);
      else if(slot && slot.pairChoices) slot.pairChoices.forEach(o => o.forEach(k => set.add(k)));
    }
    return [...set].filter(k => { const m = MONSTER_TYPES.find(t => t.key === k); return m && !m.boss; });
  },
  // moedas/s farmando o ciclo 1 do andar em 30s (mesma conta do simulador)
  floorIncome(floor){
    const sched = (MAPS[floor].cycles || {})[1] || [];
    let v = 0;
    for(const slot of sched){
      const keys = typeof slot === 'string' ? [slot] : slot.pairChoices[0];
      for(const k of keys) v += this.killValue(k);
    }
    return v / (CONFIG.dungeonTimeLimitMs / 1000);
  },
  pick(list){ return list[Math.floor(Math.random() * list.length)]; },
  rand(a, b){ return a + Math.random() * (b - a); },

  // enche as vagas vazias cujo tempo de espera acabou; true se criou algum
  ensure(){
    if(!this.unlocked()) return false;
    const r = state.requests, now = Date.now();
    let changed = false;
    for(let i = 0; i < REQUEST_CONFIG.slots; i++){
      if(r.slots[i] || (r.nextAt[i] || 0) > now) continue;
      r.slots[i] = this.generate(i);
      changed = true;
    }
    if(changed) SaveModule.save();
    return changed;
  },
  generate(slotIdx){
    const floors = this.floorsUnlocked();
    // andar do pedido: um dos 2 mais altos liberados (pedido de andar velho vale pouco)
    const floor = this.pick(floors.slice(-2));
    const top = floors[floors.length - 1];
    const givers = CITY_MAP.npcs.filter(n => !['anselmo', 'barnabe', 'creiton', 'witch'].includes(n.key));
    const giver = (this.pick(givers) || { name: 'Um morador' }).name;
    const usedSpots = state.requests.slots.filter(Boolean).map(q => q.spot);
    const spots = (CITY_MAP.spots || []).filter(s => !usedSpots.includes(s.key));
    const w = REQUEST_CONFIG.weights;
    const types = [['hunt', w.hunt], ['deliver', w.deliver], ['spot', spots.length ? w.spot : 0]];
    let roll = Math.random() * types.reduce((s, t) => s + t[1], 0), type = 'hunt';
    for(const [t, wt] of types){ roll -= wt; if(roll <= 0){ type = t; break; } }
    const id = ++state.requests.seq;
    if(type === 'hunt'){
      const monster = this.pick(this.monstersOf(floor));
      const count = Math.round(this.rand(REQUEST_CONFIG.huntKills[0], REQUEST_CONFIG.huntKills[1]) / 5) * 5;
      const reward = Math.max(20, Math.round(count * this.killValue(monster) * REQUEST_CONFIG.valueMult));
      return { id, type, giver, monster, count, base: state.monsterKills[monster] || 0, reward };
    }
    if(type === 'deliver'){
      const items = ITEM_DEFS.filter(d => d.type === 'material' && d.dungeon === floor);
      const it = this.pick(items);
      const secs = this.rand(REQUEST_CONFIG.deliverValue[0], REQUEST_CONFIG.deliverValue[1]);
      const qty = Math.max(5, Math.round(this.floorIncome(floor) * secs / Math.max(1, it.sellPrice) / 5) * 5);
      const reward = Math.max(20, Math.round(qty * it.sellPrice * REQUEST_CONFIG.valueMult));
      return { id, type, giver, item: it.key, qty, reward };
    }
    const spot = this.pick(spots);
    const reward = Math.max(30, Math.round(this.floorIncome(top) * REQUEST_CONFIG.spotSeconds));
    return { id, type, giver, spot: spot.key, reward };
  },

  progress(q){
    if(q.type === 'hunt') return Math.min(q.count, Math.max(0, (state.monsterKills[q.monster] || 0) - q.base));
    if(q.type === 'deliver') return Math.min(q.qty, state.inventory[q.item] || 0);
    return 0;
  },
  isReady(q){
    return q && (q.type === 'hunt' ? this.progress(q) >= q.count : q.type === 'deliver' ? this.progress(q) >= q.qty : false);
  },
  anyReady(){
    return state.requests.slots.some(q => this.isReady(q));
  },
  activeSpots(){
    return state.requests.slots.filter(q => q && q.type === 'spot').map(q => q.spot);
  },
  complete(slotIdx){
    const q = state.requests.slots[slotIdx];
    if(!q || (q.type !== 'spot' && !this.isReady(q))) return;
    if(q.type === 'deliver') state.inventory[q.item] -= q.qty;
    state.gold += q.reward;
    state.requests.done += 1;
    state.requests.slots[slotIdx] = null;
    state.requests.nextAt[slotIdx] = Date.now() + REQUEST_CONFIG.cooldownMs;
    SaveModule.save();
    AchievementsModule.checkAll();
    UI.showToast('PEDIDO CONCLUÍDO', `${q.giver} agradece: +${UI.fmt(q.reward)} moedas.`);
    UI.renderAll();
  },
  dismiss(slotIdx){
    if(!state.requests.slots[slotIdx]) return;
    state.requests.slots[slotIdx] = null;
    state.requests.nextAt[slotIdx] = Date.now() + REQUEST_CONFIG.dismissCooldownMs;
    SaveModule.save();
    UI.renderAll();
  },
  // clique num ponto do mapa: conclui o pedido de visita desse ponto
  visitSpot(spotKey){
    const i = state.requests.slots.findIndex(q => q && q.type === 'spot' && q.spot === spotKey);
    if(i < 0) return false;
    this.complete(i);
    return true;
  },

  describe(q){
    if(q.type === 'hunt') return `Derrotar ${q.count} ${this.monsterName(MONSTER_TYPES.find(t => t.key === q.monster))}`;
    if(q.type === 'deliver'){ const d = ITEM_DEFS.find(i => i.key === q.item); return `Entregar ${q.qty} ${d ? d.name : q.item}`; }
    const s = (CITY_MAP.spots || []).find(x => x.key === q.spot);
    // "perto d" + "a roda..." = "perto da roda..." (contração de + artigo)
    return `Procurar algo perdido perto d${s ? s.name : 'a praça'} (clique no ponto brilhando no mapa da cidade)`;
  },
  sectionHtml(){
    if(!this.unlocked()) return '';
    const esc = s => QuestModule.esc(s);
    let html = '<div class="missions-section-title">Pedidos dos moradores</div>';
    const now = Date.now();
    for(let i = 0; i < REQUEST_CONFIG.slots; i++){
      const q = state.requests.slots[i];
      if(!q){
        const mins = Math.max(1, Math.ceil(((state.requests.nextAt[i] || 0) - now) / 60000));
        html += `<div class="mission-card mission-request is-waiting"><div class="mission-desc">Novo pedido em ~${mins} min.</div></div>`;
        continue;
      }
      const ready = this.isReady(q);
      const prog = q.type === 'hunt' ? `${this.progress(q)}/${q.count}` : q.type === 'deliver' ? `${UI.fmt(this.progress(q))}/${q.qty}` : '';
      html += `
        <div class="mission-card mission-request${ready ? ' is-ready' : ''}">
          <div class="mission-giver">Pedido de ${esc(q.giver)}</div>
          <div class="quest-objective${ready ? ' done' : ''}">${ready ? '✓' : '○'} ${esc(this.describe(q))}${prog ? ` — ${prog}` : ''}</div>
          <div class="mission-reward">Recompensa: ${UI.fmt(q.reward)} moedas</div>
          <div class="mission-actions">
            ${q.type === 'spot' ? '' : `<button class="buy-btn" data-request="complete" data-slot="${i}" ${ready ? '' : 'disabled'}>Concluir</button>`}
            <button class="small-btn" data-request="dismiss" data-slot="${i}">Dispensar</button>
          </div>
        </div>`;
    }
    return html;
  },
};
