/* ---------------------------------------------------------------------
   SAVE / LOAD  (save.js)
   Sistema de 3 saves independentes (slots 1-3), cada um sua própria chave
   no localStorage (CONFIG.saveKeySlot(n)). activeSlot só existe em memória
   (nunca persistido) — enquanto for null (menu principal/seletor de saves),
   save() vira no-op. Ver MainMenuModule pra fluxo de criar/continuar/apagar.
--------------------------------------------------------------------- */
const SaveModule = {
  activeSlot: null, // 1|2|3|null

  getSlotRaw(n){
    try{ return localStorage.getItem(CONFIG.saveKeySlot(n)); }catch(e){ return null; }
  },

  // Resumo de um slot pro seletor de saves (nome + última data), sem precisar
  // carregar o save inteiro pro state global.
  slotSummary(n){
    const raw = this.getSlotRaw(n);
    if(!raw) return { slot:n, occupied:false };
    try{
      const parsed = JSON.parse(raw);
      return { slot:n, occupied:true, playerName: parsed.playerName || '', lastSave: parsed.lastSave || 0 };
    }catch(e){ return { slot:n, occupied:false, corrupted:true }; }
  },

  saveToSlot(n){
    state.lastSave = Date.now();
    try{ localStorage.setItem(CONFIG.saveKeySlot(n), JSON.stringify(state)); }catch(e){ console.warn('Falha ao salvar', e); }
  },

  // Chamado pelo autosave/tick/beforeunload sem saber de slots — não faz nada
  // enquanto o jogador ainda está no menu principal ou no seletor de saves.
  save(){
    if(this.activeSlot) this.saveToSlot(this.activeSlot);
  },

  createNewSlot(n, playerName){
    state = freshState();
    state.playerName = playerName;
    this.activeSlot = n;
    this.saveToSlot(n);
  },

  loadSlot(n){
    const raw = this.getSlotRaw(n);
    if(!raw) return false;
    try{
      const loaded = JSON.parse(raw);
      this.applyLoaded(loaded);
      this.activeSlot = n;
      return true;
    }catch(e){ console.warn('Save corrompido', e); return false; }
  },

  deleteSlot(n){
    try{ localStorage.removeItem(CONFIG.saveKeySlot(n)); }catch(e){}
    if(this.activeSlot === n) this.activeSlot = null;
  },

  downloadSlot(n){
    const raw = this.getSlotRaw(n);
    if(!raw){ alert('Este slot está vazio.'); return; }
    let name = 'save';
    try{ name = (JSON.parse(raw).playerName || 'save').replace(/[^a-z0-9\-_]/gi,'_'); }catch(e){}
    const blob = new Blob([raw], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `beyond-the-gate-slot${n}-${name}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  },

  // Roda 1x no boot, antes de mostrar qualquer tela. Se o slot 1 já tiver
  // dado, não faz nada (não sobrescreve). Nunca apaga a chave legada — fica
  // como backup inofensivo pra sempre.
  migrateLegacyIfNeeded(){
    try{
      if(this.getSlotRaw(1)) return;
      const legacyRaw = localStorage.getItem(CONFIG.saveKey);
      if(!legacyRaw) return;
      localStorage.setItem(CONFIG.saveKeySlot(1), legacyRaw);
    }catch(e){ console.warn('Falha ao migrar save legado', e); }
  },

  // Aplica um objeto de save já parseado ao estado atual do jogo. Usado tanto
  // por loadSlot() (localStorage) quanto por SettingsModule.uploadSaveFromFile()
  // (arquivo baixado pelo jogador) — mesma lógica de compatibilidade nos dois casos.
  applyLoaded(loaded){
    state = Object.assign(freshState(), loaded);
    // loaded pode vir de um arquivo de terceiros (upload de save) — nunca
    // confiar no tipo/tamanho de playerName, mesmo que os pontos de
    // renderização atuais já usem textContent (defesa em profundidade).
    if(typeof state.playerName !== 'string') state.playerName = '';
    state.playerName = state.playerName.slice(0, 20);
    // guard against missing nested keys from older saves (ou de novos
    // upgrades/tropas/mineradores/itens adicionados depois que o save foi criado)
    state.troops = Object.assign(Object.fromEntries(TROOP_DEFS.map(d => [d.key, 0])), loaded.troops||{});
    state.prospectors = Object.assign(Object.fromEntries(PROSPECTOR_DEFS.map(d => [d.key, 0])), loaded.prospectors||{});
    state.cavernUpgrades = Object.assign(Object.fromEntries(CAVERN_UPGRADE_DEFS.map(d => [d.key, 0])), loaded.cavernUpgrades||{});
    state.cavernChest = Object.assign(Object.fromEntries(MINERAL_DEFS.map(d => [d.key, 0])), loaded.cavernChest||{});
    state.oreProgress = typeof loaded.oreProgress === 'number' ? loaded.oreProgress : 0;
    state.upgrades = Object.assign(Object.fromEntries(UPGRADE_DEFS.map(d => [d.key, 0])), loaded.upgrades||{});
    state.inventory = Object.assign(Object.fromEntries(ITEM_DEFS.map(d => [d.key, 0])), loaded.inventory||{});
    state.weapons = Object.assign(Object.fromEntries([...WEAPON_DEFS, ...FORGED_WEAPON_DEFS].map(d => [d.key, 0])), loaded.weapons||{});
    // Save de antes da arma equipada ser um conceito separado (tudo
    // empilhava pra sempre): se o campo nem existia ainda, escolhe pro
    // jogador a 1ª arma que ele já possuir, só pra não ficar "sem nada
    // equipado" do nada — o bônus antigo já cravado em clickDamageFlat
    // continua lá, isso aqui não soma nada de novo.
    state.equippedWeapon = typeof loaded.equippedWeapon === 'string' ? loaded.equippedWeapon
      : (Object.keys(state.weapons).find(k => state.weapons[k] > 0) || null);
    state.quests = Object.assign(Object.fromEntries(QUEST_DEFS.map(d => [d.key, false])), loaded.quests||{});
    state.prestige = Object.assign({pClick:0,pDps:0,pOreRate:0,pCrit:0}, loaded.prestige||{});

    // Merge por-Dungeon (não substitui o objeto inteiro): saves antigos podem
    // não ter `pendingSlot`/`maxCycleCompleted` (adicionados depois), então
    // cada Dungeon recebe o default de freshState() por baixo do que já
    // tinha salvo.
    const freshDungeons = freshState().dungeons;
    const mergedDungeons = {};
    for(const key of Object.keys(freshDungeons)){
      const loadedD = (loaded.dungeons && loaded.dungeons[key]) || {};
      mergedDungeons[key] = Object.assign({}, freshDungeons[key], loadedD);
      // Save de antes do seletor de ciclo: infere quantos ciclos já foram
      // concluídos a partir do próprio killCount (só chega até ali matando o
      // chefe de cada ciclo anterior), em vez de zerar o progresso pro
      // seletor — assim quem já tinha avançado não perde a opção de voltar.
      if(loadedD.maxCycleCompleted === undefined && mergedDungeons[key].killCount > 0){
        const kpc = MonsterModule.killsPerCycleFor(key);
        mergedDungeons[key].maxCycleCompleted = Math.floor(mergedDungeons[key].killCount / kpc);
      }
    }
    state.dungeons = mergedDungeons;

    // Save de antes da atualização de Dungeons: tinha um killCount/loop
    // globais (Mapa 1 ciclos 1-3, Mapa 2 ciclos 4-6, Mapa 3 ciclo 7+), sem
    // conceito de Dungeon escolhida. Migra esse progresso linear pra dentro
    // da Dungeon correspondente, preservando exatamente onde o jogador
    // estava (e desbloqueando as Dungeons que ele já tinha alcançado).
    if(loaded.dungeons === undefined){
      const cycleLen = CONFIG.cycleLength;
      const cap = 3 * cycleLen; // 30 — tamanho de Slime e de Goblin no sistema antigo
      const oldKill = loaded.killCount || 0;
      const dungeons = {
        slimes:{killCount:0, pendingSlot:null, maxCycleCompleted:0},
        goblins:{killCount:0, pendingSlot:null, maxCycleCompleted:0},
        wilds:{killCount:0, pendingSlot:null, maxCycleCompleted:0}
      };
      let current;
      if(oldKill <= cap){
        dungeons.slimes.killCount = oldKill; current = 'slimes';
      } else if(oldKill <= cap*2){
        dungeons.slimes.killCount = cap; dungeons.goblins.killCount = oldKill - cap; current = 'goblins';
      } else {
        dungeons.slimes.killCount = cap; dungeons.goblins.killCount = cap;
        dungeons.wilds.killCount = oldKill - cap*2; current = 'wilds';
      }
      state.dungeons = dungeons;
      state.currentDungeon = current;
    }

    // Save de antes do onboarding do Clérigo: se já tinha mortes registradas
    // mas o campo nem existia ainda, é claramente um personagem estabelecido
    // — não faz sentido mostrar o aviso de "loja liberada" pra quem já joga
    // há tempos. (Personagem realmente novo sempre tem o campo presente,
    // mesmo que `false`, desde a criação — ver freshState().)
    if(loaded.shopUnlockAnnounced === undefined && state.totalKillsAll >= 1){
      state.shopUnlockAnnounced = true;
    }

    // Save de antes do sistema de missões: Ferreiro/Guilda/Caverna
    // desbloqueavam junto com a Loja só por enfrentar a dungeon — quem já
    // tinha esse acesso não pode perder o Ferreiro por causa da missão nova.
    if(loaded.quests === undefined && state.totalKillsAll >= 1){
      state.quests.slimeGelDelivery = true;
      state.metBarnabe = true;
    }

    // Save de antes da apresentação do Creiton: quem já entregou a missão
    // dele (creitonMilitia) claramente já visitou o Ferreiro antes — não faz
    // sentido mostrar a apresentação retroativamente.
    if(loaded.metCreiton === undefined && state.quests.creitonMilitia){
      state.metCreiton = true;
    }

    // Save de antes do ciclo tutorial forçado: já é um jogador estabelecido
    // (tem mortes registradas), não faz sentido forçar esse tutorial nele
    // retroativamente — libera o botão de sair normalmente.
    if(loaded.firstCycleEverCompleted === undefined && state.totalKillsAll >= 1){
      state.firstCycleEverCompleted = true;
    }

    // Save de antes do contador de entradas na Dungeon: quem já tinha acesso
    // à Academia pela regra antiga (arma escolhida OU já enfrentou a
    // dungeon) não pode perder esse acesso por causa do novo gatilho (5ª
    // entrada).
    if(loaded.dungeonEntriesCount === undefined){
      const hadOldAcademiaAccess = Object.values(state.weapons).some(v=>v>0) || state.totalKillsAll >= 1;
      if(hadOldAcademiaAccess) state.dungeonEntriesCount = 5;
    }

    // Save de antes das missões do Creiton/Clérigo: quem já tinha acesso a
    // Guilda/Caverna pela regra temporária antiga (só enfrentar a dungeon)
    // não pode perder esse acesso por causa das missões novas.
    if((!loaded.quests || loaded.quests.creitonMilitia === undefined) && state.totalKillsAll >= 1){
      state.quests.creitonMilitia = true;
    }
    if((!loaded.quests || loaded.quests.caveClearance === undefined) && state.totalKillsAll >= 1){
      state.quests.caveClearance = true;
    }

    // Contador de ciclos vitalício: backfill somando o que cada Dungeon já
    // tinha concluído (state.dungeons já mesclado acima).
    if(loaded.totalCyclesCompleted === undefined){
      state.totalCyclesCompleted = Object.values(state.dungeons).reduce((sum,d)=>sum+(d.maxCycleCompleted||0), 0);
    }
  },

  // Apaga só o slot ativo e volta pro menu principal (não há mais "save
  // atual" depois disso).
  reset(){
    if(!this.activeSlot) return;
    try{ localStorage.removeItem(CONFIG.saveKeySlot(this.activeSlot)); }catch(e){}
    this.activeSlot = null;
    state = freshState();
    MonsterModule.current = null;
    UI.showMainMenu();
    UI.renderPlayerName();
  },

  // Troca de personagem SEM apagar nada — só solta o slot ativo e volta pro
  // menu principal (o save continua intacto no localStorage).
  switchCharacter(){
    this.activeSlot = null;
    state = freshState();
    MonsterModule.current = null;
    UI.showMainMenu();
    UI.renderPlayerName();
  },

  computeOfflineEarnings(){
    const elapsedMs = Date.now() - (state.lastSave || Date.now());
    const cappedMs = Math.min(elapsedMs, CONFIG.offlineCapHours*3600*1000);
    const seconds = Math.max(0, cappedMs/1000);
    if(seconds < 5) return 0;
    const dps = TroopsModule.totalDps();
    const earned = Math.floor(dps * seconds * CONFIG.offlineEfficiency);
    if(earned > 0){
      state.gold += earned;
      state.goldEarnedThisRun += earned;
    }
    // Minério minerado offline vai direto pro baú (mesmo cap/eficiência do
    // dps acima) — fica lá esperando o jogador coletar, não aparece no
    // toast de boas-vindas (ver mainmenu.js), só na próxima vez que abrir a
    // Caverna.
    const ops = CavernModule.totalOrePerSecond();
    if(ops > 0) CavernModule.mineOreAmount(ops * seconds * CONFIG.offlineEfficiency);
    return {earned, seconds};
  }
};
