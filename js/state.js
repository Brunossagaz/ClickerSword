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
    // troops owned — derivado de TROOP_DEFS, então tropa nova nunca fica de
    // fora daqui (era a causa do bug de "Nível: undefined" / "NaN" na loja)
    troops: Object.fromEntries(TROOP_DEFS.map(d => [d.key, 0])),
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
