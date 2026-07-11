/* ---------------------------------------------------------------------
   DUNGEON MODULE (dungeons.js)
   Controla a escolha de Dungeon na cidade: desbloqueio (computado, igual ao
   padrão de ProgressionModule), entrar numa Dungeon e voltar pra cidade.
--------------------------------------------------------------------- */
const DungeonModule = {
  isUnlocked(key){
    const req = MAPS[key].unlockRequirement;
    if(!req) return true;
    return state.dungeons[req.dungeon].killCount >= req.kills;
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
    this._enterAt(key, (cycleNum - 1) * kpc);
  },
  _enterAt(key, killCount){
    state.currentDungeon = key;
    state.dungeons[key].killCount = killCount;
    // isFirst só quando a Dungeon começa exatamente no monstro 1 — assim
    // reentrar no meio de uma luta de chefe não "desliga" o chefe à toa
    MonsterModule.spawn(killCount === 0);
    UI.showDungeonView();
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
