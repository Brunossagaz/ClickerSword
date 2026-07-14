/* ---------------------------------------------------------------------
   ONBOARDING MODULE (onboarding.js)
   Introdução do Clérigo (1ª vez que clica na Igreja): pede o nome (se ainda
   não tiver), conta a história da dungeon e deixa escolher uma arma inicial.
   Também calcula quais prédios da cidade estão liberados — Igreja/Dungeon/
   Academia/Loja/Guilda são computados aqui a partir de
   state.weapons/state.totalKillsAll (nunca guardados em flag própria, mesmo
   padrão de DungeonModule/ProgressionModule); Ferreiro depende da missão do
   Barnabé (ver QuestModule/state.quests) porque entregar itens é uma ação
   irreversível, não dá pra computar isso de volta a partir do progresso.
   Caverna ainda não tem gatilho de desbloqueio definido.
--------------------------------------------------------------------- */
const OnboardingModule = {
  hasChosenWeapon(){
    return Object.values(state.weapons).some(v => v > 0);
  },
  hasFacedDungeon(){
    return state.totalKillsAll >= 1;
  },
  // Só personagens realmente novos (sem arma e sem nenhuma morte registrada)
  // veem a introdução do Clérigo — quem já tinha progresso de antes desta
  // atualização (ou é um save migrado) cai direto na Ascensão normal.
  shouldShowClericIntro(){
    return !this.hasChosenWeapon() && !this.hasFacedDungeon();
  },
  isBuildingUnlocked(key){
    if(key === 'igreja') return true;
    if(key === 'dungeon' || key === 'academia') return this.hasChosenWeapon() || this.hasFacedDungeon();
    // TEMPORÁRIO pra testar a mineração de minério: caverna liberada junto
    // com loja/guilda (mesma condição), até a missão de desbloqueio dela
    // existir de verdade — aí volta a ficar sozinha, condicionada à missão.
    if(key === 'loja' || key === 'guilda' || key === 'caverna') return this.hasFacedDungeon();
    if(key === 'ferreiro') return !!state.quests.slimeGelDelivery; // ver QuestModule
    return false;
  },

  openClericIntro(){
    document.getElementById('clericModal').classList.add('open');
    if(state.playerName){
      this.showStoryStep();
    } else {
      document.getElementById('clericNameInput').value = '';
      this.showStep('clericStepName');
    }
  },
  showStep(stepId){
    document.querySelectorAll('#clericModal .cleric-step').forEach(el => el.classList.remove('active'));
    document.getElementById(stepId).classList.add('active');
  },
  showStoryStep(){
    document.getElementById('clericStoryText').textContent =
      `Prazer, ${state.playerName}. Esta já foi uma cidade próspera, mas há pouco tempo uma dungeon surgiu misteriosamente logo ali fora dos portões. De lá saíram criaturas monstruosas que assustaram quase todos os moradores — os poucos que restaram se trancaram em suas casas. Preciso da sua ajuda pra enfrentar essa ameaça e trazer vida de volta à nossa cidade.`;
    this.showStep('clericStepStory');
  },
  renderWeaponChoices(){
    const el = document.getElementById('weaponChoiceGrid');
    el.innerHTML = '';
    for(const def of WEAPON_DEFS){
      const btn = document.createElement('button');
      btn.className = 'weapon-choice-card';
      btn.innerHTML = `
        <div class="weapon-icon icon icon-${def.icon}"></div>
        <div class="weapon-name">${def.name}</div>
        <div class="weapon-desc">+${def.clickDamageBonus} dano por clique</div>`;
      btn.addEventListener('click', () => this.finishWeaponChoice(def.key));
      el.appendChild(btn);
    }
  },
  finishWeaponChoice(key){
    state.weapons[key] = 1;
    // 1ª arma do personagem já nasce equipada (ver PlayerModule.equipWeapon/
    // clickDamage) — o bônus não fica mais gravado em clickDamageFlat, é
    // lido dinamicamente a partir da arma ativa.
    state.equippedWeapon = key;
    SaveModule.save();
    document.getElementById('clericModal').classList.remove('open');
    UI.renderAll();
  },
  // Chamado por DungeonModule.leaveToCity() — na 1ª vez que o jogador volta
  // pra cidade já tendo enfrentado a dungeon (matado ao menos 1 monstro), o
  // Clérigo avisa que a notícia chegou e recomenda vender os itens na Loja
  // (que libera nesse momento — Ferreiro depende da missão do Barnabé, ver
  // QuestModule; Guilda/Caverna ainda sem gatilho definido). Só mostra 1 vez
  // (ver state.shopUnlockAnnounced).
  announceShopUnlockIfNeeded(){
    if(!this.hasFacedDungeon() || state.shopUnlockAnnounced) return;
    state.shopUnlockAnnounced = true;
    SaveModule.save();
    document.getElementById('shopUnlockModal').classList.add('open');
  },
  init(){
    const nameInput = document.getElementById('clericNameInput');
    const confirmName = () => {
      state.playerName = nameInput.value.trim() || 'Herói';
      SaveModule.save();
      UI.renderPlayerName();
      this.showStoryStep();
    };
    document.getElementById('clericNameConfirmBtn').addEventListener('click', confirmName);
    nameInput.addEventListener('keydown', e => { if(e.key === 'Enter') confirmName(); });

    document.getElementById('clericStoryContinueBtn').addEventListener('click', () => {
      this.renderWeaponChoices();
      this.showStep('clericStepWeapon');
    });

    document.getElementById('shopUnlockOkBtn').addEventListener('click', () => {
      document.getElementById('shopUnlockModal').classList.remove('open');
    });
  }
};
