/* ---------------------------------------------------------------------
   BESTIARY MODULE (bestiary.js)
   Bestiário: um cartão por espécie de MONSTER_TYPES (config.js) com a arte,
   a descrição (`desc`), onde aparece (Andares de MAPS) e quantos o jogador
   já abateu (state.monsterKills, contado em MonsterModule.onDeath) e os
   drops com a chance de cada um. Espécie nunca abatida aparece como
   silhueta, sem nome, descrição nem drops.
   Aberto pelo botão de livro no canto da tela (ver HudModule). Todo texto
   entra por textContent (nada de innerHTML).
--------------------------------------------------------------------- */
const BestiaryModule = {
  init(){
    this.modal = document.getElementById('bestiaryModal');
    document.getElementById('bestiaryBtn').addEventListener('click', () => this.open());
    document.getElementById('bestiaryCloseBtn').addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => { if(e.target === this.modal) this.close(); });
    // zoom da arte: qualquer clique (fundo, arte, ✕) fecha
    this.zoomModal = document.getElementById('bestiaryZoomModal');
    this.zoomModal.addEventListener('click', () => this.zoomModal.classList.remove('open'));
  },
  // Arte ampliada de uma espécie já registrada (clique na arte do cartão)
  openZoom(m){
    const art = document.getElementById('bestiaryZoomArt');
    art.style.backgroundImage = `url('${m.image}')`;
    document.getElementById('bestiaryZoomName').textContent = this.displayName(m);
    this.zoomModal.classList.add('open');
  },
  open(){
    this.render();
    this.modal.classList.add('open');
  },
  close(){
    this.modal.classList.remove('open');
  },
  // 'SLIME AZUL' -> 'Slime Azul' ('LAGARTO DE FOGO' -> 'Lagarto de Fogo')
  displayName(m){
    const small = ['de', 'do', 'da', 'dos', 'das', 'e'];
    return m.name.toLowerCase().split(' ')
      .map((w, i) => (i > 0 && small.includes(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  },
  kills(key){
    return (state.monsterKills && state.monsterKills[key]) || 0;
  },
  // Andares (nome de MAPS) em que a espécie aparece em algum ciclo, na ordem
  // de progressão (DUNGEON_ORDER)
  dungeonsOf(key){
    const inSlot = slot => typeof slot === 'string' ? slot === key
      : !!(slot && slot.pairChoices && slot.pairChoices.some(opt => opt.includes(key)));
    return DUNGEON_ORDER.filter(d => MAPS[d] && Object.values(MAPS[d].cycles || {}).some(cycle => cycle.some(inSlot)))
      .map(d => MAPS[d].name);
  },
  // Chance efetiva de um drop: a mesma conta de MonsterModule.rollDrops — o
  // bônus do ramo Sorte (state.rareDropChanceBonus) só soma nos drops raros
  // (os que têm  própria); os garantidos são sempre 100%.
  dropChance(d){
    if(d.chance == null) return { value: 1, bonus: 0 };
    const bonus = state.rareDropChanceBonus || 0;
    return { value: Math.min(1, d.chance + bonus), bonus: Math.min(1, d.chance + bonus) - d.chance };
  },
  pct(v){
    const p = v * 100;
    return (Number.isInteger(Math.round(p * 10) / 10) ? Math.round(p) : (Math.round(p * 10) / 10).toString().replace('.', ',')) + '%';
  },
  // lista de drops (só pra espécie já abatida)
  dropsBlock(m){
    const wrap = document.createElement('div');
    wrap.className = 'bestiary-drops';
    const title = document.createElement('div');
    title.className = 'bestiary-drops-title';
    title.textContent = 'Drops';
    wrap.appendChild(title);
    for(const d of (m.drops || [])){
      const it = ITEM_DEFS.find(i => i.key === d.item);
      if(!it) continue;
      const row = document.createElement('div');
      row.className = 'bestiary-drop';
      const icon = document.createElement('div');
      icon.className = 'icon icon-' + it.icon;
      const name = document.createElement('span');
      name.className = 'bestiary-drop-name';
      name.textContent = it.name + (d.qtyMin === d.qtyMax ? ` ×${d.qtyMin}` : ` ×${d.qtyMin}–${d.qtyMax}`);
      const ch = this.dropChance(d);
      const chance = document.createElement('span');
      chance.className = 'bestiary-drop-chance' + (ch.value >= 1 ? ' sure' : '');
      chance.textContent = this.pct(ch.value);
      if(ch.bonus > 0){
        chance.title = `${this.pct(d.chance)} + ${this.pct(ch.bonus)} do ramo Sorte`;
        chance.classList.add('boosted');
      }
      row.append(icon, name, chance);
      wrap.appendChild(row);
    }
    if(!(m.drops || []).length){
      const none = document.createElement('div');
      none.className = 'bestiary-drop-none';
      none.textContent = 'Não dropa itens.';
      wrap.appendChild(none);
    }
    return wrap;
  },
  render(){
    const el = document.getElementById('bestiaryList');
    if(!el) return;
    const seen = MONSTER_TYPES.filter(m => this.kills(m.key) > 0).length;
    const total = MONSTER_TYPES.reduce((sum, m) => sum + this.kills(m.key), 0);
    const num = n => Math.floor(n).toLocaleString('pt-BR');
    document.getElementById('bestiarySummary').textContent =
      `${seen} de ${MONSTER_TYPES.length} espécie(s) registrada(s) · ${num(total)} abate(s) no total`;

    el.replaceChildren();
    for(const m of MONSTER_TYPES){
      const kills = this.kills(m.key);
      const known = kills > 0;
      const card = document.createElement('div');
      card.className = 'bestiary-card' + (known ? '' : ' unknown');

      // arte: 1º frame (parado) do spritesheet horizontal de 3 frames
      const art = document.createElement('div');
      art.className = 'bestiary-art';
      art.style.backgroundImage = `url('${m.image}')`;
      if(known){
        art.classList.add('zoomable');
        art.title = 'Clique para ampliar';
        art.addEventListener('click', () => this.openZoom(m));
      }
      card.appendChild(art);

      const info = document.createElement('div');
      info.className = 'bestiary-info';
      const head = document.createElement('div');
      head.className = 'bestiary-name';
      head.textContent = known ? this.displayName(m) : '???';
      if(m.boss){
        const tag = document.createElement('span');
        tag.className = 'bestiary-tag';
        tag.textContent = 'Chefe';
        head.appendChild(tag);
      }
      const where = document.createElement('div');
      where.className = 'bestiary-where';
      where.textContent = this.dungeonsOf(m.key).join(' · ');
      const desc = document.createElement('div');
      desc.className = 'bestiary-desc';
      desc.textContent = known ? (m.desc || '') : 'Derrote esta criatura para registrá-la no Bestiário.';
      const count = document.createElement('div');
      count.className = 'bestiary-kills';
      count.textContent = `Abatidos: ${num(kills)}`;
      info.append(head, where, desc, count);
      if(known) info.appendChild(this.dropsBlock(m));
      else {
        const hidden = document.createElement('div');
        hidden.className = 'bestiary-drop-none';
        hidden.textContent = 'Drops: ???';
        info.appendChild(hidden);
      }
      card.appendChild(info);
      el.appendChild(card);
    }
  }
};
