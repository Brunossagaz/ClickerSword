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
      def.apply(state);
      UI.renderAll();
    }
  }
};
