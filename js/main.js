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
  MainMenuModule.init();
  SettingsModule.loadGlobalSettings();
  SaveModule.migrateLegacyIfNeeded();

  // O jogo sempre começa no menu principal — o jogador escolhe Novo Jogo ou
  // Continuar, que leva pro seletor de saves (ver MainMenuModule). Nenhum
  // save é carregado automaticamente aqui.
  UI.showMainMenu();
  UI.renderAll(); // seguro: state==freshState() aqui, todo render já tolera esse estado

  setInterval(tick, CONFIG.tickMs);
  setInterval(()=>SaveModule.save(), CONFIG.autosaveMs); // no-op enquanto nenhum slot está ativo
  window.addEventListener('beforeunload', ()=>SaveModule.save());
}

boot();
