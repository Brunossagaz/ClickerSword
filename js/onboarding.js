/* ---------------------------------------------------------------------
   ONBOARDING MODULE (onboarding.js)
   Introdução do Clérigo: aparece sozinho na 1ª vez que a cidade abre (ver
   UI.showCityView) — pede o nome (se ainda não tiver), conta a história da
   dungeon e deixa escolher uma arma inicial. Também calcula/controla quais
   prédios da cidade estão liberados:
   - Igreja: sempre.
   - Dungeon: hasChosenWeapon() OU hasFacedDungeon() (computado, nunca
     guardado em flag própria, mesmo padrão de DungeonModule/ProgressionModule).
   - Academia: 5ª entrada na Dungeon (state.dungeonEntriesCount).
   - Loja: hasFacedDungeon() (computado).
   - Ferreiro/Guilda/Caverna: dependem de missão (ver QuestModule/
     state.quests) porque entregar itens é uma ação irreversível, não dá pra
     computar isso de volta a partir do progresso.
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
  // 1ª entrada na Dungeon da vida do personagem: o botão "Voltar pra
  // cidade" do CABEÇALHO da dungeon some (ver ui.js), pra forçar pelo menos
  // uma tentativa de verdade antes de poder desistir no meio da luta — não
  // depende de completar o ciclo (ver state.dungeonEntriesCount), só de já
  // ter entrado mais de uma vez. A opção de voltar dentro do timeUpModal
  // continua sempre disponível (ver UI.showTimeUpModal), mesmo nessa 1ª vez.
  isFirstDungeonEntry(){
    return state.dungeonEntriesCount <= 1;
  },
  isBuildingUnlocked(key){
    if(key === 'igreja') return true;
    if(key === 'dungeon') return this.hasChosenWeapon() || this.hasFacedDungeon();
    if(key === 'academia') return state.dungeonEntriesCount >= CONFIG.academiaUnlockEntries;
    if(key === 'loja') return this.hasFacedDungeon();
    if(key === 'guilda') return !!state.quests.creitonMilitia;
    if(key === 'caverna') return !!state.quests.caveClearance;
    if(key === 'ferreiro') return !!state.quests.slimeGelDelivery; // ver QuestModule
    return false;
  },
  // Texto de progresso mostrado no próprio prédio enquanto a Academia ainda
  // está trancada (ver UI.renderCityBuildingLocks) — null quando já liberou,
  // pra não mostrar nada em cima do card.
  academiaProgressLabel(){
    if(this.isBuildingUnlocked('academia')) return null;
    return `Entradas na Dungeon: ${state.dungeonEntriesCount}/${CONFIG.academiaUnlockEntries}`;
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
      `Prazer, ${state.playerName}. Esta cidade já foi cheia de vida e prosperidade. Mas, há pouco tempo, uma dungeon surgiu misteriosamente além dos portões. Dela passaram a sair criaturas terríveis que espalharam medo por toda a região. Muitos moradores fugiram, e os que ficaram vivem trancados em suas casas. Precisamos de alguém capaz de enfrentar essa ameaça e devolver a esperança ao nosso povo.`;    this.showStep('clericStepStory');
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
        <div class="weapon-desc">${UI.weaponBonusText(def)}</div>`;
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
  // (que libera nesse momento). Só mostra 1 vez (ver state.shopUnlockAnnounced).
  announceShopUnlockIfNeeded(){
    if(!this.hasFacedDungeon() || state.shopUnlockAnnounced) return;
    state.shopUnlockAnnounced = true;
    SaveModule.save();
    document.getElementById('shopUnlockModal').classList.add('open');
  },
  // Chamado por DungeonModule.enter() — dispara 1x quando a Academia libera
  // (ver CONFIG.academiaUnlockEntries).
  announceAcademiaIfNeeded(){
    if(state.dungeonEntriesCount < CONFIG.academiaUnlockEntries || state.academiaAnnounced) return;
    state.academiaAnnounced = true;
    SaveModule.save();
    document.getElementById('academiaUnlockModal').classList.add('open');
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
    document.getElementById('academiaUnlockOkBtn').addEventListener('click', () => {
      document.getElementById('academiaUnlockModal').classList.remove('open');
    });
  }
};
