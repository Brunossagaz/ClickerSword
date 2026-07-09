/* ---------------------------------------------------------------------
   CONFIG
--------------------------------------------------------------------- */
const CONFIG = {
  saveKey: 'monsterAttackClickerSave',
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
const MONSTER_TYPES = [
  // --- Mapa 1: Pântano dos Slimes (ciclos 1-3) ---
  { key:'slime',              name:'SLIME',               image:'assets/sprites/slime.png',              frameW:128, frameH:128, blinkCapable:true },
  { key:'slimeBlue',          name:'SLIME AZUL',          image:'assets/sprites/slime_blue.png',          frameW:128, frameH:128, spriteScale:0.7, hpMult:1.8, blinkCapable:true },
  { key:'slimeGreenWarrior',  name:'SLIME VERDE GUERREIRO', image:'assets/sprites/slime_green_warrior.png', frameW:128, frameH:128, hpMult:2.4, blinkCapable:true },
  { key:'slimeRed',           name:'SLIME VERMELHO',      image:'assets/sprites/slime_red.png',           frameW:128, frameH:128, hpMult:3.2, blinkCapable:true },
  { key:'slimeBlueBarbarian', name:'SLIME AZUL BÁRBARO',  image:'assets/sprites/slime_blue_barbarian.png',frameW:128, frameH:128, hpMult:4.2, blinkCapable:true },
  { key:'slimeRedKing',       name:'SLIME REI VERMELHO',  image:'assets/sprites/slime_red_king.png',      frameW:128, frameH:128, hpMult:6.0, blinkCapable:true },
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
// entrar na tela da cidade (ver DungeonModule). Cada ciclo (CONFIG.cycleLength
// monstros) usa a ordem de `cycles[cicloLocal]`; o 10º monstro do ciclo
// (índice 9) é sempre o chefe (ver MonsterModule.spawn). Dungeons sem
// `cycles` definidos (ex: wilds) usam `order` e repetem pra sempre.
//
// `unlockRequirement` (opcional): quantas mortes a Dungeon indicada precisa
// ter pra esta desbloquear. Sem isso, a Dungeon já começa desbloqueada.
// `dropsItem` (opcional): se definido, monstros dessa Dungeon dão item em vez
// de ouro (ver MonsterModule.onDeath e ITEM_DEFS).
const MAPS = {
  slimes: {
    name: 'Dungeon do Pântano dos Slimes',
    dropsItem: 'slimeGel',
    cycles: {
      1: ['slime','slime','slimeBlue','slime','slimeBlue','slime','slimeBlue','slime','slimeBlue','slimeGreenWarrior'],
      2: ['slimeBlue','slimeRed','slime','slimeBlue','slimeRed','slimeBlue','slimeRed','slimeBlue','slimeRed','slimeBlueBarbarian'],
      3: ['slimeRed','slimeBlueBarbarian','slimeRed','slimeGreenWarrior','slimeRed','slimeBlueBarbarian','slimeRed','slimeGreenWarrior','slimeRed','slimeRedKing'],
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
  { key:'slimeGel', name:'Geleia de Slime', icon:'🧪', sellPrice:8 },
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

// Ordem aqui é só organizacional — quem manda na ordem de exibição da loja é
// a PROGRESSION_CHAIN (ver abaixo). Mesmo assim, mantenha as duas em sincronia
// pra não confundir quem estiver lendo o arquivo.
const UPGRADE_DEFS = [
  { key:'clickDmg1', name:'Lâmina Afiada',      desc:'+1 dano por clique',    baseCost:15,      costGrowth:1.15, apply:s=>s.clickDamageFlat+=1,    maxLevel:20 },
  { key:'clickDmg2', name:'Punho de Ferro',     desc:'+5 dano por clique',    baseCost:300,     costGrowth:1.15, apply:s=>s.clickDamageFlat+=5,    maxLevel:20 },
  { key:'critChance',name:'Olho Certeiro',      desc:'+3% chance de crítico', baseCost:600,     costGrowth:1.15, apply:s=>s.critChance=Math.min(0.75,s.critChance+0.03), maxLevel:15 },
  { key:'clickDmg3', name:'Fúria Berserker',    desc:'+25 dano por clique',   baseCost:20000,   costGrowth:1.15, apply:s=>s.clickDamageFlat+=25,   maxLevel:20 },
  { key:'critMult',  name:'Golpe Mortal',       desc:'+0.5x multiplicador de crítico', baseCost:2000, costGrowth:1.15, apply:s=>s.critMult+=0.5, maxLevel:12 },
  { key:'clickDmg4', name:'Lâmina Encantada',   desc:'+150 dano por clique',  baseCost:80000,   costGrowth:1.15, apply:s=>s.clickDamageFlat+=150,  maxLevel:20 },
  { key:'goldFind',  name:'Bolsa Encantada',    desc:'+10% de ouro dos monstros', baseCost:6000, costGrowth:1.15, apply:s=>s.goldMult+=0.10, maxLevel:20 },
  { key:'clickDmg5', name:'Punho Divino',       desc:'+1000 dano por clique', baseCost:400000,  costGrowth:1.15, apply:s=>s.clickDamageFlat+=1000, maxLevel:20 },
  { key:'clickDmg6', name:'Fúria do Caos',      desc:'+6000 dano por clique', baseCost:2000000, costGrowth:1.15, apply:s=>s.clickDamageFlat+=6000, maxLevel:20 },
  // Sinergia: converte uma fração do dano por clique em DPS extra (somado
  // depois do multiplicador de tropas). Bônus moderado — até 40% no nível
  // máximo (20 níveis x 2%), pra não substituir tropas/mineração como fonte
  // principal de DPS, só complementar quem investiu em dano por clique.
  { key:'dpsSynergy',name:'Ressonância de Combate', desc:'DPS ganha +2% do dano por clique', baseCost:8000000, costGrowth:1.18, apply:s=>s.dpsSynergyRatio+=0.02, maxLevel:20 },
];

// Corrente única de progressão (upgrades + tropas intercalados). Cada item só
// desbloqueia depois que o ANTERIOR na corrente atinge UNLOCK_REQUIREMENT
// níveis (upgrade) ou unidades compradas (tropa). Como a 3ª upgrade
// (critChance) só desbloqueia depois que as 2 primeiras já passaram desse
// nível, "recruit" (a 1ª tropa) só fica disponível depois de 3 upgrades
// conquistados — exatamente a regra pedida. Os tiers extras de dano por
// clique (clickDmg3-6) ficam intercalados mais adiante na corrente.
const UNLOCK_REQUIREMENT = 5;
const PROGRESSION_CHAIN = [
  { type:'upgrade', key:'clickDmg1' },
  { type:'upgrade', key:'clickDmg2' },
  { type:'upgrade', key:'critChance' },
  { type:'troop',   key:'recruit' },
  { type:'upgrade', key:'clickDmg3' },
  { type:'upgrade', key:'critMult' },
  { type:'troop',   key:'archer' },
  { type:'upgrade', key:'clickDmg4' },
  { type:'upgrade', key:'goldFind' },
  { type:'troop',   key:'mage' },
  { type:'upgrade', key:'clickDmg5' },
  { type:'troop',   key:'catapult' },
  { type:'upgrade', key:'clickDmg6' },
  { type:'troop',   key:'dragon' },
  { type:'upgrade', key:'dpsSynergy' },
];

// Layout visual da árvore de Upgrades (aba "UPGRADES"). Puramente
// apresentacional — não afeta a lógica de desbloqueio (isso é sempre
// PROGRESSION_CHAIN). hub = círculo central; cada branch é uma lista
// ordenada de nós (do centro pra fora) com posição em % do container
// .tree-wrap. Pra adicionar um upgrade novo numa branch existente, só
// acrescente um item em `nodes`; pra criar uma branch nova, copie o padrão.
const UPGRADE_TREE = {
  hub: { x:50, y:52 },
  branches: [
    { label:'Dano por Clique', color:'#e8974a', nodes:[
      { key:'clickDmg1',  x:50,   y:42 },
      { key:'clickDmg2',  x:37,   y:35.7 },
      { key:'clickDmg3',  x:63,   y:29.3 },
      { key:'clickDmg4',  x:37,   y:23 },
      { key:'clickDmg5',  x:63,   y:16.7 },
      { key:'clickDmg6',  x:37,   y:10.3 },
      { key:'dpsSynergy', x:63,   y:4 },
    ]},
    { label:'Crítico', color:'#4fd1c5', nodes:[
      { key:'critChance', x:80, y:52 },
    ]},
    { label:'Dano Crítico', color:'#c9432f', nodes:[
      { key:'critMult', x:50, y:84 },
    ]},
    { label:'Ouro', color:'#ffd54a', nodes:[
      { key:'goldFind', x:20, y:52 },
    ]},
  ]
};

const PRESTIGE_UPGRADE_DEFS = [
  { key:'pClick', name:'Bênção do Guerreiro', desc:'+15% dano por clique (permanente)', baseCost:1, costGrowth:1.8, apply:s=>s.pClickMult+=0.15 },
  { key:'pDps',   name:'Pacto das Tropas',    desc:'+15% DPS das tropas (permanente)', baseCost:1, costGrowth:1.8, apply:s=>s.pDpsMult+=0.15 },
  { key:'pGold',  name:'Toque de Midas',      desc:'+15% ouro dos monstros (permanente)', baseCost:1, costGrowth:1.8, apply:s=>s.pGoldMult+=0.15 },
  { key:'pCrit',  name:'Fúria Ancestral',     desc:'+5% chance de crítico (permanente)', baseCost:2, costGrowth:2.0, apply:s=>s.pCritChance+=0.05 },
];
