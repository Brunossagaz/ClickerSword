/* ---------------------------------------------------------------------
   CONFIG
--------------------------------------------------------------------- */
const CONFIG = {
  saveKey: 'monsterAttackClickerSave', // LEGADO (pré-slots) — só lido 1x pra migração, nunca mais escrito
  saveKeySlot(n){ return 'monsterAttackClickerSave_slot' + n; }, // n = 1..maxSaveSlots
  maxSaveSlots: 3,
  settingsKey: 'monsterAttackClickerSettings', // preferências globais (áudio/volume/idioma), fora de qualquer save
  tickMs: 200,
  autosaveMs: 10000,
  baseHp: 18,
  hpGrowth: 1.135,
  cycleLength: 10,          // monstros por ciclo; o último da fileira é sempre o chefe
  bossHpMult: 7,
  bossRewardMult: 6,
  goldPerHpFactor: 0.9,     // gold reward scales with monster hp
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
  ascendKillThresholdGrowth: 15,
  monsterTimeLimitMs: 15000 // tempo pra derrotar cada monstro antes de reiniciar o ciclo
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
// casas). `dropQty` é a quantidade FIXA de item dropada por esse tipo (só
// usado em Dungeons com `dropsItem` — ver MAPS/MonsterModule.itemRewardQty),
// sem escalar com HP/posição no ciclo — segue a MESMA razão 1.5x do hpMult
// (arredondada pra cima), então nunca fica fora de ordem com a força real
// da criatura (1 → 2 → 3 → 4 → 6 → 8).
const MONSTER_TYPES = [
  // --- Mapa 1: Pântano dos Slimes (ciclos 1-5) ---
  { key:'slime',              name:'SLIME',               image:'assets/sprites/slime.png',              frameW:128, frameH:128, dropQty:1,  blinkCapable:true },
  { key:'slimeBlue',          name:'SLIME AZUL',          image:'assets/sprites/slime_blue.png',          frameW:128, frameH:128, spriteScale:0.7, hpMult:1.5,  dropQty:2,  blinkCapable:true },
  { key:'slimeGreenWarrior',  name:'SLIME VERDE GUERREIRO', image:'assets/sprites/slime_green_warrior.png', frameW:128, frameH:128, hpMult:2.25, dropQty:3,  blinkCapable:true },
  { key:'slimeRed',           name:'SLIME VERMELHO',      image:'assets/sprites/slime_red.png',           frameW:128, frameH:128, hpMult:3.38, dropQty:4,  blinkCapable:true },
  { key:'slimeBlueBarbarian', name:'SLIME AZUL BÁRBARO',  image:'assets/sprites/slime_blue_barbarian.png',frameW:128, frameH:128, hpMult:5.06, dropQty:6,  blinkCapable:true },
  { key:'slimeRedKing',       name:'SLIME REI VERMELHO',  image:'assets/sprites/slime_red_king.png',      frameW:128, frameH:128, hpMult:7.59, dropQty:8,  blinkCapable:true },
  // --- Mapa 2: Reino Goblin (ciclos 4-6) ---
  { key:'goblinGreen',   name:'GOBLIN VERDE',     image:'assets/sprites/goblin_green.png',   frameW:128, frameH:128, blinkCapable:true },
  { key:'goblinRed',     name:'GOBLIN VERMELHO',  image:'assets/sprites/goblin_red.png',     frameW:128, frameH:128, hpMult:1.6, blinkCapable:true },
  { key:'goblinMage',    name:'GOBLIN MAGO',      image:'assets/sprites/goblin_mage.png',    frameW:128, frameH:128, hpMult:2.2, blinkCapable:true },
  { key:'goblinWarrior', name:'GOBLIN GUERREIRO', image:'assets/sprites/goblin_warrior.png', frameW:128, frameH:128, hpMult:2.8, blinkCapable:true },
  { key:'goblinPriest',  name:'GOBLIN SACERDOTE', image:'assets/sprites/goblin_priest.png',  frameW:128, frameH:128, hpMult:3.6, blinkCapable:true },
  { key:'goblinMaster',  name:'GOBLIN MESTRE',    image:'assets/sprites/goblin_master.png',  frameW:128, frameH:128, hpMult:4.8, blinkCapable:true },
  { key:'goblinGreater', name:'GOBLIN MAIOR',     image:'assets/sprites/goblin_greater.png', frameW:128, frameH:128, hpMult:6.5, blinkCapable:true },
  // --- Mapa 3: Terras Selvagens (ciclo 7 em diante) ---
  { key:'orc',       name:'ORC',        image:'assets/sprites/orc.png',        frameW:128, frameH:128, blinkCapable:true },
  { key:'troll',     name:'TROLL',      image:'assets/sprites/troll.png',      frameW:128, frameH:128, blinkCapable:true },
  { key:'dragon',    name:'DRAGÃO',     image:'assets/sprites/dragon.png',     frameW:128, frameH:128, blinkCapable:true },
  { key:'demon',     name:'DEMÔNIO',    image:'assets/sprites/demon.png',      frameW:128, frameH:128, blinkCapable:true },
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
// `unlockRequirement` (opcional): quantas mortes a Dungeon indicada precisa
// ter pra esta desbloquear. Sem isso, a Dungeon já começa desbloqueada.
// `dropsItem` (opcional): se definido, monstros dessa Dungeon dão item em vez
// de ouro (ver MonsterModule.onDeath e ITEM_DEFS).
const MAPS = {
  // Cada posição do ciclo é normalmente 1 monstro só (string = chave em
  // MONSTER_TYPES). Posições de monstro DUPLO usam
  // `{ pairChoices:[[a,b], [c,d], ...] }`: ao chegar nessa posição, sorteia
  // UMA dessas duplas (ver MonsterModule.resolveSlot/pendingSlot) e os 2
  // monstros aparecem em sequência — matou o 1º, o 2º já spawna. `strong:true`
  // marca a dupla "mais forte" (posição 9 de cada ciclo, ganha hpMult extra —
  // ver MonsterModule.hpFor). A posição 10 é sempre o chefe (1 monstro só).
  slimes: {
    name: 'Dungeon do Pântano dos Slimes',
    dropsItem: 'slimeGel',
    cycles: {
      // Ciclo 1: só slime verde, do início ao fim.
      1: ['slime','slime','slime','slime',
          { pairChoices:[['slime','slime']] },
          'slime','slime','slime',
          { pairChoices:[['slime','slime']], strong:true },
          'slimeGreenWarrior'],
      // Ciclo 2: começa verde, o azul entra na posição 4 e domina o resto.
      2: ['slime','slime','slime',
          'slimeBlue',
          { pairChoices:[['slime','slime'], ['slime','slimeBlue']] },
          'slimeBlue','slimeBlue','slimeBlue',
          { pairChoices:[['slimeBlue','slimeBlue']], strong:true },
          'slimeBlueBarbarian'],
      // Ciclo 3: 3 cores — verde, depois azul, depois vermelho dominando o resto.
      3: ['slime','slime',
          'slimeBlue','slimeBlue',
          { pairChoices:[['slime','slime'], ['slime','slimeBlue']] },
          'slimeRed','slimeRed','slimeRed',
          { pairChoices:[['slimeRed','slimeRed']], strong:true },
          'slimeRedKing'],
      // Ciclo 4: mesmo padrão do Ciclo 3 (a dificuldade já sobe sozinha pelo
      // HP crescente por kill — não precisa de uma composição nova).
      4: ['slime','slime',
          'slimeBlue','slimeBlue',
          { pairChoices:[['slime','slime'], ['slime','slimeBlue']] },
          'slimeRed','slimeRed','slimeRed',
          { pairChoices:[['slimeRed','slimeRed']], strong:true },
          'slimeRedKing'],
      // Ciclo 5: só slime vermelho, do início ao fim (espelha o Ciclo 1).
      5: ['slimeRed','slimeRed','slimeRed','slimeRed',
          { pairChoices:[['slimeRed','slimeRed']] },
          'slimeRed','slimeRed','slimeRed',
          { pairChoices:[['slimeRed','slimeRed']], strong:true },
          'slimeRedKing'],
    }
  },
  goblins: {
    name: 'Dungeon do Reino Goblin',
    unlockRequirement: { dungeon:'slimes', kills:30 },
    cycles: {
      1: ['goblinGreen','goblinGreen','goblinRed','goblinGreen','goblinRed','goblinGreen','goblinRed','goblinGreen','goblinRed','goblinPriest'],
      2: ['goblinRed','goblinMage','goblinGreen','goblinRed','goblinWarrior','goblinRed','goblinMage','goblinWarrior','goblinRed','goblinMaster'],
      3: ['goblinWarrior','goblinPriest','goblinMage','goblinWarrior','goblinPriest','goblinMage','goblinWarrior','goblinPriest','goblinWarrior','goblinGreater'],
    }
  },
  wilds: {
    name: 'Dungeon das Terras Selvagens',
    unlockRequirement: { dungeon:'goblins', kills:30 },
    order: ['orc','troll','dragon','orc','troll','demon','orc','troll','dragon','demon']
  }
};

// Itens (drop alternativo ao ouro — ver campo `dropsItem` em MAPS). Simples
// por enquanto: sem raridade, só um preço fixo de venda na Loja da cidade.
const ITEM_DEFS = [
  { key:'slimeGel', name:'Geleia de Slime', icon:'item-slimegel', sellPrice:1 },
];

// Armas — a 1ª é escolhida de graça na conversa com o Clérigo (ver
// OnboardingModule); as outras duas ficam à venda no Ferreiro por
// `buyCost` ouro (ver UI.renderFerreiroWeapons). Todas dão o mesmo bônus
// fixo por enquanto (puramente cosmético qual o jogador tem); no futuro
// cada uma ganha propriedades próprias. `state.weapons[key]` é 0 ou 1.
const WEAPON_DEFS = [
  { key:'swordSimple', name:'Espada Simples', icon:'weapon-sword', clickDamageBonus:1, buyCost:500 },
  { key:'bowArrow',    name:'Arco e Flecha',  icon:'weapon-bow', clickDamageBonus:1, buyCost:500 },
  { key:'axe',         name:'Machado',        icon:'weapon-axe', clickDamageBonus:1, buyCost:500 },
];

// Missões dadas por NPCs da cidade (ver QuestModule) — entregar `itemQty`
// unidades de `itemKey` consome os itens do inventário e marca
// state.quests[key]=true (persistido, não computado, já que a entrega é uma
// ação irreversível). `unlocksBuilding` é o prédio liberado ao concluir.
const QUEST_DEFS = [
  { key:'slimeGelDelivery', npc:'Barnabé', itemKey:'slimeGel', itemQty:10, unlocksBuilding:'ferreiro' },
];

// Tropas (DPS) crescem de custo bem mais rápido que upgrades — elas não têm
// nível máximo (dá pra comprar infinitas), então o custo precisa subir rápido
// pra virar um sumidouro de ouro de longo prazo. Upgrades têm nível máximo,
// então crescem devagar (senão ficam inatingíveis antes do maxLevel).
const TROOP_DEFS = [
  { key:'recruit', name:'Recruta com Funda', desc:'+1 DPS', baseCost:150,   costGrowth:1.40, dps:1 },
  { key:'archer',  name:'Arqueiro',          desc:'+5 DPS', baseCost:800,   costGrowth:1.40, dps:5 },
  { key:'mage',    name:'Mago',              desc:'+20 DPS', baseCost:5000,  costGrowth:1.40, dps:20 },
  { key:'catapult',name:'Catapulta',         desc:'+100 DPS', baseCost:30000, costGrowth:1.40, dps:100 },
  { key:'dragon',  name:'Dragão Aliado',     desc:'+1000 DPS', baseCost:150000,costGrowth:1.45, dps:1000 },
];

// Caverna de Mineração: fonte de ouro passiva, separada da corrente de
// progressão principal — não desbloqueia por nível de upgrade/tropa, só por
// ouro mesmo. Mineradores não lutam, só rendem ouro/seg o tempo todo.
const MINER_DEFS = [
  { key:'digger',       name:'Escavador',          desc:'+2 ouro/seg',   baseCost:200,   costGrowth:1.30, goldPerSec:2 },
  { key:'pickaxeGoblin',name:'Goblin Picareta',    desc:'+10 ouro/seg',  baseCost:1500,  costGrowth:1.30, goldPerSec:10 },
  { key:'drillCart',    name:'Vagonete Perfurador',desc:'+50 ouro/seg',  baseCost:10000, costGrowth:1.30, goldPerSec:50 },
  { key:'crystalGolem', name:'Golem de Cristal',   desc:'+250 ouro/seg', baseCost:60000, costGrowth:1.35, goldPerSec:250 },
];

// Árvore de habilidades de BATALHA (Academia de Combate) — reformulada:
// 4 nós só, cada um com nível máximo 5, focados 100% em combate (sem ouro
// nem sinergia de DPS, que saíram da árvore por enquanto). Os dois primeiros
// bônus são flat (dano por clique fixo); os dois últimos são percentuais
// (multiplicam em cima do que já foi acumulado).
const UPGRADE_DEFS = [
  { key:'battleClickDmg',     name:'Fúria do Guerreiro', desc:'+5 dano por clique',        baseCost:20,    costGrowth:1.4, apply:s=>s.clickDamageFlat+=5,     maxLevel:5 },
  { key:'battleCritChance',   name:'Olho Certeiro',      desc:'+3% chance de crítico',      baseCost:300,   costGrowth:1.5, apply:s=>s.critChance=Math.min(0.75,s.critChance+0.03), maxLevel:5 },
  { key:'battleDmgPercent',   name:'Força Bruta',        desc:'+5% de dano por clique',     baseCost:3000,  costGrowth:1.6, apply:s=>s.clickDamagePercent+=0.05, maxLevel:5 },
  { key:'battleCritDmgPercent', name:'Golpe Devastador', desc:'+10% de dano crítico',       baseCost:30000, costGrowth:1.7, apply:s=>s.critDamagePercent+=0.10, maxLevel:5 },
];

// Corrente de progressão só entre upgrades agora — tropas (Guilda) não
// dependem mais disso, ficam liberadas só por ouro (ver TroopsModule/
// UI.renderTroopList). Cada upgrade só desbloqueia depois que o ANTERIOR
// atinge UNLOCK_REQUIREMENT níveis — como maxLevel também é 5 em todos,
// isso significa "maxar o anterior libera o próximo".
const UNLOCK_REQUIREMENT = 5;
const PROGRESSION_CHAIN = [
  { type:'upgrade', key:'battleClickDmg' },
  { type:'upgrade', key:'battleCritChance' },
  { type:'upgrade', key:'battleDmgPercent' },
  { type:'upgrade', key:'battleCritDmgPercent' },
];

// Layout visual da árvore de Upgrades (Academia de Combate) — círculo com 4
// ramificações partindo do hub central, uma pra cada direção cardeal.
// Puramente apresentacional — não afeta a lógica de desbloqueio (isso é
// sempre PROGRESSION_CHAIN). Pra adicionar um upgrade novo numa branch
// existente, só acrescente um item em `nodes` (mais afastado do hub); pra
// criar uma branch nova, copie o padrão.
const UPGRADE_TREE = {
  hub: { x:50, y:50 },
  branches: [
    { label:'Dano por Clique', color:'#e8974a', nodes:[
      { key:'battleClickDmg', x:50, y:15 },
    ]},
    { label:'Crítico', color:'#4fd1c5', nodes:[
      { key:'battleCritChance', x:83, y:50 },
    ]},
    { label:'Dano %', color:'#c9432f', nodes:[
      { key:'battleDmgPercent', x:50, y:85 },
    ]},
    { label:'Dano Crítico %', color:'#ffd54a', nodes:[
      { key:'battleCritDmgPercent', x:17, y:50 },
    ]},
  ]
};

const PRESTIGE_UPGRADE_DEFS = [
  { key:'pClick', name:'Bênção do Guerreiro', desc:'+15% dano por clique (permanente)', baseCost:1, costGrowth:1.8, apply:s=>s.pClickMult+=0.15 },
  { key:'pDps',   name:'Pacto das Tropas',    desc:'+15% DPS das tropas (permanente)', baseCost:1, costGrowth:1.8, apply:s=>s.pDpsMult+=0.15 },
  { key:'pGold',  name:'Toque de Midas',      desc:'+15% ouro dos monstros (permanente)', baseCost:1, costGrowth:1.8, apply:s=>s.pGoldMult+=0.15 },
  { key:'pCrit',  name:'Fúria Ancestral',     desc:'+5% chance de crítico (permanente)', baseCost:2, costGrowth:2.0, apply:s=>s.pCritChance+=0.05 },
];
