/* ---------------------------------------------------------------------
   PLAYER MODULE (player.js)
--------------------------------------------------------------------- */
const PlayerModule = {
  clickDamage(){
    const base = (1 + state.clickDamageFlat);
    return base * (1+state.pClickMult);
  },
  handleClick(evt){
    let dmg = this.clickDamage();
    let isCrit = Math.random() < (state.critChance + state.pCritChance);
    if(isCrit) dmg *= state.critMult;
    dmg = Math.max(1, Math.round(dmg));
    MonsterModule.applyDamage(dmg);
    UI.showFloatingDamage(dmg, isCrit, evt);
    UI.screenShake();
    UI.hitFlash();
  }
};
