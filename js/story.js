/* ---------------------------------------------------------------------
   STORY MODULE (story.js)
   Passagem de andar como capítulo de história (ver STORY_CHAPTERS em
   js/dialogues-data.js), sem travar nada do jogo — o próximo andar libera
   igual antes, a história só acompanha:
   1. Vencer o último ciclo do andar do capítulo atual pela 1ª vez: a cena
      `floorEnd_<andar>` toca ali mesmo na dungeon, antes do resumo de loot.
   2. De volta à cidade: um NPC puxa conversa (`cityAfter_<andar>`) e o
      cartão do próximo capítulo aparece. A missão do capítulo novo entra
      na aba História da janela de Missões.
   Estado em state.story: { chapter, pendingCity, cardShown }
     chapter     índice (0-based) do capítulo atual em STORY_CHAPTERS;
                 = STORY_CHAPTERS.length quando a história acabou
     pendingCity andar cuja conversa na cidade ainda não tocou (ou null)
     cardShown   último capítulo cujo cartão de título já apareceu (-1 = nenhum)
--------------------------------------------------------------------- */
const StoryModule = {
  current(){ return STORY_CHAPTERS[state.story.chapter] || null; },
  isFinished(){ return state.story.chapter >= STORY_CHAPTERS.length; },

  // Depois da escolha da 1ª arma (fim da introdução do Clérigo)
  onGameStart(){ this.showChapterCard(); },

  showChapterCard(){
    const ch = this.current();
    if(!ch || state.story.cardShown >= state.story.chapter) return;
    state.story.cardShown = state.story.chapter;
    DialogueModule.play('chapter_' + ch.dungeon);
  },

  // Chamado por MonsterModule ao vencer o último ciclo de um andar pela 1ª
  // vez. `done` encerra a entrada (resumo de loot) — roda depois da cena.
  onFloorCleared(dungeonKey, done){
    const ch = this.current();
    if(!ch || ch.dungeon !== dungeonKey){ done(); return; }
    state.story.chapter += 1;
    state.story.pendingCity = dungeonKey;
    SaveModule.save();
    DialogueModule.play('floorEnd_' + dungeonKey, { onEnd: done });
  },

  // Chamado por DungeonModule.leaveToCity — as conversas esperam o resumo
  // de loot fechar sozinhas (ver DialogueModule.BLOCKERS).
  onReturnToCity(){
    const key = state.story.pendingCity;
    if(!key) return;
    state.story.pendingCity = null;
    SaveModule.save();
    DialogueModule.play('cityAfter_' + key);
  },
  // Depois dos avisos da volta à cidade (Arcanas etc.), pra ficar por último
  afterReturnToCity(){ this.showChapterCard(); },

  // Missão da aba História (ver QuestModule.renderMissions)
  chapterMission(){
    const ch = this.current();
    if(!ch) return null;
    const map = MAPS[ch.dungeon];
    const d = state.dungeons[ch.dungeon];
    const done = Math.min(CONFIG.maxCycleNum, (d && d.maxCycleCompleted) || 0);
    const unlocked = DungeonModule.isUnlocked(ch.dungeon);
    return {
      num: ch.num, title: ch.title, text: ch.text,
      objective: unlocked ? `Vença o ciclo ${CONFIG.maxCycleNum} do ${map.name}` : `Libere o ${map.name}`,
      progress: done, total: CONFIG.maxCycleNum,
    };
  },

  // Save sem state.story (anterior a este sistema): começa no capítulo do
  // 1º andar ainda não concluído, sem tocar cenas de andares já vencidos.
  migrate(loaded){
    if(loaded && loaded.story) return;
    let chapter = 0;
    while(chapter < STORY_CHAPTERS.length){
      const d = state.dungeons[STORY_CHAPTERS[chapter].dungeon];
      if(!d || (d.maxCycleCompleted || 0) < CONFIG.maxCycleNum) break;
      chapter++;
    }
    const started = OnboardingModule.hasChosenWeapon() || OnboardingModule.hasFacedDungeon();
    state.story = { chapter, pendingCity: null, cardShown: started ? chapter : -1 };
  },
};
