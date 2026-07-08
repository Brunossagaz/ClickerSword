/* ---------------------------------------------------------------------
   PRESTIGE / ASCENSION MODULE
--------------------------------------------------------------------- */
const PrestigeModule = {
  potentialEssence(){
    if(state.killCount < CONFIG.ascendKillThreshold) return 0;
    return Math.floor(Math.sqrt(state.goldEarnedThisRun/500));
  },
  canAscend(){
    return state.killCount >= CONFIG.ascendKillThreshold && this.potentialEssence() > 0;
  },
  ascend(){
    if(!this.canAscend()) return;
    const gained = this.potentialEssence();
    const keepEssence = state.essence + gained;
    const keepPrestige = state.prestige;
    const keepMultipliers = { pClickMult:state.pClickMult, pDpsMult:state.pDpsMult, pGoldMult:state.pGoldMult, pCritChance:state.pCritChance };
    const keepTotalKills = state.totalKillsAll;

    state = freshState();
    state.essence = keepEssence;
    state.prestige = keepPrestige;
    state.pClickMult = keepMultipliers.pClickMult;
    state.pDpsMult = keepMultipliers.pDpsMult;
    state.pGoldMult = keepMultipliers.pGoldMult;
    state.pCritChance = keepMultipliers.pCritChance;
    state.totalKillsAll = keepTotalKills;
    // killCount volta a 0 (freshState) — ciclo e HP dos monstros reiniciam do zero

    MonsterModule.spawn(true);
    UI.renderAll();
    UI.showToast('✨ ASCENSÃO ✨', `Você ganhou ${gained} de Essência! Multiplicadores permanentes aplicados.`);
  },
  costFor(def){
    const lvl = state.prestige[def.key];
    return Math.ceil(def.baseCost * Math.pow(def.costGrowth, lvl));
  },
  buy(key){
    const def = PRESTIGE_UPGRADE_DEFS.find(u=>u.key===key);
    const cost = this.costFor(def);
    if(state.essence >= cost){
      state.essence -= cost;
      state.prestige[key] += 1;
      def.apply(state);
      UI.renderAll();
    }
  }
};
