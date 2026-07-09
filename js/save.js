/* ---------------------------------------------------------------------
   SAVE / LOAD  (save.js)
--------------------------------------------------------------------- */
const SaveModule = {
  save(){
    state.lastSave = Date.now();
    try{ localStorage.setItem(CONFIG.saveKey, JSON.stringify(state)); }catch(e){ console.warn('Falha ao salvar', e); }
  },
  // Aplica um objeto de save já parseado ao estado atual do jogo. Usado tanto
  // por load() (localStorage) quanto por SettingsModule.uploadSaveFromFile()
  // (arquivo baixado pelo jogador) — mesma lógica de compatibilidade nos dois casos.
  applyLoaded(loaded){
    state = Object.assign(freshState(), loaded);
    // guard against missing nested keys from older saves (ou de novos
    // upgrades/tropas/mineradores/itens adicionados depois que o save foi criado)
    state.troops = Object.assign(Object.fromEntries(TROOP_DEFS.map(d => [d.key, 0])), loaded.troops||{});
    state.miners = Object.assign(Object.fromEntries(MINER_DEFS.map(d => [d.key, 0])), loaded.miners||{});
    state.upgrades = Object.assign(Object.fromEntries(UPGRADE_DEFS.map(d => [d.key, 0])), loaded.upgrades||{});
    state.inventory = Object.assign(Object.fromEntries(ITEM_DEFS.map(d => [d.key, 0])), loaded.inventory||{});
    state.prestige = Object.assign({pClick:0,pDps:0,pGold:0,pCrit:0}, loaded.prestige||{});
    state.settings = Object.assign({audioEnabled:true, volume:70, language:'pt-BR'}, loaded.settings||{});

    // Save de antes da atualização de Dungeons: tinha um killCount/loop
    // globais (Mapa 1 ciclos 1-3, Mapa 2 ciclos 4-6, Mapa 3 ciclo 7+), sem
    // conceito de Dungeon escolhida. Migra esse progresso linear pra dentro
    // da Dungeon correspondente, preservando exatamente onde o jogador
    // estava (e desbloqueando as Dungeons que ele já tinha alcançado).
    if(loaded.dungeons === undefined){
      const cycleLen = CONFIG.cycleLength;
      const cap = 3 * cycleLen; // 30 — tamanho de Slime e de Goblin no sistema antigo
      const oldKill = loaded.killCount || 0;
      const dungeons = { slimes:{killCount:0}, goblins:{killCount:0}, wilds:{killCount:0} };
      let current;
      if(oldKill <= cap){
        dungeons.slimes.killCount = oldKill; current = 'slimes';
      } else if(oldKill <= cap*2){
        dungeons.slimes.killCount = cap; dungeons.goblins.killCount = oldKill - cap; current = 'goblins';
      } else {
        dungeons.slimes.killCount = cap; dungeons.goblins.killCount = cap;
        dungeons.wilds.killCount = oldKill - cap*2; current = 'wilds';
      }
      state.dungeons = dungeons;
      state.currentDungeon = current;
    }
  },
  load(){
    let raw;
    try{ raw = localStorage.getItem(CONFIG.saveKey); }catch(e){ raw = null; }
    if(!raw) return false;
    try{
      const loaded = JSON.parse(raw);
      this.applyLoaded(loaded);
      return true;
    }catch(e){ console.warn('Save corrompido', e); return false; }
  },
  reset(){
    try{ localStorage.removeItem(CONFIG.saveKey); }catch(e){}
    state = freshState();
    MonsterModule.current = null; // freshState() não tem Dungeon ativa — volta pra cidade
    UI.showCityView();
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
