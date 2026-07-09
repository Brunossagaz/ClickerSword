/* ---------------------------------------------------------------------
   SAVE / LOAD  (save.js)
--------------------------------------------------------------------- */
const SaveModule = {
  save(){
    state.lastSave = Date.now();
    try{ localStorage.setItem(CONFIG.saveKey, JSON.stringify(state)); }catch(e){ console.warn('Falha ao salvar', e); }
  },
  load(){
    let raw;
    try{ raw = localStorage.getItem(CONFIG.saveKey); }catch(e){ raw = null; }
    if(!raw) return false;
    try{
      const loaded = JSON.parse(raw);
      state = Object.assign(freshState(), loaded);
      // guard against missing nested keys from older saves (ou de novos
      // upgrades/tropas adicionados depois que o save foi criado)
      state.troops = Object.assign(Object.fromEntries(TROOP_DEFS.map(d => [d.key, 0])), loaded.troops||{});
      state.miners = Object.assign(Object.fromEntries(MINER_DEFS.map(d => [d.key, 0])), loaded.miners||{});
      state.upgrades = Object.assign(Object.fromEntries(UPGRADE_DEFS.map(d => [d.key, 0])), loaded.upgrades||{});
      state.prestige = Object.assign({pClick:0,pDps:0,pGold:0,pCrit:0}, loaded.prestige||{});
      return true;
    }catch(e){ console.warn('Save corrompido', e); return false; }
  },
  reset(){
    try{ localStorage.removeItem(CONFIG.saveKey); }catch(e){}
    state = freshState();
    MonsterModule.spawn(true);
    UI.renderAll();
  },
  computeOfflineEarnings(){
    const elapsedMs = Date.now() - (state.lastSave || Date.now());
    const cappedMs = Math.min(elapsedMs, CONFIG.offlineCapHours*3600*1000);
    const seconds = Math.max(0, cappedMs/1000);
    if(seconds < 5) return 0;
    const dps = TroopsModule.totalDps();
    const gps = MiningModule.totalGoldPerSecond();
    const earned = Math.floor((dps + gps) * seconds * CONFIG.offlineEfficiency);
    if(earned > 0){
      state.gold += earned;
      state.goldEarnedThisRun += earned;
    }
    return {earned, seconds};
  }
};
