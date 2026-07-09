/* ---------------------------------------------------------------------
   MONSTER MODULE (monster.js)
   Todo o progresso de ciclo/monstro é escopado à Dungeon ativa
   (state.dungeons[state.currentDungeon]) — ver DungeonModule pra entrar/sair.
--------------------------------------------------------------------- */
const MonsterModule = {
  current:null,
  typeFor(dungeonKey, cycleNum, posInCycle){
    const map = MAPS[dungeonKey];
    let order;
    if(map.cycles){
      // Uma vez passado o último ciclo definido, a fileira de monstros
      // repete (o padrão volta pro ciclo 1) — só o HP continua subindo com
      // killIdx, então a dungeon nunca "acaba", só fica cada vez mais difícil.
      const totalCycles = Object.keys(map.cycles).length;
      const wrapped = ((cycleNum - 1) % totalCycles) + 1;
      order = map.cycles[wrapped];
    } else {
      order = map.order;
    }
    return MONSTER_TYPES.find(t=>t.key===order[posInCycle]);
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
    const cycleLen = CONFIG.cycleLength;
    const d = state.dungeons[state.currentDungeon];
    const cycleNum = Math.floor(d.killCount / cycleLen) + 1;
    d.killCount = Math.floor(d.killCount / cycleLen) * cycleLen; // volta pro monstro 1 do ciclo atual
    this.spawn(false);
    UI.renderAll();
    UI.showToast('⏱ TEMPO ESGOTADO', `Você não derrotou o monstro a tempo! Voltando para o início do Ciclo ${cycleNum} (${MAPS[state.currentDungeon].name}).`);
  },
  spawn(isFirst){
    const cycleLen = CONFIG.cycleLength;
    const d = state.dungeons[state.currentDungeon];
    const killIdx = d.killCount;
    const posInCycle = killIdx % cycleLen;
    const cycleNum = Math.floor(killIdx / cycleLen) + 1;
    const isBoss = (!isFirst) && posInCycle === cycleLen - 1; // último monstro do ciclo = chefe
    const type = this.typeFor(state.currentDungeon, cycleNum, posInCycle);

    this.current = { type, isBoss };

    // killIdx (killCount da Dungeon ativa) reseta a cada ascensão, então a
    // dificuldade dos monstros também reseta — sem isso o HP nunca voltaria
    // ao nível 1.
    const hp = this.hpFor(killIdx, isBoss, type.hpMult);
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
  // Quantidade de item dropada — mesma escala relativa do ouro (chefe e
  // monstro dourado rendem mais), só que em unidades de item em vez de ouro.
  itemRewardQty(){
    let qty = Math.max(1, Math.round(state.monsterMaxHp / CONFIG.baseHp));
    if(state.isBoss) qty *= CONFIG.bossRewardMult;
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
    const itemKey = MAPS[state.currentDungeon].dropsItem;
    if(itemKey){
      const qty = this.itemRewardQty();
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
    this.spawn(false);
    UI.renderAll();
  }
};
