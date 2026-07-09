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
    // subindo — ver MonsterModule.typeFor), então o ciclo só cresce sempre.
    const d = state.dungeons[key];
    const cycleNum = Math.floor(d.killCount / CONFIG.cycleLength) + 1;
    return `Ciclo ${cycleNum}`;
  },
  enter(key){
    if(!this.isUnlocked(key)) return;
    state.currentDungeon = key;
    // isFirst só quando a Dungeon nunca foi visitada (killCount=0) — assim
    // reentrar no meio de uma luta de chefe não "desliga" o chefe à toa
    MonsterModule.spawn(state.dungeons[key].killCount === 0);
    UI.showDungeonView();
    UI.renderAll();
  },
  leaveToCity(){
    state.currentDungeon = null;
    MonsterModule.current = null;
    UI.showCityView();
    UI.renderAll();
  }
};
