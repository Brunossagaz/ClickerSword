/* ---------------------------------------------------------------------
   MONSTER MODULE (monster.js)
   Todo o progresso de ciclo/monstro é escopado à Dungeon ativa
   (state.dungeons[state.currentDungeon]) — ver DungeonModule pra entrar/sair.
--------------------------------------------------------------------- */
const MonsterModule = {
  current:null,
  // Schedule "canônico" de uma Dungeon (usado só pra saber o FORMATO dos
  // ciclos — quantas posições, quais são duplas): todo ciclo definido de uma
  // mesma Dungeon usa o mesmo formato, só a cor/tipo dos monstros muda de
  // ciclo pra ciclo (ver MAPS.slimes) — por isso basta olhar o ciclo 1.
  scheduleFor(dungeonKey){
    const map = MAPS[dungeonKey];
    return map.cycles ? map.cycles[1] : map.order;
  },
  // Quantidade de MONSTROS (não de "posições") que um ciclo inteiro dessa
  // Dungeon consome — cada posição normal vale 1, cada posição de dupla
  // (`pairChoices`) vale 2. Usado no lugar de CONFIG.cycleLength, que só
  // servia quando toda posição era sempre 1 monstro.
  killsPerCycle(schedule){
    return schedule.reduce((sum, slot) => sum + ((slot && slot.pairChoices) ? 2 : 1), 0);
  },
  killsPerCycleFor(dungeonKey){
    return this.killsPerCycle(this.scheduleFor(dungeonKey));
  },
  // Acha, dentro do schedule de UM ciclo, qual posição (slotIdx, 0-based) e
  // qual monstro da dupla (subKill: 0 ou 1, sempre 0 se a posição for única)
  // correspondem ao `killIdxInCycle`-ésimo monstro morto desde o início do
  // ciclo atual.
  resolveSlot(schedule, killIdxInCycle){
    let consumed = 0;
    for(let slotIdx=0; slotIdx<schedule.length; slotIdx++){
      const slot = schedule[slotIdx];
      const size = (slot && slot.pairChoices) ? 2 : 1;
      if(killIdxInCycle < consumed + size){
        return { slotIdx, subKill: killIdxInCycle - consumed, slot, isLastSlot: slotIdx === schedule.length-1 };
      }
      consumed += size;
    }
    // não deveria acontecer (killIdxInCycle sempre < killsPerCycle), mas por
    // segurança devolve a última posição em vez de quebrar
    const lastIdx = schedule.length-1;
    return { slotIdx:lastIdx, subKill:0, slot:schedule[lastIdx], isLastSlot:true };
  },
  hpFor(killIndexInRun, isBoss, hpMult){
    let hp = CONFIG.baseHp * Math.pow(CONFIG.hpGrowth, killIndexInRun);
    if(isBoss) hp *= CONFIG.bossHpMult;
    hp *= hpMult || 1;
    return Math.ceil(hp);
  },
  maybeTriggerGolden(){
    if(state.isGolden) return;
    if(Math.random() < CONFIG.goldenChancePerTick){
      state.isGolden = true;
      state.goldenExpiresAt = Date.now() + CONFIG.goldenDurationMs;
      UI.setGoldenVisible(true);
    }
  },
  checkGoldenExpiry(){
    if(state.isGolden && Date.now() > state.goldenExpiresAt){
      state.isGolden = false;
      UI.setGoldenVisible(false);
    }
  },
  checkTimeUp(){
    if(!this.current) return;
    if(Date.now() - state.monsterSpawnedAt > CONFIG.monsterTimeLimitMs){
      this.onTimeUp();
    }
  },
  onTimeUp(){
    // pausa o jogo (igual ao fim de ciclo) até o jogador escolher tentar de
    // novo ou voltar pra cidade, em vez de resetar sozinho
    this.current = null;
    UI.renderAll();
    UI.showTimeUpModal();
  },
  retryCycle(){
    const d = state.dungeons[state.currentDungeon];
    const kpc = this.killsPerCycleFor(state.currentDungeon);
    d.killCount = Math.floor(d.killCount / kpc) * kpc; // volta pro monstro 1 do ciclo atual
    d.pendingSlot = null; // descarta o sorteio de dupla em andamento, se houver
    this.spawn(false);
    UI.renderAll();
  },
  // Chamado quando o jogador sai da dungeon manualmente (botão "Voltar pra
  // cidade" durante o combate, com o monstro ainda vivo) — mesmo reset de
  // retryCycle(), só que sem spawnar de novo (quem chama já está saindo pra
  // cidade). Precisa rodar ANTES de DungeonModule.leaveToCity() zerar
  // state.currentDungeon, senão perde a referência de qual Dungeon resetar.
  abandonCycle(){
    const d = state.dungeons[state.currentDungeon];
    const kpc = this.killsPerCycleFor(state.currentDungeon);
    d.killCount = Math.floor(d.killCount / kpc) * kpc; // volta pro monstro 1 do ciclo atual
    d.pendingSlot = null;
  },
  spawn(isFirst){
    const d = state.dungeons[state.currentDungeon];
    const map = MAPS[state.currentDungeon];
    const killIdx = d.killCount;
    const cyclesMap = map.cycles || { 1: map.order };
    const totalCycles = Object.keys(cyclesMap).length;
    const schedule1 = cyclesMap[1];
    const kpc = this.killsPerCycle(schedule1);
    const cycleNum = Math.floor(killIdx / kpc) + 1;
    const killIdxInCycle = killIdx % kpc;
    const wrappedCycle = ((cycleNum - 1) % totalCycles) + 1;
    const schedule = cyclesMap[wrappedCycle];
    const { slotIdx, subKill, slot, isLastSlot } = this.resolveSlot(schedule, killIdxInCycle);

    const isDouble = !!(slot && slot.pairChoices);
    let monsterKey, isBoss = false, extraHpMult = 1;

    if(isDouble){
      // sorteia a dupla dessa posição só na 1ª metade — a 2ª reaproveita o
      // mesmo sorteio (ver state.dungeons[key].pendingSlot)
      if(subKill === 0 || !d.pendingSlot){
        const options = slot.pairChoices;
        const chosen = options[Math.floor(Math.random()*options.length)];
        d.pendingSlot = { keys: chosen, firstQty: null };
      }
      monsterKey = d.pendingSlot.keys[subKill] || d.pendingSlot.keys[0];
      if(slot.strong) extraHpMult = 1.5; // posição "mais forte" (ver MAPS.slimes)
    } else {
      monsterKey = slot;
      isBoss = (!isFirst) && isLastSlot; // último monstro do ciclo = chefe
    }

    const type = MONSTER_TYPES.find(t=>t.key===monsterKey);
    this.current = { type, isBoss, isDouble, doubleSubKill: subKill, slotIdx, totalSlots: schedule.length };

    // killIdx (killCount da Dungeon ativa) reseta a cada ascensão, então a
    // dificuldade dos monstros também reseta — sem isso o HP nunca voltaria
    // ao nível 1.
    const hp = this.hpFor(killIdx, isBoss, (type.hpMult||1) * extraHpMult);
    state.monsterHp = hp;
    state.monsterMaxHp = hp;
    state.isBoss = isBoss;
    state.isGolden = false;
    state.monsterSpawnedAt = Date.now();
    UI.setGoldenVisible(false);

    UI.renderMonsterSprite();
    UI.renderMonsterInfo();
    UI.renderHpBar();
  },
  goldReward(){
    let base = state.monsterMaxHp * CONFIG.goldPerHpFactor;
    if(state.isBoss) base *= CONFIG.bossRewardMult;
    if(state.isGolden) base *= CONFIG.goldenRewardMult;
    base *= state.goldMult * (1+state.pGoldMult);
    return Math.max(1, Math.floor(base));
  },
  // Quantidade de item dropada — FIXA por tipo de monstro (type.dropQty),
  // sem escalar com HP/posição no ciclo, pra ficar previsível (ver tabela em
  // config.js). Monstro dourado ainda multiplica, como bônus de evento.
  itemRewardQty(){
    let qty = (this.current && this.current.type.dropQty) || 1;
    if(state.isGolden) qty *= CONFIG.goldenRewardMult;
    return Math.max(1, Math.floor(qty));
  },
  applyDamage(dmg){
    state.monsterHp -= dmg;
    UI.renderHpBar();
    if(state.monsterHp <= 0){
      this.onDeath();
    }
  },
  onDeath(){
    const d = state.dungeons[state.currentDungeon];
    const wasBoss = this.current.isBoss; // captura antes do spawn() sobrescrever this.current
    const wasDouble = this.current.isDouble;
    const doubleSubKill = this.current.doubleSubKill;
    const itemKey = MAPS[state.currentDungeon].dropsItem;
    if(itemKey){
      let qty = this.itemRewardQty();
      if(wasDouble){
        if(doubleSubKill === 0){
          // guarda a recompensa do 1º da dupla — o bônus só é calculado
          // quando o 2º morrer (precisa da soma dos dois, ver MAPS.slimes)
          d.pendingSlot.firstQty = qty;
        } else {
          const firstQty = (d.pendingSlot && d.pendingSlot.firstQty) || 0;
          const bonus = Math.ceil((firstQty + qty) * 0.10);
          qty += bonus;
          d.pendingSlot = null;
        }
      }
      state.inventory[itemKey] += qty;
      UI.showFloatingItem(qty, ITEM_DEFS.find(i=>i.key===itemKey));
    } else {
      const reward = this.goldReward();
      state.gold += reward;
      state.goldEarnedThisRun += reward;
      UI.showFloatingGold(reward);
    }
    d.killCount += 1;
    state.totalKillsAll += 1; // continua vitalício e global, alimenta a Ascensão

    if(wasBoss){
      // marca esse ciclo como concluído pra sempre (vitalício, não reseta ao
      // abandonar/tentar de novo) — habilita o seletor de ciclo pra voltar
      // até aqui depois (ver DungeonModule.startAtCycle/UI.openCyclePicker)
      const kpc = this.killsPerCycleFor(state.currentDungeon);
      const justFinishedCycle = Math.floor((d.killCount - 1) / kpc) + 1;
      d.maxCycleCompleted = Math.max(d.maxCycleCompleted || 0, justFinishedCycle);
      // fim de ciclo: pausa e pergunta se o jogador quer seguir pro próximo
      // ciclo ou voltar pra cidade, em vez de continuar sozinho
      this.current = null;
      UI.renderAll();
      UI.showCycleCompleteModal();
    } else {
      this.spawn(false);
      UI.renderAll();
    }
  }
};
