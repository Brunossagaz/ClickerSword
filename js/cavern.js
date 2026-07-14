/* ---------------------------------------------------------------------
   CAVERN MODULE (cavern.js)
   Mineração de MINÉRIO da Caverna — única fonte de conteúdo da Caverna hoje
   (o antigo minerador passivo de moeda foi removido: moeda agora vem de
   vender itens/minério na Loja). Mineradores (PROSPECTOR_DEFS) não produzem
   um minério fixo: eles rendem "pontos de minério" (state.oreProgress) e,
   a cada ponto inteiro, um minério é
   sorteado por raridade (ver rollMineral) e cai no baú (state.cavernChest).
   O jogador precisa clicar no baú (ver collectChest) pra transferir tudo
   pra mochila (state.inventory) — só aí o minério fica disponível pra
   vender na Loja ou entregar em missões.
--------------------------------------------------------------------- */
const CavernModule = {
  costForProspector(def){
    const owned = state.prospectors[def.key];
    return Math.ceil(def.baseCost * Math.pow(def.costGrowth, owned));
  },
  buyProspector(key){
    const def = PROSPECTOR_DEFS.find(p=>p.key===key);
    const cost = this.costForProspector(def);
    if(state.gold >= cost){
      state.gold -= cost;
      state.prospectors[key] += 1;
      UI.renderAll();
    }
  },
  costForUpgrade(def){
    const lvl = state.cavernUpgrades[def.key];
    return Math.ceil(def.baseCost * Math.pow(def.costGrowth, lvl));
  },
  buyUpgrade(key){
    const def = CAVERN_UPGRADE_DEFS.find(u=>u.key===key);
    const lvl = state.cavernUpgrades[key];
    if(lvl >= def.maxLevel) return;
    const cost = this.costForUpgrade(def);
    if(state.gold >= cost){
      state.gold -= cost;
      state.cavernUpgrades[key] += 1;
      UI.renderAll();
    }
  },
  // Soma de orePerSec de todos os mineradores possuídos, multiplicada pelo
  // bônus de Picareta Reforçada (+20%/nível, ver CAVERN_UPGRADE_DEFS) e pelo
  // de Toque de Midas (+15%/nível, permanente entre ascensões — ver
  // PRESTIGE_UPGRADE_DEFS/state.pOreRateMult).
  totalOrePerSecond(){
    let total = 0;
    for(const def of PROSPECTOR_DEFS) total += def.orePerSec * state.prospectors[def.key];
    total *= (1 + state.cavernUpgrades.oreRatePct * 0.20);
    total *= (1 + state.pOreRateMult);
    return total;
  },
  // Sorteio ponderado por raridade — Faro de Minérios reforça o peso de
  // tudo que não é 'comum' (+15% por nível), então raro/épico/lendário
  // ficam relativamente mais prováveis sem nunca ultrapassar comum/incomum.
  rollMineral(){
    const luck = state.cavernUpgrades.oreLuck * 0.15;
    const weights = MINERAL_DEFS.map(d => d.rarity === 'comum' ? d.weight : d.weight * (1+luck));
    const totalWeight = weights.reduce((a,b)=>a+b, 0);
    let r = Math.random() * totalWeight;
    for(let i=0; i<MINERAL_DEFS.length; i++){
      r -= weights[i];
      if(r <= 0) return MINERAL_DEFS[i].key;
    }
    return MINERAL_DEFS[MINERAL_DEFS.length-1].key;
  },
  // `amount` é fracionário (taxa*segundos) — só sorteia minério a cada
  // unidade INTEIRA acumulada, o resto fica guardado pra próxima chamada
  // (ver state.oreProgress).
  mineOreAmount(amount){
    state.oreProgress += amount;
    while(state.oreProgress >= 1){
      state.oreProgress -= 1;
      const key = this.rollMineral();
      state.cavernChest[key] += 1;
    }
  },
  tick(dtSeconds){
    const rate = this.totalOrePerSecond();
    if(rate > 0) this.mineOreAmount(rate * dtSeconds);
  },
  chestTotal(){
    return MINERAL_DEFS.reduce((sum, d) => sum + state.cavernChest[d.key], 0);
  },
  collectChest(){
    let collected = 0;
    for(const def of MINERAL_DEFS){
      const qty = state.cavernChest[def.key];
      if(qty > 0){
        state.inventory[def.key] += qty;
        state.cavernChest[def.key] = 0;
        collected += qty;
      }
    }
    if(collected > 0){
      SaveModule.save();
      UI.renderAll();
      UI.showToast('BAÚ COLETADO', `${collected} minério(s) transferido(s) para a mochila.`);
    }
  }
};
