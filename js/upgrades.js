/* ---------------------------------------------------------------------
   UPGRADES MODULE (upgrades.js)
--------------------------------------------------------------------- */
const UpgradesModule = {
  costFor(def){
    const lvl = state.upgrades[def.key];
    return Math.ceil(def.baseCost * Math.pow(def.costGrowth, lvl));
  },
  buy(key){
    if(!ProgressionModule.isUnlocked('upgrade', key)) return;
    const def = UPGRADE_DEFS.find(u=>u.key===key);
    const lvl = state.upgrades[key];
    if(lvl >= def.maxLevel) return;
    const cost = this.costFor(def);
    if(state.gold >= cost){
      state.gold -= cost;
      state.upgrades[key] += 1;
      this.recalcStats();
      UI.renderAll();
    }
  },
  // Recalcula TODOS os atributos derivados a partir dos níveis comprados
  // (state.upgrades e state.prestige), em vez de confiar no que ficou somado
  // no save. Assim, trocar um efeito no Compêndio (ou rebalancear
  // UPGRADE_DEFS) vale na hora pros níveis já comprados, inclusive em saves
  // antigos. Chamado ao carregar o save e a cada compra. Nível acima do
  // maxLevel atual (maxLevel reduzido no Compêndio) é cortado.
  recalcStats(){
    for(const k of Object.keys(UPGRADE_STATS)) state[k] = 0;
    for(const def of UPGRADE_DEFS){
      const lvl = Math.max(0, Math.min(def.maxLevel, Math.floor(state.upgrades[def.key] || 0)));
      state.upgrades[def.key] = lvl;
      for(let i = 0; i < lvl; i++) def.apply(state);
    }
    state.pClickMult = 0; state.pDpsMult = 0; state.pOreRateMult = 0; state.pCritChance = 0;
    for(const def of PRESTIGE_UPGRADE_DEFS){
      const lvl = Math.max(0, Math.floor(state.prestige[def.key] || 0));
      for(let i = 0; i < lvl; i++) def.apply(state);
    }
  }
};
