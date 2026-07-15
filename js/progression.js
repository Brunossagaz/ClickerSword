/* ---------------------------------------------------------------------
   PROGRESSION MODULE (progression.js)
   Controla o desbloqueio dos upgrades da Academia de Combate: cada um
   declara seu próprio pré-requisito via `requires` (ver UPGRADE_DEFS em
   config.js) — hoje isso forma uma "árvore em estrela" com uma raiz
   ('battleClickDmg', sem `requires`) e os demais brotando direto dela, mas
   nada impede um upgrade futuro exigir outro que não seja a raiz (ex.:
   autoClickSpeed2 exige autoClickSpeed1, não a raiz). O limiar de
   desbloqueio é o `maxLevel` do PRÉ-REQUISITO (não um número fixo) — assim
   funciona tanto pros ramos de 5 níveis quanto pros de 1 nível só (Clique
   Automático e seus upgrades de velocidade). Tropas (Guilda) não têm mais
   pré-requisito, só moeda (ver TroopsModule) — isUnlocked('troop', ...)
   sempre retorna true.
--------------------------------------------------------------------- */
const ProgressionModule = {
  isUnlocked(type, key){
    if(type !== 'upgrade') return true;
    const def = UPGRADE_DEFS.find(u=>u.key===key);
    if(!def.requires) return true; // raiz da árvore
    const reqDef = UPGRADE_DEFS.find(u=>u.key===def.requires);
    return state.upgrades[def.requires] >= reqDef.maxLevel;
  },
  lockLabel(type, key){
    if(type !== 'upgrade') return '';
    const def = UPGRADE_DEFS.find(u=>u.key===key);
    if(!def || !def.requires) return '';
    const reqDef = UPGRADE_DEFS.find(u=>u.key===def.requires);
    return `Requer ${reqDef.name} nível ${reqDef.maxLevel}`;
  }
};
