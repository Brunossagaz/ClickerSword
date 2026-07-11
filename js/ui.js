/* ---------------------------------------------------------------------
   UI MODULE (ui.js)
--------------------------------------------------------------------- */
const UI = {
  canvas:null, ctx:null,
  init(){
    this.canvas = document.getElementById('monsterCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.parentElement.addEventListener('click', (e)=>PlayerModule.handleClick(e));

    document.getElementById('ascendBtn').addEventListener('click', ()=>PrestigeModule.ascend());
    document.getElementById('switchCharacterBtn').addEventListener('click', ()=>{
      if(confirm('Voltar ao menu principal? Seu progresso está salvo, nada será perdido.')) SaveModule.switchCharacter();
    });
    document.getElementById('resetBtn').addEventListener('click', ()=>{
      if(confirm('Tem certeza que deseja apagar esse save permanentemente?')) SaveModule.reset();
    });
    // Sair no meio de uma luta (monstro ainda vivo) custa o progresso do
    // ciclo atual — pergunta antes (modal próprio, não confirm() nativo do
    // navegador), e se confirmar volta pro monstro 1 do ciclo na próxima vez
    // que entrar (ver MonsterModule.abandonCycle).
    document.getElementById('leaveDungeonBtn').addEventListener('click', ()=>{
      document.getElementById('leaveConfirmModal').classList.add('open');
    });
    document.getElementById('leaveConfirmYesBtn').addEventListener('click', ()=>{
      document.getElementById('leaveConfirmModal').classList.remove('open');
      MonsterModule.abandonCycle();
      DungeonModule.leaveToCity();
    });
    document.getElementById('leaveConfirmNoBtn').addEventListener('click', ()=>{
      document.getElementById('leaveConfirmModal').classList.remove('open');
    });

    document.getElementById('cycleContinueBtn').addEventListener('click', ()=>{
      document.getElementById('cycleCompleteModal').classList.remove('open');
      MonsterModule.spawn(false);
      UI.renderAll();
    });
    document.getElementById('cycleLeaveBtn').addEventListener('click', ()=>{
      document.getElementById('cycleCompleteModal').classList.remove('open');
      DungeonModule.leaveToCity();
    });

    document.getElementById('timeUpRetryBtn').addEventListener('click', ()=>{
      document.getElementById('timeUpModal').classList.remove('open');
      MonsterModule.retryCycle();
    });
    document.getElementById('timeUpLeaveBtn').addEventListener('click', ()=>{
      document.getElementById('timeUpModal').classList.remove('open');
      DungeonModule.leaveToCity();
    });

    // Prédios da cidade: cada um abre um modal por cima da cena, igual ao
    // padrão já usado por Configurações/Conquistas — nenhum bloqueia os
    // outros porque só existem enquanto o jogador está na Cidade (a view da
    // dungeon nem mostra os botões que os abrem). Os que ainda estão
    // trancados (ver renderCityBuildingLocks) ficam com o atributo `disabled`,
    // que já impede o clique nativamente — sem precisar checar de novo aqui.
    this.wireBuildingModal('openFerreiroBtn', 'ferreiroModal', 'ferreiroCloseBtn');
    this.wireBuildingModal('openGuildaBtn', 'guildaModal', 'guildaCloseBtn');
    this.wireBuildingModal('openCavernaBtn', 'cavernaModal', 'cavernaCloseBtn');
    this.wireBuildingModal('openDungeonBtn', 'dungeonModal', 'dungeonCloseBtn');
    this.wireBuildingModal('openInventarioBtn', 'inventarioModal', 'inventarioCloseBtn');
    this.wireBuildingModal('openAcademiaBtn', 'academiaModal', 'academiaCloseBtn');
    this.initModalTabs('inventarioModal');

    // Igreja é especial: na 1ª vez (personagem novo, sem arma escolhida e
    // sem nenhuma morte) abre a introdução do Clérigo em vez da Ascensão
    // normal — ver OnboardingModule.shouldShowClericIntro.
    const igrejaModal = document.getElementById('igrejaModal');
    document.getElementById('openIgrejaBtn').addEventListener('click', ()=>{
      if(OnboardingModule.shouldShowClericIntro()) OnboardingModule.openClericIntro();
      else igrejaModal.classList.add('open');
    });
    document.getElementById('igrejaCloseBtn').addEventListener('click', ()=>igrejaModal.classList.remove('open'));
    igrejaModal.addEventListener('click', (e)=>{ if(e.target === igrejaModal) igrejaModal.classList.remove('open'); });
    OnboardingModule.init();

    // Loja também é especial: na 1ª vez, o Barnabé se apresenta antes de
    // abrir a loja normal — ver QuestModule.openBarnabeIntro.
    const lojaModal = document.getElementById('lojaModal');
    document.getElementById('openLojaBtn').addEventListener('click', ()=>{
      if(!state.metBarnabe) QuestModule.openBarnabeIntro();
      else lojaModal.classList.add('open');
    });
    document.getElementById('lojaCloseBtn').addEventListener('click', ()=>lojaModal.classList.remove('open'));
    lojaModal.addEventListener('click', (e)=>{ if(e.target === lojaModal) lojaModal.classList.remove('open'); });
    QuestModule.init();

    this.initSettingsModal();
  },
  wireBuildingModal(openBtnId, modalId, closeBtnId){
    const modal = document.getElementById(modalId);
    document.getElementById(openBtnId).addEventListener('click', ()=>modal.classList.add('open'));
    document.getElementById(closeBtnId).addEventListener('click', ()=>modal.classList.remove('open'));
    modal.addEventListener('click', (e)=>{ if(e.target === modal) modal.classList.remove('open'); });
  },
  // Abas internas escopadas a um modal específico (hoje só o Inventário usa)
  // — não é o sistema global de tabs (removido na reestruturação anterior).
  initModalTabs(modalId){
    const modal = document.getElementById(modalId);
    const tabBtns = modal.querySelectorAll('.modal-tab-btn');
    const tabPanels = modal.querySelectorAll('.modal-tab-content');
    tabBtns.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        tabBtns.forEach(b=>b.classList.remove('active'));
        tabPanels.forEach(p=>p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });
  },
  // Alterna entre as 4 telas do jogo (menu principal, seletor de saves,
  // cidade, dungeon) — só uma fica visível por vez. showCityView/showDungeonView
  // mantêm nome/assinatura de antes, então dungeons.js/monster.js/main.js não
  // precisam mudar.
  showScreen(id){
    ['view-mainmenu','view-slotpicker','view-city','view-dungeon'].forEach(vid=>{
      document.getElementById(vid).classList.toggle('active', vid===id);
    });
    document.getElementById('statBar').style.display = (id==='view-city'||id==='view-dungeon') ? '' : 'none';
  },
  showMainMenu(){ this.showScreen('view-mainmenu'); },
  showSlotPicker(){ MainMenuModule.renderSlotPicker(); this.showScreen('view-slotpicker'); },
  showCityView(){ this.showScreen('view-city'); },
  showDungeonView(){ this.showScreen('view-dungeon'); },
  renderPlayerName(){
    const el = document.getElementById('playerNameTag');
    el.textContent = state.playerName ? `Bem-vindo, ${state.playerName}` : '';
    el.style.display = state.playerName ? '' : 'none';
  },
  // Trava/destrava os prédios da cidade (botão `disabled` nativo já impede o
  // clique) conforme o progresso do onboarding — ver OnboardingModule.
  renderCityBuildingLocks(){
    const buildingByBtn = {
      openFerreiroBtn:'ferreiro', openGuildaBtn:'guilda', openCavernaBtn:'caverna',
      openLojaBtn:'loja', openIgrejaBtn:'igreja', openDungeonBtn:'dungeon', openInventarioBtn:'inventario',
      openAcademiaBtn:'academia'
    };
    for(const btnId in buildingByBtn){
      document.getElementById(btnId).disabled = !OnboardingModule.isBuildingUnlocked(buildingByBtn[btnId]);
    }
  },
  // Chamado pelo MonsterModule.onDeath() quando o chefe de um ciclo é
  // derrotado — pausa o jogo (MonsterModule.current fica null) até o
  // jogador escolher continuar pro próximo ciclo ou voltar pra cidade.
  showCycleCompleteModal(){
    const d = state.dungeons[state.currentDungeon];
    const kpc = MonsterModule.killsPerCycleFor(state.currentDungeon);
    const justFinishedCycle = Math.floor((d.killCount - 1) / kpc) + 1;
    const nextCycle = Math.floor(d.killCount / kpc) + 1;
    document.getElementById('cycleCompleteText').textContent =
      `Você derrotou o chefe do Ciclo ${justFinishedCycle} de ${MAPS[state.currentDungeon].name}! Quer continuar para o Ciclo ${nextCycle}?`;
    document.getElementById('cycleCompleteModal').classList.add('open');
  },
  // Chamado pelo MonsterModule.onTimeUp() quando o timer do monstro atual
  // esgota — pausa o jogo até o jogador escolher tentar de novo o ciclo ou
  // voltar pra cidade, em vez de resetar sozinho.
  showTimeUpModal(){
    const d = state.dungeons[state.currentDungeon];
    const kpc = MonsterModule.killsPerCycleFor(state.currentDungeon);
    const cycleNum = Math.floor(d.killCount / kpc) + 1;
    document.getElementById('timeUpText').textContent =
      `Tempo esgotado! Você não derrotou o monstro a tempo. Quer tentar de novo o Ciclo ${cycleNum} de ${MAPS[state.currentDungeon].name} ou voltar pra cidade?`;
    document.getElementById('timeUpModal').classList.add('open');
  },
  // Reflete as preferências globais e mostra/esconde a seção "Personagem"
  // (trocar/apagar) dependendo se há um save ativo — não faz sentido
  // trocar/apagar personagem a partir do menu principal, antes de escolher um.
  openSettingsModal(){
    document.getElementById('audioToggle').checked = SettingsModule.current.audioEnabled;
    document.getElementById('audioToggleLabel').textContent = SettingsModule.current.audioEnabled ? 'Ativado' : 'Desativado';
    document.getElementById('volumeSlider').value = SettingsModule.current.volume;
    document.getElementById('languageSelect').value = SettingsModule.current.language;
    document.getElementById('settingsSlotSection').style.display = SaveModule.activeSlot ? '' : 'none';
    document.getElementById('settingsModal').classList.add('open');
  },
  initSettingsModal(){
    const settingsModal = document.getElementById('settingsModal');
    const achievementsModal = document.getElementById('achievementsModal');
    const openModal = (modal)=> modal.classList.add('open');
    const closeModal = (modal)=> modal.classList.remove('open');

    document.getElementById('settingsGearBtn').addEventListener('click', ()=>this.openSettingsModal());
    document.getElementById('settingsCloseBtn').addEventListener('click', ()=>closeModal(settingsModal));
    settingsModal.addEventListener('click', (e)=>{ if(e.target === settingsModal) closeModal(settingsModal); });

    document.getElementById('achievementsBtn').addEventListener('click', ()=>{
      closeModal(settingsModal);
      openModal(achievementsModal);
    });
    document.getElementById('achievementsCloseBtn').addEventListener('click', ()=>closeModal(achievementsModal));
    achievementsModal.addEventListener('click', (e)=>{ if(e.target === achievementsModal) closeModal(achievementsModal); });

    document.getElementById('downloadSaveBtn').addEventListener('click', ()=>SettingsModule.downloadSave());

    const uploadInput = document.getElementById('uploadSaveInput');
    document.getElementById('uploadSaveBtn').addEventListener('click', ()=>uploadInput.click());
    uploadInput.addEventListener('change', ()=>{
      const file = uploadInput.files[0];
      SettingsModule.uploadSaveFromFile(file).then(()=>{
        closeModal(settingsModal);
        this.showToast('SAVE CARREGADO', 'Seu progresso foi importado com sucesso!');
      }).catch(msg=>{
        alert(msg);
      }).finally(()=>{
        uploadInput.value = '';
      });
    });

    document.getElementById('audioToggle').addEventListener('change', (e)=>{
      SettingsModule.setAudioEnabled(e.target.checked);
      document.getElementById('audioToggleLabel').textContent = e.target.checked ? 'Ativado' : 'Desativado';
    });
    document.getElementById('volumeSlider').addEventListener('input', (e)=>SettingsModule.setVolume(Number(e.target.value)));
    document.getElementById('languageSelect').addEventListener('change', (e)=>SettingsModule.setLanguage(e.target.value));
  },
  fmt(n){
    n = Math.floor(n);
    if(n < 1000) return ''+n;
    const units = ['','K','M','B','T','Qa','Qi','Sx'];
    let u = 0;
    let val = n;
    while(val >= 1000 && u < units.length-1){ val/=1000; u++; }
    return val.toFixed(val<10?2:1)+units[u];
  },
  renderMonsterSprite(){
    const big = MonsterModule.current.isBoss;
    Sprites.draw(this.ctx, MonsterModule.current.type, big, state.isGolden);
    this.canvas.style.width = big ? '256px' : '224px';
    this.canvas.style.height = big ? '256px' : '224px';
  },
  renderMonsterInfo(){
    if(!MonsterModule.current) return; // sem monstro ativo (jogador está na cidade)
    const t = MonsterModule.current.type;
    const d = state.dungeons[state.currentDungeon];
    const kpc = MonsterModule.killsPerCycleFor(state.currentDungeon);
    const loop = Math.floor(d.killCount / kpc) + 1;
    // posição no ciclo é por SLOT (1-10), não por monstro morto — uma posição
    // dupla (ver MAPS.slimes) vale 1 posição só, mesmo consumindo 2 mortes
    const slotPos = MonsterModule.current.slotIdx + 1;
    const totalSlots = MonsterModule.current.totalSlots;
    const monsterNameEl = document.getElementById('monsterName');
    monsterNameEl.innerHTML = (MonsterModule.current.isBoss ? '<div class="icon icon-boss"></div>CHEFE: ' : '') + t.name;
    document.getElementById('tierLabel').textContent = `${MAPS[state.currentDungeon].name} · CICLO ${loop} · MONSTRO ${slotPos}/${totalSlots} (ABATIDOS NO TOTAL: ${state.totalKillsAll})`;
  },
  renderHpBar(){
    if(!MonsterModule.current) return;
    const pct = Math.max(0, (state.monsterHp/state.monsterMaxHp)*100);
    document.getElementById('hpFill').style.width = pct+'%';
    document.getElementById('hpText').textContent = `${Math.max(0,Math.ceil(state.monsterHp))} / ${state.monsterMaxHp}`;
  },
  renderTimer(){
    if(!MonsterModule.current) return;
    const remainingMs = Math.max(0, CONFIG.monsterTimeLimitMs - (Date.now() - state.monsterSpawnedAt));
    const pct = Math.max(0, (remainingMs/CONFIG.monsterTimeLimitMs)*100);
    const fill = document.getElementById('timerFill');
    const text = document.getElementById('timerText');
    fill.style.width = pct+'%';
    text.textContent = Math.ceil(remainingMs/1000)+'s';
    fill.classList.toggle('urgent', remainingMs < 5000);
  },
  setGoldenVisible(v){
    document.getElementById('goldenTag').style.display = v ? 'block' : 'none';
    this.renderMonsterSprite();
  },
  renderStats(){
    document.getElementById('statGold').textContent = this.fmt(state.gold);
    document.getElementById('statClickDmg').textContent = this.fmt(PlayerModule.clickDamage());
    document.getElementById('statDps').textContent = this.fmt(TroopsModule.totalDps());
    document.getElementById('statCrit').textContent = Math.round((state.critChance+state.pCritChance)*100)+'%';
    document.getElementById('statMiningGps').textContent = this.fmt(MiningModule.totalGoldPerSecond());
    // espelham os mesmos valores na aba Estatísticas do Inventário
    document.getElementById('invStatClickDmg').textContent = this.fmt(PlayerModule.clickDamage());
    document.getElementById('invStatDps').textContent = this.fmt(TroopsModule.totalDps());
  },
  renderDungeonList(){
    const el = document.getElementById('dungeonList');
    el.innerHTML = '';
    for(const key of Object.keys(MAPS)){
      const map = MAPS[key];
      const row = document.createElement('div');
      if(!DungeonModule.isUnlocked(key)){
        const req = map.unlockRequirement;
        row.className = 'shop-row locked';
        row.innerHTML = `
          <div class="shop-info">
            <div class="name"><div class="icon icon-lock"></div>${map.name}</div>
            <div class="desc">Requer ${req.kills} mortes na ${MAPS[req.dungeon].name}</div>
          </div>`;
        el.appendChild(row);
        continue;
      }
      row.className = 'shop-row';
      row.innerHTML = `
        <div class="shop-info">
          <div class="name">${map.name}</div>
          <div class="desc">${DungeonModule.progressLabel(key)}${map.dropsItem ? ' · dropa itens em vez de ouro' : ''}</div>
        </div>
        <button class="buy-btn">ENTRAR</button>`;
      row.querySelector('button').addEventListener('click', ()=>DungeonModule.enter(key));
      el.appendChild(row);
    }
  },
  // Monta uma linha de item reutilizável — com botão de vender (Loja) ou só
  // visualização (Mochila do Inventário), conforme opts.showSellButton.
  buildItemRow(def, opts){
    opts = opts || {};
    const qty = state.inventory[def.key];
    const hasAny = qty > 0;
    const row = document.createElement('div');
    row.className = 'shop-row'+(hasAny?'':' disabled');
    const sellBtnHtml = opts.showSellButton ? `<button class="buy-btn" ${hasAny?'':'disabled'}>Vender tudo</button>` : '';
    row.innerHTML = `
      <div class="shop-info">
        <div class="name"><div class="icon icon-${def.icon}"></div>${def.name}</div>
        <div class="desc">${opts.showSellButton ? 'Vende por '+def.sellPrice+' ouro cada' : ''}</div>
        <div class="owned">Possui: ${qty}</div>
      </div>${sellBtnHtml}`;
    if(opts.showSellButton && hasAny){
      row.querySelector('button').addEventListener('click', ()=>{
        state.gold += qty * def.sellPrice;
        state.inventory[def.key] = 0;
        UI.renderAll();
      });
    }
    return row;
  },
  renderShop(){
    const el = document.getElementById('shopList');
    el.innerHTML = '';
    for(const def of ITEM_DEFS) el.appendChild(this.buildItemRow(def, { showSellButton:true }));
  },
  // Mochila do Inventário: mesma lista de itens, só visualização (sem vender
  // — vender continua exclusivo da Loja).
  renderInventoryBag(){
    const el = document.getElementById('inventoryBagList');
    el.innerHTML = '';
    const owned = ITEM_DEFS.filter(d=>state.inventory[d.key] > 0);
    if(owned.length === 0){
      el.innerHTML = '<div class="footer-note">Sua mochila está vazia. Explore as Dungeons para coletar itens.</div>';
      return;
    }
    for(const def of owned) el.appendChild(this.buildItemRow(def, { showSellButton:false }));
  },
  // Aba Armas do Inventário: mostra a(s) arma(s) escolhida(s) com o Clérigo —
  // só visualização, sem loja de armas por enquanto.
  renderWeaponsList(){
    const el = document.getElementById('weaponsList');
    el.innerHTML = '';
    const owned = WEAPON_DEFS.filter(d=>state.weapons[d.key] > 0);
    if(owned.length === 0){
      el.innerHTML = '<div class="footer-note">Nenhuma arma equipada ainda.</div>';
      return;
    }
    for(const def of owned){
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `
        <div class="shop-info">
          <div class="name"><div class="icon icon-${def.icon}"></div>${def.name}</div>
          <div class="desc">+${def.clickDamageBonus} dano por clique</div>
        </div>`;
      el.appendChild(row);
    }
  },
  // Loja de armas do Ferreiro — vende as armas que o jogador ainda não tem
  // (a 1ª já veio de graça do Clérigo). Comprar aplica o mesmo bônus de
  // dano por clique de escolher a arma no onboarding.
  renderFerreiroWeapons(){
    const el = document.getElementById('ferreiroWeaponList');
    el.innerHTML = '';
    for(const def of WEAPON_DEFS){
      const owned = state.weapons[def.key] > 0;
      const canAfford = state.gold >= def.buyCost;
      const row = document.createElement('div');
      if(owned){
        row.className = 'shop-row';
        row.innerHTML = `
          <div class="shop-info">
            <div class="name"><div class="icon icon-${def.icon}"></div>${def.name}</div>
            <div class="desc">+${def.clickDamageBonus} dano por clique</div>
            <div class="owned">Equipada</div>
          </div>`;
      } else {
        row.className = 'shop-row'+(canAfford?'':' disabled');
        row.innerHTML = `
          <div class="shop-info">
            <div class="name"><div class="icon icon-${def.icon}"></div>${def.name}</div>
            <div class="desc">+${def.clickDamageBonus} dano por clique</div>
          </div>
          <button class="buy-btn" ${canAfford?'':'disabled'}><div class="icon icon-gold"></div> ${UI.fmt(def.buyCost)}</button>`;
        if(canAfford){
          row.querySelector('button').addEventListener('click', ()=>{
            state.gold -= def.buyCost;
            state.weapons[def.key] = 1;
            state.clickDamageFlat += def.clickDamageBonus;
            UI.renderAll();
          });
        }
      }
      el.appendChild(row);
    }
  },
  renderMinerList(){
    const el = document.getElementById('minerList');
    el.innerHTML = '';
    for(const def of MINER_DEFS){
      const owned = state.miners[def.key];
      const cost = MiningModule.costFor(def);
      const canAfford = state.gold >= cost;
      const row = document.createElement('div');
      row.className = 'shop-row'+(canAfford?'':' disabled');
      row.innerHTML = `
        <div class="shop-info">
          <div class="name">${def.name}</div>
          <div class="desc">${def.desc} cada</div>
          <div class="owned">Possui: ${owned}</div>
        </div>
        <button class="buy-btn" ${canAfford?'':'disabled'}><div class="icon icon-gold"></div> ${UI.fmt(cost)}</button>`;
      row.querySelector('button').addEventListener('click', ()=>MiningModule.buy(def.key));
      el.appendChild(row);
    }
  },
  // Tropas não dependem mais da árvore de upgrades (Guilda vai ganhar seu
  // próprio conceito depois) — liberadas só por ouro, mesmo padrão da
  // Caverna (ver renderMinerList).
  renderTroopList(){
    const el = document.getElementById('troopList');
    el.innerHTML = '';
    for(const def of TROOP_DEFS){
      const row = document.createElement('div');
      const owned = state.troops[def.key];
      const cost = TroopsModule.costFor(def);
      const canAfford = state.gold >= cost;
      row.className = 'shop-row'+(canAfford?'':' disabled');
      row.innerHTML = `
        <div class="shop-info">
          <div class="name">${def.name}</div>
          <div class="desc">${def.desc} cada</div>
          <div class="owned">Possui: ${owned}</div>
        </div>
        <button class="buy-btn" ${canAfford?'':'disabled'}><div class="icon icon-gold"></div> ${UI.fmt(cost)}</button>`;
      row.querySelector('button').addEventListener('click', ()=>TroopsModule.buy(def.key));
      el.appendChild(row);
    }
  },
  // Desenha a árvore de upgrades (aba UPGRADES) a partir dos dados puramente
  // visuais em UPGRADE_TREE (config.js). O desbloqueio continua sendo
  // decidido só pela PROGRESSION_CHAIN via ProgressionModule — esta função
  // só posiciona os mesmos nós que renderUpgradeList() desenhava em lista.
  renderUpgradeTree(){
    const linesEl = document.getElementById('upgradeTreeLines');
    const nodesEl = document.getElementById('upgradeTreeNodes');
    linesEl.innerHTML = '';
    nodesEl.innerHTML = '';

    const hub = UPGRADE_TREE.hub;
    const svgLine = (x1,y1,x2,y2,color)=>{
      const line = document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1', x1+'%'); line.setAttribute('y1', y1+'%');
      line.setAttribute('x2', x2+'%'); line.setAttribute('y2', y2+'%');
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '2');
      line.setAttribute('opacity', '0.7');
      linesEl.appendChild(line);
    };

    for(const branch of UPGRADE_TREE.branches){
      // rótulo da branch, um pouco além do último nó (o mais afastado do hub)
      // — perto do nó colide com o círculo. Distância FIXA (não proporcional
      // à distância hub->nó) porque agora todo nó fica ~mesma distância do
      // hub (só 1 por branch) — um fator proporcional deixava o rótulo perto
      // demais do nó (colidindo) ou vazando pra fora do .tree-wrap.
      const outer = branch.nodes[branch.nodes.length-1];
      const dx = outer.x - hub.x, dy = outer.y - hub.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      const EXTEND = 13; // pontos percentuais além do centro do nó
      // clamp com mais margem que os nós (12/6) — o rótulo tem largura
      // própria (até 100px), então precisa de mais respiro da borda do
      // .tree-wrap pra não cortar o texto, mesmo já andando pra dentro
      const labelX = Math.max(12, Math.min(88, outer.x + (dx/dist)*EXTEND));
      const labelY = Math.max(6, Math.min(94, outer.y + (dy/dist)*EXTEND));
      const label = document.createElement('div');
      label.className = 'tree-branch-label';
      label.style.left = labelX+'%';
      label.style.top = labelY+'%';
      label.style.color = branch.color;
      label.textContent = branch.label;
      nodesEl.appendChild(label);

      // linhas conectando hub -> nó1 -> nó2 -> ...
      let prev = hub;
      for(const node of branch.nodes){
        svgLine(prev.x, prev.y, node.x, node.y, branch.color);
        prev = node;
      }

      for(const node of branch.nodes){
        const def = UPGRADE_DEFS.find(u=>u.key===node.key);
        const el = document.createElement('div');
        el.className = 'tree-node';
        el.style.left = node.x+'%';
        el.style.top = node.y+'%';
        el.style.borderColor = branch.color;

        if(!ProgressionModule.isUnlocked('upgrade', node.key)){
          el.classList.add('locked');
          el.innerHTML = `
            <div class="node-name"><div class="icon icon-lock"></div>${def.name}</div>
            <div class="node-tooltip">${ProgressionModule.lockLabel('upgrade', node.key)}</div>`;
          nodesEl.appendChild(el);
          continue;
        }

        const lvl = state.upgrades[node.key];
        const maxed = lvl >= def.maxLevel;
        const cost = UpgradesModule.costFor(def);
        const canAfford = !maxed && state.gold >= cost;
        if(maxed) el.classList.add('maxed');

        el.innerHTML = `
          <div class="node-name">${def.name}</div>
          <div class="node-level">${lvl}/${def.maxLevel}</div>
          <div class="node-cost">${maxed ? 'MÁX' : '<div class=\"icon icon-gold\"></div> '+UI.fmt(cost)}</div>
          ${maxed ? '' : `<button class="node-plus-btn" ${canAfford?'':'disabled'}>+</button>`}
          <div class="node-tooltip">${def.desc}</div>`;
        if(!maxed){
          const plusBtn = el.querySelector('.node-plus-btn');
          plusBtn.addEventListener('click', (e)=>{ e.stopPropagation(); UpgradesModule.buy(node.key); });
        }
        nodesEl.appendChild(el);
      }
    }
  },
  renderPrestigeTab(){
    document.getElementById('essenceCount').textContent = UI.fmt(state.essence);
    const gain = PrestigeModule.potentialEssence();
    document.getElementById('essenceGain').textContent = gain;

    // state.totalKillsAll (vitalício, o mesmo "ABATIDOS NO TOTAL" da arena) é
    // o que conta pra ascender — nunca reseta, nem por timeout de chefe nem
    // por ascensão. Assim o progresso mostrado aqui bate com o que a arena
    // já exibe, sem depender de mortes só desta run.
    const threshold = PrestigeModule.currentAscendThreshold();
    const killsSoFar = Math.min(state.totalKillsAll, threshold);
    document.getElementById('ascendProgress').textContent = `Abatidos no total: ${killsSoFar}/${threshold}`;

    const btn = document.getElementById('ascendBtn');
    const killsOk = state.totalKillsAll >= threshold;
    btn.disabled = !PrestigeModule.canAscend();
    if(PrestigeModule.canAscend()){
      btn.textContent = 'ASCENDER';
    } else if(!killsOk){
      btn.textContent = `MATE ${threshold} MONSTROS NO TOTAL PARA ASCENDER`;
    } else {
      btn.textContent = 'GANHE MAIS OURO NESTE RUN PARA ASCENDER';
    }

    const el = document.getElementById('prestigeUpgradeList');
    el.innerHTML = '';
    for(const def of PRESTIGE_UPGRADE_DEFS){
      const cost = PrestigeModule.costFor(def);
      const canAfford = state.essence >= cost;
      const row = document.createElement('div');
      row.className = 'shop-row'+(canAfford?'':' disabled');
      row.innerHTML = `
        <div class="shop-info">
          <div class="name">${def.name}</div>
          <div class="desc">${def.desc}</div>
          <div class="owned">Nível: ${state.prestige[def.key]}</div>
        </div>
        <button class="buy-btn" ${canAfford?'':'disabled'}><div class="icon icon-essence"></div> ${UI.fmt(cost)}</button>`;
      row.querySelector('button').addEventListener('click', ()=>PrestigeModule.buy(def.key));
      el.appendChild(row);
    }
  },
  renderAll(){
    this.renderStats();
    this.renderMonsterInfo();
    this.renderHpBar();
    this.renderTimer();
    this.renderDungeonList();
    this.renderTroopList();
    this.renderMinerList();
    this.renderShop();
    this.renderInventoryBag();
    this.renderWeaponsList();
    this.renderFerreiroWeapons();
    this.renderCityBuildingLocks();
    QuestModule.renderQuestBanner();
    this.renderUpgradeTree();
    this.renderPrestigeTab();
  },
  showFloatingDamage(dmg, isCrit, evt){
    const stage = document.getElementById('monsterStage');
    const div = document.createElement('div');
    div.className = 'float-dmg'+(isCrit?' crit':'');
    div.textContent = (isCrit?'CRÍT! ':'')+'-'+this.fmt(dmg);
    const rect = stage.getBoundingClientRect();
    const relX = evt && evt.clientX ? (evt.clientX-rect.left) : rect.width/2;
    div.style.left = relX+'px';
    div.style.top = (evt && evt.clientY ? (evt.clientY-rect.top-20) : rect.height/2)+'px';
    stage.appendChild(div);
    setTimeout(()=>div.remove(), 850);
  },
  showFloatingGold(amount){
    const stage = document.getElementById('monsterStage');
    const div = document.createElement('div');
    div.className = 'float-dmg';
    div.style.color = '#ffd54a';
    div.textContent = '+'+this.fmt(amount)+' ouro';
    div.style.left = '50%';
    div.style.top = '50%';
    stage.appendChild(div);
    setTimeout(()=>div.remove(), 850);
  },
  showFloatingGoldAt(amount, evt){
    const stage = document.getElementById('monsterStage');
    const div = document.createElement('div');
    div.className = 'float-dmg';
    div.style.color = '#ffd54a';
    div.textContent = '+'+this.fmt(amount)+' ouro';
    const rect = stage.getBoundingClientRect();
    const relX = evt && evt.clientX ? (evt.clientX-rect.left) : rect.width/2;
    div.style.left = relX+'px';
    div.style.top = (evt && evt.clientY ? (evt.clientY-rect.top+10) : rect.height/2)+'px';
    stage.appendChild(div);
    setTimeout(()=>div.remove(), 850);
  },
  showFloatingItem(qty, itemDef){
    const stage = document.getElementById('monsterStage');
    const div = document.createElement('div');
    div.className = 'float-dmg';
    div.style.color = '#8fe0c8';
    div.textContent = '+'+qty+' '+itemDef.name;
    div.style.left = '50%';
    div.style.top = '50%';
    stage.appendChild(div);
    setTimeout(()=>div.remove(), 850);
  },
  showFloatingItemAt(qty, itemDef, evt){
    const stage = document.getElementById('monsterStage');
    const div = document.createElement('div');
    div.className = 'float-dmg';
    div.style.color = '#8fe0c8';
    div.textContent = '+'+qty;
    const rect = stage.getBoundingClientRect();
    const relX = evt && evt.clientX ? (evt.clientX-rect.left) : rect.width/2;
    div.style.left = relX+'px';
    div.style.top = (evt && evt.clientY ? (evt.clientY-rect.top+10) : rect.height/2)+'px';
    stage.appendChild(div);
    setTimeout(()=>div.remove(), 850);
  },
  screenShake(){
    const c = document.getElementById('monsterCanvas');
    c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
  },
  hitFlash(){
    const c = document.getElementById('monsterCanvas');
    c.classList.add('flash');
    setTimeout(()=>c.classList.remove('flash'), 90);
  },
  showToast(title, msg){
    const div = document.createElement('div');
    div.className = 'toast';
    div.innerHTML = `<span class="pixel">${title}</span>${msg}`;
    document.body.appendChild(div);
    setTimeout(()=>{ div.style.transition='opacity .5s'; div.style.opacity='0'; setTimeout(()=>div.remove(),500); }, 3800);
  }
};
