/* ---------------------------------------------------------------------
   MONSTER MODULE (monster.js)
--------------------------------------------------------------------- */
const MonsterModule = {
  current:null,
  typeFor(cycleNum, posInCycle){
    const slimesMap = MAPS.slimes;
    const order = slimesMap.cycles[cycleNum] || MAPS.wilds.order;
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
    const cycleNum = Math.floor(state.killCount / cycleLen) + 1;
    state.killCount = Math.floor(state.killCount / cycleLen) * cycleLen; // volta pro monstro 1 do ciclo atual
    this.spawn(false);
    UI.renderAll();
    UI.showToast('⏱ TEMPO ESGOTADO', `Você não derrotou o monstro a tempo! Voltando para o início do Ciclo ${cycleNum}.`);
  },
  spawn(isFirst){
    const cycleLen = CONFIG.cycleLength;
    const killIdx = state.killCount;
    const posInCycle = killIdx % cycleLen;
    const cycleNum = Math.floor(killIdx / cycleLen) + 1;
    const isBoss = (!isFirst) && posInCycle === cycleLen - 1; // último monstro do ciclo = chefe
    const type = this.typeFor(cycleNum, posInCycle);
    state.loop = cycleNum;

    this.current = { type, isBoss };

    // killIdx (killCount) reseta a cada ascensão, então a dificuldade dos
    // monstros também reseta — sem isso o HP nunca voltaria ao nível 1.
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
  applyDamage(dmg){
    state.monsterHp -= dmg;
    UI.renderHpBar();
    if(state.monsterHp <= 0){
      this.onDeath();
    }
  },
  onDeath(){
    const reward = this.goldReward();
    state.gold += reward;
    state.goldEarnedThisRun += reward;
    state.killCount += 1;
    state.totalKillsAll += 1;
    UI.showFloatingGold(reward);
    this.spawn(false);
    UI.renderAll();
  }
};
