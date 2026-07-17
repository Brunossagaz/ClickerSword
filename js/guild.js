/* ---------------------------------------------------------------------
   GUILD MODULE (guild.js)
   Expedições da Guilda: manda as tropas já compradas (ver TROOP_DEFS/
   TroopsModule) coletarem material de dungeon sozinhas por uma duração fixa
   (ver GUILD_EXPEDITION_DEFS em config.js), online ou offline — resolve
   sozinha assim que o tempo passa (ver resolveIfDone, chamado no tick do
   jogo em main.js e ao carregar um save em mainmenu.js), sem precisar de
   nenhum passo extra de "coletar baú" (mesmo espírito de
   SaveModule.computeOfflineEarnings, mas com um alvo de tempo escolhido pelo
   jogador em vez de correr sempre). Só 1 expedição por vez (ver state.guild).
--------------------------------------------------------------------- */
const GuildModule = {
  expeditionDef(key){
    return GUILD_EXPEDITION_DEFS.find(d => d.key === key);
  },
  // Soma de dps*quantidade só das TROOP_DEFS — de propósito SEM o bônus de
  // arma equipada nem o multiplicador de prestígio (ver TroopsModule.totalDps):
  // aqui é "poder de tropa" pra logística da Guilda, não dano de combate.
  troopPower(){
    let total = 0;
    for(const def of TROOP_DEFS) total += def.dps * state.troops[def.key];
    return total;
  },
  // Só materiais (nunca minério/arma bruta) de Dungeon já desbloqueada — ver
  // DungeonModule.isUnlocked e o campo `dungeon` em ITEM_DEFS.
  availableMaterials(){
    return ITEM_DEFS.filter(d => d.type === 'material' && DungeonModule.isUnlocked(d.dungeon));
  },
  totalItemsFor(cycleKey){
    const def = this.expeditionDef(cycleKey);
    return Math.round(CONFIG.guildItemsPerHourPerPower * this.troopPower() * def.hours * def.rateMult);
  },
  canStart(cycleKey){
    return OnboardingModule.isBuildingUnlocked('guilda')
      && !state.guild.active
      && this.troopPower() > 0
      && !!this.expeditionDef(cycleKey);
  },
  start(cycleKey){
    if(!this.canStart(cycleKey)) return;
    const def = this.expeditionDef(cycleKey);
    state.guild = { active:true, cycleKey, startedAt:Date.now(), durationMs: def.hours*3600*1000 };
    SaveModule.save();
    UI.renderAll();
  },
  // Sorteio ponderado por `weight` entre os materiais disponíveis — mesmo
  // padrão de CavernModule.rollMineral.
  rollMaterial(){
    const pool = this.availableMaterials();
    const totalWeight = pool.reduce((sum, d) => sum + d.weight, 0);
    let r = Math.random() * totalWeight;
    for(const d of pool){
      r -= d.weight;
      if(r <= 0) return d.key;
    }
    return pool[pool.length-1].key;
  },
  remainingMs(){
    if(!state.guild.active) return 0;
    return Math.max(0, (state.guild.startedAt + state.guild.durationMs) - Date.now());
  },
  remainingLabel(){
    const ms = this.remainingMs();
    const totalMin = Math.ceil(ms/60000);
    const h = Math.floor(totalMin/60), m = totalMin%60;
    return h > 0 ? `Faltam ${h}h${m > 0 ? m+'min' : ''}` : `Faltam ${m}min`;
  },
  // Chamado no tick do jogo (main.js) e ao carregar um save (mainmenu.js) —
  // cobre tanto expedição concluída com o jogo aberto quanto enquanto o
  // jogador estava fora. Itens vão direto pra mochila, sem etapa de "baú".
  resolveIfDone(){
    if(!state.guild.active || this.remainingMs() > 0) return;
    const total = this.totalItemsFor(state.guild.cycleKey);
    const gains = {};
    for(let i=0; i<total; i++){
      const key = this.rollMaterial();
      state.inventory[key] += 1;
      gains[key] = (gains[key]||0) + 1;
    }
    state.guild = { active:false, cycleKey:null, startedAt:0, durationMs:0 };
    SaveModule.save();
    if(total > 0){
      const summary = Object.entries(gains).map(([key,qty]) => {
        const def = ITEM_DEFS.find(i=>i.key===key);
        return `${qty}x ${def.name}`;
      }).join(', ');
      UI.showToast('EXPEDIÇÃO DA GUILDA', `Sua tropa voltou com: ${summary}.`);
    } else {
      UI.showToast('EXPEDIÇÃO DA GUILDA', 'Sua tropa voltou de mãos vazias dessa vez.');
    }
    UI.renderAll();
  }
};
