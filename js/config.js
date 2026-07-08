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
  ascendKillThreshold: 60,  // min kills this run to ascend
  monsterTimeLimitMs: 15000 // tempo pra derrotar cada monstro antes de reiniciar o ciclo
};

// Ordem fixa dos monstros dentro de cada ciclo de CONFIG.cycleLength (10).
// A posição 10 (índice 9) é sempre o chefe do ciclo (HP/recompensa multiplicados).
const CYCLE_MONSTER_ORDER = [
  'slime', 'goblin', 'slimeBlue', 'orc', 'troll',
  'dragon', 'demon', 'goblin', 'orc', 'demon'
];

// Todo monstro é um spritesheet PNG (3 frames de 128x128: idle, piscando,
// flash de dano) gerado por tools/gen_sprites.py. Para mudar a arte de um
// monstro, edite o gerador Python e rode `python tools/gen_sprites.py` de
// novo — não precisa mexer neste arquivo nem em sprites.js.
const MONSTER_TYPES = [
  { key:'slime',     name:'SLIME',      image:'assets/sprites/slime.png',      frameW:128, frameH:128, blinkCapable:true },
  { key:'slimeBlue', name:'SLIME AZUL', image:'assets/sprites/slime_blue.png', frameW:128, frameH:128, spriteScale:0.7, hpMult:1.8, blinkCapable:true },
  { key:'goblin',    name:'GOBLIN',     image:'assets/sprites/goblin.png',     frameW:128, frameH:128, blinkCapable:true },
  { key:'orc',       name:'ORC',        image:'assets/sprites/orc.png',        frameW:128, frameH:128, blinkCapable:true },
  { key:'troll',     name:'TROLL',      image:'assets/sprites/troll.png',      frameW:128, frameH:128, blinkCapable:true },
  { key:'dragon',    name:'DRAGÃO',     image:'assets/sprites/dragon.png',     frameW:128, frameH:128, blinkCapable:true },
  { key:'demon',     name:'DEMÔNIO',    image:'assets/sprites/demon.png',      frameW:128, frameH:128, blinkCapable:true },
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

const UPGRADE_DEFS = [
  { key:'clickDmg1', name:'Lâmina Afiada',   desc:'+1 dano por clique', baseCost:15,   costGrowth:1.15, apply:s=>s.clickDamageFlat+=1, maxLevel:20 },
  { key:'clickDmg2', name:'Punho de Ferro',  desc:'+5 dano por clique', baseCost:300,  costGrowth:1.15, apply:s=>s.clickDamageFlat+=5, maxLevel:20 },
  { key:'critChance',name:'Olho Certeiro',   desc:'+3% chance de crítico', baseCost:600,  costGrowth:1.15, apply:s=>s.critChance=Math.min(0.75,s.critChance+0.03), maxLevel:15 },
  { key:'critMult',  name:'Golpe Mortal',    desc:'+0.5x multiplicador de crítico', baseCost:2000, costGrowth:1.15, apply:s=>s.critMult+=0.5, maxLevel:12 },
  { key:'goldFind',  name:'Bolsa Encantada', desc:'+10% de ouro dos monstros', baseCost:6000, costGrowth:1.15, apply:s=>s.goldMult+=0.10, maxLevel:20 },
];

// Corrente única de progressão (upgrades + tropas intercalados). Cada item só
// desbloqueia depois que o ANTERIOR na corrente atinge UNLOCK_REQUIREMENT
// níveis (upgrade) ou unidades compradas (tropa). Como a 3ª upgrade
// (critChance) só desbloqueia depois que as 2 primeiras já passaram desse
// nível, "recruit" (a 1ª tropa) só fica disponível depois de 3 upgrades
// conquistados — exatamente a regra pedida.
const UNLOCK_REQUIREMENT = 5;
const PROGRESSION_CHAIN = [
  { type:'upgrade', key:'clickDmg1' },
  { type:'upgrade', key:'clickDmg2' },
  { type:'upgrade', key:'critChance' },
  { type:'troop',   key:'recruit' },
  { type:'upgrade', key:'critMult' },
  { type:'troop',   key:'archer' },
  { type:'upgrade', key:'goldFind' },
  { type:'troop',   key:'mage' },
  { type:'troop',   key:'catapult' },
  { type:'troop',   key:'dragon' },
];

const PRESTIGE_UPGRADE_DEFS = [
  { key:'pClick', name:'Bênção do Guerreiro', desc:'+15% dano por clique (permanente)', baseCost:1, costGrowth:1.8, apply:s=>s.pClickMult+=0.15 },
  { key:'pDps',   name:'Pacto das Tropas',    desc:'+15% DPS das tropas (permanente)', baseCost:1, costGrowth:1.8, apply:s=>s.pDpsMult+=0.15 },
  { key:'pGold',  name:'Toque de Midas',      desc:'+15% ouro dos monstros (permanente)', baseCost:1, costGrowth:1.8, apply:s=>s.pGoldMult+=0.15 },
  { key:'pCrit',  name:'Fúria Ancestral',     desc:'+5% chance de crítico (permanente)', baseCost:2, costGrowth:2.0, apply:s=>s.pCritChance+=0.05 },
];
