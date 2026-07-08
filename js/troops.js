/* ---------------------------------------------------------------------
   TROOPS MODULE (troops.js)
--------------------------------------------------------------------- */
const TroopsModule = {
  costFor(def){
    const owned = state.troops[def.key];
    return Math.ceil(def.baseCost * Math.pow(def.costGrowth, owned));
  },
  buy(key){
    if(!ProgressionModule.isUnlocked('troop', key)) return;
    const def = TROOP_DEFS.find(t=>t.key===key);
    const cost = this.costFor(def);
    if(state.gold >= cost){
      state.gold -= cost;
      state.troops[key] += 1;
      UI.renderAll();
    }
  },
  totalDps(){
    let total = 0;
    for(const def of TROOP_DEFS){
      total += def.dps * state.troops[def.key];
    }
    total *= (1+state.pDpsMult);
    return total;
  }
};
