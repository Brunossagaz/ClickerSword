/* ---------------------------------------------------------------------
   BESTIARY MODULE (bestiary.js)
   Bestiário: um cartão por espécie de MONSTER_TYPES (config.js) com a arte,
   a descrição (`desc`), onde aparece (Andares de MAPS) e quantos o jogador
   já abateu (state.monsterKills, contado em MonsterModule.onDeath).
   Espécie nunca abatida aparece como silhueta, sem nome nem descrição.
   Aberto pelo botão de livro no canto da tela (ver HudModule). Todo texto
   entra por textContent (nada de innerHTML).
--------------------------------------------------------------------- */
const BestiaryModule = {
  init(){
    this.modal = document.getElementById('bestiaryModal');
    document.getElementById('bestiaryBtn').addEventListener('click', () => this.open());
    document.getElementById('bestiaryCloseBtn').addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => { if(e.target === this.modal) this.close(); });
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
      card.appendChild(info);
      el.appendChild(card);
    }
  }
};
