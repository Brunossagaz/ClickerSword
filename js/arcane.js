/* ---------------------------------------------------------------------
   ARCANE MODULE (arcane.js)
   Habilidades Arcanas (aba da Academia): Fogo, Elétrico e Gelo, definidas
   em ARCANE_SKILL_DEFS (config.js). Disparam sozinhas durante a batalha —
   o jogador só escolhe onde investir os pontos.
   - Pontos: 1 por ciclo cujo chefe foi derrotado pela 1ª vez, em qualquer
     andar (derivado de state.dungeons.*.maxCycleCompleted, então quem já
     tinha progresso antes desta atualização recebe os pontos retroativos).
   - Gastos: aprender a habilidade (1 ponto) e depois 1 ponto por nível em
     um dos 2 ramos — Dano ou Velocidade (ver state.arcaneSkills).
   Todos os relógios aqui andam por tick (ver main.js), então pausam sozinhos
   junto com o jogo (conversas, modal de tempo esgotado).
--------------------------------------------------------------------- */
const ArcaneModule = {
  // estado só de batalha, nunca salvo: acumuladores de cada habilidade,
  // queimadura ativa e tempo restante de congelamento
  timers: {},
  burn: null,
  freezeLeftMs: 0,

  def(key){ return ARCANE_SKILL_DEFS.find(d => d.key === key); },
  isLearned(key){ return (state.arcaneSkills[key] || 0) > 0; },
  dmgLevel(key){ return state.arcaneSkills[key+'Dmg'] || 0; },
  spdLevel(key){ return state.arcaneSkills[key+'Spd'] || 0; },

  // Libera ao vencer o último ciclo do andar CONFIG.arcaneUnlockDungeon.
  // arcaneAnnounced mantém liberado mesmo se esse progresso um dia zerar.
  isUnlocked(){
    if(state.arcaneAnnounced) return true;
    const d = state.dungeons[CONFIG.arcaneUnlockDungeon];
    return (d && d.maxCycleCompleted || 0) >= CONFIG.maxCycleNum;
  },
  pointsEarned(){
    return DUNGEON_ORDER.reduce((sum, key) => {
      const d = state.dungeons[key];
      return sum + Math.min(CONFIG.maxCycleNum, (d && d.maxCycleCompleted) || 0);
    }, 0);
  },
  pointsSpent(){
    return Object.values(state.arcaneSkills).reduce((a, b) => a + b, 0) * CONFIG.arcanePointCost;
  },
  pointsAvailable(){
    return Math.max(0, this.pointsEarned() - this.pointsSpent());
  },
  canSpend(){
    return this.isUnlocked() && this.pointsAvailable() >= CONFIG.arcanePointCost;
  },
  learn(key){
    if(!this.def(key) || this.isLearned(key) || !this.canSpend()) return;
    state.arcaneSkills[key] = 1;
    this.timers[key] = 0;
    SaveModule.save();
    UI.renderAll();
  },
  // branch: 'Dmg' ou 'Spd'
  upgrade(key, branch){
    if(!this.isLearned(key) || (branch !== 'Dmg' && branch !== 'Spd') || !this.canSpend()) return;
    if(branch === 'Dmg' && this.dmgMaxed(key)) return;
    if(branch === 'Spd' && this.intervalMs(key) <= this.def(key).minIntervalMs) return;
    state.arcaneSkills[key+branch] += 1;
    SaveModule.save();
    UI.renderAll();
  },

  // Devolve todos os pontos gastos (grátis): esquece as habilidades e zera
  // os dois ramos de cada uma — ver botão "Reiniciar" em UI.renderArcaneTab.
  resetSkills(){
    if(this.pointsSpent() <= 0) return;
    state.arcaneSkills = freshState().arcaneSkills;
    this.resetBattle();
    SaveModule.save();
    UI.renderAll();
    UI.showToast('HABILIDADES REINICIADAS', `${this.pointsAvailable()} Pontos Arcanos disponíveis para redistribuir.`);
  },

  // ---- números de cada habilidade (também usados pela aba da Academia
  // pra mostrar o valor atual e o do próximo nível)
  intervalMs(key, spd = this.spdLevel(key)){
    const def = this.def(key);
    return Math.max(def.minIntervalMs, def.intervalMs * Math.pow(def.speedStep, spd));
  },
  power(key, dmg = this.dmgLevel(key)){
    const def = this.def(key);
    const p = def.dmgBase + def.dmgPerLevel * dmg;
    return def.maxPower != null ? Math.min(def.maxPower, p) : p;
  },
  // ramo de Dano no teto (ARCANE_SKILL_DEFS.maxPower) — mais níveis não somam nada
  dmgMaxed(key){
    const def = this.def(key);
    return def.maxPower != null && this.power(key) >= def.maxPower - 1e-9;
  },
  baseDamage(){
    return Math.max(1, PlayerModule.clickDamage());
  },

  // ---- batalha
  isActive(){
    return !!(state.currentDungeon && MonsterModule.current);
  },
  isFrozen(){
    return this.freezeLeftMs > 0 && this.isActive();
  },
  // multiplicador de dano recebido pelo monstro (Gelo) — ver MonsterModule.applyDamage
  damageTakenMult(){
    return this.isFrozen() ? 1 + this.power('ice') : 1;
  },
  // velocidade dos relógios de monstro/Dungeon (Gelo) — ver main.js/tick
  timeScale(){
    return this.isFrozen() ? this.def('ice').slowFactor : 1;
  },
  // Monstro novo: queimadura e congelamento eram do anterior, somem junto.
  // Os acumuladores de cada habilidade continuam (não reiniciam a cada monstro).
  onMonsterSpawn(){
    this.burn = null;
    this.freezeLeftMs = 0;
    UI.renderArcaneEffects();
  },
  // Entrada nova na Dungeon: tudo zerado, cada habilidade começa a contar do 0.
  resetBattle(){
    this.timers = {};
    this.onMonsterSpawn();
  },
  tick(ms){
    if(!this.isActive()) return;
    for(const def of ARCANE_SKILL_DEFS){
      if(!this.isLearned(def.key)) continue;
      this.timers[def.key] = (this.timers[def.key] || 0) + ms;
      const interval = this.intervalMs(def.key);
      if(this.timers[def.key] >= interval){
        this.timers[def.key] -= interval;
        this.cast(def.key);
        if(!this.isActive()) return; // o golpe matou o chefe e saiu da Dungeon
      }
    }
    if(this.burn){
      const def = this.def('fire');
      this.burn.elapsedMs += ms;
      while(this.burn && this.burn.elapsedMs >= def.tickMs && this.burn.ticksLeft > 0){
        this.burn.elapsedMs -= def.tickMs;
        this.burn.ticksLeft -= 1;
        const dmg = this.burn.dmgPerTick;
        if(this.burn.ticksLeft <= 0){ this.burn = null; UI.renderArcaneEffects(); }
        this.hit(dmg, 'fire');
        if(!this.isActive()) return;
      }
    }
    if(this.freezeLeftMs > 0){
      this.freezeLeftMs -= ms;
      if(this.freezeLeftMs <= 0){ this.freezeLeftMs = 0; UI.renderArcaneEffects(); }
    }
  },
  cast(key){
    const def = this.def(key);
    if(key === 'fire'){
      // reaplicar renova (não empilha), mesmo padrão da queimadura das armas
      const ticks = Math.max(1, Math.round(def.durationMs / def.tickMs));
      this.burn = { dmgPerTick: this.baseDamage() * this.power('fire') / ticks, ticksLeft: ticks, elapsedMs: 0 };
    } else if(key === 'lightning'){
      UI.showLightningStrike();
      this.hit(this.baseDamage() * this.power('lightning'), 'lightning');
    } else if(key === 'ice'){
      this.freezeLeftMs = def.durationMs;
    }
    UI.renderArcaneEffects();
  },
  hit(rawDmg, key){
    const dealt = MonsterModule.applyDamage(Math.max(1, Math.round(rawDmg)));
    UI.showFloatingArcaneDamage(dealt, key);
  }
};
