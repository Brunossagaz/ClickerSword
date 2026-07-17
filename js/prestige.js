/* ---------------------------------------------------------------------
   PRESTIGE / ASCENSION MODULE
--------------------------------------------------------------------- */
const PrestigeModule = {
  // Limiar de mortes VITALÍCIAS (totalKillsAll, nunca reseta) pra poder
  // ascender. Cresce um pouco a cada ascensão já feita (ascensionCount
  // também é vitalício), então as próximas ascensões demoram um pouco mais
  // sem virar exagero. Usar totalKillsAll em vez de killCount (mortes só
  // desta run) evita o problema de o timer de chefe zerar o progresso: o
  // contador vitalício só sobe, nunca é derrubado por um timeout de ciclo.
  currentAscendThreshold(){
    return CONFIG.ascendKillThresholdBase + state.ascensionCount * CONFIG.ascendKillThresholdGrowth;
  },
  potentialEssence(){
    if(state.totalKillsAll < this.currentAscendThreshold()) return 0;
    return Math.floor(Math.sqrt(state.goldEarnedThisRun/500));
  },
  canAscend(){
    return state.totalKillsAll >= this.currentAscendThreshold() && this.potentialEssence() > 0;
  },
  ascend(){
    if(!this.canAscend()) return;
    const gained = this.potentialEssence();
    const keepEssence = state.essence + gained;
    const keepPrestige = state.prestige;
    const keepMultipliers = { pClickMult:state.pClickMult, pDpsMult:state.pDpsMult, pOreRateMult:state.pOreRateMult, pCritChance:state.pCritChance };
    const keepTotalKills = state.totalKillsAll;
    const keepAscensionCount = state.ascensionCount + 1;
    // Cadeia de onboarding/desbloqueios (missões, avisos únicos do Clérigo,
    // contadores de progresso pra Academia/Caverna) fica permanente entre
    // ascensões, por pedido — diferente de dungeons/armas (que fazem parte
    // do próprio mecanismo de regrind do prestígio e continuam resetando).
    const keepOnboarding = {
      quests: state.quests,
      metBarnabe: state.metBarnabe,
      metCreiton: state.metCreiton,
      shopUnlockAnnounced: state.shopUnlockAnnounced,
      academiaAnnounced: state.academiaAnnounced,
      dungeonEntriesCount: state.dungeonEntriesCount,
      firstCycleEverCompleted: state.firstCycleEverCompleted,
      totalCyclesCompleted: state.totalCyclesCompleted
    };

    state = freshState();
    state.essence = keepEssence;
    state.prestige = keepPrestige;
    state.pClickMult = keepMultipliers.pClickMult;
    state.pDpsMult = keepMultipliers.pDpsMult;
    state.pOreRateMult = keepMultipliers.pOreRateMult;
    state.pCritChance = keepMultipliers.pCritChance;
    state.totalKillsAll = keepTotalKills;
    state.ascensionCount = keepAscensionCount;
    Object.assign(state, keepOnboarding);
    // killCount de todas as Dungeons volta a 0 (freshState) — ciclo e HP dos
    // monstros reiniciam do zero, e as Dungeons desbloqueadas por progresso
    // (Goblin, Selvagens) voltam a ficar trancadas. Sem Dungeon ativa, o
    // jogador volta pra cidade e escolhe de novo por onde começar.
    MonsterModule.current = null;
    UI.showCityView();
    UI.renderAll();
    UI.showToast('ASCENSÃO', `Você ganhou ${gained} de Essência! Multiplicadores permanentes aplicados.`);
  },
  costFor(def){
    const lvl = state.prestige[def.key];
    return Math.ceil(def.baseCost * Math.pow(def.costGrowth, lvl));
  },
  buy(key){
    const def = PRESTIGE_UPGRADE_DEFS.find(u=>u.key===key);
    const cost = this.costFor(def);
    if(state.essence >= cost){
      state.essence -= cost;
      state.prestige[key] += 1;
      def.apply(state);
      UI.renderAll();
    }
  }
};
