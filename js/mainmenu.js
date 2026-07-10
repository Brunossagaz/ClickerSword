/* ---------------------------------------------------------------------
   MAIN MENU MODULE (mainmenu.js)
   Tela inicial (Novo Jogo / Continuar / Configurações) e seletor de 3 saves.
   Personagem novo NÃO pede nome aqui — ele nasce sem nome, cai na cidade
   trancada, e é o Clérigo (1ª conversa na Igreja, ver OnboardingModule) quem
   pergunta. O diálogo de nome deste módulo (nameEntryModal) sobrevive só
   pro caso de save antigo/migrado que já tem progresso mas nunca teve nome
   (esses já passam direto pela Igreja sem falar com o Clérigo, então
   precisam de outro jeito de nomear o personagem). Delega toda leitura/
   escrita em disco pro SaveModule — este módulo só orquestra a UI de
   pré-jogo.
--------------------------------------------------------------------- */
const MainMenuModule = {
  pendingMode: null, // 'rename' | null
  pendingSlot: null,

  init(){
    document.getElementById('menuNewGameBtn').addEventListener('click', ()=>UI.showSlotPicker());
    document.getElementById('menuContinueBtn').addEventListener('click', ()=>UI.showSlotPicker());
    document.getElementById('menuSettingsBtn').addEventListener('click', ()=>UI.openSettingsModal());
    document.getElementById('slotBackBtn').addEventListener('click', ()=>UI.showMainMenu());
    this.initNameEntryModal();
  },

  renderSlotPicker(){
    const el = document.getElementById('slotGrid');
    el.innerHTML = '';
    for(let n=1; n<=CONFIG.maxSaveSlots; n++){
      const meta = SaveModule.slotSummary(n);
      const box = document.createElement('div');
      box.className = 'slot-box'+(meta.occupied ? '' : ' empty');
      if(meta.occupied){
        const dateStr = new Date(meta.lastSave).toLocaleString('pt-BR');
        box.innerHTML = `
          <div class="slot-name">${meta.playerName || '(sem nome)'}</div>
          <div class="slot-date">Último acesso: ${dateStr}</div>
          <div class="slot-actions">
            <button class="menu-btn slot-continue" data-slot="${n}">▶ Continuar</button>
            <button class="small-btn slot-download" data-slot="${n}">⬇</button>
            <button class="small-btn slot-delete" data-slot="${n}">🗑</button>
            <button class="small-btn slot-newhere" data-slot="${n}">🔄 Novo aqui</button>
          </div>`;
      } else {
        box.innerHTML = `
          <div class="slot-name">Slot ${n} vazio</div>
          <div class="slot-actions">
            <button class="menu-btn slot-createnew" data-slot="${n}">🆕 Começar aqui</button>
          </div>`;
      }
      el.appendChild(box);
    }
    el.querySelectorAll('.slot-continue').forEach(b=>b.addEventListener('click', ()=>this.continueSlot(Number(b.dataset.slot))));
    el.querySelectorAll('.slot-download').forEach(b=>b.addEventListener('click', ()=>SaveModule.downloadSlot(Number(b.dataset.slot))));
    el.querySelectorAll('.slot-delete').forEach(b=>b.addEventListener('click', ()=>this.deleteSlotWithConfirm(Number(b.dataset.slot))));
    el.querySelectorAll('.slot-newhere').forEach(b=>b.addEventListener('click', ()=>this.newGameOverSlot(Number(b.dataset.slot))));
    el.querySelectorAll('.slot-createnew').forEach(b=>b.addEventListener('click', ()=>this.startNewGame(Number(b.dataset.slot))));
  },

  // Personagem novo nasce sem nome — quem pergunta é o Clérigo, na 1ª
  // conversa na Igreja (ver OnboardingModule.openClericIntro).
  startNewGame(slot){
    SaveModule.createNewSlot(slot, '');
    MonsterModule.current = null;
    UI.showCityView();
    UI.renderPlayerName();
    UI.renderAll();
  },

  newGameOverSlot(slot){
    if(confirm('Isso vai APAGAR o save atual deste slot e começar um personagem novo. Continuar?')) this.startNewGame(slot);
  },

  deleteSlotWithConfirm(slot){
    if(confirm('Apagar este save permanentemente?')){
      SaveModule.deleteSlot(slot);
      this.renderSlotPicker();
    }
  },

  continueSlot(n){
    const ok = SaveModule.loadSlot(n);
    if(!ok){ alert('Este save está corrompido ou vazio.'); return; }
    if(!state.playerName){
      this.pendingMode = 'rename'; this.pendingSlot = n;
      document.getElementById('nameEntryTitle').textContent = '🧙 NOMEIE SEU PERSONAGEM';
      document.getElementById('nameEntryPrompt').textContent = 'Este save antigo ainda não tem um nome de personagem.';
      document.getElementById('nameEntryInput').value = '';
      document.getElementById('nameEntryModal').classList.add('open');
      return; // finishEnteringLoadedGame() só roda depois do nome confirmado
    }
    this.finishEnteringLoadedGame();
  },

  finishEnteringLoadedGame(){
    if(state.currentDungeon){
      MonsterModule.spawn(false);
      UI.showDungeonView();
    } else {
      UI.showCityView();
    }
    const off = SaveModule.computeOfflineEarnings();
    if(off && off.earned > 0){
      const mins = Math.floor(off.seconds/60);
      UI.showToast('BEM-VINDO DE VOLTA', `Suas tropas lutaram por ${mins} min enquanto você estava fora e renderam ${UI.fmt(off.earned)} de ouro!`);
    }
    UI.renderPlayerName();
    UI.renderAll();
  },

  initNameEntryModal(){
    const modal = document.getElementById('nameEntryModal');
    const input = document.getElementById('nameEntryInput');
    const doConfirm = ()=>{
      const name = input.value.trim() || 'Herói';
      modal.classList.remove('open');
      if(this.pendingMode === 'rename'){
        state.playerName = name;
        SaveModule.saveToSlot(SaveModule.activeSlot);
        this.finishEnteringLoadedGame();
      }
      UI.renderPlayerName();
      UI.renderAll();
      this.pendingMode = null; this.pendingSlot = null;
    };
    document.getElementById('nameEntryConfirmBtn').addEventListener('click', doConfirm);
    input.addEventListener('keydown', e=>{ if(e.key === 'Enter') doConfirm(); });
    document.getElementById('nameEntryCancelBtn').addEventListener('click', ()=>{
      modal.classList.remove('open');
      if(this.pendingMode === 'rename'){ SaveModule.activeSlot = null; UI.showSlotPicker(); }
      this.pendingMode = null; this.pendingSlot = null;
    });
  }
};
