/* ---------------------------------------------------------------------
   PLAYER MODULE (player.js)
--------------------------------------------------------------------- */
const PlayerModule = {
  clickDamage(){
    // Sem base fixa: o personagem começa com 0 de dano por clique — só sobe
    // com upgrades ou a arma escolhida com o Clérigo (ver OnboardingModule).
    // clickDamagePercent (Academia de Combate) multiplica em cima do flat.
    const base = state.clickDamageFlat * (1+state.clickDamagePercent);
    return base * (1+state.pClickMult);
  },
  handleClick(evt){
    // captura o estado ANTES de aplicar dano: se esse clique também matar o
    // monstro, applyDamage já dispara o spawn do próximo (que reseta
    // isGolden/monsterMaxHp) antes da checagem do bônus dourado abaixo.
    const wasGolden = state.isGolden;
    const goldenType = MonsterModule.current && MonsterModule.current.type;

    let dmg = this.clickDamage();
    let isCrit = Math.random() < (state.critChance + state.pCritChance);
    // critDamagePercent (Academia de Combate) multiplica em cima do critMult
    if(isCrit) dmg *= state.critMult * (1+state.critDamagePercent);
    dmg = Math.max(1, Math.round(dmg));
    MonsterModule.applyDamage(dmg);
    UI.showFloatingDamage(dmg, isCrit, evt);
    UI.screenShake();
    UI.hitFlash();

    // Monstro Dourado: cada clique já rende um pouco do item PRINCIPAL
    // (a 1ª entrada de `drops`, sempre garantida) na hora, sem precisar
    // terminar de matá-lo dentro da janela dourada.
    if(wasGolden){
      const mainDrop = goldenType && goldenType.drops && goldenType.drops[0];
      if(mainDrop){
        const avgQty = (mainDrop.qtyMin + mainDrop.qtyMax) / 2;
        const qty = Math.max(1, Math.round(avgQty * 0.1));
        state.inventory[mainDrop.item] += qty;
        UI.showFloatingItemAt(qty, ITEM_DEFS.find(i=>i.key===mainDrop.item), evt);
      }
      UI.renderStats();
    }
  }
};
