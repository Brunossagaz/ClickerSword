/* ---------------------------------------------------------------------
   MINING MODULE (mining.js)
   Caverna de Mineração: fonte de ouro passiva (mineradores), independente
   do combate. Não passa pela PROGRESSION_CHAIN — só custa ouro mesmo.
--------------------------------------------------------------------- */
const MiningModule = {
  costFor(def){
    const owned = state.miners[def.key];
    return Math.ceil(def.baseCost * Math.pow(def.costGrowth, owned));
  },
  buy(key){
    const def = MINER_DEFS.find(m=>m.key===key);
    const cost = this.costFor(def);
    if(state.gold >= cost){
      state.gold -= cost;
      state.miners[key] += 1;
      UI.renderAll();
    }
  },
  totalGoldPerSecond(){
    let total = 0;
    for(const def of MINER_DEFS){
      total += def.goldPerSec * state.miners[def.key];
    }
    total *= (1+state.pGoldMult);
    return total;
  }
};
