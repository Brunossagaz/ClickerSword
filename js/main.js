/* ---------------------------------------------------------------------
   MAIN GAME LOOP
--------------------------------------------------------------------- */
function tick(){
  MonsterModule.checkGoldenExpiry();
  MonsterModule.maybeTriggerGolden();
  MonsterModule.checkTimeUp();
  const dps = TroopsModule.totalDps();
  if(dps > 0 && MonsterModule.current){
    MonsterModule.applyDamage(dps * (CONFIG.tickMs/1000));
  }
  const gps = MiningModule.totalGoldPerSecond();
  if(gps > 0){
    const earned = gps * (CONFIG.tickMs/1000);
    state.gold += earned;
    state.goldEarnedThisRun += earned;
  }
  UI.renderStats();
  UI.renderTimer();
}

function boot(){
  UI.init();
  Sprites.startBlinkLoop();
  const hadSave = SaveModule.load();
  MonsterModule.spawn(true);
  if(hadSave){
    const off = SaveModule.computeOfflineEarnings();
    if(off && off.earned > 0){
      const mins = Math.floor(off.seconds/60);
      UI.showToast('BEM-VINDO DE VOLTA', `Suas tropas lutaram por ${mins} min enquanto você estava fora e renderam ${UI.fmt(off.earned)} de ouro!`);
    }
  }
  UI.renderAll();

  setInterval(tick, CONFIG.tickMs);
  setInterval(()=>SaveModule.save(), CONFIG.autosaveMs);
  window.addEventListener('beforeunload', ()=>SaveModule.save());
}

boot();
