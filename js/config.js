/* ---------------------------------------------------------------------
   CONFIG
--------------------------------------------------------------------- */
const CONFIG = {
  saveKey: 'monsterAttackClickerSave', // LEGADO (pré-slots) — só lido 1x pra migração, nunca mais escrito
  saveKeySlot(n) { return 'monsterAttackClickerSave_slot' + n; }, // n = 1..maxSaveSlots
  maxSaveSlots: 3,
  settingsKey: 'monsterAttackClickerSettings', // preferências globais (áudio/volume/idioma), fora de qualquer save
  tickMs: 200,
  autosaveMs: 10000,
  baseHp: 18,
  hpGrowth: 1.135,
  cycleLength: 10,          // monstros por ciclo; o último da fileira é sempre o chefe
  bossHpMult: 7,
  // Ciclo máximo de qualquer Dungeon — ao bater o chefe do Ciclo 5, o jogo
  // não avança pro Ciclo 6: volta pro monstro 1 do próprio Ciclo 5, que
  // passa a se repetir pra sempre (ver MonsterModule.onDeath/spawn).
  maxCycleNum: 5,
  offlineCapHours: 8,
  offlineEfficiency: 0.5,
  goldenChancePerTick: 0.0025, // per 200ms tick
  goldenDurationMs: 8000,
  goldenRewardMult: 20,
  // mín. de mortes NESTE run pra poder ascender. Cresce um pouco a cada
  // ascensão já feita (ver PrestigeModule.currentAscendThreshold): a 1ª
  // ascensão pede ascendKillThresholdBase, a 2ª pede +ascendKillThresholdGrowth,
  // a 3ª +2x isso, e assim por diante — sem exagero.
  ascendKillThresholdBase: 100,
  ascendKillThresholdGrowth: 100,
  monsterTimeLimitMs: 10000, // tempo pra derrotar cada monstro antes de reiniciar o ciclo
  bossTimeLimitMs: 20000, // igual, mas só pro chefe (último monstro do ciclo) — luta mais demorada, folga maior
  academiaUnlockEntries: 5, // nº de entradas na Dungeon pra liberar a Academia — ver OnboardingModule
  // Queimadura (ver WEAPON_DEFS.burnChance/burnDamagePercent, MonsterModule.
  // applyBurn/checkBurnTick): dano total é dividido em ticks ao longo de
  // burnDurationMs, um a cada burnTickMs.
  burnDurationMs: 3000,
  burnTickMs: 500,
  // Expedições da Guilda (ver GUILD_EXPEDITION_DEFS/GuildModule): itens/hora
  // rendidos por ponto de "poder de tropa" (soma de dps*quantidade das
  // TROOP_DEFS já compradas). Valor pequeno de propósito — é o 1º número a
  // ajustar se o ritmo de itens ficar rápido/lento demais.
  guildItemsPerHourPerPower: 0.05
};

// Todo monstro é um spritesheet PNG (3 frames de 128x128: idle, piscando,
// flash de dano) gerado por tools/gen_sprites.py. Para mudar a arte de um
// monstro, edite o gerador Python e rode `python tools/gen_sprites.py` de
// novo — não precisa mexer neste arquivo nem em sprites.js.
//
// hpMult reflete a força relativa da criatura (afeta o HP, multiplica junto
// com o bônus de chefe quando a criatura cai na última posição do ciclo).
//
// Slimes seguem um padrão fixo agora: cada tier tem exatamente 1.5x o hpMult
// do anterior (1.0 → 1.5 → 2.25 → 3.375 → 5.0625 → 7.59375, arredondado a 2
// casas).
//
// `drops`: lista de possíveis recompensas de item por morte desse tipo de
// monstro (ver MonsterModule.rollDrops/onDeath) — TODO monstro do jogo dropa
// item agora, nunca moeda direto (moeda só vem de vender item na Loja,
// incluindo os minérios coletados na Caverna). Cada entrada é
// `{ item, chance, qtyMin, qtyMax }`:
//   - `item`: chave em ITEM_DEFS.
//   - `chance`: 0-1, checada de forma independente por entrada (então um
//     monstro pode dropar vários itens diferentes na mesma morte). Omitido =
//     1 (sempre dropa).
//   - `qtyMin`/`qtyMax`: quantidade sorteada nesse intervalo (iguais = valor
//     fixo). Não escala com HP/posição no ciclo, só com monstro dourado (ver
//     MonsterModule.itemQtyFor).
const MONSTER_TYPES = [
  // --- Mapa 1: Pântano dos Slimes (ciclos 1-5) ---
  {
    key: 'slime', name: 'SLIME', image: 'assets/sprites/slime.png', frameW: 128, frameH: 128, blinkCapable: true,
    drops: [
      { item: 'slimeGel', qtyMin: 1, qtyMax: 1 },
      { item: 'slimeCompound', chance: 0.75, qtyMin: 1, qtyMax: 3 },
    ]
  },
  {
    key: 'slimeBlue', name: 'SLIME AZUL', image: 'assets/sprites/slime_blue.png', frameW: 128, frameH: 128, spriteScale: 0.7, hpMult: 1.5, blinkCapable: true,
    drops: [
      { item: 'slimeGel', qtyMin: 3, qtyMax: 3 },
      { item: 'slimeCompound', chance: 0.75, qtyMin: 1, qtyMax: 3 }
    ]
  },
  {
    key: 'slimeGreenWarrior', name: 'SLIME VERDE GUERREIRO', image: 'assets/sprites/slime_green_warrior.png', frameW: 128, frameH: 128, hpMult: 2.25, blinkCapable: true,
    drops: [
      { item: 'slimeGel', qtyMin: 5, qtyMax: 8 },
      { item: 'slimeCompound', chance: 0.75, qtyMin: 1, qtyMax: 1 },
      { item: 'slimeSword', chance: 0.30, qtyMin: 1, qtyMax: 1 },
    ]
  },
  {
    key: 'slimeRed', name: 'SLIME VERMELHO', image: 'assets/sprites/slime_red.png', frameW: 128, frameH: 128, hpMult: 3.38, blinkCapable: true,
    drops: [
      { item: 'slimeGel', qtyMin: 5, qtyMax: 5 },
      { item: 'slimeCompound', chance: 0.75, qtyMin: 1, qtyMax: 3 }
    ]
  },
  {
    key: 'slimeBlueBarbarian', name: 'SLIME AZUL BÁRBARO', image: 'assets/sprites/slime_blue_barbarian.png', frameW: 128, frameH: 128, hpMult: 5.06, blinkCapable: true,
    drops: [
      { item: 'slimeGel', qtyMin: 10, qtyMax: 14 },
      { item: 'slimeCompound', chance: 0.75, qtyMin: 4, qtyMax: 6 },
      { item: 'slimeAxe', chance: 0.30, qtyMin: 1, qtyMax: 1 },
    ]
  },
  {
    key: 'slimeRedKing', name: 'SLIME REI VERMELHO', image: 'assets/sprites/slime_red_king.png', frameW: 128, frameH: 128, hpMult: 7.59, blinkCapable: true,
    drops: [
      { item: 'slimeGel', qtyMin: 8, qtyMax: 8 },
      { item: 'slimeCompound', chance: 0.75, qtyMin: 10, qtyMax: 12 },
      { item: 'slimeAxeGreater', chance: 0.30, qtyMin: 1, qtyMax: 1 },
    ]
  },
  // --- Mapa 2: Reino Goblin (ciclos 4-6) ---
  {
    key: 'goblinGreen', name: 'GOBLIN VERDE', image: 'assets/sprites/goblin_green.png', frameW: 128, frameH: 128, blinkCapable: true,
    drops: [{ item: 'goblinEar', qtyMin: 1, qtyMax: 1 }]
  },
  {
    key: 'goblinRed', name: 'GOBLIN VERMELHO', image: 'assets/sprites/goblin_red.png', frameW: 128, frameH: 128, hpMult: 1.6, blinkCapable: true,
    drops: [{ item: 'goblinFang', qtyMin: 2, qtyMax: 2 }]
  },
  {
    key: 'goblinMage', name: 'GOBLIN MAGO', image: 'assets/sprites/goblin_mage.png', frameW: 128, frameH: 128, hpMult: 2.2, blinkCapable: true,
    drops: [{ item: 'goblinShard', qtyMin: 2, qtyMax: 2 }]
  },
  {
    key: 'goblinWarrior', name: 'GOBLIN GUERREIRO', image: 'assets/sprites/goblin_warrior.png', frameW: 128, frameH: 128, hpMult: 2.8, blinkCapable: true,
    drops: [{ item: 'goblinScale', qtyMin: 3, qtyMax: 3 }]
  },
  {
    key: 'goblinPriest', name: 'GOBLIN SACERDOTE', image: 'assets/sprites/goblin_priest.png', frameW: 128, frameH: 128, hpMult: 3.6, blinkCapable: true,
    drops: [{ item: 'goblinAmulet', qtyMin: 3, qtyMax: 3 }]
  },
  {
    key: 'goblinMaster', name: 'GOBLIN MESTRE', image: 'assets/sprites/goblin_master.png', frameW: 128, frameH: 128, hpMult: 4.8, blinkCapable: true,
    drops: [{ item: 'goblinSeal', qtyMin: 4, qtyMax: 4 }]
  },
  {
    key: 'goblinGreater', name: 'GOBLIN MAIOR', image: 'assets/sprites/goblin_greater.png', frameW: 128, frameH: 128, hpMult: 6.5, blinkCapable: true,
    drops: [{ item: 'goblinCrown', qtyMin: 5, qtyMax: 5 }]
  },
  // --- Mapa 3: Terras Selvagens (ciclo 7 em diante) ---
  {
    key: 'orc', name: 'ORC', image: 'assets/sprites/orc.png', frameW: 128, frameH: 128, blinkCapable: true,
    drops: [{ item: 'orcTusk', qtyMin: 2, qtyMax: 2 }]
  },
  {
    key: 'troll', name: 'TROLL', image: 'assets/sprites/troll.png', frameW: 128, frameH: 128, blinkCapable: true,
    drops: [{ item: 'trollHide', qtyMin: 2, qtyMax: 2 }]
  },
  {
    key: 'dragon', name: 'DRAGÃO', image: 'assets/sprites/dragon.png', frameW: 128, frameH: 128, blinkCapable: true,
    drops: [{ item: 'dragonScale', qtyMin: 3, qtyMax: 3 }]
  },
  {
    key: 'demon', name: 'DEMÔNIO', image: 'assets/sprites/demon.png', frameW: 128, frameH: 128, blinkCapable: true,
    drops: [{ item: 'demonHorn', qtyMin: 3, qtyMax: 3 }]
  },
  // --- Mapa 4: Andar do Dragão --- 1 espécie nova (Lagarto de Fogo) +
  // 'dragon' (já existia, agora exclusivo deste andar em vez de dividir
  // com Selvagens — ver MAPS.dragons/ITEM_DEFS.dragonScale).
  {
    key: 'fireLizard', name: 'LAGARTO DE FOGO', image: 'assets/sprites/fire_lizard.png', frameW: 128, frameH: 128, blinkCapable: true,
    drops: [{ item: 'fireLizardScale', qtyMin: 2, qtyMax: 2 }]
  },
  // --- Mapa 5: Andar do Demônio --- 2 espécies novas (Sombra, Mini Servo)
  // + 'demon' (já existia, agora exclusivo deste andar — ver MAPS.demons/
  // ITEM_DEFS.demonHorn).
  {
    key: 'shadow', name: 'SOMBRA', image: 'assets/sprites/shadow.png', frameW: 128, frameH: 128, blinkCapable: true,
    drops: [{ item: 'shadowEssence', qtyMin: 3, qtyMax: 3 }]
  },
  {
    key: 'miniServo', name: 'MINI SERVO', image: 'assets/sprites/mini_servo.png', frameW: 128, frameH: 128, blinkCapable: true,
    drops: [{ item: 'miniServoClaw', qtyMin: 2, qtyMax: 2 }]
  },
];

// Dungeons: cada uma tem seu próprio progresso (state.dungeons[key].killCount,
// contado do zero, independente das outras) — o jogador escolhe em qual
// entrar na tela da cidade (ver DungeonModule). Cada ciclo tem 10 POSIÇÕES
// (ver `cycles[cicloLocal]`); a última posição (índice 9) é sempre o chefe.
// Toda posição normal é 1 monstro só (string); posições de monstro duplo
// usam `{ pairChoices:[...] }` e valem 2 monstros mortos, mas continuam
// contando como 1 posição só (ver MonsterModule.killsPerCycle/resolveSlot).
// Dungeons sem `cycles` definidos (ex: wilds) usam `order` e repetem pra sempre.
//
// `unlockRequirement` (opcional): o Andar indicado (`dungeon`) precisa ter o
// CHEFE do ciclo `cycle` já derrotado ao menos 1x (ver
// state.dungeons[key].maxCycleCompleted/DungeonModule.isUnlocked) — não é
// baseado em quantidade de mortes. Sem isso, o Andar já começa desbloqueado.
// Recompensa é sempre item (nunca moeda direto) — cada MONSTER_TYPES define
// seus próprios `drops` (ver comentário acima e MonsterModule.onDeath).
const MAPS = {
  // Cada posição do ciclo é normalmente 1 monstro só (string = chave em
  // MONSTER_TYPES). Posições de GRUPO usam
  // `{ pairChoices:[[a,b], [c,d], ...] }`: ao chegar nessa posição, sorteia
  // UMA dessas opções (ver MonsterModule.resolveSlot/pendingSlot/groupSize)
  // e os monstros aparecem em sequência — matou o 1º, o 2º já spawna, e
  // assim por diante. Apesar do nome, `pairChoices` aceita opções de
  // QUALQUER tamanho (2 = dupla, 3 = tripla — ver MAPS.goblins/wilds/dragons),
  // desde que todas as opções da MESMA posição tenham o mesmo tamanho entre
  // si. `strong:true` marca o grupo "mais forte" do ciclo, ganha hpMult
  // extra (ver MonsterModule.hpFor). Um grupo pode até SER o chefe do ciclo
  // se for a ÚLTIMA posição (ver MAPS.dragons) — só a ÚLTIMA fase do grupo
  // conta como chefe de verdade (ver MonsterModule.spawn). `killsPerCycle`
  // (não o Nº de posições) é o que precisa bater entre os ciclos de uma
  // MESMA Dungeon — o formato/Nº de posições pode variar de ciclo pra ciclo,
  // só o total de mortes precisa ser sempre igual (ver MonsterModule.
  // killsPerCycleFor, que lê só o Ciclo 1 pra saber esse total).
  slimes: {
    name: 'Andar do Pântano dos Slimes',
    cycles: {
      // Ciclo 1: só slime verde, do início ao fim.
      1: ['slime', 'slime', 'slime', 'slime',
        { pairChoices: [['slime', 'slime']] },
        'slime', 'slime', 'slime',
        { pairChoices: [['slime', 'slime']], strong: true },
        'slimeGreenWarrior'],
      // Ciclo 2: começa verde, o azul entra na posição 4 e domina o resto.
      2: ['slime', 'slime', 'slime',
        'slimeBlue',
        { pairChoices: [['slime', 'slime'], ['slime', 'slimeBlue']] },
        'slimeBlue', 'slimeBlue', 'slimeBlue',
        { pairChoices: [['slimeBlue', 'slimeBlue']], strong: true },
        'slimeGreenWarrior'],
      // Ciclo 3: 3 cores — verde, depois azul, depois vermelho dominando o resto.
      3: ['slime', 'slime',
        'slimeBlue', 'slimeBlue',
        { pairChoices: [['slime', 'slime'], ['slime', 'slimeBlue']] },
        'slimeRed', 'slimeRed', 'slimeRed',
        { pairChoices: [['slimeRed', 'slimeRed']], strong: true },
        'slimeBlueBarbarian'],
      // Ciclo 4: mesmo padrão do Ciclo 3 (a dificuldade já sobe sozinha pelo
      // HP crescente por kill — não precisa de uma composição nova).
      4: ['slime', 'slime',
        'slimeBlue', 'slimeBlue',
        { pairChoices: [['slime', 'slime'], ['slime', 'slimeBlue']] },
        'slimeRed', 'slimeRed', 'slimeRed',
        { pairChoices: [['slimeRed', 'slimeRed']], strong: true },
        'slimeBlueBarbarian'],
      // Ciclo 5: só slime vermelho, do início ao fim (espelha o Ciclo 1).
      5: ['slimeRed', 'slimeRed', 'slimeRed', 'slimeRed',
        { pairChoices: [['slimeRed', 'slimeRed']] },
        'slimeRed', 'slimeRed', 'slimeRed',
        { pairChoices: [['slimeRed', 'slimeRed']], strong: true },
        'slimeRedKing'],
    }
  },
  // Mesmo padrão estrutural do Slime acima (posição 5 = dupla, posição 9 =
  // dupla "forte", posição 10 = chefe) em todos os ciclos exceto o 5, que
  // troca a dupla forte por uma TRIPLA — todo ciclo aqui soma exatamente 12
  // mortes (killsPerCycle), igual ao Ciclo 1 (ver comentário no topo de MAPS).
  goblins: {
    name: 'Andar do Reino Goblin',
    unlockRequirement: { dungeon: 'slimes', cycle: 5 },
    cycles: {
      // Ciclo 1: verde dominante, vermelho estreando.
      1: ['goblinGreen', 'goblinGreen', 'goblinGreen', 'goblinRed',
        { pairChoices: [['goblinGreen', 'goblinGreen']] },
        'goblinRed', 'goblinRed', 'goblinGreen',
        { pairChoices: [['goblinRed', 'goblinRed']], strong: true },
        'goblinPriest'],
      // Ciclo 2: vermelho dominante, mago/guerreiro estreando.
      2: ['goblinRed', 'goblinRed', 'goblinMage', 'goblinRed',
        { pairChoices: [['goblinRed', 'goblinRed'], ['goblinRed', 'goblinMage']] },
        'goblinWarrior', 'goblinRed', 'goblinMage',
        { pairChoices: [['goblinWarrior', 'goblinWarrior']], strong: true },
        'goblinMaster'],
      // Ciclo 3: mago/guerreiro dominante, sacerdote estreando.
      3: ['goblinMage', 'goblinWarrior', 'goblinMage', 'goblinWarrior',
        { pairChoices: [['goblinMage', 'goblinMage'], ['goblinMage', 'goblinWarrior']] },
        'goblinPriest', 'goblinWarrior', 'goblinPriest',
        { pairChoices: [['goblinPriest', 'goblinPriest']], strong: true },
        'goblinGreater'],
      // Ciclo 4: mesmo padrão do Ciclo 3 (a dificuldade já sobe sozinha pelo
      // HP crescente por kill — não precisa de uma composição nova).
      4: ['goblinMage', 'goblinWarrior', 'goblinMage', 'goblinWarrior',
        { pairChoices: [['goblinMage', 'goblinMage'], ['goblinMage', 'goblinWarrior']] },
        'goblinPriest', 'goblinWarrior', 'goblinPriest',
        { pairChoices: [['goblinPriest', 'goblinPriest']], strong: true },
        'goblinGreater'],
      // Ciclo 5: só goblin mestre, do início ao fim — a posição "forte" vira
      // uma TRIPLA (2 mestres + 1 maior) em vez de dupla, por isso só tem 7
      // posições únicas antes dela em vez de 8 (mantém as 12 mortes do ciclo).
      5: ['goblinMaster', 'goblinMaster', 'goblinMaster', 'goblinMaster',
        { pairChoices: [['goblinMaster', 'goblinMaster']] },
        'goblinMaster', 'goblinMaster',
        { pairChoices: [['goblinMaster', 'goblinMaster', 'goblinGreater']], strong: true },
        'goblinGreater'],
    }
  },
  // Só Orc e Troll (Dragão e Demônio agora têm andar próprio — ver
  // MAPS.dragons/MAPS.demons). Todo ciclo soma 12 mortes, igual ao Ciclo 1.
  wilds: {
    name: 'Andar das Terras Selvagens',
    unlockRequirement: { dungeon: 'goblins', cycle: 5 },
    cycles: {
      // Ciclo 1: padrão básico, 2 duplas (posições 5 e 9).
      1: ['orc', 'orc', 'orc', 'troll',
        { pairChoices: [['orc', 'orc']] },
        'troll', 'orc', 'troll',
        { pairChoices: [['troll', 'troll']], strong: true },
        'troll'],
      // Ciclo 2: estreia a TRIPLA na posição 4 (no lugar de uma dupla) —
      // 7 posições únicas em vez de 8 pra manter as 12 mortes do ciclo.
      2: ['troll', 'orc', 'troll',
        { pairChoices: [['orc', 'troll', 'orc']] },
        'troll', 'troll', 'orc',
        { pairChoices: [['troll', 'troll']], strong: true },
        'orc'],
      // Ciclo 3: dupla variada na posição 5, tripla forte na posição 9.
      3: ['orc', 'troll', 'orc', 'troll',
        { pairChoices: [['orc', 'orc'], ['troll', 'troll']] },
        'orc', 'troll',
        { pairChoices: [['orc', 'troll', 'troll'], ['troll', 'orc', 'orc']], strong: true },
        'troll'],
      // Ciclo 4: mesmo padrão do Ciclo 3.
      4: ['orc', 'troll', 'orc', 'troll',
        { pairChoices: [['orc', 'orc'], ['troll', 'troll']] },
        'orc', 'troll',
        { pairChoices: [['orc', 'troll', 'troll'], ['troll', 'orc', 'orc']], strong: true },
        'troll'],
      // Ciclo 5: o mais difícil — dupla + tripla forte, os dois tipos
      // intercalados o tempo todo.
      5: ['troll', 'troll', 'orc', 'troll',
        { pairChoices: [['troll', 'troll']] },
        'orc', 'troll',
        { pairChoices: [['orc', 'troll', 'orc'], ['troll', 'orc', 'troll']], strong: true },
        'troll'],
    }
  },
  // Andar novo — 1 espécie nova (Lagarto de Fogo) + Dragão (promovido de
  // Selvagens pra virar o destaque deste andar, ver ITEM_DEFS.dragonScale).
  // Só 3 ciclos: killsPerCycle = 5 (3 avulsos + 1 dupla), fixo nos 3.
  dragons: {
    name: 'Andar do Dragão',
    unlockRequirement: { dungeon: 'wilds', cycle: 5 },
    cycles: {
      // Ciclo 1: 3 Lagartos de Fogo avulsos + 1 DUPLA de Lagartos de Fogo
      // na última posição — a dupla inteira É o chefe (só a 2ª fase conta
      // pra fechar o ciclo/dar o bônus de CONFIG.bossHpMult, ver
      // MonsterModule.spawn), em vez do chefe de sempre ser 1 monstro só.
      1: ['fireLizard', 'fireLizard', 'fireLizard',
        { pairChoices: [['fireLizard', 'fireLizard']] }],
      // Ciclo 2: igual ao Ciclo 1 (a dificuldade já sobe sozinha pelo HP
      // crescente por kill).
      2: ['fireLizard', 'fireLizard', 'fireLizard',
        { pairChoices: [['fireLizard', 'fireLizard']] }],
      // Ciclo 3: só Dragão, do início ao fim (mesmas 5 mortes dos ciclos
      // anteriores, só que todas avulsas — a última é o chefe, como de costume).
      3: ['dragon', 'dragon', 'dragon', 'dragon', 'dragon'],
    }
  },
  // Andar novo — 2 espécies novas (Sombra, Mini Servo) + Demônio (promovido
  // de Selvagens, ver ITEM_DEFS.demonHorn). Sem duplas/triplas aqui, de
  // propósito — todo ciclo tem 10 posições únicas, igual ao Goblin/Slime
  // originais. É o andar mais avançado do jogo hoje.
  demons: {
    name: 'Andar do Demônio',
    unlockRequirement: { dungeon: 'dragons', cycle: 5 },
    cycles: {
      // Ciclo 1: só Mini Servo, do início ao fim.
      1: ['miniServo', 'miniServo', 'miniServo', 'miniServo', 'miniServo',
        'miniServo', 'miniServo', 'miniServo', 'miniServo', 'miniServo'],
      // Ciclo 2: Mini Servo intercalado com Sombra — a Sombra fecha o ciclo.
      2: ['miniServo', 'shadow', 'miniServo', 'shadow', 'miniServo',
        'shadow', 'miniServo', 'shadow', 'miniServo', 'shadow'],
      // Ciclo 3: só Demônio, do início ao fim — o chefe final do jogo hoje.
      3: ['demon', 'demon', 'demon', 'demon', 'demon',
        'demon', 'demon', 'demon', 'demon', 'demon'],
    }
  },
};

// Continuidade de dificuldade entre Dungeons (ver MonsterModule.spawn,
// hpKillIndex): cada Dungeon nova recomeça seu próprio killCount do zero,
// mas sem um offset o 1º monstro dela voltaria a ter o MESMO HP do 1º
// monstro do jogo inteiro — trivial pra quem já tinha acabado de vencer a
// Dungeon anterior. `hpKillOffset` soma quantas mortes as Dungeons
// ANTERIORES (nesta ordem de progressão) somariam do Ciclo 1 até o Ciclo
// MÁXIMO (CONFIG.maxCycleNum) — assim toda Dungeon nova continua a MESMA
// curva exponencial de onde a anterior parou, em vez de resetar.
// `_groupSizeFor`/`_kpcFor` duplicam de propósito a lógica de
// MonsterModule.groupSize/killsPerCycle (não dá pra chamar MonsterModule
// daqui, config.js carrega ANTES de monster.js) — são só 2 linhas, ver
// monster.js pra versão "oficial" usada durante o jogo.
const DUNGEON_ORDER = ['slimes', 'goblins', 'wilds', 'dragons', 'demons'];
(function assignHpKillOffsets(){
  const _groupSizeFor = slot => (!slot || !slot.pairChoices) ? 1 : Math.max(...slot.pairChoices.map(o => o.length));
  const _kpcFor = schedule => schedule.reduce((sum, slot) => sum + _groupSizeFor(slot), 0);
  let offset = 0;
  for(const key of DUNGEON_ORDER){
    const map = MAPS[key];
    if(!map) continue;
    map.hpKillOffset = offset;
    offset += _kpcFor(map.cycles[1]) * CONFIG.maxCycleNum;
  }
})();

// Itens (todo drop de monstro vira item — ver `drops` em MONSTER_TYPES).
// Preço fixo de venda na Loja da cidade. `type:'brokenWeapon'` (opcional):
// arma BRUTA — não é equipável direto (não é sistema de desgaste/
// durabilidade, é só a categoria do drop) — precisa ser forjada no
// Ferreiro (ver FORGED_WEAPON_DEFS/ForgeModule) pra virar uma arma de
// verdade, equipável em PlayerModule.equipWeapon.
// `dungeon`/`weight` (só em itens `type:'material'`): usados pelas
// Expedições da Guilda (ver GuildModule.availableMaterials/rollMaterial) —
// `dungeon` filtra pra só sortear material de Dungeon já desbloqueada (ver
// DungeonModule.isUnlocked), `weight` pondera o sorteio dentro dessa Dungeon
// (mesmo padrão de MINERAL_DEFS.weight/CavernModule.rollMineral: maior peso
// = mais comum, não precisa somar 100).
const ITEM_DEFS = [
  // --- Andar do Pântano dos Slimes ---
  { key: 'slimeGel', name: 'Geleia de Slime', icon: 'item-slimegel', sellPrice: 2, type: 'material', dungeon: 'slimes', weight: 40 },
  { key: 'slimeCompound', name: 'Composto de Slime', icon: 'item-slimecompound', sellPrice: 10, type: 'material', dungeon: 'slimes', weight: 15 },
  { key: 'slimeSword', name: 'Espada de Gosma (Bruta)', icon: 'item-slimesword', sellPrice: 30, type: 'brokenWeapon' },
  { key: 'slimeAxe', name: 'Machado de Gosma (Bruto)', icon: 'item-slimeaxe', sellPrice: 100, type: 'brokenWeapon' },
  { key: 'slimeAxeGreater', name: 'Machado de Gosma Maior (Bruto)', icon: 'item-slimeaxegreater', sellPrice: 300, type: 'brokenWeapon' },
  // --- Andar do Reino Goblin ---
  { key: 'goblinEar', name: 'Orelha de Goblin', icon: 'item-goblinear', sellPrice: 3, type: 'material', dungeon: 'goblins', weight: 35 },
  { key: 'goblinFang', name: 'Presa de Goblin Vermelho', icon: 'item-goblinfang', sellPrice: 5, type: 'material', dungeon: 'goblins', weight: 28 },
  { key: 'goblinShard', name: 'Fragmento Arcano Goblin', icon: 'item-goblinshard', sellPrice: 8, type: 'material', dungeon: 'goblins', weight: 20 },
  { key: 'goblinScale', name: 'Escama de Armadura Goblin', icon: 'item-goblinscale', sellPrice: 11, type: 'material', dungeon: 'goblins', weight: 14 },
  { key: 'goblinAmulet', name: 'Amuleto Sagrado Goblin', icon: 'item-goblinamulet', sellPrice: 15, type: 'material', dungeon: 'goblins', weight: 9 },
  { key: 'goblinSeal', name: 'Selo do Goblin Mestre', icon: 'item-goblinseal', sellPrice: 20, type: 'material', dungeon: 'goblins', weight: 5 },
  { key: 'goblinCrown', name: 'Coroa Menor Goblin', icon: 'item-goblincrown', sellPrice: 28, type: 'material', dungeon: 'goblins', weight: 2 },
  // --- Andar das Terras Selvagens --- (Dragão/Demônio saíram daqui, agora
  // têm andar próprio — ver blocos abaixo)
  { key: 'orcTusk', name: 'Presa de Orc', icon: 'item-orctusk', sellPrice: 40, type: 'material', dungeon: 'wilds', weight: 40 },
  { key: 'trollHide', name: 'Pele de Troll', icon: 'item-trollhide', sellPrice: 65, type: 'material', dungeon: 'wilds', weight: 25 },
  // --- Andar do Dragão --- preço subiu (era 110 quando dividia com
  // Selvagens) pra refletir ser o material mais raro de um andar mais avançado.
  { key: 'fireLizardScale', name: 'Escama de Lagarto de Fogo', icon: 'item-firelizardscale', sellPrice: 220, type: 'material', dungeon: 'dragons', weight: 40 },
  { key: 'dragonScale', name: 'Escama de Dragão', icon: 'item-dragonscale', sellPrice: 350, type: 'material', dungeon: 'dragons', weight: 15 },
  // --- Andar do Demônio --- preço do Chifre subiu (era 180) pra ser o item
  // mais valioso do jogo — capstone do andar mais avançado hoje.
  { key: 'miniServoClaw', name: 'Garra de Mini Servo', icon: 'item-miniservoclaw', sellPrice: 260, type: 'material', dungeon: 'demons', weight: 45 },
  { key: 'shadowEssence', name: 'Essência das Sombras', icon: 'item-shadowessence', sellPrice: 320, type: 'material', dungeon: 'demons', weight: 30 },
  { key: 'demonHorn', name: 'Chifre de Demônio', icon: 'item-demonhorn', sellPrice: 500, type: 'material', dungeon: 'demons', weight: 10 },
  // --- Caverna (minérios) --- itens com `type:'mineral'` NÃO vêm de drop de
  // monstro: entram no inventário só pelo baú da Caverna (ver CavernModule.
  // collectChest). `rarity`/`weight` controlam o sorteio de qual minério cai
  // no baú a cada ponto de minério minerado (ver CavernModule.rollMineral) —
  // `weight` é o peso relativo, somam 100 só pra ler como "% de chance base"
  // (o upgrade Faro de Minérios reforça o peso de tudo que não é 'comum').
  { key: 'ironOre', name: 'Minério de Ferro', icon: 'mineral-iron', sellPrice: 4, type: 'mineral', rarity: 'comum', weight: 42 },
  { key: 'bronzeChunk', name: 'Fragmento de Bronze', icon: 'mineral-bronze', sellPrice: 7, type: 'mineral', rarity: 'comum', weight: 33 },
  { key: 'silverOre', name: 'Minério de Prata', icon: 'mineral-silver', sellPrice: 18, type: 'mineral', rarity: 'incomum', weight: 16 },
  { key: 'goldOre', name: 'Minério de Ouro', icon: 'mineral-gold', sellPrice: 45, type: 'mineral', rarity: 'raro', weight: 7 },
  { key: 'rawDiamond', name: 'Diamante Bruto', icon: 'mineral-diamond', sellPrice: 150, type: 'mineral', rarity: 'epico', weight: 1.8 },
  { key: 'arcaneCrystal', name: 'Cristal Arcano', icon: 'mineral-crystal', sellPrice: 500, type: 'mineral', rarity: 'lendario', weight: 0.2 },
];

// Raridade dos minérios (ver ITEM_DEFS acima) — só label + cor pra UI
// (badge no nome do item, bolinha no detalhamento do baú). `comum` fica de
// fora do boost do upgrade Faro de Minérios (ver CavernModule.rollMineral).
const RARITY_DEFS = {
  comum: { label: 'Comum', color: '#b9b9b9' },
  incomum: { label: 'Incomum', color: '#6fcf7f' },
  raro: { label: 'Raro', color: '#4fa3e3' },
  epico: { label: 'Épico', color: '#b06fe0' },
  lendario: { label: 'Lendário', color: '#ffb84a' },
};

// Derivado de ITEM_DEFS (não duplicado) — todo item com type:'mineral' vira
// automaticamente parte do sistema de mineração da Caverna (baú, sorteio,
// listas da aba Minério). Ver js/cavern.js.
const MINERAL_DEFS = ITEM_DEFS.filter(d => d.type === 'mineral');

// Mineradores de MINÉRIO da Caverna — compra infinita/custo exponencial
// (mesmo formato de TROOP_DEFS), mas cada um rende `orePerSec` PONTOS de
// minério/seg (fracionário), não um minério específico. A cada ponto inteiro
// acumulado (ver CavernModule.mineOreAmount), um minério é sorteado por
// raridade e cai no baú — por isso não há "goldPerSec" fixo por minerador
// aqui, e sim uma taxa compartilhada entre todos os tipos de minério.
const PROSPECTOR_DEFS = [
  { key: 'apprentice', name: 'Aprendiz de Minerador', desc: '+0.1 minério/seg', baseCost: 300, costGrowth: 1.30, orePerSec: 0.1 },
  { key: 'veteranMiner', name: 'Minerador Veterano', desc: '+0.5 minério/seg', baseCost: 2200, costGrowth: 1.30, orePerSec: 0.5 },
  { key: 'blaster', name: 'Explosivista', desc: '+2 minério/seg', baseCost: 15000, costGrowth: 1.32, orePerSec: 2 },
  { key: 'excavatorGolem', name: 'Golem Escavador', desc: '+8 minério/seg', baseCost: 90000, costGrowth: 1.35, orePerSec: 8 },
];

// Upgrades da Caverna — mesmo formato de nível máximo/custo
// exponencial de UPGRADE_DEFS, mas SEM passar pela árvore/ProgressionModule:
// é uma lista simples, comprada direto com moeda (ver CavernModule.buyUpgrade),
// igual à lista de upgrades permanentes do Prestígio (PRESTIGE_UPGRADE_DEFS).
// `oreRatePct`: cada nível soma +20% multiplicativo na taxa total de
// mineração (ver CavernModule.totalOrePerSecond). `oreLuck`: cada nível soma
// +15% no peso relativo de toda raridade acima de 'comum' no sorteio (ver
// CavernModule.rollMineral) — não tem `apply`, os efeitos são lidos
// dinamicamente a partir de state.cavernUpgrades[key] onde são usados.
const CAVERN_UPGRADE_DEFS = [
  { key: 'oreRatePct', name: 'Picareta Reforçada', desc: '+20% velocidade de mineração', baseCost: 600, costGrowth: 1.6, maxLevel: 10 },
  { key: 'oreLuck', name: 'Faro de Minérios', desc: '+15% chance de minérios raros', baseCost: 900, costGrowth: 1.7, maxLevel: 10 },
];

// Falas soltas do Barnabé — sorteada 1 por vez toda vez que a Loja é aberta
// (depois da 1ª apresentação, ver QuestModule.openBarnabeIntro), só clima,
// sem efeito em jogo. Ver UI: abertura de #lojaModal.
const BARNABE_LINES = [
  'Bom dia meu amigo!',
  'Seja bem vindo!',
  'Muitas aventuras por aí?',
  'Obrigado por ajudar a nossa cidade.',
  'Meu irmão consegue arrumar algumas armas para você.',
];

// Falas soltas do Creiton (irmão do Barnabé, dono do Ferreiro) — sorteada 1
// por vez toda vez que o Ferreiro é aberto, mesmo padrão de BARNABE_LINES,
// só clima, sem efeito em jogo. Ver UI: abertura de #ferreiroModal.
const CREITON_LINES = [
  'Precisa de uma arma nova?',
  'Minha forja nunca esfria.',
  'Traga minério bom e eu faço milagres.',
  'Já viu o que dá pra forjar com material de verdade?',
  'Cuidado lá fora, essas dungeons não perdoam ninguém.',
];

const ANSELMO_LINES = [
  'Estou orando por você',
  'Que essas pragas do Dungeon desapareçam',
  'Obrigado pela ajuda',
];

// Armas — a 1ª é escolhida de graça na conversa com o Clérigo (ver
// OnboardingModule); as outras duas ficam à venda no Ferreiro por
// `buyCost` moeda (ver UI.renderFerreiroWeapons). `state.weapons[key]` é 0 ou 1.
//
// Bônus suportados (todos opcionais — só declare o campo na arma que tiver
// esse bônus, o resto do código trata ausência como 0):
//   clickDamageBonus  — flat, soma ao dano por clique (PlayerModule.clickDamage)
//   dpsBonus          — flat, soma ao DPS automático (TroopsModule.totalDps)
//   critChanceBonus   — soma à chance de crítico, 0-1 (PlayerModule.handleClick)
//   critDamageBonus   — soma ao % de dano crítico extra, 0-1 (PlayerModule.handleClick)
//   extraDropChance   — 0-1, chance de rolar os drops do monstro morto uma
//                       vez extra (MonsterModule.rollDrops)
//   burnChance        — 0-1, chance por CLIQUE de aplicar/renovar queimadura
//                       no monstro atual (PlayerModule.handleClick)
//   burnDamagePercent — % do dano daquele clique que vira dano total de
//                       queimadura, dividido em ticks (MonsterModule.applyBurn,
//                       ver CONFIG.burnDurationMs/burnTickMs)
// Pra adicionar um novo tipo de bônus no futuro: crie o campo aqui (com esse
// mesmo padrão flat/opcional) e leia ele no único lugar do código que já
// calcula aquele stat (ex.: um bônus de ouro entraria em ShopModule/onde
// quer que a venda calcule o preço final).
const WEAPON_DEFS = [
  { key: 'swordSimple', name: 'Espada Simples', icon: 'weapon-sword', clickDamageBonus: 1, buyCost: 500 },
  { key: 'bowArrow', name: 'Arco e Flecha', icon: 'weapon-bow', clickDamageBonus: 1, buyCost: 500 },
  { key: 'axe', name: 'Machado', icon: 'weapon-axe', clickDamageBonus: 1, buyCost: 500 },
];

// Armas FORJADAS — resultado de consertar uma arma bruta (ver ITEM_DEFS
// `type:'brokenWeapon'`) no Ferreiro (ver ForgeModule/js/forge.js).
// Compartilham o mesmo "pool" de posse de WEAPON_DEFS (state.weapons,
// 0/1 por chave — nunca duplicado, forjar de novo não faz nada se já
// possui) e o mesmo sistema de arma EQUIPADA (state.equippedWeapon, ver
// PlayerModule.equipWeapon) — só uma arma fica ativa por vez, seja ela
// inicial ou forjada. Mesma lista de bônus opcionais de WEAPON_DEFS acima
// (clickDamageBonus/dpsBonus/critChanceBonus/critDamageBonus/extraDropChance/
// burnChance/burnDamagePercent).
// `recipe.materials` são chaves de ITEM_DEFS consumidas de state.inventory;
// `recipe.coinCost` é consumido de state.gold — tudo verificado em
// ForgeModule.canForge antes de deixar forjar.
const FORGED_WEAPON_DEFS = [
  {
    key: 'slimeWarriorSword', name: 'Espada do Guerreiro Slime', icon: 'weapon-slimewarriorsword',
    clickDamageBonus: 50, dpsBonus: 20,
    recipe: {
      coinCost: 700, materials: [
        { itemKey: 'slimeSword', qty: 3 },
        { itemKey: 'slimeGel', qty: 300 },
        { itemKey: 'ironOre', qty: 50 },
        { itemKey: 'bronzeChunk', qty: 50 },
        { itemKey: 'goldOre', qty: 5 },
      ]
    }
  },
  {
    key: 'slimeWarriorAxe', name: 'Machado do Guerreiro Slime', icon: 'weapon-slimewarrioraxe',
    clickDamageBonus: 150, dpsBonus: 60,
    recipe: {
      coinCost: 2000, materials: [
        { itemKey: 'slimeAxe', qty: 3 },
        { itemKey: 'slimeGel', qty: 900 },
        { itemKey: 'ironOre', qty: 100 },
        { itemKey: 'bronzeChunk', qty: 100 },
        { itemKey: 'goldOre', qty: 15 },
        { itemKey: 'rawDiamond', qty: 5 },
      ]
    }
  },
  {
    key: 'slimeKingGreatAxe', name: 'Machado Ancestral do Rei Slime', icon: 'weapon-slimekinggreataxe',
    clickDamageBonus: 400, dpsBonus: 150,
    recipe: {
      coinCost: 5000, materials: [
        { itemKey: 'slimeAxeGreater', qty: 3 },
        { itemKey: 'slimeGel', qty: 2000 },
        { itemKey: 'ironOre', qty: 300 },
        { itemKey: 'bronzeChunk', qty: 250 },
        { itemKey: 'goldOre', qty: 40 },
        { itemKey: 'rawDiamond', qty: 15 },
        { itemKey: 'arcaneCrystal', qty: 3 },
      ]
    }
  },
];

// Missões dadas por NPCs da cidade (ver QuestModule). Cada missão tem um
// array `objectives` (ver tipos suportados em QuestModule.objectiveDone) —
// completar TODOS os objetivos habilita o botão de conclusão. Objetivos
// `deliverItem` consomem o item do inventário ao concluir (ação irreversível,
// por isso `state.quests[key]=true` fica persistido, nunca recomputado — ver
// js/onboarding.js). `unlocksBuilding` é o prédio liberado ao concluir.
// `modalElId`/`bannerElId` dizem em qual modal e em qual <div> o banner de
// progresso da missão é renderizado (ver QuestModule.renderAllQuestBanners);
// `bannerLabel` é o texto curto do banner; `completeTitle`/`completeText`
// preenchem o `questCompleteModal` genérico ao concluir (ver QuestModule.deliver).
const QUEST_DEFS = [
  {
    key: 'slimeGelDelivery', npc: 'Barnabé', unlocksBuilding: 'ferreiro',
    modalElId: 'lojaModal', bannerElId: 'lojaQuestBanner', bannerLabel: 'Encomenda do Creiton',
    objectives: [
      { type: 'deliverItem', itemKey: 'slimeGel', itemQty: 10 },
    ],
    completeTitle: 'BARNABÉ',
    completeText: 'Ótima notícia! Isso é exatamente o que o Creiton precisava — ele já está a caminho de volta. Pode ir até o Ferreiro quando quiser.'
  },
  {
    // Missão com objetivos variados de propósito (não só entrega de item) —
    // prova que o jogador já enfrenta a dungeon de verdade e já investiu num
    // 2º armamento antes de "armar uma tropa" de verdade. O objetivo
    // `ownWeapons` exige só armas INICIAIS compráveis no próprio Ferreiro
    // (não uma arma forjada) de propósito: forjar exige minério, que só vem
    // da Caverna — e a Caverna é liberada por uma missão totalmente separada
    // (caveClearance), então exigir arma forjada aqui criaria uma dependência
    // escondida entre 2 missões que hoje podem ser feitas em qualquer ordem.
    key: 'creitonMilitia', npc: 'Creiton', unlocksBuilding: 'guilda',
    modalElId: 'ferreiroModal', bannerElId: 'ferreiroQuestBanner', bannerLabel: 'Material pra Tropas',
    objectives: [
      { type: 'deliverItem', itemKey: 'slimeCompound', itemQty: 8 },
      { type: 'defeatCycle', count: 1, label: 'Derrotar o chefe de um ciclo em qualquer Dungeon' },
      { type: 'ownWeapons', count: 2, label: 'Possuir 2 armas iniciais diferentes (compre a 2ª no Ferreiro)' },
    ],
    completeTitle: 'CREITON',
    completeText: 'Perfeito — material temperado, você já provou que aguenta a dungeon e ainda chegou armado até os dentes. Já mandei um recado pra Guilda — pode ir até lá quando quiser armar sua tropa.'
  },
  {
    // Anunciada pelo próprio Anselmo ao abrir a Igreja (ver
    // QuestModule.openAnselmoCaveIntro/state.caveQuestAnnounced), igual ao
    // padrão de Barnabé/Creiton — não é mais só um banner passivo.
    key: 'caveClearance', npc: 'Irmão Anselmo', unlocksBuilding: 'caverna',
    modalElId: 'igrejaModal', bannerElId: 'clericQuestBanner', bannerLabel: 'Reabertura da Caverna',
    objectives: [
      { type: 'deliverItem', itemKey: 'slimeGel', itemQty: 20 },
      { type: 'deliverItem', itemKey: 'slimeCompound', itemQty: 15 },
      { type: 'defeatCycle', count: 1, label: 'Derrotar o chefe de um ciclo em qualquer Dungeon' },
    ],
    completeTitle: 'IRMÃO ANSELMO',
    completeText: 'Isso deve bastar pra convencer os poucos mineradores que restaram a voltar ao trabalho, e sua coragem lá fora acaba com a última dúvida deles. A Caverna está pronta pra ser explorada.'
  },
];

// Tropas (DPS) crescem de custo bem mais rápido que upgrades — elas não têm
// nível máximo (dá pra comprar infinitas), então o custo precisa subir rápido
// pra virar um sumidouro de moeda de longo prazo. Upgrades têm nível máximo,
// então crescem devagar (senão ficam inatingíveis antes do maxLevel).
const TROOP_DEFS = [
  { key: 'recruit', name: 'Recruta', desc: '+1 DPS', baseCost: 150, costGrowth: 1.40, dps: 1 },
  { key: 'archer', name: 'Arqueiro', desc: '+5 DPS', baseCost: 800, costGrowth: 1.40, dps: 5 },
  { key: 'mage', name: 'Mago', desc: '+20 DPS', baseCost: 5000, costGrowth: 1.40, dps: 20 },
  { key: 'catapult', name: 'Catapulta', desc: '+100 DPS', baseCost: 30000, costGrowth: 1.40, dps: 100 },
  { key: 'dragon', name: 'Dragão Aliado', desc: '+1000 DPS', baseCost: 150000, costGrowth: 1.45, dps: 1000 },
];

// Expedições da Guilda (ver GuildModule): manda as tropas coletarem material
// de dungeon sozinhas por uma duração fixa, online ou offline — resolve
// automaticamente assim que o tempo passa (ver GuildModule.resolveIfDone,
// chamado no tick do jogo e ao carregar um save). `rateMult` cresce com a
// duração de propósito, pra recompensar esperar mais em vez de mandar várias
// expedições curtas seguidas.
const GUILD_EXPEDITION_DEFS = [
  { key: 'curta', name: 'Curta', hours: 1, rateMult: 1.0 },
  { key: 'media', name: 'Média', hours: 4, rateMult: 1.15 },
  { key: 'longa', name: 'Longa', hours: 8, rateMult: 1.30 },
  { key: 'extensa', name: 'Extensa', hours: 12, rateMult: 1.45 },
  { key: 'expedicao', name: 'Expedição', hours: 24, rateMult: 1.60 },
];

// Árvore de habilidades de BATALHA (Academia de Combate):
// Nível 0 = raiz ("Fúria do Guerreiro"); Nível 1 = upgrades que brotam dela
// direto (Olho Certeiro/Força Bruta/Golpe Devastador/Clique Automático);
// Nível 2 = upgrades por ramo de Nível 1 (3 cada nos ramos de combate, custo
// moderado baseCost=400; 2 encadeados no ramo de Automação). Cada upgrade só
// libera quando o `requires` dele atinge o PRÓPRIO `maxLevel` (ver
// ProgressionModule.isUnlocked) — como `requires` aponta pro PAI direto (não
// sempre a raiz), isso empilha em cadeia por ramo sem precisar de nenhuma
// lógica nova, e funciona igual pra ramos de 5 níveis ou de 1 nível só. Os
// ramos de Crítico e Dano % somam um pouco de dano por clique junto da
// própria stat nos upgrades de Nível 2 (pra reforçar a ligação com a raiz);
// o ramo de Dano Crítico % só reforça a própria stat.
const UPGRADE_DEFS = [
  { key: 'battleClickDmg', name: 'Fúria do Guerreiro', desc: '+5 dano por clique', baseCost: 10, costGrowth: 1.3, apply: s => s.clickDamageFlat += 5, maxLevel: 5, requires: null },
  { key: 'battleCritChance', name: 'Olho Certeiro', desc: '+3% chance de crítico', baseCost: 60, costGrowth: 1.35, apply: s => s.critChance = Math.min(0.75, s.critChance + 0.03), maxLevel: 5, requires: 'battleClickDmg' },
  { key: 'battleDmgPercent', name: 'Força Bruta', desc: '+5% de dano por clique', baseCost: 60, costGrowth: 1.4, apply: s => s.clickDamagePercent += 0.05, maxLevel: 5, requires: 'battleClickDmg' },
  { key: 'battleCritDmgPercent', name: 'Golpe Devastador', desc: '+10% de dano crítico', baseCost: 60, costGrowth: 1.45, apply: s => s.critDamagePercent += 0.10, maxLevel: 5, requires: 'battleClickDmg' },
  // Clique Automático — só 1 nível (compra única, sem escalar): liga um
  // clique automático periódico enquanto houver monstro ativo E o ciclo
  // atual já tiver sido concluído antes (ver PlayerModule.isAutoClickActive
  // /main.js/tick). `autoClickIntervalMs` é a base (1s) lida de
  // PlayerModule.autoClickIntervalMs(), reduzida pelos 2 upgrades de
  // velocidade abaixo — não é um stat de state, `apply` fica vazio de
  // propósito, o efeito é 100% dinâmico a partir de
  // state.upgrades.battleAutoClick > 0.
  { key: 'battleAutoClick', name: 'Clique Automático', desc: 'Clica sozinho a cada 1s (só em ciclos já vencidos antes)', baseCost: 1000, costGrowth: 1.5, apply: s => { }, maxLevel: 1, requires: 'battleClickDmg', autoClickIntervalMs: 1000 },
  // Upgrades de velocidade do Clique Automático — encadeados (o 2º exige o
  // 1º, não a raiz), cada um -25 pontos percentuais do intervalo BASE
  // (1000ms), acumulando: 1000ms → 750ms → 500ms. Ver
  // PlayerModule.autoClickIntervalMs().
  { key: 'autoClickSpeed1', name: 'Reflexos de Aço', desc: '-25% no intervalo do Clique Automático (1s → 0.75s)', baseCost: 3000, costGrowth: 1.5, apply: s => { }, maxLevel: 1, requires: 'battleAutoClick' },
  { key: 'autoClickSpeed2', name: 'Reflexos Sobrenaturais', desc: '-25% no intervalo do Clique Automático, acumulado (0.75s → 0.5s)', baseCost: 8000, costGrowth: 1.5, apply: s => { }, maxLevel: 1, requires: 'autoClickSpeed1' },

  // --- Nível 2 do ramo Crítico (requer Olho Certeiro nível 5) ---
  {
    key: 'critChance2A', name: 'Visão de Falcão', desc: '+4% chance de crítico, +4 dano por clique', baseCost: 400, costGrowth: 1.5, maxLevel: 5, requires: 'battleCritChance',
    apply: s => { s.critChance = Math.min(0.75, s.critChance + 0.04); s.clickDamageFlat += 4; }
  },
  {
    key: 'critChance2B', name: 'Reflexos Rápidos', desc: '+6% chance de crítico, +2 dano por clique', baseCost: 400, costGrowth: 1.5, maxLevel: 5, requires: 'battleCritChance',
    apply: s => { s.critChance = Math.min(0.75, s.critChance + 0.06); s.clickDamageFlat += 2; }
  },
  {
    key: 'critChance2C', name: 'Instinto Selvagem', desc: '+2% chance de crítico, +7 dano por clique', baseCost: 400, costGrowth: 1.5, maxLevel: 5, requires: 'battleCritChance',
    apply: s => { s.critChance = Math.min(0.75, s.critChance + 0.02); s.clickDamageFlat += 7; }
  },

  // --- Nível 2 do ramo Dano % (requer Força Bruta nível 5) ---
  {
    key: 'dmgPercent2A', name: 'Impacto Brutal', desc: '+7% de dano por clique, +3 dano por clique', baseCost: 400, costGrowth: 1.5, maxLevel: 5, requires: 'battleDmgPercent',
    apply: s => { s.clickDamagePercent += 0.07; s.clickDamageFlat += 3; }
  },
  {
    key: 'dmgPercent2B', name: 'Força Titânica', desc: '+10% de dano por clique, +1 dano por clique', baseCost: 400, costGrowth: 1.5, maxLevel: 5, requires: 'battleDmgPercent',
    apply: s => { s.clickDamagePercent += 0.10; s.clickDamageFlat += 1; }
  },
  {
    key: 'dmgPercent2C', name: 'Golpe Pesado', desc: '+4% de dano por clique, +6 dano por clique', baseCost: 400, costGrowth: 1.5, maxLevel: 5, requires: 'battleDmgPercent',
    apply: s => { s.clickDamagePercent += 0.04; s.clickDamageFlat += 6; }
  },

  // --- Nível 3 do ramo Dano % (encadeado: cada um exige o SEU pai de
  // Nível 2, não a raiz do ramo — mesmo esquema de corrente do ramo
  // Automação, ver UI.renderDescendants) — bem mais caro que o Nível 2
  // (baseCost 3000 vs 400). dmgPercent3B reaproveita state.dpsSynergyRatio
  // (existia desde antes, só não tinha mais upgrade que o alimentasse — ver
  // TroopsModule.total/comentário "Ressonância de Combate" em troops.js).
  {
    key: 'dmgPercent3A', name: 'Impacto Absoluto', desc: '+30 dano por clique', baseCost: 3000, costGrowth: 1.6, maxLevel: 5, requires: 'dmgPercent2A',
    apply: s => s.clickDamageFlat += 30
  },
  {
    key: 'dmgPercent3B', name: 'Ressonância de Combate', desc: '+15 dano por clique, +5% DPS', baseCost: 3000, costGrowth: 1.6, maxLevel: 5, requires: 'dmgPercent2B',
    apply: s => { s.clickDamageFlat += 15; s.dpsSynergyRatio += 0.05; }
  },
  {
    key: 'dmgPercent3C', name: 'Fúria Titânica', desc: '+30% de dano por clique', baseCost: 3000, costGrowth: 1.6, maxLevel: 5, requires: 'dmgPercent2C',
    apply: s => s.clickDamagePercent += 0.30
  },

  // --- Nível 4 do ramo Dano % (mesmo esquema de corrente do Nível 3, cada
  // um exige o SEU pai de Nível 3) — bem mais caro que o Nível 3
  // (baseCost 25000 vs 3000).
  {
    key: 'dmgPercent4A', name: 'Golpe Definitivo', desc: '+100 dano por clique', baseCost: 25000, costGrowth: 1.7, maxLevel: 5, requires: 'dmgPercent3A',
    apply: s => s.clickDamageFlat += 100
  },
  {
    key: 'dmgPercent4B', name: 'Ressonância Amplificada', desc: '+50 dano por clique, +10% DPS', baseCost: 25000, costGrowth: 1.7, maxLevel: 5, requires: 'dmgPercent3B',
    apply: s => { s.clickDamageFlat += 50; s.dpsSynergyRatio += 0.10; }
  },
  {
    key: 'dmgPercent4C', name: 'Fúria Apocalíptica', desc: '+60% de dano por clique', baseCost: 25000, costGrowth: 1.7, maxLevel: 5, requires: 'dmgPercent3C',
    apply: s => s.clickDamagePercent += 0.60
  },

  // --- Nível 2 do ramo Dano Crítico % (requer Golpe Devastador nível 5) —
  // só reforça a própria stat, sem somar dano por clique. ---
  {
    key: 'critDmgPercent2A', name: 'Fragmentação', desc: '+12% de dano crítico', baseCost: 400, costGrowth: 1.5, maxLevel: 5, requires: 'battleCritDmgPercent',
    apply: s => s.critDamagePercent += 0.12
  },
  {
    key: 'critDmgPercent2B', name: 'Execução Brutal', desc: '+15% de dano crítico', baseCost: 400, costGrowth: 1.5, maxLevel: 5, requires: 'battleCritDmgPercent',
    apply: s => s.critDamagePercent += 0.15
  },
  {
    key: 'critDmgPercent2C', name: 'Golpe Fatal', desc: '+18% de dano crítico', baseCost: 400, costGrowth: 1.5, maxLevel: 5, requires: 'battleCritDmgPercent',
    apply: s => s.critDamagePercent += 0.18
  },

  // --- Ramo Sorte (drops raros) e Ramo Monstro Dourado — mesmo padrão dos
  // 4 ramos acima (raiz de 5 níveis + 3 filhos de Nível 2 também de 5
  // níveis, requerendo a raiz do próprio ramo), só que MUITO mais caros
  // (baseCost/costGrowth bem acima dos ramos de dano), por serem ramos
  // avançados de "luck". rareDropChanceBonus só afeta entradas de drop com
  // `chance` própria em MONSTER_TYPES (as raras — as garantidas não têm
  // `chance` e não são tocadas); goldenChanceBonus soma direto em cima de
  // CONFIG.goldenChancePerTick (ver MonsterModule.rollDrops/maybeTriggerGolden).
  { key: 'battleDropChance', name: 'Faro de Caçador', desc: '+3% de chance nos drops raros dos monstros', baseCost: 1500, costGrowth: 1.5, maxLevel: 5, requires: 'battleClickDmg',
    apply: s => s.rareDropChanceBonus = Math.min(0.9, s.rareDropChanceBonus + 0.03) },
  { key: 'battleGoldenChance', name: 'Sorte Dourada', desc: '+0.05% de chance de monstro dourado por tick', baseCost: 2000, costGrowth: 1.5, maxLevel: 5, requires: 'battleClickDmg',
    apply: s => s.goldenChanceBonus = Math.min(0.05, s.goldenChanceBonus + 0.0005) },

  // --- Nível 2 do ramo Sorte (requer Faro de Caçador nível 5) ---
  {
    key: 'dropChance2A', name: 'Instinto de Caçador', desc: '+4% de chance nos drops raros dos monstros', baseCost: 8000, costGrowth: 1.6, maxLevel: 5, requires: 'battleDropChance',
    apply: s => s.rareDropChanceBonus = Math.min(0.9, s.rareDropChanceBonus + 0.04)
  },
  {
    key: 'dropChance2B', name: 'Faro Apurado', desc: '+6% de chance nos drops raros dos monstros', baseCost: 8000, costGrowth: 1.6, maxLevel: 5, requires: 'battleDropChance',
    apply: s => s.rareDropChanceBonus = Math.min(0.9, s.rareDropChanceBonus + 0.06)
  },
  {
    key: 'dropChance2C', name: 'Sexto Sentido', desc: '+2% de chance nos drops raros dos monstros', baseCost: 8000, costGrowth: 1.6, maxLevel: 5, requires: 'battleDropChance',
    apply: s => s.rareDropChanceBonus = Math.min(0.9, s.rareDropChanceBonus + 0.02)
  },

  // --- Nível 2 do ramo Monstro Dourado (requer Sorte Dourada nível 5) ---
  {
    key: 'goldenChance2A', name: 'Toque de Midas', desc: '+0.07% de chance de monstro dourado por tick', baseCost: 10000, costGrowth: 1.6, maxLevel: 5, requires: 'battleGoldenChance',
    apply: s => s.goldenChanceBonus = Math.min(0.05, s.goldenChanceBonus + 0.0007)
  },
  {
    key: 'goldenChance2B', name: 'Bênção Dourada', desc: '+0.10% de chance de monstro dourado por tick', baseCost: 10000, costGrowth: 1.6, maxLevel: 5, requires: 'battleGoldenChance',
    apply: s => s.goldenChanceBonus = Math.min(0.05, s.goldenChanceBonus + 0.0010)
  },
  {
    key: 'goldenChance2C', name: 'Fortuna Rara', desc: '+0.04% de chance de monstro dourado por tick', baseCost: 10000, costGrowth: 1.6, maxLevel: 5, requires: 'battleGoldenChance',
    apply: s => s.goldenChanceBonus = Math.min(0.05, s.goldenChanceBonus + 0.0004)
  },
];

// Layout visual da árvore de Upgrades (Academia de Combate): `root` fica no
// centro (`hub`) e os 3 de Nível 1 brotam dele (ver UI.renderUpgradeTree —
// as linhas são curvas, não retas). Cada branch agora tem também
// `children`: os 3 upgrades de Nível 2 daquele ramo, brotando do nó de
// Nível 1 (não do hub) — de propósito posicionados FORA da área 0-100
// visível a zoom 1, então só aparecem se o jogador der zoom out ou
// arrastar o mapa (ver .tree-wrap/UI.initTreePanZoom). O desbloqueio real
// vem de `requires` em UPGRADE_DEFS, não daqui — isto é só o layout.
const UPGRADE_TREE = {
  root: 'battleClickDmg',
  hub: { x: 50, y: 50 },
  branches: [
    {
      label: 'Crítico', color: '#4fd1c5', nodes: [
        { key: 'battleCritChance', x: 50, y: 15 },
      ], children: [
        { key: 'critChance2A', x: 35, y: -17 },
        { key: 'critChance2B', x: 50, y: -20 },
        { key: 'critChance2C', x: 65, y: -17 },
      ]
    },
    {
      label: 'Dano %', color: '#c9432f', nodes: [
        { key: 'battleDmgPercent', x: 81, y: 80 },
      ], children: [
        // Nível 3 encadeado (não irmão): cada dmgPercent3X é filho do SEU
        // dmgPercent2X, continuando pra fora na mesma direção radial a
        // partir do hub — mesmo esquema de corrente do ramo Automação.
        { key: 'dmgPercent2A', x: 114, y: 91, children: [
          { key: 'dmgPercent3A', x: 144, y: 110, children: [
            { key: 'dmgPercent4A', x: 174, y: 129 },
          ] },
        ] },
        { key: 'dmgPercent2B', x: 106, y: 104, children: [
          { key: 'dmgPercent3B', x: 132, y: 129, children: [
            { key: 'dmgPercent4B', x: 158, y: 154 },
          ] },
        ] },
        { key: 'dmgPercent2C', x: 94, y: 113, children: [
          { key: 'dmgPercent3C', x: 115, y: 143, children: [
            { key: 'dmgPercent4C', x: 136, y: 173 },
          ] },
        ] },
      ]
    },
    {
      label: 'Dano Crítico %', color: '#ffd54a', nodes: [
        { key: 'battleCritDmgPercent', x: 19, y: 80 },
      ], children: [
        { key: 'critDmgPercent2A', x: 6, y: 113 },
        { key: 'critDmgPercent2B', x: -6, y: 104 },
        { key: 'critDmgPercent2C', x: -14, y: 91 },
      ]
    },
    // Automação: diferente dos outros 3 ramos (3 filhos irmãos do mesmo
    // pai), aqui os 2 upgrades de Nível 2 são uma CADEIA (autoClickSpeed2
    // aninhado dentro de `children` de autoClickSpeed1, não direto de
    // battleAutoClick) — UI.renderUpgradeTree percorre isso recursivamente,
    // então funciona também pra profundidade 3 sem precisar de código novo.
    {
      label: 'Automação', color: '#8fd9c4', nodes: [
        { key: 'battleAutoClick', x: 82, y: 20 },
      ], children: [
        {
          key: 'autoClickSpeed1', x: 100, y: 5, children: [
            { key: 'autoClickSpeed2', x: 118, y: -10 },
          ]
        },
      ]
    },
    // Sorte (drops raros): espelha a posição de Automação, do outro lado do
    // hub (x negativo em vez de >100).
    {
      label: 'Sorte', color: '#9b5de5', nodes: [
        { key: 'battleDropChance', x: 18, y: 20 },
      ], children: [
        { key: 'dropChance2A', x: -15, y: 5 },
        { key: 'dropChance2B', x: -18, y: 20 },
        { key: 'dropChance2C', x: -15, y: 35 },
      ]
    },
    // Monstro Dourado: mesmo y dos outros 2 ramos "de canto" (Dano %/Dano
    // Crítico %, ambos y:80), só que centralizado — os 3 formam uma fileira
    // só embaixo do hub. y:80 (não mais fundo) de propósito: o rótulo da
    // branch (UI.renderUpgradeTree label*) empurra 13pts na direção do nó a
    // partir do hub, e pra nó "reto pra baixo" (dx=0) isso esbarra rápido no
    // clamp de 94 do eixo Y — acima de y:81 o texto do rótulo já invade o
    // próprio card do nó.
    {
      label: 'Monstro Dourado', color: '#ffab00', nodes: [
        { key: 'battleGoldenChance', x: 50, y: 80 },
      ], children: [
        { key: 'goldenChance2A', x: 35, y: 122 },
        { key: 'goldenChance2B', x: 50, y: 128 },
        { key: 'goldenChance2C', x: 65, y: 122 },
      ]
    },
  ]
};

const PRESTIGE_UPGRADE_DEFS = [
  { key: 'pClick', name: 'Bênção do Guerreiro', desc: '+15% dano por clique (permanente)', baseCost: 1, costGrowth: 1.8, apply: s => s.pClickMult += 0.15 },
  { key: 'pDps', name: 'Pacto das Tropas', desc: '+15% DPS das tropas (permanente)', baseCost: 1, costGrowth: 1.8, apply: s => s.pDpsMult += 0.15 },
  { key: 'pOreRate', name: 'Toque de Midas', desc: '+15% velocidade de mineração de minério (permanente)', baseCost: 1, costGrowth: 1.8, apply: s => s.pOreRateMult += 0.15 },
  { key: 'pCrit', name: 'Fúria Ancestral', desc: '+5% chance de crítico (permanente)', baseCost: 2, costGrowth: 2.0, apply: s => s.pCritChance += 0.05 },
];
