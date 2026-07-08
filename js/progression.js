/* ---------------------------------------------------------------------
   PROGRESSION MODULE (progression.js)
   Controla o desbloqueio em corrente de upgrades/tropas (ver PROGRESSION_CHAIN
   em config.js): cada item só libera depois que o anterior atinge
   UNLOCK_REQUIREMENT níveis (upgrade) ou unidades compradas (tropa).
--------------------------------------------------------------------- */
const ProgressionModule = {
  indexOf(type, key){
    return PROGRESSION_CHAIN.findIndex(e=>e.type===type && e.key===key);
  },
  levelOf(entry){
    return entry.type === 'troop' ? state.troops[entry.key] : state.upgrades[entry.key];
  },
  nameOf(entry){
    const def = entry.type === 'troop'
      ? TROOP_DEFS.find(t=>t.key===entry.key)
      : UPGRADE_DEFS.find(u=>u.key===entry.key);
    return def.name;
  },
  isUnlocked(type, key){
    const idx = this.indexOf(type, key);
    if(idx <= 0) return true; // primeiro item da corrente sempre liberado
    return this.levelOf(PROGRESSION_CHAIN[idx-1]) >= UNLOCK_REQUIREMENT;
  },
  lockLabel(type, key){
    const idx = this.indexOf(type, key);
    if(idx <= 0) return '';
    const prev = PROGRESSION_CHAIN[idx-1];
    return `Requer ${this.nameOf(prev)} nível/qtd. ${UNLOCK_REQUIREMENT}`;
  }
};
