/* ---------------------------------------------------------------------
   FORGE MODULE (forge.js)
   Conserto de armas BRUTAS (ver ITEM_DEFS type:'brokenWeapon') no
   Ferreiro — consome materiais de state.inventory + moeda de state.gold
   e destrava uma arma nova em state.weapons (ver FORGED_WEAPON_DEFS em
   config.js pelas receitas). A arma forjada não fica equipada
   automaticamente — o jogador escolhe no Inventário (ver
   PlayerModule.equipWeapon).
--------------------------------------------------------------------- */
const ForgeModule = {
  // forja em ordem: a arma anterior da linha precisa ter sido forjada antes
  // (FORGED_WEAPON_DEFS.requiresWeapon) — sem isso dava pra pular pro
  // Machado Ancestral antes do Machado
  prerequisiteMissing(def){
    return def.requiresWeapon && !state.weapons[def.requiresWeapon]
      ? FORGED_WEAPON_DEFS.find(w => w.key === def.requiresWeapon) : null;
  },
  canForge(def){
    if(this.prerequisiteMissing(def)) return false;
    if(state.gold < (def.recipe.coinCost||0)) return false;
    return def.recipe.materials.every(m => state.inventory[m.itemKey] >= m.qty);
  },
  forge(key){
    const def = FORGED_WEAPON_DEFS.find(w=>w.key===key);
    if(state.weapons[key] || !this.canForge(def)) return; // já forjada ou falta material
    state.gold -= (def.recipe.coinCost||0);
    for(const m of def.recipe.materials) state.inventory[m.itemKey] -= m.qty;
    state.weapons[key] = 1;
    AchievementsModule.checkAll();
    SaveModule.save();
    UI.renderAll();
    UI.showToast('ARMA FORJADA', `${def.name} está pronta! Equipe-a no Inventário.`);
  }
};
