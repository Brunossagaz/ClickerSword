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
    // ciclos completos (chefe derrotado) no total, vitalício — usado pra
    // exigir "mais um ciclo" depois da missão do Creiton (ver
    // MonsterModule.onDeath / QuestModule.deliver)
    totalCyclesCompleted:0,
    // o personagem já completou o 1º ciclo da vida dele (chefe derrotado)?
    // vitalício, não deriva de dungeons.*.maxCycleCompleted porque esse
    // reseta a cada ascensão — controla o bloqueio do botão "Voltar pra
    // cidade" durante o ciclo tutorial forçado (ver MonsterModule.onDeath/
    // UI leaveDungeonBtn/timeUpLeaveBtn)
    firstCycleEverCompleted:false,
    // quantas vezes o jogador já entrou numa Dungeon (ver
    // DungeonModule.enter) — Academia libera na 5ª entrada
    dungeonEntriesCount:0,
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
    dpsSynergyRatio:0, // fração do dano por clique somada como DPS extra (upgrade antigo, removido da árvore — só existe pra quem já tinha comprado)
    // percentuais da Academia de Combate — multiplicam em cima do que já foi
    // acumulado (ver PlayerModule.clickDamage())
    clickDamagePercent:0,
    critDamagePercent:0,
    // troops owned — derivado de TROOP_DEFS, então tropa nova nunca fica de
    // fora daqui (era a causa do bug de "Nível: undefined" / "NaN" na loja)
    troops: Object.fromEntries(TROOP_DEFS.map(d => [d.key, 0])),
    // mineradores de MINÉRIO da Caverna — derivado de PROSPECTOR_DEFS (ver
    // js/cavern.js/CavernModule)
    prospectors: Object.fromEntries(PROSPECTOR_DEFS.map(d => [d.key, 0])),
    // upgrades da Caverna (nível, não booleano) — derivado de CAVERN_UPGRADE_DEFS
    cavernUpgrades: Object.fromEntries(CAVERN_UPGRADE_DEFS.map(d => [d.key, 0])),
    // baú da Caverna: minério já minerado mas ainda não transferido pra
    // mochila (ver CavernModule.collectChest) — derivado de MINERAL_DEFS,
    // capacidade ilimitada de propósito
    cavernChest: Object.fromEntries(MINERAL_DEFS.map(d => [d.key, 0])),
    // acumulador fracionário de "pontos de minério" entre um sorteio
    // inteiro e outro (ver CavernModule.mineOreAmount) — sem isso, taxas
    // fracionárias (ex.: +0.1/seg) nunca renderiam nada
    oreProgress:0,
    // itens coletados matando monstros em Dungeons (ver MONSTER_TYPES.drops)
    inventory: Object.fromEntries(ITEM_DEFS.map(d => [d.key, 0])),
    // pool de posse de TODA arma (iniciais + forjadas, ver WEAPON_DEFS/
    // FORGED_WEAPON_DEFS) — 0 ou 1 por chave, nunca duplicado. Também usado
    // pra saber se o onboarding já passou (ver OnboardingModule.hasChosenWeapon)
    weapons: Object.fromEntries([...WEAPON_DEFS, ...FORGED_WEAPON_DEFS].map(d => [d.key, 0])),
    // chave da arma ATIVA agora (de state.weapons) — só uma por vez, troca
    // no Inventário (ver PlayerModule.equipWeapon). null até a 1ª escolha
    // com o Clérigo.
    equippedWeapon: null,
    // já mostrou o aviso do Clérigo sobre a Loja liberada, ao voltar pra
    // cidade pela 1ª vez após enfrentar a dungeon? (ver
    // OnboardingModule.announceShopUnlockIfNeeded, chamado por DungeonModule.leaveToCity)
    shopUnlockAnnounced:false,
    // já conheceu o Barnabé (dono da Loja)? controla se o clique na Loja
    // mostra a apresentação dele ou já abre a loja normal — ver QuestModule
    metBarnabe:false,
    // já conheceu o Creiton (dono do Ferreiro)? controla se o clique no
    // Ferreiro mostra a apresentação dele ou já abre o ferreiro normal —
    // mesmo padrão de metBarnabe, ver UI.init
    metCreiton:false,
    // já mostrou o aviso do Clérigo sobre a Academia liberada (5ª entrada na
    // Dungeon)? ver OnboardingModule.announceAcademiaIfNeeded
    academiaAnnounced:false,
    // missões concluídas (true/false por chave) — ver QUEST_DEFS/QuestModule
    quests: Object.fromEntries(QUEST_DEFS.map(d => [d.key, false])),
    // Expedição da Guilda em andamento (ver GuildModule) — só 1 por vez.
    // `startedAt`/`durationMs` (ambos em ms, Date.now()) definem quando ela
    // termina; resolve sozinha (itens direto na mochila) tanto no tick do
    // jogo quanto ao carregar um save, então funciona igual online e offline.
    guild: { active:false, cycleKey:null, startedAt:0, durationMs:0 },
    // upgrades owned (levels) — mesmo motivo, derivado de UPGRADE_DEFS
    upgrades: Object.fromEntries(UPGRADE_DEFS.map(d => [d.key, 0])),
    // prestige permanent upgrades
    prestige:{ pClick:0, pDps:0, pOreRate:0, pCrit:0 },
    pClickMult:0, pDpsMult:0, pOreRateMult:0, pCritChance:0,
    // meta
    goldEarnedThisRun:0,
    lastSave:Date.now()
  };
}
let state = freshState();
