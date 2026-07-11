/* ---------------------------------------------------------------------
   PROGRESSION MODULE (progression.js)
   Controla o desbloqueio dos upgrades da Academia de Combate: cada um
   declara seu próprio pré-requisito via `requires` (ver UPGRADE_DEFS em
   config.js) — hoje isso forma uma "árvore em estrela" com uma raiz
   ('battleClickDmg', sem `requires`) e os demais brotando direto dela, mas
   nada impede um upgrade futuro exigir outro que não seja a raiz. Tropas
   (Guilda) não têm mais pré-requisito, só ouro (ver TroopsModule) —
   isUnlocked('troop', ...) sempre retorna true.
--------------------------------------------------------------------- */
const ProgressionModule = {
  isUnlocked(type, key){
    if(type !== 'upgrade') return true;
    const def = UPGRADE_DEFS.find(u=>u.key===key);
    if(!def.requires) return true; // raiz da árvore
    return state.upgrades[def.requires] >= UNLOCK_REQUIREMENT;
  },
  lockLabel(type, key){
    if(type !== 'upgrade') return '';
    const def = UPGRADE_DEFS.find(u=>u.key===key);
    if(!def || !def.requires) return '';
    const reqDef = UPGRADE_DEFS.find(u=>u.key===def.requires);
    return `Requer ${reqDef.name} nível ${UNLOCK_REQUIREMENT}`;
  }
};
