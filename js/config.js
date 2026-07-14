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
  { key:'slime',              name:'SLIME',               image:'assets/sprites/slime.png',              frameW:128, frameH:128, blinkCapable:true,
    drops:[ { item:'slimeGel', qtyMin:1, qtyMax:1 } ] },
  { key:'slimeBlue',          name:'SLIME AZUL',          image:'assets/sprites/slime_blue.png',          frameW:128, frameH:128, spriteScale:0.7, hpMult:1.5,  blinkCapable:true,
    drops:[ { item:'slimeGel', qtyMin:3, qtyMax:3 } ] },
  { key:'slimeGreenWarrior',  name:'SLIME VERDE GUERREIRO', image:'assets/sprites/slime_green_warrior.png', frameW:128, frameH:128, hpMult:2.25, blinkCapable:true,
    drops:[
      { item:'slimeGel', qtyMin:5, qtyMax:8 },
      { item:'slimeCompound', chance:0.75, qtyMin:1, qtyMax:1 },
      { item:'slimeSword', chance:0.30, qtyMin:1, qtyMax:1 },
    ] },
  { key:'slimeRed',           name:'SLIME VERMELHO',      image:'assets/sprites/slime_red.png',           frameW:128, frameH:128, hpMult:3.38, blinkCapable:true,
    drops:[ { item:'slimeGel', qtyMin:5, qtyMax:5 } ] },
  { key:'slimeBlueBarbarian', name:'SLIME AZUL BÁRBARO',  image:'assets/sprites/slime_blue_barbarian.png',frameW:128, frameH:128, hpMult:5.06, blinkCapable:true,
    drops:[
      { item:'slimeGel', qtyMin:10, qtyMax:14 },
      { item:'slimeCompound', chance:0.75, qtyMin:4, qtyMax:6 },
      { item:'slimeAxe', chance:0.30, qtyMin:1, qtyMax:1 },
    ] },
  { key:'slimeRedKing',       name:'SLIME REI VERMELHO',  image:'assets/sprites/slime_red_king.png',      frameW:128, frameH:128, hpMult:7.59, blinkCapable:true,
    drops:[
      { item:'slimeGel', qtyMin:8, qtyMax:8 },
      { item:'slimeCompound', chance:0.75, qtyMin:10, qtyMax:12 },
      { item:'slimeAxeGreater', chance:0.30, qtyMin:1, qtyMax:1 },
    ] },
  // --- Mapa 2: Reino Goblin (ciclos 4-6) ---
  { key:'goblinGreen',   name:'GOBLIN VERDE',     image:'assets/sprites/goblin_green.png',   frameW:128, frameH:128, blinkCapable:true,
    drops:[ { item:'goblinEar', qtyMin:1, qtyMax:1 } ] },
  { key:'goblinRed',     name:'GOBLIN VERMELHO',  image:'assets/sprites/goblin_red.png',     frameW:128, frameH:128, hpMult:1.6, blinkCapable:true,
    drops:[ { item:'goblinFang', qtyMin:2, qtyMax:2 } ] },
  { key:'goblinMage',    name:'GOBLIN MAGO',      image:'assets/sprites/goblin_mage.png',    frameW:128, frameH:128, hpMult:2.2, blinkCapable:true,
    drops:[ { item:'goblinShard', qtyMin:2, qtyMax:2 } ] },
  { key:'goblinWarrior', name:'GOBLIN GUERREIRO', image:'assets/sprites/goblin_warrior.png', frameW:128, frameH:128, hpMult:2.8, blinkCapable:true,
    drops:[ { item:'goblinScale', qtyMin:3, qtyMax:3 } ] },
  { key:'goblinPriest',  name:'GOBLIN SACERDOTE', image:'assets/sprites/goblin_priest.png',  frameW:128, frameH:128, hpMult:3.6, blinkCapable:true,
    drops:[ { item:'goblinAmulet', qtyMin:3, qtyMax:3 } ] },
  { key:'goblinMaster',  name:'GOBLIN MESTRE',    image:'assets/sprites/goblin_master.png',  frameW:128, frameH:128, hpMult:4.8, blinkCapable:true,
    drops:[ { item:'goblinSeal', qtyMin:4, qtyMax:4 } ] },
  { key:'goblinGreater', name:'GOBLIN MAIOR',     image:'assets/sprites/goblin_greater.png', frameW:128, frameH:128, hpMult:6.5, blinkCapable:true,
    drops:[ { item:'goblinCrown', qtyMin:5, qtyMax:5 } ] },
  // --- Mapa 3: Terras Selvagens (ciclo 7 em diante) ---
  { key:'orc',       name:'ORC',        image:'assets/sprites/orc.png',        frameW:128, frameH:128, blinkCapable:true,
    drops:[ { item:'orcTusk', qtyMin:2, qtyMax:2 } ] },
  { key:'troll',     name:'TROLL',      image:'assets/sprites/troll.png',      frameW:128, frameH:128, blinkCapable:true,
    drops:[ { item:'trollHide', qtyMin:2, qtyMax:2 } ] },
  { key:'dragon',    name:'DRAGÃO',     image:'assets/sprites/dragon.png',     frameW:128, frameH:128, blinkCapable:true,
    drops:[ { item:'dragonScale', qtyMin:3, qtyMax:3 } ] },
  { key:'demon',     name:'DEMÔNIO',    image:'assets/sprites/demon.png',      frameW:128, frameH:128, blinkCapable:true,
    drops:[ { item:'demonHorn', qtyMin:3, qtyMax:3 } ] },
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
// Recompensa é sempre item (nunca moeda direto) — cada MONSTER_TYPES define
// seus próprios `drops` (ver comentário acima e MonsterModule.onDeath).
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

// Itens (todo drop de monstro vira item — ver `drops` em MONSTER_TYPES).
// Preço fixo de venda na Loja da cidade. `type:'brokenWeapon'` (opcional):
// arma BRUTA — não é equipável direto (não é sistema de desgaste/
// durabilidade, é só a categoria do drop) — precisa ser forjada no
// Ferreiro (ver FORGED_WEAPON_DEFS/ForgeModule) pra virar uma arma de
// verdade, equipável em PlayerModule.equipWeapon.
const ITEM_DEFS = [
  // --- Dungeon do Pântano dos Slimes ---
  { key:'slimeGel',        name:'Geleia de Slime',        icon:'item-slimegel',        sellPrice:2 },
  { key:'slimeCompound',   name:'Composto de Slime',      icon:'item-slimecompound',   sellPrice:10 },
  { key:'slimeSword',      name:'Espada de Gosma (Bruta)',        icon:'item-slimesword',      sellPrice:30,  type:'brokenWeapon' },
  { key:'slimeAxe',        name:'Machado de Gosma (Bruto)',       icon:'item-slimeaxe',        sellPrice:100, type:'brokenWeapon' },
  { key:'slimeAxeGreater', name:'Machado de Gosma Maior (Bruto)', icon:'item-slimeaxegreater', sellPrice:300, type:'brokenWeapon' },
  // --- Dungeon do Reino Goblin ---
  { key:'goblinEar',    name:'Orelha de Goblin',           icon:'item-goblinear',    sellPrice:3 },
  { key:'goblinFang',   name:'Presa de Goblin Vermelho',   icon:'item-goblinfang',   sellPrice:5 },
  { key:'goblinShard',  name:'Fragmento Arcano Goblin',    icon:'item-goblinshard',  sellPrice:8 },
  { key:'goblinScale',  name:'Escama de Armadura Goblin',  icon:'item-goblinscale',  sellPrice:11 },
  { key:'goblinAmulet', name:'Amuleto Sagrado Goblin',     icon:'item-goblinamulet', sellPrice:15 },
  { key:'goblinSeal',   name:'Selo do Goblin Mestre',      icon:'item-goblinseal',   sellPrice:20 },
  { key:'goblinCrown',  name:'Coroa Menor Goblin',         icon:'item-goblincrown',  sellPrice:28 },
  // --- Dungeon das Terras Selvagens ---
  { key:'orcTusk',     name:'Presa de Orc',       icon:'item-orctusk',     sellPrice:40 },
  { key:'trollHide',   name:'Pele de Troll',      icon:'item-trollhide',   sellPrice:65 },
  { key:'dragonScale', name:'Escama de Dragão',   icon:'item-dragonscale', sellPrice:110 },
  { key:'demonHorn',   name:'Chifre de Demônio',  icon:'item-demonhorn',   sellPrice:180 },
  // --- Caverna (minérios) --- itens com `type:'mineral'` NÃO vêm de drop de
  // monstro: entram no inventário só pelo baú da Caverna (ver CavernModule.
  // collectChest). `rarity`/`weight` controlam o sorteio de qual minério cai
  // no baú a cada ponto de minério minerado (ver CavernModule.rollMineral) —
  // `weight` é o peso relativo, somam 100 só pra ler como "% de chance base"
  // (o upgrade Faro de Minérios reforça o peso de tudo que não é 'comum').
  { key:'ironOre',       name:'Minério de Ferro',    icon:'mineral-iron',    sellPrice:4,   type:'mineral', rarity:'comum',     weight:42 },
  { key:'bronzeChunk',   name:'Fragmento de Bronze', icon:'mineral-bronze',  sellPrice:7,   type:'mineral', rarity:'comum',     weight:33 },
  { key:'silverOre',     name:'Minério de Prata',    icon:'mineral-silver',  sellPrice:18,  type:'mineral', rarity:'incomum',   weight:16 },
  { key:'goldOre',       name:'Minério de Ouro',     icon:'mineral-gold',    sellPrice:45,  type:'mineral', rarity:'raro',      weight:7 },
  { key:'rawDiamond',    name:'Diamante Bruto',      icon:'mineral-diamond', sellPrice:150, type:'mineral', rarity:'epico',     weight:1.8 },
  { key:'arcaneCrystal', name:'Cristal Arcano',      icon:'mineral-crystal', sellPrice:500, type:'mineral', rarity:'lendario',  weight:0.2 },
];

// Raridade dos minérios (ver ITEM_DEFS acima) — só label + cor pra UI
// (badge no nome do item, bolinha no detalhamento do baú). `comum` fica de
// fora do boost do upgrade Faro de Minérios (ver CavernModule.rollMineral).
const RARITY_DEFS = {
  comum:    { label:'Comum',    color:'#b9b9b9' },
  incomum:  { label:'Incomum',  color:'#6fcf7f' },
  raro:     { label:'Raro',     color:'#4fa3e3' },
  epico:    { label:'Épico',    color:'#b06fe0' },
  lendario: { label:'Lendário', color:'#ffb84a' },
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
  { key:'apprentice',     name:'Aprendiz de Minerador', desc:'+0.1 minério/seg', baseCost:300,   costGrowth:1.30, orePerSec:0.1 },
  { key:'veteranMiner',   name:'Minerador Veterano',    desc:'+0.5 minério/seg', baseCost:2200,  costGrowth:1.30, orePerSec:0.5 },
  { key:'blaster',        name:'Explosivista',          desc:'+2 minério/seg',   baseCost:15000, costGrowth:1.32, orePerSec:2 },
  { key:'excavatorGolem', name:'Golem Escavador',       desc:'+8 minério/seg',   baseCost:90000, costGrowth:1.35, orePerSec:8 },
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
  { key:'oreRatePct', name:'Picareta Reforçada', desc:'+20% velocidade de mineração', baseCost:600, costGrowth:1.6, maxLevel:10 },
  { key:'oreLuck',    name:'Faro de Minérios',   desc:'+15% chance de minérios raros', baseCost:900, costGrowth:1.7, maxLevel:10 },
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

// Armas — a 1ª é escolhida de graça na conversa com o Clérigo (ver
// OnboardingModule); as outras duas ficam à venda no Ferreiro por
// `buyCost` moeda (ver UI.renderFerreiroWeapons). Todas dão o mesmo bônus
// fixo por enquanto (puramente cosmético qual o jogador tem); no futuro
// cada uma ganha propriedades próprias. `state.weapons[key]` é 0 ou 1.
const WEAPON_DEFS = [
  { key:'swordSimple', name:'Espada Simples', icon:'weapon-sword', clickDamageBonus:1, buyCost:500 },
  { key:'bowArrow',    name:'Arco e Flecha',  icon:'weapon-bow', clickDamageBonus:1, buyCost:500 },
  { key:'axe',         name:'Machado',        icon:'weapon-axe', clickDamageBonus:1, buyCost:500 },
];

// Armas FORJADAS — resultado de consertar uma arma bruta (ver ITEM_DEFS
// `type:'brokenWeapon'`) no Ferreiro (ver ForgeModule/js/forge.js).
// Compartilham o mesmo "pool" de posse de WEAPON_DEFS (state.weapons,
// 0/1 por chave — nunca duplicado, forjar de novo não faz nada se já
// possui) e o mesmo sistema de arma EQUIPADA (state.equippedWeapon, ver
// PlayerModule.equipWeapon) — só uma arma fica ativa por vez, seja ela
// inicial ou forjada. `dpsBonus` é novo: só armas forjadas dão DPS além
// de dano por clique (ver TroopsModule.totalDps). `recipe.materials` são
// chaves de ITEM_DEFS consumidas de state.inventory; `recipe.coinCost` é
// consumido de state.gold — tudo verificado em ForgeModule.canForge antes
// de deixar forjar.
const FORGED_WEAPON_DEFS = [
  { key:'slimeWarriorSword', name:'Espada do Guerreiro Slime', icon:'weapon-slimewarriorsword',
    clickDamageBonus:50, dpsBonus:20,
    recipe:{ coinCost:300, materials:[
      { itemKey:'slimeSword',    qty:3 },
      { itemKey:'slimeGel',      qty:30 },
      { itemKey:'ironOre',       qty:20 },
      { itemKey:'bronzeChunk',   qty:20 },
      { itemKey:'goldOre',       qty:5 },
    ] } },
  { key:'slimeWarriorAxe', name:'Machado do Guerreiro Slime', icon:'weapon-slimewarrioraxe',
    clickDamageBonus:150, dpsBonus:60,
    recipe:{ coinCost:900, materials:[
      { itemKey:'slimeAxe',      qty:3 },
      { itemKey:'slimeGel',      qty:90 },
      { itemKey:'ironOre',       qty:60 },
      { itemKey:'bronzeChunk',   qty:60 },
      { itemKey:'goldOre',       qty:15 },
      { itemKey:'rawDiamond',    qty:5 },
    ] } },
  { key:'slimeKingGreatAxe', name:'Machado Ancestral do Rei Slime', icon:'weapon-slimekinggreataxe',
    clickDamageBonus:400, dpsBonus:150,
    recipe:{ coinCost:2500, materials:[
      { itemKey:'slimeAxeGreater', qty:3 },
      { itemKey:'slimeGel',        qty:200 },
      { itemKey:'ironOre',         qty:150 },
      { itemKey:'bronzeChunk',     qty:150 },
      { itemKey:'goldOre',         qty:40 },
      { itemKey:'rawDiamond',      qty:15 },
      { itemKey:'arcaneCrystal',   qty:3 },
    ] } },
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
// pra virar um sumidouro de moeda de longo prazo. Upgrades têm nível máximo,
// então crescem devagar (senão ficam inatingíveis antes do maxLevel).
const TROOP_DEFS = [
  { key:'recruit', name:'Recruta com Funda', desc:'+1 DPS', baseCost:150,   costGrowth:1.40, dps:1 },
  { key:'archer',  name:'Arqueiro',          desc:'+5 DPS', baseCost:800,   costGrowth:1.40, dps:5 },
  { key:'mage',    name:'Mago',              desc:'+20 DPS', baseCost:5000,  costGrowth:1.40, dps:20 },
  { key:'catapult',name:'Catapulta',         desc:'+100 DPS', baseCost:30000, costGrowth:1.40, dps:100 },
  { key:'dragon',  name:'Dragão Aliado',     desc:'+1000 DPS', baseCost:150000,costGrowth:1.45, dps:1000 },
];

// Árvore de habilidades de BATALHA (Academia de Combate) — 3 níveis agora:
// Nível 0 = raiz ("Fúria do Guerreiro"); Nível 1 = os 3 upgrades que brotam
// dela (Olho Certeiro/Força Bruta/Golpe Devastador, todos com o MESMO
// baseCost=60, só o costGrowth de cada um difere); Nível 2 = 3 upgrades por
// ramo de Nível 1 (9 no total), custo moderado (baseCost=400). Cada upgrade
// só libera quando o `requires` dele alcança UNLOCK_REQUIREMENT níveis (ver
// ProgressionModule.isUnlocked) — como `requires` aponta pro PAI direto (não
// sempre a raiz), isso empilha em cadeia por ramo sem precisar de nenhuma
// lógica nova. Os ramos de Crítico e Dano % somam um pouco de dano por
// clique junto da própria stat nos upgrades de Nível 2 (pra reforçar a
// ligação com a raiz); o ramo de Dano Crítico % só reforça a própria stat.
const UNLOCK_REQUIREMENT = 5;
const UPGRADE_DEFS = [
  { key:'battleClickDmg',     name:'Fúria do Guerreiro', desc:'+5 dano por clique',        baseCost:10, costGrowth:1.3,  apply:s=>s.clickDamageFlat+=5,     maxLevel:5, requires:null },
  { key:'battleCritChance',   name:'Olho Certeiro',      desc:'+3% chance de crítico',      baseCost:60, costGrowth:1.35, apply:s=>s.critChance=Math.min(0.75,s.critChance+0.03), maxLevel:5, requires:'battleClickDmg' },
  { key:'battleDmgPercent',   name:'Força Bruta',        desc:'+5% de dano por clique',     baseCost:60, costGrowth:1.4,  apply:s=>s.clickDamagePercent+=0.05, maxLevel:5, requires:'battleClickDmg' },
  { key:'battleCritDmgPercent', name:'Golpe Devastador', desc:'+10% de dano crítico',       baseCost:60, costGrowth:1.45, apply:s=>s.critDamagePercent+=0.10, maxLevel:5, requires:'battleClickDmg' },

  // --- Nível 2 do ramo Crítico (requer Olho Certeiro nível 5) ---
  { key:'critChance2A', name:'Visão de Falcão',    desc:'+4% chance de crítico, +4 dano por clique', baseCost:400, costGrowth:1.5, maxLevel:5, requires:'battleCritChance',
    apply:s=>{ s.critChance=Math.min(0.75,s.critChance+0.04); s.clickDamageFlat+=4; } },
  { key:'critChance2B', name:'Reflexos Rápidos',   desc:'+6% chance de crítico, +2 dano por clique', baseCost:400, costGrowth:1.5, maxLevel:5, requires:'battleCritChance',
    apply:s=>{ s.critChance=Math.min(0.75,s.critChance+0.06); s.clickDamageFlat+=2; } },
  { key:'critChance2C', name:'Instinto Selvagem',  desc:'+2% chance de crítico, +7 dano por clique', baseCost:400, costGrowth:1.5, maxLevel:5, requires:'battleCritChance',
    apply:s=>{ s.critChance=Math.min(0.75,s.critChance+0.02); s.clickDamageFlat+=7; } },

  // --- Nível 2 do ramo Dano % (requer Força Bruta nível 5) ---
  { key:'dmgPercent2A', name:'Impacto Brutal',     desc:'+7% de dano por clique, +3 dano por clique', baseCost:400, costGrowth:1.5, maxLevel:5, requires:'battleDmgPercent',
    apply:s=>{ s.clickDamagePercent+=0.07; s.clickDamageFlat+=3; } },
  { key:'dmgPercent2B', name:'Força Titânica',     desc:'+10% de dano por clique, +1 dano por clique', baseCost:400, costGrowth:1.5, maxLevel:5, requires:'battleDmgPercent',
    apply:s=>{ s.clickDamagePercent+=0.10; s.clickDamageFlat+=1; } },
  { key:'dmgPercent2C', name:'Golpe Pesado',       desc:'+4% de dano por clique, +6 dano por clique', baseCost:400, costGrowth:1.5, maxLevel:5, requires:'battleDmgPercent',
    apply:s=>{ s.clickDamagePercent+=0.04; s.clickDamageFlat+=6; } },

  // --- Nível 2 do ramo Dano Crítico % (requer Golpe Devastador nível 5) —
  // só reforça a própria stat, sem somar dano por clique. ---
  { key:'critDmgPercent2A', name:'Fragmentação',    desc:'+12% de dano crítico', baseCost:400, costGrowth:1.5, maxLevel:5, requires:'battleCritDmgPercent',
    apply:s=>s.critDamagePercent+=0.12 },
  { key:'critDmgPercent2B', name:'Execução Brutal', desc:'+15% de dano crítico', baseCost:400, costGrowth:1.5, maxLevel:5, requires:'battleCritDmgPercent',
    apply:s=>s.critDamagePercent+=0.15 },
  { key:'critDmgPercent2C', name:'Golpe Fatal',     desc:'+18% de dano crítico', baseCost:400, costGrowth:1.5, maxLevel:5, requires:'battleCritDmgPercent',
    apply:s=>s.critDamagePercent+=0.18 },
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
  hub: { x:50, y:50 },
  branches: [
    { label:'Crítico', color:'#4fd1c5', nodes:[
      { key:'battleCritChance', x:50, y:15 },
    ], children:[
      { key:'critChance2A', x:35, y:-17 },
      { key:'critChance2B', x:50, y:-20 },
      { key:'critChance2C', x:65, y:-17 },
    ]},
    { label:'Dano %', color:'#c9432f', nodes:[
      { key:'battleDmgPercent', x:81, y:80 },
    ], children:[
      { key:'dmgPercent2A', x:114, y:91 },
      { key:'dmgPercent2B', x:106, y:104 },
      { key:'dmgPercent2C', x:94, y:113 },
    ]},
    { label:'Dano Crítico %', color:'#ffd54a', nodes:[
      { key:'battleCritDmgPercent', x:19, y:80 },
    ], children:[
      { key:'critDmgPercent2A', x:6, y:113 },
      { key:'critDmgPercent2B', x:-6, y:104 },
      { key:'critDmgPercent2C', x:-14, y:91 },
    ]},
  ]
};

const PRESTIGE_UPGRADE_DEFS = [
  { key:'pClick', name:'Bênção do Guerreiro', desc:'+15% dano por clique (permanente)', baseCost:1, costGrowth:1.8, apply:s=>s.pClickMult+=0.15 },
  { key:'pDps',   name:'Pacto das Tropas',    desc:'+15% DPS das tropas (permanente)', baseCost:1, costGrowth:1.8, apply:s=>s.pDpsMult+=0.15 },
  { key:'pOreRate', name:'Toque de Midas',    desc:'+15% velocidade de mineração de minério (permanente)', baseCost:1, costGrowth:1.8, apply:s=>s.pOreRateMult+=0.15 },
  { key:'pCrit',  name:'Fúria Ancestral',     desc:'+5% chance de crítico (permanente)', baseCost:2, costGrowth:2.0, apply:s=>s.pCritChance+=0.05 },
];
