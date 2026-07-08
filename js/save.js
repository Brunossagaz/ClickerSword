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
      // guard against missing nested keys from older saves
      state.troops = Object.assign({recruit:0,archer:0,mage:0,catapult:0,dragon:0}, loaded.troops||{});
      state.upgrades = Object.assign({clickDmg1:0,clickDmg2:0,critChance:0,critMult:0,goldFind:0}, loaded.upgrades||{});
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
    const earned = Math.floor(dps * seconds * CONFIG.offlineEfficiency);
    if(earned > 0){
      state.gold += earned;
      state.goldEarnedThisRun += earned;
    }
    return {earned, seconds};
  }
};
