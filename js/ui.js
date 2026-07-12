/* ---------------------------------------------------------------------
   UI MODULE (ui.js)
--------------------------------------------------------------------- */
const UI = {
  canvas:null, ctx:null,
  // Pan/zoom da árvore de Upgrades (Academia de Combate) — só transform
  // visual, não mexe nas coordenadas (%) dos nós em UPGRADE_TREE. Resetado
  // toda vez que o modal é aberto (ver initTreePanZoom).
  treeView:{ x:0, y:0, scale:1 },
  init(){
    this.canvas = document.getElementById('monsterCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.parentElement.addEventListener('click', (e)=>PlayerModule.handleClick(e));
    this.initModalBodyLock();

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
    // cyclePickerModal não tem botão que o "abre" fixo na cidade (é aberto
    // via UI.openCyclePicker, disparado de dentro do dungeonModal) — só
    // precisa do fechar/clique-fora, igual aos outros modais.
    {
      const cyclePickerModal = document.getElementById('cyclePickerModal');
      document.getElementById('cyclePickerCloseBtn').addEventListener('click', ()=>cyclePickerModal.classList.remove('open'));
      cyclePickerModal.addEventListener('click', (e)=>{ if(e.target === cyclePickerModal) cyclePickerModal.classList.remove('open'); });
    }
    this.wireBuildingModal('openInventarioBtn', 'inventarioModal', 'inventarioCloseBtn');
    this.wireBuildingModal('openAcademiaBtn', 'academiaModal', 'academiaCloseBtn');
    this.initModalTabs('inventarioModal');
    // sempre abre a Academia com a view centralizada (zoom 1, sem pan) —
    // sem isso o jogador podia reabrir o modal ainda deslocado/dado zoom de
    // uma visita anterior, o que é confuso.
    document.getElementById('openAcademiaBtn').addEventListener('click', ()=>this.resetTreeView());
    this.initTreePanZoom();

    // Botão "?" (ajuda) — alterna o popover com as instruções de pan/zoom,
    // em vez de deixar o texto sempre visível ocupando espaço no cabeçalho.
    {
      const helpBtn = document.getElementById('academiaHelpBtn');
      const helpPopover = document.getElementById('academiaHelpPopover');
      helpBtn.addEventListener('click', (e)=>{
        e.stopPropagation();
        helpPopover.classList.toggle('open');
      });
      document.addEventListener('click', (e)=>{
        if(helpPopover.classList.contains('open') && !helpPopover.contains(e.target) && e.target !== helpBtn){
          helpPopover.classList.remove('open');
        }
      });
    }

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
  // Trava a rolagem da PÁGINA (body) sempre que qualquer .modal-overlay
  // estiver aberto — sem isso, se o conteúdo de algum modal (ex.: Academia)
  // ficasse por qualquer motivo um pouco mais alto que a viewport do
  // jogador (fonte/zoom/DPI variam por máquina), a barra de rolagem
  // aparecia na PÁGINA inteira (feia, na borda da janela) em vez de ficar
  // contida dentro do próprio modal. Usa um MutationObserver central em vez
  // de mexer em cada handler de abrir/fechar modal espalhado pelo código.
  initModalBodyLock(){
    const sync = () => {
      const anyOpen = !!document.querySelector('.modal-overlay.open');
      document.body.classList.toggle('modal-open', anyOpen);
    };
    const observer = new MutationObserver(sync);
    document.querySelectorAll('.modal-overlay').forEach(modal=>{
      observer.observe(modal, { attributes:true, attributeFilter:['class'] });
    });
    sync();
  },
  wireBuildingModal(openBtnId, modalId, closeBtnId){
    const modal = document.getElementById(modalId);
    document.getElementById(openBtnId).addEventListener('click', ()=>modal.classList.add('open'));
    document.getElementById(closeBtnId).addEventListener('click', ()=>modal.classList.remove('open'));
    modal.addEventListener('click', (e)=>{ if(e.target === modal) modal.classList.remove('open'); });
  },
  // Aplica this.treeView (pan+zoom) no .tree-canvas — chamado depois de
  // qualquer mudança de scale/x/y. transform-origin:0 0 (ver CSS), então
  // translate() acontece no espaço em px do .tree-wrap (não é afetado pelo
  // scale que vem depois no mesmo transform).
  applyTreeTransform(){
    const canvas = document.getElementById('upgradeTreeCanvas');
    const v = this.treeView;
    canvas.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.scale})`;
  },
  resetTreeView(){
    this.treeView = { x:0, y:0, scale:1 };
    this.applyTreeTransform();
  },
  // Scroll do mouse = zoom (centrado no cursor, pra não "fugir" da posição
  // que o jogador está olhando); clique+arraste no espaço vazio (fora de
  // .tree-node) = pan. Nada disso mexe nas coordenadas de UPGRADE_TREE —
  // só o transform CSS do .tree-canvas (ver applyTreeTransform).
  initTreePanZoom(){
    const wrap = document.getElementById('upgradeTreeWrap');
    const MIN_SCALE = 0.4, MAX_SCALE = 2.5;

    wrap.addEventListener('wheel', (e)=>{
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const v = this.treeView;
      const factor = e.deltaY < 0 ? 1.1 : (1/1.1);
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * factor));
      // mantém o ponto do mundo sob o cursor fixo na tela ao mudar o zoom
      const worldX = (mx - v.x) / v.scale, worldY = (my - v.y) / v.scale;
      v.scale = newScale;
      v.x = mx - worldX * newScale;
      v.y = my - worldY * newScale;
      this.applyTreeTransform();
    }, { passive:false });

    let dragging = false, lastX = 0, lastY = 0;
    wrap.addEventListener('mousedown', (e)=>{
      if(e.target.closest('.tree-node') || e.target.closest('.tree-reset-btn')) return; // só arrasta no espaço vazio
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      wrap.classList.add('dragging');
    });
    window.addEventListener('mousemove', (e)=>{
      if(!dragging) return;
      this.treeView.x += e.clientX - lastX;
      this.treeView.y += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      this.applyTreeTransform();
    });
    window.addEventListener('mouseup', ()=>{
      dragging = false;
      wrap.classList.remove('dragging');
    });

    document.getElementById('upgradeTreeResetBtn').addEventListener('click', ()=>this.resetTreeView());
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

    // Posição de monstro duplo (ver MAPS.slimes): destaca bem qual dos 2
    // monstros da dupla está na tela agora (1/2 ou 2/2).
    const badge = document.getElementById('doubleMonsterBadge');
    if(MonsterModule.current.isDouble){
      badge.textContent = `MONSTRO ${MonsterModule.current.doubleSubKill+1}/2`;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
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
      const maxCycleCompleted = state.dungeons[key].maxCycleCompleted || 0;
      row.className = 'shop-row';
      row.innerHTML = `
        <div class="shop-info">
          <div class="name">${map.name}</div>
          <div class="desc">${DungeonModule.progressLabel(key)}</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <button class="buy-btn dungeon-enter-btn">ENTRAR</button>
          ${maxCycleCompleted > 0 ? '<button class="small-btn dungeon-cyclepicker-btn">Escolher ciclo</button>' : ''}
        </div>`;
      row.querySelector('.dungeon-enter-btn').addEventListener('click', ()=>DungeonModule.enter(key));
      const cycleBtn = row.querySelector('.dungeon-cyclepicker-btn');
      if(cycleBtn) cycleBtn.addEventListener('click', ()=>UI.openCyclePicker(key));
      el.appendChild(row);
    }
  },
  // Seletor de ciclo (ver DungeonModule.startAtCycle) — só lista ciclos que
  // o jogador já concluiu (derrotou o chefe) nessa Dungeon.
  openCyclePicker(key){
    const map = MAPS[key];
    const max = state.dungeons[key].maxCycleCompleted || 0;
    document.getElementById('cyclePickerTitle').textContent = `ESCOLHER CICLO — ${map.name}`;
    const el = document.getElementById('cyclePickerList');
    el.innerHTML = '';
    for(let n=1; n<=max; n++){
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `<div class="shop-info"><div class="name">Ciclo ${n}</div></div><button class="buy-btn">INICIAR</button>`;
      row.querySelector('button').addEventListener('click', ()=>DungeonModule.startAtCycle(key, n));
      el.appendChild(row);
    }
    document.getElementById('cyclePickerModal').classList.add('open');
  },
  // Monta uma linha de item reutilizável — com botão de vender (Loja) e/ou
  // equipar (Mochila do Inventário, só pra itens com `equip` — ver
  // opts.showSellButton/opts.showEquipButton).
  buildItemRow(def, opts){
    opts = opts || {};
    const qty = state.inventory[def.key];
    const hasAny = qty > 0;
    const isEquipped = !!(def.equip && state.equipment[def.key] > 0);
    const row = document.createElement('div');
    row.className = 'shop-row'+(hasAny||isEquipped?'':' disabled');
    const sellBtnHtml = opts.showSellButton ? `<button class="buy-btn sell-btn" ${hasAny?'':'disabled'}>Vender tudo</button>` : '';
    const equipBtnHtml = (opts.showEquipButton && def.equip && !isEquipped) ? `<button class="buy-btn equip-btn" ${hasAny?'':'disabled'}>Equipar</button>` : '';
    const equipDesc = def.equip ? `+${def.equip.clickDamageBonus} dano por clique${isEquipped ? ' (equipada)' : ''}` : '';
    const sellDesc = opts.showSellButton ? 'Vende por '+def.sellPrice+' ouro cada' : '';
    row.innerHTML = `
      <div class="shop-info">
        <div class="name"><div class="icon icon-${def.icon}"></div>${def.name}</div>
        <div class="desc">${[sellDesc, equipDesc].filter(Boolean).join(' · ')}</div>
        <div class="owned">Possui: ${qty}</div>
      </div>${equipBtnHtml}${sellBtnHtml}`;
    if(opts.showSellButton && hasAny){
      row.querySelector('.sell-btn').addEventListener('click', ()=>{
        const earned = qty * def.sellPrice;
        state.gold += earned;
        state.goldEarnedThisRun += earned;
        state.inventory[def.key] = 0;
        UI.renderAll();
      });
    }
    if(opts.showEquipButton && def.equip && !isEquipped && hasAny){
      row.querySelector('.equip-btn').addEventListener('click', ()=>{
        state.inventory[def.key] -= 1;
        state.equipment[def.key] = 1;
        state.clickDamageFlat += def.equip.clickDamageBonus;
        UI.renderAll();
        UI.showToast('EQUIPADO', `${def.name} equipada! +${def.equip.clickDamageBonus} dano por clique.`);
      });
    }
    return row;
  },
  renderShop(){
    const el = document.getElementById('shopList');
    el.innerHTML = '';
    for(const def of ITEM_DEFS) el.appendChild(this.buildItemRow(def, { showSellButton:true }));
  },
  // Mochila do Inventário: mesma lista de itens, com botão de equipar pros
  // que têm `equip` (vender continua exclusivo da Loja). Item equipado
  // continua aparecendo mesmo com 0 unidades restantes, pra mostrar o status.
  renderInventoryBag(){
    const el = document.getElementById('inventoryBagList');
    el.innerHTML = '';
    const owned = ITEM_DEFS.filter(d=>state.inventory[d.key] > 0 || (d.equip && state.equipment[d.key] > 0));
    if(owned.length === 0){
      el.innerHTML = '<div class="footer-note">Sua mochila está vazia. Explore as Dungeons para coletar itens.</div>';
      return;
    }
    for(const def of owned) el.appendChild(this.buildItemRow(def, { showSellButton:false, showEquipButton:true }));
  },
  // Aba Armas do Inventário: mostra a(s) arma(s) escolhida(s) com o Clérigo/
  // compradas no Ferreiro E os equipamentos dropados em Dungeons já
  // equipados (ver ITEM_DEFS.equip/state.equipment) — só visualização.
  renderWeaponsList(){
    const el = document.getElementById('weaponsList');
    el.innerHTML = '';
    const ownedWeapons = WEAPON_DEFS.filter(d=>state.weapons[d.key] > 0);
    const ownedGear = ITEM_DEFS.filter(d=>d.equip && state.equipment[d.key] > 0);
    if(ownedWeapons.length === 0 && ownedGear.length === 0){
      el.innerHTML = '<div class="footer-note">Nenhuma arma equipada ainda.</div>';
      return;
    }
    for(const def of ownedWeapons){
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `
        <div class="shop-info">
          <div class="name"><div class="icon icon-${def.icon}"></div>${def.name}</div>
          <div class="desc">+${def.clickDamageBonus} dano por clique</div>
        </div>`;
      el.appendChild(row);
    }
    for(const def of ownedGear){
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `
        <div class="shop-info">
          <div class="name"><div class="icon icon-${def.icon}"></div>${def.name}</div>
          <div class="desc">+${def.equip.clickDamageBonus} dano por clique</div>
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
  // visuais em UPGRADE_TREE (config.js): a raiz (`UPGRADE_TREE.root`) fica
  // no centro (`hub`) e é um nó de verdade (clicável, com nível/custo), não
  // só um rótulo decorativo — os outros brotam dela por linhas curvas, feito
  // raiz de planta. O desbloqueio real é decidido por ProgressionModule
  // (via `requires` em UPGRADE_DEFS) — esta função só posiciona os nós.
  renderUpgradeTree(){
    const linesEl = document.getElementById('upgradeTreeLines');
    const nodesEl = document.getElementById('upgradeTreeNodes');
    linesEl.innerHTML = '';
    nodesEl.innerHTML = '';

    const hub = UPGRADE_TREE.hub;

    // Curva suave (Bezier quadrática) em vez de linha reta, pra parecer raiz
    // de verdade brotando do centro — o SVG usa viewBox 0-100 (ver
    // index.html), então as mesmas coordenadas dos nós (%) valem aqui.
    const rootPath = (x1,y1,x2,y2,color)=>{
      const dx = x2-x1, dy = y2-y1;
      const len = Math.hypot(dx,dy) || 1;
      const CURVE = 8; // deslocamento perpendicular do ponto de controle
      const ctrlX = (x1+x2)/2 + (-dy/len)*CURVE;
      const ctrlY = (y1+y2)/2 + (dx/len)*CURVE;
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d', `M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`);
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', 'none');
      path.setAttribute('opacity', '0.7');
      linesEl.appendChild(path);
    };

    // Monta um nó (raiz ou branch) — mesmo card pros dois casos, só o da
    // raiz ganha a classe extra `root-node` (maior, brilho de brasa fixo).
    const buildNode = (key, x, y, color, isRoot)=>{
      const def = UPGRADE_DEFS.find(u=>u.key===key);
      const el = document.createElement('div');
      el.className = 'tree-node'+(isRoot ? ' root-node' : '');
      el.style.left = x+'%';
      el.style.top = y+'%';
      if(!isRoot) el.style.borderColor = color;

      if(!ProgressionModule.isUnlocked('upgrade', key)){
        el.classList.add('locked');
        el.innerHTML = `
          <div class="node-name"><div class="icon icon-lock"></div>${def.name}</div>
          <div class="node-tooltip">${ProgressionModule.lockLabel('upgrade', key)}</div>`;
        nodesEl.appendChild(el);
        return;
      }

      const lvl = state.upgrades[key];
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
        plusBtn.addEventListener('click', (e)=>{ e.stopPropagation(); UpgradesModule.buy(key); });
      }
      nodesEl.appendChild(el);
    };

    // raiz no centro, primeiro (fica embaixo das raízes na ordem do DOM,
    // mas ambos têm z-index próprio via CSS então não faz diferença visual)
    buildNode(UPGRADE_TREE.root, hub.x, hub.y, null, true);

    for(const branch of UPGRADE_TREE.branches){
      const node = branch.nodes[0];
      // rótulo da branch, um pouco além do nó (perto colide com o círculo)
      const dx = node.x - hub.x, dy = node.y - hub.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      const EXTEND = 13; // pontos percentuais além do centro do nó
      const labelX = Math.max(12, Math.min(88, node.x + (dx/dist)*EXTEND));
      const labelY = Math.max(6, Math.min(94, node.y + (dy/dist)*EXTEND));
      const label = document.createElement('div');
      label.className = 'tree-branch-label';
      label.style.left = labelX+'%';
      label.style.top = labelY+'%';
      label.style.color = branch.color;
      label.textContent = branch.label;
      nodesEl.appendChild(label);

      rootPath(hub.x, hub.y, node.x, node.y, branch.color);
      buildNode(node.key, node.x, node.y, branch.color, false);

      // Nível 2 do ramo: brota do nó de Nível 1 (não do hub) — mesma curva,
      // só a origem muda. De propósito ficam fora da área 0-100 visível a
      // zoom 1 (ver posições em UPGRADE_TREE), então só aparecem dando
      // zoom out ou arrastando o mapa.
      for(const child of (branch.children || [])){
        rootPath(node.x, node.y, child.x, child.y, branch.color);
        buildNode(child.key, child.x, child.y, branch.color, false);
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
  // `index` (opcional): quando um monstro dropa vários itens na mesma
  // morte (ver MonsterModule.onDeath), escalona as mensagens na vertical pra
  // não ficarem todas empilhadas exatamente no mesmo pixel.
  showFloatingItem(qty, itemDef, index){
    const stage = document.getElementById('monsterStage');
    const div = document.createElement('div');
    div.className = 'float-dmg';
    div.style.color = '#8fe0c8';
    div.textContent = '+'+qty+' '+itemDef.name;
    div.style.left = '50%';
    div.style.top = 'calc(50% + '+((index||0)*22)+'px)';
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
