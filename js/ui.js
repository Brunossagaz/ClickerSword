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
    this.initModalTabs('ferreiroModal');
    // Ferreiro também é especial: na 1ª vez, o Creiton se apresenta antes de
    // abrir o ferreiro normal — ver QuestModule.openCreitonIntro. Nas próximas
    // vezes, sorteia uma fala solta dele (CREITON_LINES) só de clima, mesmo
    // padrão do Barnabé na Loja (BARNABE_LINES/lojaBarnabeLine).
    const ferreiroModal = document.getElementById('ferreiroModal');
    document.getElementById('openFerreiroBtn').addEventListener('click', ()=>{
      if(!state.metCreiton){
        QuestModule.openCreitonIntro();
      } else {
        document.getElementById('ferreiroCreitonLine').textContent =
          '"'+CREITON_LINES[Math.floor(Math.random()*CREITON_LINES.length)]+'"';
        ferreiroModal.classList.add('open');
      }
    });
    document.getElementById('ferreiroCloseBtn').addEventListener('click', ()=>ferreiroModal.classList.remove('open'));
    ferreiroModal.addEventListener('click', (e)=>{ if(e.target === ferreiroModal) ferreiroModal.classList.remove('open'); });
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
    this.wireBuildingModal('openAcademiaBtn', 'academiaModal', 'academiaCloseBtn');
    this.initModalTabs('sidebarInventory');
    this.initSidebarToggle();
    document.getElementById('cavernChestBtn').addEventListener('click', ()=>CavernModule.collectChest());
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

    // A introdução do Clérigo (nome/história/arma) dispara sozinha ao entrar
    // na cidade (ver showCityView) — o clique na Igreja, na 1ª vez, ainda
    // apresenta a missão da Caverna (ver QuestModule.openAnselmoCaveIntro/
    // state.caveQuestAnnounced), mesmo padrão de Barnabé na Loja/Creiton no
    // Ferreiro; das próximas vezes em diante já abre o modal normal.
    const igrejaModal = document.getElementById('igrejaModal');
    document.getElementById('openIgrejaBtn').addEventListener('click', ()=>{
      if(!state.caveQuestAnnounced){
        QuestModule.openAnselmoCaveIntro();
      } else {
        igrejaModal.classList.add('open');
      }
    });
    document.getElementById('igrejaCloseBtn').addEventListener('click', ()=>igrejaModal.classList.remove('open'));
    igrejaModal.addEventListener('click', (e)=>{ if(e.target === igrejaModal) igrejaModal.classList.remove('open'); });
    OnboardingModule.init();

    // Loja também é especial: na 1ª vez, o Barnabé se apresenta antes de
    // abrir a loja normal — ver QuestModule.openBarnabeIntro. Nas próximas
    // vezes, sorteia uma fala solta dele (BARNABE_LINES) só de clima.
    const lojaModal = document.getElementById('lojaModal');
    document.getElementById('openLojaBtn').addEventListener('click', ()=>{
      if(!state.metBarnabe){
        QuestModule.openBarnabeIntro();
      } else {
        document.getElementById('lojaBarnabeLine').textContent =
          '"'+BARNABE_LINES[Math.floor(Math.random()*BARNABE_LINES.length)]+'"';
        lojaModal.classList.add('open');
      }
    });
    document.getElementById('lojaCloseBtn').addEventListener('click', ()=>lojaModal.classList.remove('open'));
    lojaModal.addEventListener('click', (e)=>{ if(e.target === lojaModal) lojaModal.classList.remove('open'); });
    this.initModalTabs('lojaModal');
    // Botões "Tudo Geral"/"Zero Geral" de cada aba da Loja (ver setAllSellQty).
    document.getElementById('lojaDropsAllBtn').addEventListener('click', ()=>this.setAllSellQty(this.shopCategoryDefs().drops, true));
    document.getElementById('lojaDropsNoneBtn').addEventListener('click', ()=>this.setAllSellQty(this.shopCategoryDefs().drops, false));
    document.getElementById('lojaWeaponsAllBtn').addEventListener('click', ()=>this.setAllSellQty(this.shopCategoryDefs().weapons, true));
    document.getElementById('lojaWeaponsNoneBtn').addEventListener('click', ()=>this.setAllSellQty(this.shopCategoryDefs().weapons, false));
    document.getElementById('lojaMineralsAllBtn').addEventListener('click', ()=>this.setAllSellQty(this.shopCategoryDefs().minerals, true));
    document.getElementById('lojaMineralsNoneBtn').addEventListener('click', ()=>this.setAllSellQty(this.shopCategoryDefs().minerals, false));
    // Botão "Vender Selecionados" de cada aba da Loja (ver sellSelected).
    document.getElementById('lojaDropsSellSelectedBtn').addEventListener('click', ()=>this.sellSelected(this.shopCategoryDefs().drops));
    document.getElementById('lojaWeaponsSellSelectedBtn').addEventListener('click', ()=>this.sellSelected(this.shopCategoryDefs().weapons));
    document.getElementById('lojaMineralsSellSelectedBtn').addEventListener('click', ()=>this.sellSelected(this.shopCategoryDefs().minerals));
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
  // Sidebar do Inventário: fixa à esquerda, expande/encolhe clicando no
  // botão-aba (ver .sidebar-inventory/.sidebar-toggle-btn em style.css) —
  // alternativa ao modal antigo, sempre visível durante Cidade/Dungeon
  // (mesma regra do statBar que ela substituiu, ver showScreen).
  initSidebarToggle(){
    const sidebar = document.getElementById('sidebarInventory');
    document.getElementById('sidebarToggleBtn').addEventListener('click', ()=>{
      sidebar.classList.toggle('expanded');
    });
  },
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
    // sidebar do inventário substitui o antigo statBar — mesma regra de
    // visibilidade (só durante Cidade/Dungeon, nunca no menu/seletor de save)
    document.getElementById('sidebarInventory').style.display = (id==='view-city'||id==='view-dungeon') ? '' : 'none';
    // No menu principal a engrenagem de Configurações fica escondida (ver
    // body.screen-mainmenu em style.css) — já existe o botão CONFIGURAÇÕES
    // ali dentro, a engrenagem só volta a aparecer nas outras telas.
    document.body.classList.toggle('screen-mainmenu', id==='view-mainmenu');
  },
  showMainMenu(){ this.showScreen('view-mainmenu'); },
  showSlotPicker(){ MainMenuModule.renderSlotPicker(); this.showScreen('view-slotpicker'); },
  // Único ponto de entrada na tela da cidade (novo jogo, retomar save,
  // sair de dungeon, ascender) — cobre "personagem novo" aqui em vez de só
  // no clique da Igreja, então a introdução do Clérigo aparece sozinha
  // assim que a cidade abre pela 1ª vez (ver OnboardingModule.shouldShowClericIntro).
  showCityView(){
    this.showScreen('view-city');
    if(OnboardingModule.shouldShowClericIntro()) OnboardingModule.openClericIntro();
  },
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
      openLojaBtn:'loja', openIgrejaBtn:'igreja', openDungeonBtn:'dungeon',
      openAcademiaBtn:'academia'
    };
    for(const btnId in buildingByBtn){
      document.getElementById(btnId).disabled = !OnboardingModule.isBuildingUnlocked(buildingByBtn[btnId]);
    }
    // Progresso de entradas na Dungeon, só enquanto a Academia estiver
    // trancada (ver OnboardingModule.academiaProgressLabel).
    document.getElementById('academiaProgress').textContent = OnboardingModule.academiaProgressLabel() || '';
  },
  // 1ª entrada na Dungeon da vida do personagem (ver
  // OnboardingModule.isFirstDungeonEntry): esconde o botão "Voltar pra
  // cidade" do cabeçalho, pra forçar pelo menos uma tentativa de verdade —
  // já a partir da 2ª entrada (completando o ciclo ou não) volta a aparecer.
  renderLeaveButtonVisibility(){
    document.getElementById('leaveDungeonBtn').style.display = OnboardingModule.isFirstDungeonEntry() ? 'none' : '';
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
    // "Voltar pra cidade" sempre disponível aqui, mesmo na 1ª entrada (ver
    // OnboardingModule.isFirstDungeonEntry) — o bloqueio é só pra impedir
    // abandonar uma luta em andamento à toa; se o personagem não tem dano
    // suficiente pra vencer dentro do tempo, precisa de uma saída.
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
    const loop = MonsterModule.currentCycleFor(state.currentDungeon);
    // posição no ciclo é por SLOT (1-10), não por monstro morto — uma posição
    // dupla (ver MAPS.slimes) vale 1 posição só, mesmo consumindo 2 mortes
    const slotPos = MonsterModule.current.slotIdx + 1;
    const totalSlots = MonsterModule.current.totalSlots;
    const monsterNameEl = document.getElementById('monsterName');
    monsterNameEl.innerHTML = (MonsterModule.current.isBoss ? '<div class="icon icon-boss"></div>CHEFE: ' : '') + t.name;
    document.getElementById('tierLabel').textContent = `${MAPS[state.currentDungeon].name} · CICLO ${loop} · MONSTRO ${slotPos}/${totalSlots} (ABATIDOS NO TOTAL: ${state.totalKillsAll})`;

    // Posição de monstro em grupo (dupla ou tripla, ver MAPS.slimes/
    // MAPS.dragons): destaca bem qual fase do grupo está na tela agora
    // (1/2, 2/2, 1/3, 2/3, 3/3...).
    const badge = document.getElementById('doubleMonsterBadge');
    if(MonsterModule.current.isDouble){
      badge.textContent = `MONSTRO ${MonsterModule.current.doubleSubKill+1}/${MonsterModule.current.groupSize}`;
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
  // Registro de drops da dungeon atual — reseta a cada entrada nova (ver
  // DungeonModule._enterAt) e ganha uma entrada por morte que dropou algo
  // (ver MonsterModule.onDeath). Mais recente no topo; capado pra não crescer
  // sem limite numa sessão AFK longa.
  _dropLog:[],
  resetDropLog(){
    this._dropLog = [];
    this.renderDropLog();
  },
  logDrops(slotPos, drops){
    if(!drops.length) return;
    this._dropLog.unshift({ slotPos, drops });
    if(this._dropLog.length > 30) this._dropLog.length = 30;
    this.renderDropLog();
  },
  renderDropLog(){
    const el = document.getElementById('dropLog');
    if(!this._dropLog.length){
      el.innerHTML = '<div class="footer-note" style="margin:0;">Nenhum item dropado ainda nesse ciclo.</div>';
      return;
    }
    el.innerHTML = this._dropLog.map(entry => {
      const items = entry.drops.map(d => {
        const itemDef = ITEM_DEFS.find(i => i.key === d.item);
        return `<div class="drop-log-item">Dropou ${d.qty}x ${itemDef.name}</div>`;
      }).join('');
      return `<div class="drop-log-entry"><div class="drop-log-monster">Monstro ${entry.slotPos}</div>${items}</div>`;
    }).join('');
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
    // MonsterModule.maybeTriggerGolden roda a cada tick mesmo fora de uma
    // Dungeon (ver main.js) — sem essa guarda, o sorteio do monstro dourado
    // acertando enquanto o jogador está na cidade quebrava aqui
    // (MonsterModule.current nulo).
    if(MonsterModule.current) this.renderMonsterSprite();
  },
  // Aba Estatísticas da sidebar do Inventário — substitui o antigo statBar
  // (que só tinha 4 valores) por um resumo mais completo do personagem.
  renderStats(){
    document.getElementById('invStatGold').textContent = this.fmt(state.gold);
    document.getElementById('invStatClickDmg').textContent = this.fmt(PlayerModule.clickDamage());
    document.getElementById('invStatDps').textContent = this.fmt(TroopsModule.totalDps());
    document.getElementById('invStatCrit').textContent = Math.round((state.critChance+state.pCritChance)*100)+'%';
    // toFixed em vez de fmt() aqui: taxas de minério começam fracionárias
    // (ex.: 0.10/seg) e fmt() arredonda pra baixo em inteiro, mostraria "0"
    const orePerSec = CavernModule.totalOrePerSecond().toFixed(2);
    document.getElementById('invStatOrePerSec').textContent = orePerSec;
    document.getElementById('statOrePerSec').textContent = orePerSec; // mesma taxa, exibida de novo dentro do modal da Caverna
    document.getElementById('invStatEssence').textContent = this.fmt(state.essence);
    document.getElementById('invStatKills').textContent = this.fmt(state.totalKillsAll);
    document.getElementById('invStatAutoClick').textContent = this.autoClickStatusText();
  },
  // Texto do intervalo do Clique Automático — reaproveitado pela aba
  // Estatísticas (sempre visível) e pelo aviso dentro da Dungeon (ver
  // renderAutoClickStatus). "—" se nem comprado ainda.
  autoClickStatusText(){
    if(state.upgrades.battleAutoClick <= 0) return '—';
    if(!PlayerModule.isAutoClickActive()) return 'Pausado';
    return (PlayerModule.autoClickIntervalMs()/1000).toFixed(2).replace(/\.?0+$/, '')+'s';
  },
  // Aviso dentro da Dungeon (ver index.html #autoClickNote) — só aparece se
  // o jogador já comprou o upgrade; explica por que ele está pausado quando
  // o ciclo atual ainda não foi concluído antes (ver
  // PlayerModule.isAutoClickActive).
  renderAutoClickStatus(){
    const el = document.getElementById('autoClickNote');
    if(state.upgrades.battleAutoClick <= 0 || !MonsterModule.current){
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    if(PlayerModule.isAutoClickActive()){
      el.classList.remove('warning');
      el.textContent = `Clique Automático ativo — 1 clique a cada ${this.autoClickStatusText()}.`;
    } else {
      el.classList.add('warning');
      el.textContent = 'Clique Automático pausado: só funciona em ciclos já vencidos antes (derrote o chefe deste ciclo pela 1ª vez).';
    }
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
            <div class="desc">Requer vencer o Ciclo ${req.cycle} do ${MAPS[req.dungeon].name}</div>
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
  // Quantidade selecionada pra vender de cada item (Loja) — sobrevive a
  // re-renders (renderShop() é chamado a cada clique de -/+/Tudo), só reseta
  // depois de uma venda de verdade. Inicializado sob demanda em buildItemRow.
  shopSellQty:{},
  // Monta uma linha de item reutilizável — com seletor de quantidade +
  // vender (Loja, ver opts.showSellButton). Equipar arma NÃO passa mais por
  // aqui — nenhum ITEM_DEFS tem mais `equip` (armas dropadas são
  // `type:'brokenWeapon'`, precisam ser forjadas primeiro, ver
  // renderForgeList); equipar acontece só na aba Armas do Inventário
  // (ver renderWeaponsList/PlayerModule.equipWeapon).
  buildItemRow(def, opts){
    opts = opts || {};
    const qty = state.inventory[def.key];
    const hasAny = qty > 0;
    const row = document.createElement('div');
    row.className = 'shop-row'+(hasAny?'':' disabled');
    const sellDesc = opts.showSellButton ? 'Vende por '+def.sellPrice+' moeda(s) cada' : '';
    const rarityHtml = def.rarity ? `<span class="rarity-tag rarity-${def.rarity}">${RARITY_DEFS[def.rarity].label}</span>` : '';

    let sellControlsHtml = '';
    if(opts.showSellButton){
      // Sempre começa em 0 (nunca pré-seleciona 1) — o jogador escolhe
      // quanto vender explicitamente, com +/-/Tudo ou os botões "Geral" da
      // aba (ver setAllSellQty). Clampado entre 0 e o quanto ele possui.
      const selQty = Math.max(0, Math.min(this.shopSellQty[def.key] || 0, qty));
      this.shopSellQty[def.key] = selQty;
      const dis = hasAny ? '' : 'disabled';
      const minusDis = (hasAny && selQty > 0) ? '' : 'disabled';
      const plusDis = (hasAny && selQty < qty) ? '' : 'disabled';
      const sellDis = (hasAny && selQty > 0) ? '' : 'disabled';
      sellControlsHtml = `
        <div class="qty-stepper">
          <button class="qty-btn qty-minus" ${minusDis}>−</button>
          <span class="qty-value">${selQty}</span>
          <button class="qty-btn qty-plus" ${plusDis}>+</button>
          <button class="small-btn qty-all-btn" ${dis}>Tudo</button>
          <button class="buy-btn sell-btn" ${sellDis}>Vender</button>
        </div>`;
    }

    row.innerHTML = `
      <div class="shop-info">
        <div class="name"><div class="icon icon-${def.icon}"></div>${def.name}${rarityHtml}</div>
        <div class="desc">${sellDesc}</div>
        <div class="owned">Possui: ${qty}</div>
      </div>${sellControlsHtml}`;

    if(opts.showSellButton && hasAny){
      row.querySelector('.qty-minus').addEventListener('click', ()=>{
        this.shopSellQty[def.key] = Math.max(0, (this.shopSellQty[def.key]||0) - 1);
        this.renderShop();
      });
      row.querySelector('.qty-plus').addEventListener('click', ()=>{
        this.shopSellQty[def.key] = Math.min(qty, (this.shopSellQty[def.key]||0) + 1);
        this.renderShop();
      });
      row.querySelector('.qty-all-btn').addEventListener('click', ()=>{
        this.shopSellQty[def.key] = qty;
        this.renderShop();
      });
      row.querySelector('.sell-btn').addEventListener('click', ()=>{
        const sellQty = Math.max(0, Math.min(this.shopSellQty[def.key] || 0, qty));
        if(sellQty <= 0) return;
        const earned = sellQty * def.sellPrice;
        state.gold += earned;
        state.goldEarnedThisRun += earned;
        state.inventory[def.key] -= sellQty;
        this.shopSellQty[def.key] = 0;
        UI.renderAll();
      });
    }
    return row;
  },
  // Loja separada em 3 abas por categoria — derivadas do campo `type` de
  // ITEM_DEFS: `type:'material'` marca os drops comuns de monstro;
  // `type:'mineral'` marca os minérios da Caverna; `type:'brokenWeapon'`
  // marca as armas brutas dropadas (precisam ser forjadas no Ferreiro pra
  // virar equipáveis, ver renderForgeList). Reaproveitado pelos botões
  // "Tudo Geral"/"Zero Geral" de cada aba (ver setAllSellQty).
  shopCategoryDefs(){
    return {
      drops: ITEM_DEFS.filter(d=>d.type==='material'),
      weapons: ITEM_DEFS.filter(d=>d.type==='brokenWeapon'),
      minerals: ITEM_DEFS.filter(d=>d.type==='mineral'),
    };
  },
  renderShop(){
    const cats = this.shopCategoryDefs();
    const fillList = (elId, defs)=>{
      const el = document.getElementById(elId);
      el.innerHTML = '';
      for(const def of defs) el.appendChild(this.buildItemRow(def, { showSellButton:true }));
    };
    fillList('shopListDrops', cats.drops);
    fillList('shopListWeapons', cats.weapons);
    fillList('shopListMinerals', cats.minerals);
    // "Vender Selecionados" só fica habilitado se ALGUM item da aba tiver
    // quantidade > 0 selecionada (ver sellSelected) — nenhuma quantidade
    // escolhida = clicar não teria efeito nenhum.
    const anySelected = defs => defs.some(def => (this.shopSellQty[def.key] || 0) > 0);
    document.getElementById('lojaDropsSellSelectedBtn').disabled = !anySelected(cats.drops);
    document.getElementById('lojaWeaponsSellSelectedBtn').disabled = !anySelected(cats.weapons);
    document.getElementById('lojaMineralsSellSelectedBtn').disabled = !anySelected(cats.minerals);
  },
  // Botão "Tudo Geral"/"Zero Geral" de uma aba da Loja — só ajusta o
  // seletor de quantidade de TODOS os itens daquela categoria de uma vez
  // (mesmo efeito do botão "Tudo" de uma linha, só que pra lista inteira);
  // não vende nada sozinho, o jogador ainda confirma com "Vender" em cada
  // linha (ou com "Vender Selecionados", ver sellSelected).
  setAllSellQty(defs, toMax){
    for(const def of defs){
      this.shopSellQty[def.key] = toMax ? state.inventory[def.key] : 0;
    }
    this.renderShop();
  },
  // Botão "Vender Selecionados" de uma aba da Loja — vende de uma vez todo
  // item da categoria com quantidade > 0 em shopSellQty, sem precisar
  // clicar "Vender" linha por linha. Mesma lógica de venda do `.sell-btn`
  // individual (ver buildItemRow), só que somada pra vários itens antes de
  // re-renderizar.
  sellSelected(defs){
    for(const def of defs){
      const qty = state.inventory[def.key];
      const sellQty = Math.max(0, Math.min(this.shopSellQty[def.key] || 0, qty));
      if(sellQty <= 0) continue;
      const earned = sellQty * def.sellPrice;
      state.gold += earned;
      state.goldEarnedThisRun += earned;
      state.inventory[def.key] -= sellQty;
      this.shopSellQty[def.key] = 0;
    }
    UI.renderAll();
  },
  // Mochila do Inventário: mesma lista de itens (vender continua exclusivo
  // da Loja) — inclui armas brutas ainda não forjadas, minérios e drops
  // comuns, tudo só visualização aqui.
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
  // Monta a lista de bônus de uma arma pra exibição (Escolha do Clérigo,
  // Ferreiro, Forjar, aba Armas) — só mostra os campos presentes, todos
  // opcionais (ver lista completa em WEAPON_DEFS/FORGED_WEAPON_DEFS). Novo
  // tipo de bônus no futuro: só adicionar 1 linha aqui pra aparecer em
  // TODA tela de uma vez, sem duplicar em cada render* separado.
  weaponBonusText(def){
    const parts = [];
    if(def.clickDamageBonus) parts.push(`+${def.clickDamageBonus} dano por clique`);
    if(def.dpsBonus) parts.push(`+${def.dpsBonus} DPS`);
    if(def.critChanceBonus) parts.push(`+${Math.round(def.critChanceBonus*100)}% chance de crítico`);
    if(def.critDamageBonus) parts.push(`+${Math.round(def.critDamageBonus*100)}% dano crítico`);
    if(def.extraDropChance) parts.push(`${Math.round(def.extraDropChance*100)}% chance de drop extra`);
    if(def.burnChance) parts.push(`${Math.round(def.burnChance*100)}% chance de queimadura`);
    return parts.join(' · ');
  },
  // Aba Armas do Inventário — "seleção de arma equipada": lista TODA arma
  // que o jogador já possui (iniciais de WEAPON_DEFS + forjadas de
  // FORGED_WEAPON_DEFS, mesmo pool state.weapons), cada uma com um botão
  // Equipar (chama PlayerModule.equipWeapon) ou o selo "Equipada" se for a
  // state.equippedWeapon atual — só UMA fica ativa por vez, ver
  // PlayerModule.clickDamage/TroopsModule.totalDps.
  renderWeaponsList(){
    const el = document.getElementById('weaponsList');
    el.innerHTML = '';
    const owned = [...WEAPON_DEFS, ...FORGED_WEAPON_DEFS].filter(d=>state.weapons[d.key] > 0);
    if(owned.length === 0){
      el.innerHTML = '<div class="footer-note">Nenhuma arma ainda. Escolha uma com o Clérigo ou compre/forje no Ferreiro.</div>';
      return;
    }
    for(const def of owned){
      const isEquipped = state.equippedWeapon === def.key;
      const row = document.createElement('div');
      row.className = 'shop-row'+(isEquipped ? ' equipped' : '');
      row.innerHTML = `
        <div class="shop-info">
          <div class="name"><div class="icon icon-${def.icon}"></div>${def.name}</div>
          <div class="desc">${this.weaponBonusText(def)}</div>
        </div>
        ${isEquipped ? '<div class="owned">Equipada</div>' : '<button class="buy-btn equip-btn">Equipar</button>'}`;
      if(!isEquipped){
        row.querySelector('.equip-btn').addEventListener('click', ()=>PlayerModule.equipWeapon(def.key));
      }
      el.appendChild(row);
    }
  },
  // Loja de armas do Ferreiro — vende as armas que o jogador ainda não tem
  // (a 1ª já veio de graça do Clérigo). Comprar só dá posse (state.weapons)
  // — não equipa sozinho, o jogador escolhe na aba Armas do Inventário
  // (ver renderWeaponsList/PlayerModule.equipWeapon).
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
            <div class="desc">${this.weaponBonusText(def)}</div>
            <div class="owned">Possui</div>
          </div>`;
      } else {
        row.className = 'shop-row'+(canAfford?'':' disabled');
        row.innerHTML = `
          <div class="shop-info">
            <div class="name"><div class="icon icon-${def.icon}"></div>${def.name}</div>
            <div class="desc">${this.weaponBonusText(def)}</div>
          </div>
          <button class="buy-btn" ${canAfford?'':'disabled'}><div class="icon icon-coin"></div> ${UI.fmt(def.buyCost)}</button>`;
        if(canAfford){
          row.querySelector('button').addEventListener('click', ()=>{
            state.gold -= def.buyCost;
            state.weapons[def.key] = 1;
            UI.renderAll();
          });
        }
      }
      el.appendChild(row);
    }
  },
  // Aba Forjar do Ferreiro — conserta uma arma bruta (ver ITEM_DEFS
  // type:'brokenWeapon') em FORGED_WEAPON_DEFS. Cada material mostra
  // possui/precisa, verde se já tem o suficiente. Já forjada não mostra
  // botão de novo (state.weapons[key] só vai a 1, não empilha).
  renderForgeList(){
    const el = document.getElementById('forgeList');
    el.innerHTML = '';
    for(const def of FORGED_WEAPON_DEFS){
      const owned = state.weapons[def.key] > 0;
      const row = document.createElement('div');
      const materialsHtml = def.recipe.materials.map(m=>{
        const itemDef = ITEM_DEFS.find(i=>i.key===m.itemKey);
        const have = state.inventory[m.itemKey];
        const met = have >= m.qty;
        return `<div class="recipe-material ${met?'met':'unmet'}">${itemDef.name}: ${have}/${m.qty}</div>`;
      }).join('');
      if(owned){
        row.className = 'shop-row';
        row.innerHTML = `
          <div class="shop-info">
            <div class="name"><div class="icon icon-${def.icon}"></div>${def.name}</div>
            <div class="desc">${this.weaponBonusText(def)}</div>
            <div class="owned">Já forjada</div>
          </div>`;
      } else {
        const canForge = ForgeModule.canForge(def);
        row.className = 'shop-row'+(canForge?'':' disabled');
        row.innerHTML = `
          <div class="shop-info">
            <div class="name"><div class="icon icon-${def.icon}"></div>${def.name}</div>
            <div class="desc">${this.weaponBonusText(def)}</div>
            <div class="recipe-materials">${materialsHtml}</div>
          </div>
          <button class="buy-btn" ${canForge?'':'disabled'}><div class="icon icon-coin"></div> ${UI.fmt(def.recipe.coinCost)}</button>`;
        if(canForge){
          row.querySelector('button').addEventListener('click', ()=>ForgeModule.forge(def.key));
        }
      }
      el.appendChild(row);
    }
  },
  // Mineradores de MINÉRIO da Caverna — mesmo template das outras listas de
  // compra escalável (ex.: renderTroopList), usando PROSPECTOR_DEFS/CavernModule.
  renderOreProspectorList(){
    const el = document.getElementById('oreProspectorList');
    el.innerHTML = '';
    for(const def of PROSPECTOR_DEFS){
      const owned = state.prospectors[def.key];
      const cost = CavernModule.costForProspector(def);
      const canAfford = state.gold >= cost;
      const row = document.createElement('div');
      row.className = 'shop-row'+(canAfford?'':' disabled');
      row.innerHTML = `
        <div class="shop-info">
          <div class="name">${def.name}</div>
          <div class="desc">${def.desc} cada</div>
          <div class="owned">Possui: ${owned}</div>
        </div>
        <button class="buy-btn" ${canAfford?'':'disabled'}><div class="icon icon-coin"></div> ${UI.fmt(cost)}</button>`;
      row.querySelector('button').addEventListener('click', ()=>CavernModule.buyProspector(def.key));
      el.appendChild(row);
    }
  },
  // Upgrades da Caverna — mesmo template de renderPrestigeTab
  // (nível/maxLevel em vez de "Possui: N"), mas pagando moeda e sem
  // ProgressionModule (lista simples, sem árvore).
  renderCavernUpgradeList(){
    const el = document.getElementById('cavernUpgradeList');
    el.innerHTML = '';
    for(const def of CAVERN_UPGRADE_DEFS){
      const lvl = state.cavernUpgrades[def.key];
      const maxed = lvl >= def.maxLevel;
      const cost = CavernModule.costForUpgrade(def);
      const canAfford = !maxed && state.gold >= cost;
      const row = document.createElement('div');
      row.className = 'shop-row'+(canAfford?'':' disabled');
      row.innerHTML = `
        <div class="shop-info">
          <div class="name">${def.name}</div>
          <div class="desc">${def.desc}</div>
          <div class="owned">Nível: ${lvl}/${def.maxLevel}</div>
        </div>
        ${maxed ? '<div class="owned">MÁX</div>' : `<button class="buy-btn" ${canAfford?'':'disabled'}><div class="icon icon-coin"></div> ${UI.fmt(cost)}</button>`}`;
      if(!maxed) row.querySelector('button').addEventListener('click', ()=>CavernModule.buyUpgrade(def.key));
      el.appendChild(row);
    }
  },
  // Baú da Caverna — botão grande com o total acumulado
  // (desabilitado se vazio) + detalhamento por minério com a cor da
  // raridade (ver RARITY_DEFS). Clicar no botão chama CavernModule.collectChest.
  renderCavernChest(){
    const total = CavernModule.chestTotal();
    document.getElementById('cavernChestCount').textContent = total;
    document.getElementById('cavernChestBtn').disabled = total === 0;
    const el = document.getElementById('cavernChestBreakdown');
    el.innerHTML = '';
    for(const def of MINERAL_DEFS){
      const qty = state.cavernChest[def.key];
      if(qty <= 0) continue;
      const row = document.createElement('div');
      row.className = 'chest-breakdown-row';
      row.innerHTML = `<span class="rarity-dot rarity-${def.rarity}"></span>${def.name}: ${qty}`;
      el.appendChild(row);
    }
  },
  // Tropas não dependem mais da árvore de upgrades (Guilda vai ganhar seu
  // próprio conceito depois) — liberadas só por moeda, mesmo padrão da
  // Caverna (ver renderOreProspectorList).
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
        <button class="buy-btn" ${canAfford?'':'disabled'}><div class="icon icon-coin"></div> ${UI.fmt(cost)}</button>`;
      row.querySelector('button').addEventListener('click', ()=>TroopsModule.buy(def.key));
      el.appendChild(row);
    }
  },
  // Painel de Expedições da Guilda (ver GuildModule) — 3 estados possíveis:
  // sem tropa nenhuma comprada (nada pra mandar), expedição em andamento
  // (progresso) ou livre pra escolher um dos presets de duração.
  renderGuildExpedition(){
    const el = document.getElementById('guildExpeditionPanel');
    if(!el) return;
    if(GuildModule.troopPower() <= 0 && !state.guild.active){
      el.innerHTML = `<div class="footer-note" style="margin:0;">Compre ao menos 1 tropa abaixo pra habilitar expedições.</div>`;
      return;
    }
    if(state.guild.active){
      const def = GuildModule.expeditionDef(state.guild.cycleKey);
      el.innerHTML = `
        <div class="stat" style="margin-bottom:10px;">
          <div class="label">Expedição em andamento (${def.name})</div>
          <div class="value">${GuildModule.remainingLabel()}</div>
        </div>`;
      return;
    }
    el.innerHTML = '';
    for(const def of GUILD_EXPEDITION_DEFS){
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `
        <div class="shop-info">
          <div class="name">${def.name}</div>
          <div class="desc">${def.hours}h — rendimento estimado: ~${GuildModule.totalItemsFor(def.key)} item(ns)</div>
        </div>
        <button class="buy-btn">Enviar</button>`;
      row.querySelector('button').addEventListener('click', ()=>GuildModule.start(def.key));
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
        <div class="node-cost">${maxed ? 'MÁX' : '<div class=\"icon icon-coin\"></div> '+UI.fmt(cost)}</div>
        ${maxed ? '' : `<button class="node-plus-btn" ${canAfford?'':'disabled'}>+</button>`}
        <div class="node-tooltip">${def.desc}</div>`;
      if(!maxed){
        const plusBtn = el.querySelector('.node-plus-btn');
        plusBtn.addEventListener('click', (e)=>{ e.stopPropagation(); UpgradesModule.buy(key); });
      }
      nodesEl.appendChild(el);
    };

    // Desenha recursivamente os descendentes de um nó (Nível 2, 3, ...) —
    // suporta tanto "3 filhos irmãos do mesmo pai" (Crítico/Dano%/Dano
    // Crítico%) quanto uma CADEIA aninhada (Automação: autoClickSpeed2
    // dentro de `children` de autoClickSpeed1). Cada filho revela seu
    // próprio pré-requisito (`requires` em UPGRADE_DEFS) em vez de assumir
    // que é sempre `parent` — é o que permite a cadeia funcionar igual aos
    // ramos de irmãos, sem código separado pra cada formato. De propósito
    // ficam fora da área 0-100 visível a zoom 1 (ver posições em
    // UPGRADE_TREE), então só aparecem dando zoom out ou arrastando o mapa.
    const renderDescendants = (parentNode, children, color)=>{
      for(const child of (children || [])){
        const childDef = UPGRADE_DEFS.find(u=>u.key===child.key);
        if(state.upgrades[childDef.requires] <= 0) continue;
        rootPath(parentNode.x, parentNode.y, child.x, child.y, color);
        buildNode(child.key, child.x, child.y, color, false);
        renderDescendants(child, child.children, color);
      }
    };

    // raiz no centro, primeiro (fica embaixo das raízes na ordem do DOM,
    // mas ambos têm z-index próprio via CSS então não faz diferença visual)
    buildNode(UPGRADE_TREE.root, hub.x, hub.y, null, true);

    for(const branch of UPGRADE_TREE.branches){
      const node = branch.nodes[0];
      // Nó/linha de Nível 1 só aparecem depois que a raiz foi comprada pela
      // 1ª vez (nível >= 1) — antes disso nem o cadeado é mostrado, o ramo
      // inteiro fica reservado/invisível (rótulo incluso).
      if(state.upgrades[UPGRADE_TREE.root] <= 0) continue;
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
      renderDescendants(node, branch.children, branch.color);
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
      btn.textContent = 'GANHE MAIS MOEDA NESTE RUN PARA ASCENDER';
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
    this.renderAutoClickStatus();
    this.renderDungeonList();
    this.renderTroopList();
    this.renderGuildExpedition();
    this.renderOreProspectorList();
    this.renderCavernUpgradeList();
    this.renderCavernChest();
    this.renderShop();
    this.renderInventoryBag();
    this.renderWeaponsList();
    this.renderFerreiroWeapons();
    this.renderForgeList();
    this.renderCityBuildingLocks();
    this.renderLeaveButtonVisibility();
    QuestModule.renderAllQuestBanners();
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
  // Dano acumulado das tropas (DPS automático) — chamado periodicamente pelo
  // game loop (ver main.js/tick), não a cada tick de 200ms (viraria poluição
  // visual), daí não receber posição de clique como showFloatingDamage:
  // sempre no centro da arena, cor diferente (ver .float-dmg.dps) pra não
  // confundir com dano de clique (dourado) ou crítico (vermelho).
  showFloatingDpsDamage(dmg){
    const stage = document.getElementById('monsterStage');
    const div = document.createElement('div');
    div.className = 'float-dmg dps';
    div.textContent = '-'+this.fmt(dmg);
    stage.appendChild(div);
    setTimeout(()=>div.remove(), 850);
  },
  // 1 tick de queimadura (ver MonsterModule.checkBurnTick) — cor própria
  // (ver .float-dmg.burn), pra distinguir de clique/crítico/DPS das tropas.
  showFloatingBurnDamage(dmg){
    const stage = document.getElementById('monsterStage');
    const div = document.createElement('div');
    div.className = 'float-dmg burn';
    div.textContent = '-'+this.fmt(dmg);
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
