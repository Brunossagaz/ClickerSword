/* ---------------------------------------------------------------------
   DUNGEON MODULE (dungeons.js)
   Controla a escolha de Dungeon na cidade: desbloqueio (computado, igual ao
   padrão de ProgressionModule), entrar numa Dungeon e voltar pra cidade.
--------------------------------------------------------------------- */
const DungeonModule = {
  isUnlocked(key){
    const req = MAPS[key].unlockRequirement;
    if(!req) return true;
    return (state.dungeons[req.dungeon].maxCycleCompleted || 0) >= req.cycle;
  },
  progressLabel(key){
    // Sem "/total" fixo: todo mundo dungeon é infinita na prática (o padrão
    // de monstros repete depois do último ciclo definido, só o HP continua
    // subindo — ver MonsterModule.spawn), então o ciclo só cresce sempre.
    const d = state.dungeons[key];
    const kpc = MonsterModule.killsPerCycleFor(key);
    const cycleNum = Math.floor(d.killCount / kpc) + 1;
    return `Ciclo ${cycleNum}`;
  },
  enter(key){
    if(!this.isUnlocked(key)) return;
    // o modal de seleção (prédio "Dungeons") fica por cima de qualquer view,
    // já que é um .modal-overlay solto no body — sem isso ficaria visível
    // por cima da arena depois de entrar
    document.getElementById('dungeonModal').classList.remove('open');
    // conta como "entrada nova" só aqui (não em startAtCycle, que é retomar
    // um ciclo já limpo pelo seletor) — ver OnboardingModule (Academia libera
    // na 5ª entrada)
    state.dungeonEntriesCount += 1;
    OnboardingModule.announceAcademiaIfNeeded();
    state.dungeons[key].repeatCycleNum = null; // entrada manual cancela qualquer Repetir Ciclo pendente
    state.dungeons[key].repeatRemaining = 0;
    state.dungeons[key].repeatLootTotals = null;
    this._enterAt(key, state.dungeons[key].killCount);
  },
  // Reinicia a Dungeon no INÍCIO de um ciclo já concluído antes (ver
  // UI.openCyclePicker) — só é chamado pra ciclos com maxCycleCompleted>=n,
  // então nunca "pula na frente" de onde o jogador realmente chegou.
  startAtCycle(key, cycleNum){
    if(!this.isUnlocked(key)) return;
    const d = state.dungeons[key];
    if(cycleNum > (d.maxCycleCompleted || 0)) return;
    document.getElementById('cyclePickerModal').classList.remove('open');
    document.getElementById('dungeonModal').classList.remove('open');
    const kpc = MonsterModule.killsPerCycleFor(key);
    d.pendingSlot = null; // descarta qualquer dupla em andamento de uma run anterior
    d.repeatCycleNum = null; // reinício manual (INICIAR) cancela Repetir Ciclo pendente
    d.repeatRemaining = 0;
    d.repeatLootTotals = null;
    this._enterAt(key, (cycleNum - 1) * kpc);
  },
  // Igual a startAtCycle, mas liga o modo "Repetir Ciclo" (ver
  // UI.openRepeatCycleModal): ao derrotar o chefe desse ciclo, em vez de
  // avançar pro próximo, volta sozinho pro monstro 1 dele — `times` vezes
  // seguidas (2-50, ver repeatCycleModal) — acumulando o loot de tudo que
  // morrer nesse meio tempo (ver MonsterModule.onDeath) até acabar as
  // repetições, quando volta pra tela de seleção de Dungeons com o resumo
  // (ver UI.showRepeatCycleResultModal).
  startAtCycleRepeat(key, cycleNum, times){
    if(!this.isUnlocked(key)) return;
    const d = state.dungeons[key];
    if(cycleNum > (d.maxCycleCompleted || 0)) return;
    this.startAtCycle(key, cycleNum);
    d.repeatCycleNum = cycleNum;
    d.repeatRemaining = Math.max(2, Math.min(50, Math.round(times) || 2));
    d.repeatLootTotals = {};
  },
  _enterAt(key, killCount){
    state.currentDungeon = key;
    state.dungeons[key].killCount = killCount;
    // isFirst só quando a Dungeon começa exatamente no monstro 1 — assim
    // reentrar no meio de uma luta de chefe não "desliga" o chefe à toa
    MonsterModule.spawn(killCount === 0);
    UI.showDungeonView();
    UI.resetDropLog(); // registro de drops é por entrada, não sobrevive daqui pra frente
    UI.renderAll();
  },
  leaveToCity(){
    state.currentDungeon = null;
    MonsterModule.current = null;
    UI.showCityView();
    UI.renderAll();
    OnboardingModule.announceShopUnlockIfNeeded();
  }
};
