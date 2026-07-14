/* ---------------------------------------------------------------------
   MAIN GAME LOOP
--------------------------------------------------------------------- */
// Acumula o dano de DPS entre ticks pra mostrar 1 número flutuante por
// segundo (ver UI.showFloatingDpsDamage) em vez de um a cada 200ms — a
// soma nesse intervalo já bate com o próprio valor de DPS exibido no stat.
let dpsFloatAccum = 0;
let dpsFloatElapsedMs = 0;
function tick(){
  MonsterModule.checkGoldenExpiry();
  MonsterModule.maybeTriggerGolden();
  MonsterModule.checkTimeUp();
  const dps = TroopsModule.totalDps();
  if(dps > 0 && MonsterModule.current){
    const dmg = dps * (CONFIG.tickMs/1000);
    MonsterModule.applyDamage(dmg);
    dpsFloatAccum += dmg;
    dpsFloatElapsedMs += CONFIG.tickMs;
    if(dpsFloatElapsedMs >= 1000){
      UI.showFloatingDpsDamage(dpsFloatAccum);
      dpsFloatAccum = 0;
      dpsFloatElapsedMs = 0;
    }
  }
  CavernModule.tick(CONFIG.tickMs/1000);
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
