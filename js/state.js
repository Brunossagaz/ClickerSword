/* ---------------------------------------------------------------------
   STATE
--------------------------------------------------------------------- */
function freshState(){
  return {
    playerName:'', // definido na criação do save (Novo Jogo) ou ao nomear um save migrado sem nome — ver MainMenuModule
    gold:0,
    essence:0,
    ascensionCount:0, // quantas vezes já ascendeu (vitalício) — usado pra escalar o limiar da próxima ascensão
    // run progress
    currentDungeon:null, // null = jogador está na cidade (tela de seleção); 'slimes'/'goblins'/'wilds' = dentro de uma Dungeon
    // progresso independente por Dungeon. `pendingSlot` só é usado por
    // Dungeons com posições de monstro duplo (ver MAPS/MonsterModule) — guarda
    // qual par de monstros foi sorteado pra posição atual (e o quanto o 1º já
    // rendeu de item), pra o 2º monstro da dupla usar o MESMO sorteio em vez
    // de rolar de novo. `maxCycleCompleted` guarda o maior ciclo cujo chefe
    // já foi derrotado nessa Dungeon (vitalício, não reseta ao abandonar/
    // tentar de novo) — habilita o seletor de ciclo (ver DungeonModule/
    // UI.openCyclePicker): só é possível reiniciar em ciclos já concluídos.
    dungeons:{
      slimes:{killCount:0, pendingSlot:null, maxCycleCompleted:0},
      goblins:{killCount:0, pendingSlot:null, maxCycleCompleted:0},
      wilds:{killCount:0, pendingSlot:null, maxCycleCompleted:0}
    },
    totalKillsAll:0,
    monsterHp:0,
    monsterMaxHp:0,
    monsterSpawnedAt:0,
    isBoss:false,
    isGolden:false,
    goldenExpiresAt:0,
    // player combat — começa em 0: só sobe com upgrades ou a arma escolhida
    // com o Clérigo (ver OnboardingModule.finishWeaponChoice)
    clickDamageFlat:0,
    critChance:0,
    critMult:2,
    goldMult:1,
    dpsSynergyRatio:0, // fração do dano por clique somada como DPS extra (upgrade antigo, removido da árvore — só existe pra quem já tinha comprado)
    // percentuais da Academia de Combate — multiplicam em cima do que já foi
    // acumulado (ver PlayerModule.clickDamage())
    clickDamagePercent:0,
    critDamagePercent:0,
    // troops owned — derivado de TROOP_DEFS, então tropa nova nunca fica de
    // fora daqui (era a causa do bug de "Nível: undefined" / "NaN" na loja)
    troops: Object.fromEntries(TROOP_DEFS.map(d => [d.key, 0])),
    // mineradores da Caverna de Mineração — mesmo motivo, derivado de MINER_DEFS
    miners: Object.fromEntries(MINER_DEFS.map(d => [d.key, 0])),
    // itens coletados em Dungeons que dropam item em vez de ouro (ex: Slime)
    inventory: Object.fromEntries(ITEM_DEFS.map(d => [d.key, 0])),
    // arma inicial escolhida com o Clérigo (0 ou 1 por chave) — também usada
    // pra saber se o onboarding já passou (ver OnboardingModule.hasChosenWeapon)
    weapons: Object.fromEntries(WEAPON_DEFS.map(d => [d.key, 0])),
    // já mostrou o aviso do Clérigo sobre a Loja liberada, ao voltar pra
    // cidade pela 1ª vez após enfrentar a dungeon? (ver
    // OnboardingModule.announceShopUnlockIfNeeded, chamado por DungeonModule.leaveToCity)
    shopUnlockAnnounced:false,
    // já conheceu o Barnabé (dono da Loja)? controla se o clique na Loja
    // mostra a apresentação dele ou já abre a loja normal — ver QuestModule
    metBarnabe:false,
    // missões concluídas (true/false por chave) — ver QUEST_DEFS/QuestModule
    quests: Object.fromEntries(QUEST_DEFS.map(d => [d.key, false])),
    // upgrades owned (levels) — mesmo motivo, derivado de UPGRADE_DEFS
    upgrades: Object.fromEntries(UPGRADE_DEFS.map(d => [d.key, 0])),
    // prestige permanent upgrades
    prestige:{ pClick:0, pDps:0, pGold:0, pCrit:0 },
    pClickMult:0, pDpsMult:0, pGoldMult:0, pCritChance:0,
    // meta
    goldEarnedThisRun:0,
    lastSave:Date.now()
  };
}
let state = freshState();
