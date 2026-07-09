/* ---------------------------------------------------------------------
   PLAYER MODULE (player.js)
--------------------------------------------------------------------- */
const PlayerModule = {
  clickDamage(){
    const base = (1 + state.clickDamageFlat);
    return base * (1+state.pClickMult);
  },
  handleClick(evt){
    // captura o estado ANTES de aplicar dano: se esse clique também matar o
    // monstro, applyDamage já dispara o spawn do próximo (que reseta
    // isGolden/monsterMaxHp) antes da checagem do bônus dourado abaixo.
    const wasGolden = state.isGolden;
    const goldenMaxHp = state.monsterMaxHp;

    let dmg = this.clickDamage();
    let isCrit = Math.random() < (state.critChance + state.pCritChance);
    if(isCrit) dmg *= state.critMult;
    dmg = Math.max(1, Math.round(dmg));
    MonsterModule.applyDamage(dmg);
    UI.showFloatingDamage(dmg, isCrit, evt);
    UI.screenShake();
    UI.hitFlash();

    // Monstro Dourado: cada clique já rende ouro na hora, sem precisar
    // terminar de matá-lo dentro da janela dourada.
    if(wasGolden){
      const bonus = Math.max(1, Math.floor(goldenMaxHp * CONFIG.goldPerHpFactor * 0.02 * state.goldMult * (1+state.pGoldMult)));
      state.gold += bonus;
      state.goldEarnedThisRun += bonus;
      UI.showFloatingGoldAt(bonus, evt);
      UI.renderStats();
    }
  }
};
