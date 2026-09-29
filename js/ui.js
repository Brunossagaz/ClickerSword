/* ---------------------------------------------------------------------
   UI MODULE (ui.js)
--------------------------------------------------------------------- */
const UI = {
  canvas:null, ctx:null,
  // Pan/zoom da árvore de Upgrades (Academia de Combate) — só transform
  // visual, não mexe nas posições dos nós (ver layoutUpgradeTree). Resetado
  // toda vez que o modal é aberto (ver initTreePanZoom).
  treeView:{ x:0, y:0, scale:1 },
  init(){
    this.canvas = document.getElementById('monsterCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.parentElement.addEventListener('click', (e)=>PlayerModule.handleClick(e));
    CityMapModule.init();
    HudModule.init();
    BestiaryModule.init();
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
      DungeonModule.leaveWithSummary('SAIU DA DUNGEON');
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
      DungeonModule.leaveWithSummary('TEMPO ESGOTADO');
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
        ferreiroModal.classList.add('open');
        DialogueModule.typeInto(document.getElementById('ferreiroCreitonLine'),
          '"'+CREITON_LINES[Math.floor(Math.random()*CREITON_LINES.length)]+'"', DialogueModule.voiceFor('creiton'));
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
    // repeatCycleModal (ver UI.openRepeatCycleModal): stepper com campo
    // digitável, clampado entre 2 e 50 só ao confirmar/perder foco — clampar
    // a cada tecla digitada atrapalharia quem está digitando um nº de 2
    // dígitos (ex.: "35" ficaria preso em "3" no meio do caminho).
    {
      const repeatCycleModal = document.getElementById('repeatCycleModal');
      const input = document.getElementById('repeatCycleInput');
      const clampInput = ()=>{
        let v = Math.round(Number(input.value));
        if(!Number.isFinite(v)) v = 2;
        v = Math.max(2, Math.min(50, v));
        input.value = v;
        return v;
      };
      document.getElementById('repeatCycleMinusBtn').addEventListener('click', ()=>{
        input.value = clampInput() - 1;
        clampInput();
      });
      document.getElementById('repeatCyclePlusBtn').addEventListener('click', ()=>{
        input.value = clampInput() + 1;
        clampInput();
      });
      input.addEventListener('change', clampInput);
      document.getElementById('repeatCycleCloseBtn').addEventListener('click', ()=>repeatCycleModal.classList.remove('open'));
      repeatCycleModal.addEventListener('click', (e)=>{ if(e.target === repeatCycleModal) repeatCycleModal.classList.remove('open'); });
      document.getElementById('repeatCycleConfirmBtn').addEventListener('click', ()=>{
        const times = clampInput();
        const target = UI.repeatCycleTarget;
        repeatCycleModal.classList.remove('open');
        if(target) DungeonModule.startAtCycleRepeat(target.key, target.cycleNum, times);
      });
    }
    {
      const repeatCycleResultModal = document.getElementById('repeatCycleResultModal');
      document.getElementById('repeatCycleResultCloseBtn').addEventListener('click', ()=>repeatCycleResultModal.classList.remove('open'));
      repeatCycleResultModal.addEventListener('click', (e)=>{ if(e.target === repeatCycleResultModal) repeatCycleResultModal.classList.remove('open'); });
    }
    this.wireBuildingModal('openAcademiaBtn', 'academiaModal', 'academiaCloseBtn');
    this.initModalTabs('academiaModal');
    // a árvore só mede o tamanho da janela quando está visível — ao voltar
    // pra aba dela, recentraliza (senão ficava com a medida de quando estava escondida)
    document.querySelector('#academiaModal .modal-tab-btn[data-tab="academiaTabTree"]')
      .addEventListener('click', ()=>this.resetTreeView());
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
        lojaModal.classList.add('open');
        DialogueModule.typeInto(document.getElementById('lojaBarnabeLine'),
          '"'+BARNABE_LINES[Math.floor(Math.random()*BARNABE_LINES.length)]+'"', DialogueModule.voiceFor('barnabe'));
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
    DialogueModule.init();
    DialogueModule.init();
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
    // ladrilho de fundo (.tree-wrap) anda junto com o mapa, senão os nós
    // "deslizam" por cima de um chão parado
    const wrap = document.getElementById('upgradeTreeWrap');
    wrap.style.backgroundPosition = `${v.x}px ${v.y}px`;
    wrap.style.backgroundSize = `${64*v.scale}px ${64*v.scale}px`;
  },
  // Centraliza na raiz com um zoom que mostra o 1º anel inteiro (ver
  // layoutUpgradeTree). Roda no próximo frame porque, vindo do clique que
  // abre a Academia, o modal ainda não tem tamanho medido.
  resetTreeView(){
    requestAnimationFrame(()=>{
      const wrap = document.getElementById('upgradeTreeWrap');
      const layout = this.treeLayout || this.layoutUpgradeTree();
      const w = wrap.clientWidth || 640, h = wrap.clientHeight || 520;
      const scale = Math.max(0.3, Math.min(1, (Math.min(w, h) / 2 - 10) / (layout.ring + 95)));
      this.treeView = { scale, x: w / 2 - layout.root.x * scale, y: h / 2 - layout.root.y * scale };
      this.applyTreeTransform();
    });
  },
  // Scroll do mouse = zoom (centrado no cursor, pra não "fugir" da posição
  // que o jogador está olhando); clique+arraste no espaço vazio (fora de
  // .tree-node) = pan. Nada disso mexe nas coordenadas de UPGRADE_TREE —
  // só o transform CSS do .tree-canvas (ver applyTreeTransform).
  initTreePanZoom(){
    const wrap = document.getElementById('upgradeTreeWrap');
    const MIN_SCALE = 0.2, MAX_SCALE = 2.5;

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
    // troca de tela no menu (abrir menu, seletor de save, entrar no jogo):
    // cobre com a tela de carregamento enquanto o layout novo monta
    const MENU = ['view-mainmenu', 'view-slotpicker'];
    if(this.currentScreen && this.currentScreen !== id && (MENU.includes(id) || MENU.includes(this.currentScreen))) LoadingModule.flash();
    this.currentScreen = id;
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
    document.body.classList.toggle('screen-slotpicker', id==='view-slotpicker');
    // Cidade vira mapa largo com NPCs animados (ver CityMapModule) — a
    // animação só roda enquanto essa tela está visível
    document.body.classList.toggle('screen-city', id==='view-city');
    document.body.classList.toggle('screen-dungeon', id==='view-dungeon');
    // mochila/inventário só existem durante o jogo; fecha ao sair
    if(id!=='view-city' && id!=='view-dungeon') HudModule.toggleInventory(false);
    CityMapModule.setActive(id==='view-city');
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
    document.getElementById('textSpeedSelect').value = SettingsModule.current.textSpeed;
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
      AchievementsModule.render();
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
    document.getElementById('textSpeedSelect').addEventListener('change', (e)=>SettingsModule.setTextSpeed(e.target.value));
    document.getElementById('textSpeedSelect').addEventListener('change', (e)=>SettingsModule.setTextSpeed(e.target.value));
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
  // Itens obtidos na entrada atual da Dungeon (state.dungeonRun.loot, somado
  // em MonsterModule.onDeath) — grade de ícones + quantidade ao lado da arena.
  resetDropLog(){ this.renderLootPanel(); },
  logDrops(){ this.renderLootPanel(); },
  renderLootPanel(){
    const el = document.getElementById('lootGrid');
    if(!el) return;
    const loot = (state.dungeonRun && state.dungeonRun.loot) || {};
    const items = ITEM_DEFS.filter(d => loot[d.key] > 0);
    if(!items.length){
      el.innerHTML = '<div class="footer-note" style="margin:0;">Nada ainda. Derrote monstros para coletar itens.</div>';
      return;
    }
    el.innerHTML = items.map(d => `<div class="bag-slot" data-key="${d.key}" tabindex="0"><div class="icon icon-${d.icon}"></div><span class="bag-qty">${this.fmt(loot[d.key])}</span></div>`).join('');
    this.bindGridTooltip(el, key => {
      const d = ITEM_DEFS.find(x => x.key === key);
      return { title: d.name, rarity: d.rarity, lines: [`Obtido nesta entrada: ${this.fmt(loot[key])}`, `Vende por ${d.sellPrice} moeda(s) cada`] };
    });
  },
  renderTimer(){
    if(!MonsterModule.current) return;
    const limitMs = MonsterModule.timeLimitMs();
    const remainingMs = Math.max(0, limitMs - (Date.now() - state.monsterSpawnedAt));
    const pct = Math.max(0, (remainingMs/limitMs)*100);
    const fill = document.getElementById('timerFill');
    const text = document.getElementById('timerText');
    fill.style.width = pct+'%';
    text.textContent = 'Monstro: '+Math.ceil(remainingMs/1000)+'s';
    fill.classList.toggle('urgent', remainingMs < 5000);

    // 2ª barra: tempo da entrada inteira na Dungeon (ver DungeonModule.tickRunTimer)
    const runLimitMs = DungeonModule.runTimeLimitMs();
    const runRemainingMs = Math.max(0, runLimitMs - state.dungeonRun.elapsedMs);
    const runSecs = Math.ceil(runRemainingMs/1000);
    const runFill = document.getElementById('dungeonTimerFill');
    runFill.style.width = ((runRemainingMs/runLimitMs)*100)+'%';
    document.getElementById('dungeonTimerText').textContent =
      `Dungeon: ${Math.floor(runSecs/60)}:${String(runSecs%60).padStart(2,'0')}`;
    runFill.classList.toggle('urgent', runRemainingMs < 10000);
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
    document.getElementById('hudGold').textContent = this.fmt(state.gold);
    document.getElementById('invStatClickDmg').textContent = this.fmt(PlayerModule.clickDamage());
    document.getElementById('invStatClickDmgTooltip').innerHTML = this.clickDamageBreakdownHtml();
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
  // Detalhamento do cálculo de Dano por Clique (tooltip ao passar o mouse
  // sobre a linha, ver .stat-row.has-tooltip/CSS) — espelha PASSO A PASSO a
  // MESMA fórmula de PlayerModule.clickDamage(), só pra deixar visível de
  // onde vem o número final. % de dano da Ascensão só aparece se o jogador
  // já tiver esse multiplicador (state.pClickMult>0), pra não poluir a
  // tooltip de quem nunca ascendeu.
  clickDamageBreakdownHtml(){
    const weaponDef = PlayerModule.equippedWeaponDef();
    const weaponBonus = weaponDef ? weaponDef.clickDamageBonus : 0;
    const dmgPercentPts = Math.round(state.clickDamagePercent * 100);
    const pClickPts = Math.round(state.pClickMult * 100);
    const rows = [
      `<div class="tt-row"><span>Dano base (Academia)</span><span>${this.fmt(state.clickDamageFlat)}</span></div>`,
      `<div class="tt-row"><span>Dano da arma${weaponDef ? ' ('+weaponDef.name+')' : ''}</span><span>${weaponDef ? this.fmt(weaponBonus) : '—'}</span></div>`,
      `<div class="tt-row"><span>% de dano (Academia)</span><span>+${dmgPercentPts}%</span></div>`,
    ];
    if(pClickPts > 0){
      rows.push(`<div class="tt-row"><span>% de dano (Ascensão)</span><span>+${pClickPts}%</span></div>`);
    }
    rows.push(`<div class="tt-row tt-total"><span>Total</span><span>${this.fmt(PlayerModule.clickDamage())}</span></div>`);
    return rows.join('');
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
      row.innerHTML = `
        <div class="shop-info"><div class="name">Ciclo ${n}</div></div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
          <button class="buy-btn cycle-start-btn">INICIAR</button>
          <button class="small-btn cycle-repeat-btn">Repetir Ciclo</button>
        </div>`;
      row.querySelector('.cycle-start-btn').addEventListener('click', ()=>DungeonModule.startAtCycle(key, n));
      row.querySelector('.cycle-repeat-btn').addEventListener('click', ()=>UI.openRepeatCycleModal(key, n));
      el.appendChild(row);
    }
    document.getElementById('cyclePickerModal').classList.add('open');
  },
  // Alvo (Dungeon + nº do ciclo) pro qual o repeatCycleModal aberto no
  // momento vai aplicar a repetição ao confirmar — setado em
  // openRepeatCycleModal, lido só pelo listener do repeatCycleConfirmBtn
  // (ver UI.init).
  repeatCycleTarget:null,
  // Abre o modal que pergunta quantas vezes (2-50) repetir um ciclo já
  // concluído (ver DungeonModule.startAtCycleRepeat) — chamado a partir do
  // seletor de ciclo (openCyclePicker), então `n` sempre já é um ciclo
  // vencido antes.
  openRepeatCycleModal(key, cycleNum){
    this.repeatCycleTarget = { key, cycleNum };
    document.getElementById('repeatCycleTitle').textContent = `REPETIR CICLO ${cycleNum}`;
    document.getElementById('repeatCycleInput').value = 2;
    document.getElementById('repeatCycleModal').classList.add('open');
  },
  // Resumo mostrado ao acabar uma sessão de "Repetir Ciclo" (ver
  // MonsterModule.onDeath/DungeonModule.startAtCycleRepeat) — abre por cima
  // da tela de seleção de Dungeons (pra onde o jogador já foi devolvido por
  // DungeonModule.leaveToCity) com o total de cada item dropado durante as
  // repetições.
  showRepeatCycleResultModal(key, totals, info){
    const sub = info ? `Repetir Ciclo ${info.cycle}: ${info.done} de ${info.total} ciclo(s) concluído(s). Loot total:` : 'Loot total coletado nas repetições:';
    this.showLootSummaryModal(`CICLOS CONCLUÍDOS — ${MAPS[key].name}`, sub, totals);
  },
  // Mesmo modal, genérico — também usado quando o tempo da Dungeon acaba
  // (ver DungeonModule.onRunTimeUp).
  showLootSummaryModal(title, subtitle, totals){
    document.getElementById('repeatCycleResultTitle').textContent = title;
    document.getElementById('repeatCycleResultSubtitle').textContent = subtitle;
    const el = document.getElementById('repeatCycleResultList');
    el.innerHTML = '';
    const entries = Object.entries(totals).filter(([, qty]) => qty > 0);
    if(entries.length === 0){
      el.innerHTML = '<div class="footer-note">Nenhum item coletado.</div>';
    } else {
      for(const [itemKey, qty] of entries){
        const def = ITEM_DEFS.find(d=>d.key===itemKey);
        const row = document.createElement('div');
        row.className = 'shop-row';
        row.innerHTML = `
          <div class="shop-info">
            <div class="name"><div class="icon icon-${def ? def.icon : 'chest'}"></div>${def ? def.name : itemKey}</div>
          </div>
          <div class="owned">x${qty}</div>`;
        el.appendChild(row);
      }
    }
    document.getElementById('dungeonModal').classList.add('open'); // tela de seleção de Dungeons, por baixo
    document.getElementById('repeatCycleResultModal').classList.add('open');
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
  // Mochila do Perfil do jogador: cada item que o jogador possui ocupa um
  // quadrado (ícone + quantidade, empilha sem limite), filtrável por tipo.
  // Passar o mouse mostra os detalhes (ver showGridTooltip). Só
  // visualização — vender continua exclusivo da Loja. A grade completa a
  // última fileira (mínimo 3 fileiras) com slots vazios, pra ter cara de mochila.
  BAG_FILTERS: [['all', 'Tudo'], ['material', 'Materiais'], ['brokenWeapon', 'Armas brutas'], ['mineral', 'Minérios']],
  BAG_COLS: 8,
  bagFilter: 'all',
  renderInventoryBag(){
    const el = document.getElementById('inventoryBagList');
    const owned = ITEM_DEFS.filter(d => state.inventory[d.key] > 0);
    const shown = owned.filter(d => this.bagFilter === 'all' || d.type === this.bagFilter);
    const slotCount = Math.max(this.BAG_COLS * 3, Math.ceil(shown.length / this.BAG_COLS) * this.BAG_COLS);
    const filters = this.BAG_FILTERS.map(([key, label]) =>
      `<button class="bag-filter${this.bagFilter === key ? ' active' : ''}" data-filter="${key}">${label}</button>`).join('');
    const slots = [];
    for(let i = 0; i < slotCount; i++){
      const def = shown[i];
      if(!def){ slots.push('<div class="bag-slot empty"></div>'); continue; }
      const rarity = def.rarity && RARITY_DEFS[def.rarity];
      slots.push(`<div class="bag-slot" data-key="${def.key}" tabindex="0"
        ${rarity ? `data-rarity="${def.rarity}" style="--rarity-color:${rarity.color}"` : ''}>
        <div class="icon icon-${def.icon}"></div><span class="bag-qty">${this.fmt(state.inventory[def.key])}</span></div>`);
    }
    const empty = owned.length ? '' : '<div class="footer-note">Sua mochila está vazia. Explore as Dungeons para coletar itens.</div>';
    el.innerHTML = `<div class="bag-filters">${filters}</div><div class="bag-grid">${slots.join('')}</div>${empty}`;
    el.onclick = (e) => {
      const f = e.target.closest('[data-filter]');
      if(!f) return;
      this.bagFilter = f.dataset.filter;
      this.renderInventoryBag();
    };
    this.bindGridTooltip(el, key => {
      const d = ITEM_DEFS.find(x => x.key === key);
      const typeLabel = { material:'Material', brokenWeapon:'Arma bruta (forje no Ferreiro)', mineral:'Minério' }[d.type] || '';
      return { title: d.name, rarity: d.rarity, lines: [typeLabel, `Possui: ${this.fmt(state.inventory[key])}`, `Vende por ${d.sellPrice} moeda(s) cada`] };
    });
  },
  // Tooltip único das grades (Mochila/Armas/Itens obtidos): segue o mouse e é
  // montado só com textContent. `info(key)` devolve { title, rarity?, lines[], hint? }.
  gridTooltipEl(){
    let t = document.getElementById('gridTooltip');
    if(!t){ t = document.createElement('div'); t.id = 'gridTooltip'; t.className = 'grid-tooltip'; document.body.appendChild(t); }
    return t;
  },
  bindGridTooltip(root, info){
    const tip = this.gridTooltipEl();
    const show = (slot, x, y) => {
      const data = info(slot.dataset.key);
      if(!data) return;
      tip.replaceChildren();
      const h = document.createElement('div');
      h.className = 'tt-title';
      h.textContent = data.title;
      if(data.rarity && RARITY_DEFS[data.rarity]){
        const r = document.createElement('span');
        r.className = 'rarity-tag rarity-' + data.rarity;
        r.textContent = RARITY_DEFS[data.rarity].label;
        h.append(' ', r);
      }
      tip.appendChild(h);
      for(const line of data.lines.filter(Boolean)){ const d = document.createElement('div'); d.textContent = line; tip.appendChild(d); }
      if(data.hint){ const d = document.createElement('div'); d.className = 'tt-hint'; d.textContent = data.hint; tip.appendChild(d); }
      tip.classList.add('open');
      this.placeGridTooltip(x, y);
    };
    root.onmousemove = (e) => {
      const slot = e.target.closest('[data-key]');
      if(!slot){ tip.classList.remove('open'); return; }
      if(tip.dataset.key !== slot.dataset.key || !tip.classList.contains('open')){ tip.dataset.key = slot.dataset.key; show(slot, e.clientX, e.clientY); }
      else this.placeGridTooltip(e.clientX, e.clientY);
    };
    root.onmouseleave = () => { tip.classList.remove('open'); tip.dataset.key = ''; };
    root.onfocusin = (e) => {
      const slot = e.target.closest('[data-key]');
      if(slot){ const r = slot.getBoundingClientRect(); tip.dataset.key = slot.dataset.key; show(slot, r.right, r.top); }
    };
    root.onfocusout = () => tip.classList.remove('open');
  },
  placeGridTooltip(x, y){
    const tip = this.gridTooltipEl();
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const left = x + 18 + w > window.innerWidth ? x - w - 12 : x + 18;
    const top = Math.min(window.innerHeight - h - 8, Math.max(8, y - 10));
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top = top + 'px';
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
    const owned = [...WEAPON_DEFS, ...FORGED_WEAPON_DEFS].filter(d=>state.weapons[d.key] > 0);
    if(owned.length === 0){
      el.innerHTML = '<div class="footer-note">Nenhuma arma ainda. Escolha uma com o Clérigo ou compre/forje no Ferreiro.</div>';
      el.onclick = null;
      return;
    }
    const slotCount = Math.max(this.BAG_COLS * 2, Math.ceil(owned.length / this.BAG_COLS) * this.BAG_COLS);
    const slots = [];
    for(let i = 0; i < slotCount; i++){
      const def = owned[i];
      if(!def){ slots.push('<div class="bag-slot empty"></div>'); continue; }
      const eq = state.equippedWeapon === def.key;
      slots.push(`<div class="bag-slot weapon-slot${eq ? ' selected' : ''}" data-key="${def.key}" tabindex="0" role="button">
        <div class="icon icon-${def.icon}"></div>${eq ? '<span class="bag-qty">E</span>' : ''}</div>`);
    }
    el.innerHTML = `<div class="footer-note" style="margin:0 0 8px;">Clique numa arma para equipá-la. Passe o mouse para ver os bônus.</div><div class="bag-grid">${slots.join('')}</div>`;
    el.onclick = (e) => {
      const slot = e.target.closest('.weapon-slot[data-key]');
      if(slot && state.equippedWeapon !== slot.dataset.key) PlayerModule.equipWeapon(slot.dataset.key);
    };
    el.onkeydown = (e) => { if(e.key === 'Enter' || e.key === ' '){ const s = e.target.closest('.weapon-slot'); if(s){ e.preventDefault(); s.click(); } } };
    this.bindGridTooltip(el, key => {
      const d = [...WEAPON_DEFS, ...FORGED_WEAPON_DEFS].find(x => x.key === key);
      const eq = state.equippedWeapon === key;
      return { title: d.name, lines: this.weaponBonusText(d).split(' · '), hint: eq ? 'Equipada' : 'Clique para equipar' };
    });
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
            AchievementsModule.checkAll(); // Arsenal Completo
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
        const needs = ForgeModule.prerequisiteMissing(def);
        row.className = 'shop-row'+(canForge?'':' disabled')+(needs?' locked':'');
        row.innerHTML = `
          <div class="shop-info">
            <div class="name"><div class="icon icon-${def.icon}"></div>${def.name}</div>
            <div class="desc">${this.weaponBonusText(def)}</div>
            ${needs ? '<div class="desc forge-needs"></div>' : ''}
            <div class="recipe-materials">${materialsHtml}</div>
          </div>
          <button class="buy-btn" ${canForge?'':'disabled'}><div class="icon icon-coin"></div> ${UI.fmt(def.recipe.coinCost)}</button>`;
        if(needs) row.querySelector('.forge-needs').textContent = 'Forje antes: ' + needs.name;
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
      const unlocked = CavernModule.isProspectorUnlocked(def);
      const canAfford = unlocked && state.gold >= cost;
      const row = document.createElement('div');
      row.className = 'shop-row'+(canAfford?'':' disabled')+(unlocked?'':' locked');
      row.innerHTML = `
        <div class="shop-info">
          <div class="name">${def.name}</div>
          <div class="desc">${def.desc} cada</div>
          <div class="owned">Possui: ${owned}</div>
          ${unlocked ? '' : '<div class="desc">Libera junto com o ' + MAPS[def.requiresDungeon].name + '</div>'}
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
    // sistema em pausa (ver CONFIG.guildExpeditionsEnabled): seção escondida
    document.getElementById('guildExpeditionSection').style.display = CONFIG.guildExpeditionsEnabled ? '' : 'none';
    if(!CONFIG.guildExpeditionsEnabled) return;
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
  // Posições da árvore (em px do "mundo" da árvore), calculadas a partir da
  // estrutura de UPGRADE_TREE — layout radial: raiz no centro, cada ramo
  // numa fatia do círculo proporcional às folhas dele (mínimo 2, pra ramo
  // pequeno não ficar espremido entre vizinhos), cada nível num anel mais
  // afastado. O raio do anel é o menor que mantém QUALQUER par de nós
  // vizinhos no mesmo anel a pelo menos TREE_SPACING px (centro a centro),
  // então card nenhum sobrepõe outro; como cada subárvore fica dentro da
  // própria fatia, as ligações também nunca cruzam outro ramo.
  TREE_SPACING: 150,   // distância mínima entre centros de nós (card + custo + rótulo)
  TREE_MIN_RING: 190,  // raio mínimo do 1º anel
  TREE_PAD: 130,       // margem do mundo em volta do nó mais externo
  layoutUpgradeTree(){
    const toNode = (item, depth, branch) => ({
      key: item.key, depth, branch,
      children: (item.children || []).map(c => toNode(c, depth + 1, branch))
    });
    const root = { key: UPGRADE_TREE.root, depth: 0, branch: null,
      children: UPGRADE_TREE.branches.map(b => ({ key: b.nodes[0].key, depth: 1, branch: b,
        children: (b.children || []).map(c => toNode(c, 2, b)) })) };
    const leaves = n => n.children.length ? n.children.reduce((s, c) => s + leaves(c), 0) : 1;
    const weight = n => n.depth === 1 ? Math.max(2, leaves(n)) : leaves(n);

    // ângulos: cada nó no meio da própria fatia; filhos dividem a fatia do
    // pai pelas folhas (centralizados quando o pai tem fatia maior que as folhas)
    const assign = (n, a0, a1) => {
      n.angle = (a0 + a1) / 2;
      if(!n.children.length) return;
      const total = n.children.reduce((s, c) => s + leaves(c), 0);
      const span = (a1 - a0) * (n.depth === 1 ? total / weight(n) : 1);
      let a = n.angle - span / 2;
      for(const c of n.children){
        const w = span * leaves(c) / total;
        assign(c, a, a + w);
        a += w;
      }
    };
    const total = root.children.reduce((s, c) => s + weight(c), 0);
    let a = -Math.PI / 2 - Math.PI * weight(root.children[0]) / total; // 1º ramo centrado no topo
    for(const c of root.children){
      const w = 2 * Math.PI * weight(c) / total;
      assign(c, a, a + w);
      a += w;
    }

    const all = [];
    const walk = (n, parent) => { n.parent = parent; all.push(n); n.children.forEach(c => walk(c, n)); };
    walk(root, null);

    // menor raio de anel que respeita TREE_SPACING em todo anel
    let ring = this.TREE_MIN_RING;
    const maxDepth = Math.max(...all.map(n => n.depth));
    for(let d = 1; d <= maxDepth; d++){
      const angles = all.filter(n => n.depth === d).map(n => n.angle).sort((x, y) => x - y);
      for(let i = 0; i < angles.length; i++){
        const next = i + 1 < angles.length ? angles[i + 1] : (d === 1 ? angles[0] + 2 * Math.PI : null);
        if(next == null) continue;
        const gap = next - angles[i];
        if(gap <= 0) continue;
        ring = Math.max(ring, this.TREE_SPACING / (2 * d * Math.sin(Math.min(gap, Math.PI) / 2)));
      }
    }

    for(const n of all){
      n.x = Math.cos(n.angle || 0) * n.depth * ring;
      n.y = Math.sin(n.angle || 0) * n.depth * ring;
    }
    const minX = Math.min(...all.map(n => n.x)), minY = Math.min(...all.map(n => n.y));
    for(const n of all){ n.x = Math.round(n.x - minX + this.TREE_PAD); n.y = Math.round(n.y - minY + this.TREE_PAD); }
    const width = Math.max(...all.map(n => n.x)) + this.TREE_PAD;
    const height = Math.max(...all.map(n => n.y)) + this.TREE_PAD;
    return { root, nodes: all, width, height, ring };
  },
  renderUpgradeTree(){
    const linesEl = document.getElementById('upgradeTreeLines');
    const nodesEl = document.getElementById('upgradeTreeNodes');
    const canvasEl = document.getElementById('upgradeTreeCanvas');
    linesEl.innerHTML = '';
    nodesEl.innerHTML = '';

    // mundo da árvore em px: canvas e SVG do mesmo tamanho, viewBox 1:1 —
    // linhas e nós usam exatamente as mesmas coordenadas, sem distorção
    const layout = this.treeLayout = this.layoutUpgradeTree();
    canvasEl.style.width = layout.width + 'px';
    canvasEl.style.height = layout.height + 'px';
    linesEl.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);

    // Ligação reta de centro a centro (fica dentro da fatia do ramo, ver
    // layoutUpgradeTree). Traço desenhado 2x — um escuro mais grosso por
    // baixo (contorno) e o da cor do ramo por cima — com espessura fixa em
    // px mesmo com zoom (vector-effect).
    const rootPath = (x1,y1,x2,y2,color)=>{
      const d = `M ${x1} ${y1} L ${x2} ${y2}`;
      for(const [stroke, width] of [['#0e0a14', 10], [color, 4]]){
        const path = document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', stroke);
        path.setAttribute('stroke-width', width);
        path.setAttribute('stroke-linecap', 'square');
        path.setAttribute('stroke-linejoin', 'miter');
        path.setAttribute('fill', 'none');
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        path.setAttribute('shape-rendering', 'crispEdges');
        linesEl.appendChild(path);
      }
    };

    // Monta um nó (raiz ou branch) — mesmo card pros dois casos, só o da
    // raiz ganha a classe extra `root-node` (maior, moldura de brasa). A
    // moldura pixel art vem do CSS (border-image por estado); a cor do ramo
    // entra como filete interno via --branch-color. `icon` = classe .icon-*
    // do ramo (UPGRADE_TREE.branches[].icon / rootIcon).
    const buildNode = (key, x, y, color, isRoot, icon)=>{
      const def = UPGRADE_DEFS.find(u=>u.key===key);
      const el = document.createElement('div');
      el.className = 'tree-node'+(isRoot ? ' root-node' : '');
      el.style.left = x+'px';
      el.style.top = y+'px';
      if(!isRoot) el.style.setProperty('--branch-color', color);

      if(!ProgressionModule.isUnlocked('upgrade', key)){
        el.classList.add('locked');
        el.innerHTML = `
          <div class="icon node-icon icon-lock"></div>
          <div class="node-name">${def.name}</div>
          <div class="node-tooltip">${ProgressionModule.lockLabel('upgrade', key)}</div>`;
        nodesEl.appendChild(el);
        return el;
      }

      const lvl = state.upgrades[key];
      const maxed = lvl >= def.maxLevel;
      const cost = UpgradesModule.costFor(def);
      const canAfford = !maxed && state.gold >= cost;
      if(maxed) el.classList.add('maxed');

      el.innerHTML = `
        <div class="icon node-icon icon-${icon}"></div>
        <div class="node-name">${def.name}</div>
        <div class="node-level">${lvl}/${def.maxLevel}</div>
        <div class="node-footer">
          <div class="node-cost">${maxed ? 'MÁX' : '<div class=\"icon icon-coin\"></div> '+UI.fmt(cost)}</div>
          ${maxed ? '' : `<button class="node-plus-btn" ${canAfford?'':'disabled'}>+</button>`}
        </div>
        <div class="node-tooltip">${def.desc}</div>`;
      if(!maxed){
        const plusBtn = el.querySelector('.node-plus-btn');
        plusBtn.addEventListener('click', (e)=>{ e.stopPropagation(); UpgradesModule.buy(key); });
      }
      nodesEl.appendChild(el);
      return el;
    };

    // Desenha recursivamente os descendentes de um nó (Nível 2, 3, ...) —
    // irmãos ou cadeia, tanto faz (ver UPGRADE_TREE). Cada filho só aparece
    // depois que o próprio pré-requisito (`requires` em UPGRADE_DEFS) tem
    // ao menos 1 nível; as posições já vêm calculadas (layoutUpgradeTree),
    // então esconder um nó não mexe no lugar dos outros.
    const renderDescendants = (parentNode, color, icon)=>{
      for(const child of parentNode.children){
        const childDef = UPGRADE_DEFS.find(u=>u.key===child.key);
        if(!childDef || state.upgrades[childDef.requires] <= 0) continue;
        rootPath(parentNode.x, parentNode.y, child.x, child.y, color);
        buildNode(child.key, child.x, child.y, color, false, icon);
        renderDescendants(child, color, icon);
      }
    };

    // raiz no centro, primeiro (fica embaixo das raízes na ordem do DOM,
    // mas ambos têm z-index próprio via CSS então não faz diferença visual)
    const hub = layout.root;
    buildNode(hub.key, hub.x, hub.y, null, true, UPGRADE_TREE.rootIcon);

    for(const node of hub.children){
      const branch = node.branch;
      // Nó/linha de Nível 1 só aparecem depois que a raiz foi comprada pela
      // 1ª vez (nível >= 1) — antes disso nem o cadeado é mostrado, o ramo
      // inteiro fica reservado/invisível (rótulo incluso).
      if(state.upgrades[UPGRADE_TREE.root] <= 0) continue;
      rootPath(hub.x, hub.y, node.x, node.y, branch.color);
      const nodeEl = buildNode(node.key, node.x, node.y, branch.color, false, branch.icon);
      // rótulo da branch: placa presa logo acima da moldura do nó de Nível
      // 1 (filho do nó, então anda junto e nunca colide com outro nó)
      const label = document.createElement('div');
      label.className = 'tree-branch-label';
      label.style.color = branch.color;
      label.textContent = branch.label;
      nodeEl.appendChild(label);
      renderDescendants(node, branch.color, branch.icon);
    }
  },
  renderPrestigeTab(){
    // Ascensão fora do jogo (ver CONFIG.ascensionEnabled): some da Igreja e
    // das Estatísticas, e a Igreja mostra só a nota de silêncio.
    const enabled = !!CONFIG.ascensionEnabled;
    document.getElementById('ascensionSection').style.display = enabled ? '' : 'none';
    document.getElementById('igrejaQuietNote').style.display = enabled ? 'none' : '';
    document.getElementById('invStatEssenceRow').style.display = enabled ? '' : 'none';
    if(!enabled) return;
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
    this.renderLootPanel();
    this.renderFerreiroWeapons();
    this.renderForgeList();
    this.renderCityBuildingLocks();
    this.renderLeaveButtonVisibility();
    QuestModule.render();
    this.renderUpgradeTree();
    this.renderPrestigeTab();
    this.renderArcaneTab();
    this.renderArcaneBar();
  },
  // ---------------------------------------------------------------------
  // Habilidades Arcanas (ver ArcaneModule/ARCANE_SKILL_DEFS)
  // ---------------------------------------------------------------------
  // Ícones desenhados em SVG (sem PNG ainda) — cor vem da def
  arcaneIconSvg(key, color){
    const paths = {
      fire: `<path d="M12 1.5c.6 3.6 4.9 5.6 4.9 11.1a4.9 4.9 0 0 1-9.8 0c0-2.8 1.7-3.9 2-6.6 1 1 1.6 2.3 1.6 3.6 1.3-2 1.6-4.9 1.3-8.1z" fill="${color}"/><path d="M12 12.5c.3 1.7 2.3 2.4 2.3 4.5a2.3 2.3 0 0 1-4.6 0c0-1.3.8-1.9 1-3 .5.4.8 1 .8 1.6.5-1 .6-2 .5-3.1z" fill="#fff3c4"/>`,
      lightning: `<path d="M13.5 1.5 4.5 13.5h6.2l-1.7 9 10-12.8h-6.3l.8-8.2z" fill="${color}" stroke="#7a5a00" stroke-width="1" stroke-linejoin="round"/>`,
      ice: `<g stroke="${color}" stroke-width="2.2" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><path d="M9.5 3.8 12 6l2.5-2.2M9.5 20.2 12 18l2.5 2.2M3.6 10.5 6.8 9.3 6 6M20.4 13.5l-3.2 1.2.8 3.3M3.6 13.5l3.2 1.2-.8 3.3M20.4 10.5l-3.2-1.2.8-3.3" fill="none"/></g>`
    };
    return `<svg viewBox="0 0 24 24" class="arcane-icon" aria-hidden="true">${paths[key] || ''}</svg>`;
  },
  arcaneSecs(ms){
    return (ms/1000).toFixed(1).replace('.', ',') + 's';
  },
  arcanePct(x){
    return Math.round(x*100) + '%';
  },
  // Linha de efeito de uma habilidade pra um nível de dano `dmg` qualquer
  // (usada pro valor atual e pra prévia do próximo nível)
  arcaneEffectText(key, dmg){
    const def = ArcaneModule.def(key);
    const p = ArcaneModule.power(key, dmg);
    if(key === 'fire') return `${this.arcanePct(p)} do dano por clique em ${this.arcaneSecs(def.durationMs)}`;
    if(key === 'lightning') return `${this.arcanePct(p)} do dano por clique por raio`;
    return `+${this.arcanePct(p)} de dano recebido por ${this.arcaneSecs(def.durationMs)}`;
  },
  showAcademiaTab(tabId){
    const btn = document.querySelector(`#academiaModal .modal-tab-btn[data-tab="${tabId}"]`);
    if(btn) btn.click();
  },
  renderArcaneTab(){
    const el = document.getElementById('arcaneTab');
    if(!el) return;
    const unlocked = ArcaneModule.isUnlocked();
    const points = ArcaneModule.pointsAvailable();
    const earned = ArcaneModule.pointsEarned();
    const maxPoints = DUNGEON_ORDER.length * CONFIG.maxCycleNum;
    const cost = CONFIG.arcanePointCost;
    const canSpend = ArcaneModule.canSpend();
    const unlockFloor = DUNGEON_ORDER.indexOf(CONFIG.arcaneUnlockDungeon) + 1;

    let html = `
      <div class="arcane-header">
        <div class="arcane-points"><span class="arcane-points-value">${points}</span> Ponto${points === 1 ? '' : 's'} Arcano${points === 1 ? '' : 's'}</div>
        <div class="footer-note">Ganhe 1 ponto ao derrotar o chefe de cada ciclo pela 1ª vez (${earned}/${maxPoints} conquistados). As habilidades aprendidas disparam sozinhas durante a batalha.</div>
        ${unlocked && ArcaneModule.pointsSpent() > 0 ? `<button class="small-btn arcane-reset-btn" id="arcaneResetBtn" title="Devolve todos os pontos gastos, de graça">Reiniciar habilidades</button>` : ''}
      </div>`;
    if(!unlocked){
      html += `<div class="arcane-locked-note"><div class="icon icon-lock"></div>Conclua o ${unlockFloor}º andar (${MAPS[CONFIG.arcaneUnlockDungeon].name}) e volte à cidade para liberar.</div>`;
    }
    html += `<div class="arcane-grid${unlocked ? '' : ' locked'}">`;
    for(const def of ARCANE_SKILL_DEFS){
      const learned = ArcaneModule.isLearned(def.key);
      const dmgLvl = ArcaneModule.dmgLevel(def.key);
      const spdLvl = ArcaneModule.spdLevel(def.key);
      const interval = ArcaneModule.intervalMs(def.key);
      const nextInterval = ArcaneModule.intervalMs(def.key, spdLvl + 1);
      const spdMaxed = interval <= def.minIntervalMs;
      const extra = def.key === 'ice' ? `<div class="arcane-stat">Tempo passa a ${this.arcanePct(def.slowFactor)} da velocidade</div>` : '';
      html += `
        <div class="arcane-card${learned ? ' learned' : ''}" style="--skill-color:${def.color}">
          <div class="arcane-card-top">
            <div class="arcane-card-icon">${this.arcaneIconSvg(def.key, def.color)}</div>
            <div>
              <div class="arcane-card-name pixel">${def.name.toUpperCase()}</div>
              <div class="arcane-card-level">${learned ? `Nível ${1 + dmgLvl + spdLvl}` : 'Não aprendida'}</div>
            </div>
          </div>
          <div class="arcane-card-desc">${def.desc}</div>
          <div class="arcane-stat">${this.arcaneEffectText(def.key, dmgLvl)}</div>
          <div class="arcane-stat">Dispara a cada ${this.arcaneSecs(interval)}</div>
          ${extra}`;
      if(!learned){
        html += `<button class="ascend-btn arcane-learn-btn" data-learn="${def.key}" ${canSpend ? '' : 'disabled'}>APRENDER — ${cost} ponto</button>`;
      } else {
        html += `
          <div class="arcane-branches">
            <div class="arcane-branch">
              <div class="arcane-branch-title">DANO <span>Nv ${dmgLvl}</span></div>
              <div class="arcane-branch-next">→ ${this.arcaneEffectText(def.key, dmgLvl + 1)}</div>
              <button class="buy-btn" data-up="${def.key}" data-branch="Dmg" ${canSpend ? '' : 'disabled'}>+1 (${cost} pt)</button>
            </div>
            <div class="arcane-branch">
              <div class="arcane-branch-title">VELOCIDADE <span>Nv ${spdLvl}</span></div>
              <div class="arcane-branch-next">${spdMaxed ? 'Velocidade máxima' : `→ a cada ${this.arcaneSecs(nextInterval)}`}</div>
              <button class="buy-btn" data-up="${def.key}" data-branch="Spd" ${canSpend && !spdMaxed ? '' : 'disabled'}>${spdMaxed ? 'MÁX' : `+1 (${cost} pt)`}</button>
            </div>
          </div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    el.innerHTML = html;
    el.querySelectorAll('[data-learn]').forEach(b => b.addEventListener('click', ()=>ArcaneModule.learn(b.dataset.learn)));
    el.querySelectorAll('[data-up]').forEach(b => b.addEventListener('click', ()=>ArcaneModule.upgrade(b.dataset.up, b.dataset.branch)));
    // Reiniciar pede um 2º clique pra confirmar (evita apagar a build sem querer);
    // se não confirmar em 4s, o botão volta ao normal.
    const resetBtn = document.getElementById('arcaneResetBtn');
    if(resetBtn){
      resetBtn.addEventListener('click', ()=>{
        if(resetBtn.classList.contains('confirm')){ ArcaneModule.resetSkills(); return; }
        resetBtn.classList.add('confirm');
        resetBtn.textContent = `Confirmar? Devolve ${ArcaneModule.pointsSpent()} ponto(s)`;
        setTimeout(()=>{
          if(!resetBtn.isConnected) return;
          resetBtn.classList.remove('confirm');
          resetBtn.textContent = 'Reiniciar habilidades';
        }, 4000);
      });
    }
  },
  // Barra fixa na arena com as habilidades aprendidas — a parte escura de
  // cada ícone esvazia conforme a próxima execução se aproxima. Chamada a
  // cada tick (main.js): só recria o HTML quando o conjunto aprendido muda.
  renderArcaneBar(){
    const bar = document.getElementById('arcaneBar');
    const learned = ARCANE_SKILL_DEFS.filter(d => ArcaneModule.isLearned(d.key));
    if(!learned.length || !state.currentDungeon){
      bar.style.display = 'none';
      return;
    }
    bar.style.display = '';
    const sig = learned.map(d => d.key + (1 + ArcaneModule.dmgLevel(d.key) + ArcaneModule.spdLevel(d.key))).join('|');
    if(bar.dataset.sig !== sig){
      bar.dataset.sig = sig;
      bar.innerHTML = learned.map(d => `
        <div class="arcane-slot" data-key="${d.key}" style="--skill-color:${d.color}" title="${d.name}: ${d.desc}">
          ${this.arcaneIconSvg(d.key, d.color)}
          <div class="arcane-slot-cd"></div>
          <div class="arcane-slot-lvl">${1 + ArcaneModule.dmgLevel(d.key) + ArcaneModule.spdLevel(d.key)}</div>
        </div>`).join('');
    }
    for(const d of learned){
      const slot = bar.querySelector(`[data-key="${d.key}"]`);
      const progress = Math.min(1, (ArcaneModule.timers[d.key] || 0) / ArcaneModule.intervalMs(d.key));
      slot.querySelector('.arcane-slot-cd').style.height = ((1 - progress) * 100) + '%';
      const active = (d.key === 'fire' && !!ArcaneModule.burn) || (d.key === 'ice' && ArcaneModule.isFrozen());
      slot.classList.toggle('active', active);
    }
  },
  // Monstro queimando/congelado (classes na arena, ver CSS .arcane-burning/.arcane-frozen)
  renderArcaneEffects(){
    const stage = document.getElementById('monsterStage');
    stage.classList.toggle('arcane-burning', !!ArcaneModule.burn && ArcaneModule.isActive());
    stage.classList.toggle('arcane-frozen', ArcaneModule.isFrozen());
  },
  showLightningStrike(){
    const bolt = document.getElementById('arcaneBolt');
    bolt.classList.remove('strike'); void bolt.offsetWidth; bolt.classList.add('strike');
    this.screenShake();
  },
  showFloatingArcaneDamage(dmg, key){
    const stage = document.getElementById('monsterStage');
    const div = document.createElement('div');
    div.className = 'float-dmg arcane-' + key;
    div.textContent = '-' + this.fmt(dmg);
    // um pouco pro lado, pra não sobrepor o número do clique no centro
    div.style.left = (key === 'lightning' ? 38 : 62) + '%';
    stage.appendChild(div);
    setTimeout(()=>div.remove(), 850);
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
    // texto puro (nomes de item/quantidades vindas do state) — nunca innerHTML
    const t = document.createElement('span');
    t.className = 'pixel';
    t.textContent = title;
    div.append(t, String(msg));
    document.body.appendChild(div);
    setTimeout(()=>{ div.style.transition='opacity .5s'; div.style.opacity='0'; setTimeout(()=>div.remove(),500); }, 3800);
  }
};
