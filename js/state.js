/* ---------------------------------------------------------------------
   STATE
--------------------------------------------------------------------- */
function freshState(){
  return {
    gold:0,
    essence:0,
    // run progress
    killCount:0,
    totalKillsAll:0,
    loop:1, // "ciclo" — how many times we've cycled through all monster tiers
    monsterHp:0,
    monsterMaxHp:0,
    monsterSpawnedAt:0,
    isBoss:false,
    isGolden:false,
    goldenExpiresAt:0,
    // player combat
    clickDamageFlat:1,
    critChance:0,
    critMult:2,
    goldMult:1,
    // troops owned
    troops:{ recruit:0, archer:0, mage:0, catapult:0, dragon:0 },
    // upgrades owned (levels)
    upgrades:{ clickDmg1:0, clickDmg2:0, critChance:0, critMult:0, goldFind:0 },
    // prestige permanent upgrades
    prestige:{ pClick:0, pDps:0, pGold:0, pCrit:0 },
    pClickMult:0, pDpsMult:0, pGoldMult:0, pCritChance:0,
    // meta
    goldEarnedThisRun:0,
    lastSave:Date.now()
  };
}
let state = freshState();
