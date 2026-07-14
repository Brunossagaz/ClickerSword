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
  canForge(def){
    if(state.gold < (def.recipe.coinCost||0)) return false;
    return def.recipe.materials.every(m => state.inventory[m.itemKey] >= m.qty);
  },
  forge(key){
    const def = FORGED_WEAPON_DEFS.find(w=>w.key===key);
    if(state.weapons[key] || !this.canForge(def)) return; // já forjada ou falta material
    state.gold -= (def.recipe.coinCost||0);
    for(const m of def.recipe.materials) state.inventory[m.itemKey] -= m.qty;
    state.weapons[key] = 1;
    SaveModule.save();
    UI.renderAll();
    UI.showToast('ARMA FORJADA', `${def.name} está pronta! Equipe-a no Inventário.`);
  }
};
