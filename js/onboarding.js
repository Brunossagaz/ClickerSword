/* ---------------------------------------------------------------------
   ONBOARDING MODULE (onboarding.js)
   Introdução do Clérigo: aparece sozinho na 1ª vez que a cidade abre (ver
   UI.showCityView) — pede o nome (se ainda não tiver), conta a história da
   dungeon e deixa escolher uma arma inicial. Também calcula/controla quais
   prédios da cidade estão liberados:
   - Igreja: sempre.
   - Dungeon: hasChosenWeapon() OU hasFacedDungeon() (computado, nunca
     guardado em flag própria, mesmo padrão de DungeonModule/ProgressionModule).
   - Academia: apresentada pelo Anselmo/Aldo na volta da 3ª entrada na
     Dungeon (state.academiaAnnounced, ver announceAcademiaIfNeeded).
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
  // Mostra a introdução do Clérigo (culminando na escolha de arma) em 2
  // casos: personagem realmente novo (sem arma e sem nenhuma morte
  // registrada — quem já tinha progresso de antes desta atualização, ou é
  // um save migrado, cai direto no jogo normal) OU depois de uma Ascensão
  // (a arma sempre reseta, ver PrestigeModule.ascend, mas totalKillsAll é
  // vitalício e nunca volta a 0 — sem o 2º caso, `!hasFacedDungeon()`
  // ficava falso pra sempre depois da 1ª Ascensão e travava essa tela
  // fechada, deixando o jogador sem arma e sem como escolher outra).
  shouldShowClericIntro(){
    if(this.hasChosenWeapon()) return false;
    return !this.hasFacedDungeon() || state.ascensionCount > 0;
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
    if(key === 'academia') return !!state.academiaAnnounced;
    if(key === 'loja') return this.hasFacedDungeon();
    if(key === 'guilda') return !!state.quests.creitonMilitia;
    if(key === 'caverna') return !!state.quests.caveClearance;
    if(key === 'ferreiro') return !!state.quests.slimeGelDelivery; // ver QuestModule
    return false;
  },

  openClericIntro(){
    document.getElementById('clericModal').classList.add('open');
    if(!state.playerName){
      document.getElementById('clericNameInput').value = '';
      this.showStep('clericStepName');
    } else if(state.ascensionCount > 0){
      // Pós-Ascensão: mesmo herói, já conhece a história — pula direto pra
      // escolha de arma (a única coisa que a Ascensão realmente zerou aqui).
      this.renderWeaponChoices();
      this.showStep('clericStepWeapon');
    } else {
      this.showStoryStep();
    }
  },
  showStep(stepId){
    document.querySelectorAll('#clericModal .cleric-step').forEach(el => el.classList.remove('active'));
    const step = document.getElementById(stepId);
    step.classList.add('active');
    // falas do Clérigo aparecem aos poucos, igual às conversas (ver DialogueModule.typeInto)
    const text = step.querySelector('.cleric-text');
    if(text){
      if(text.dataset.full === undefined) text.dataset.full = text.textContent;
      DialogueModule.typeInto(text, text.dataset.full, DialogueModule.voiceFor('anselmo'));
    }
  },
  showStoryStep(){
    document.getElementById('clericStoryText').dataset.full =
      `Prazer, ${state.playerName}. Esta cidade já foi cheia de vida e prosperidade. Mas, há pouco tempo, uma dungeon surgiu misteriosamente além dos portões. Dela passaram a sair criaturas terríveis que espalharam medo por toda a região. Muitos moradores fugiram, e os que ficaram vivem trancados em suas casas. Precisamos de alguém capaz de enfrentar essa ameaça e devolver a esperança ao nosso povo.`;    this.showStep('clericStepStory');
  },
  renderWeaponChoices(){
    const el = document.getElementById('weaponChoiceGrid');
    el.innerHTML = '';
    for(const def of WEAPON_DEFS){
      if(def.custom) continue; // armas criadas no Compêndio ficam só no Ferreiro, não viram escolha grátis
      // só ícone e nome; os bônus aparecem no tooltip ao passar o mouse (ou no foco)
      const btn = document.createElement('button');
      btn.className = 'weapon-choice-card';
      btn.dataset.key = def.key;
      btn.setAttribute('aria-label', `${def.name}: ${UI.weaponBonusText(def)}`);
      btn.innerHTML = `
        <div class="weapon-icon icon icon-${def.icon}"></div>
        <div class="weapon-name">${def.name}</div>`;
      btn.addEventListener('click', () => this.finishWeaponChoice(def.key));
      el.appendChild(btn);
    }
    UI.bindGridTooltip(el, key => {
      const d = WEAPON_DEFS.find(w => w.key === key);
      return d ? { title: d.name, lines: UI.weaponBonusText(d).split(' · '), hint: 'Clique para escolher' } : null;
    });
  },
  finishWeaponChoice(key){
    state.weapons[key] = 1;
    // 1ª arma do personagem já nasce equipada (ver PlayerModule.equipWeapon/
    // clickDamage) — o bônus não fica mais gravado em clickDamageFlat, é
    // lido dinamicamente a partir da arma ativa.
    state.equippedWeapon = key;
    SaveModule.save();
    document.getElementById('clericModal').classList.remove('open');
    UI.gridTooltipEl().classList.remove('open'); // o tooltip do cartão escolhido não fica pra trás
    UI.renderAll();
    StoryModule.onGameStart(); // cartão do Capítulo I
  },
  // Chamado por DungeonModule.leaveToCity() — na 1ª vez que o jogador volta
  // pra cidade já tendo enfrentado a dungeon (matado ao menos 1 monstro), o
  // Clérigo avisa que a notícia chegou e recomenda vender os itens na Loja
  // (que libera nesse momento). Só mostra 1 vez (ver state.shopUnlockAnnounced).
  announceShopUnlockIfNeeded(){
    if(!this.hasFacedDungeon() || state.shopUnlockAnnounced) return;
    state.shopUnlockAnnounced = true;
    SaveModule.save();
    DialogueModule.play('shopUnlock');
  },
  // Chamado por DungeonModule.leaveToCity() — na volta da
  // CONFIG.academiaUnlockEntries-ésima entrada (depois do resumo de loot, ver
  // DialogueModule.BLOCKERS) o Anselmo leva o herói até o Professor Aldo, que
  // libera a Academia e ela abre no fim da conversa. O flag só marca no fim:
  // se o jogo fechar no meio, a conversa repete na próxima volta.
  announceAcademiaIfNeeded(){
    if(state.dungeonEntriesCount < CONFIG.academiaUnlockEntries || state.academiaAnnounced || this._academiaQueued) return;
    this._academiaQueued = true;
    DialogueModule.play('academiaUnlock', { action: 'openAcademia', onEnd: () => {
      this._academiaQueued = false;
      state.academiaAnnounced = true;
      SaveModule.save();
    } });
  },
  // Chamado ao abrir a Academia (ver UI.init, placa openAcademiaBtn): com o
  // 1º Ponto Arcano já ganho, o Professor Aldo apresenta as Habilidades
  // Arcanas e a aba aparece no fim da conversa (antes disso fica escondida,
  // ver UI.renderArcaneTab). Marca só no fim: fechou no meio, repete.
  announceArcaneIfNeeded(){
    if(state.arcaneAnnounced || !ArcaneModule.isReady() || this._arcaneQueued) return;
    this._arcaneQueued = true;
    DialogueModule.play('arcaneIntro', { immediate: true, onEnd: () => {
      this._arcaneQueued = false;
      state.arcaneAnnounced = true;
      SaveModule.save();
    } });
  },
  init(){
    const nameInput = document.getElementById('clericNameInput');
    const confirmName = () => {
      state.playerName = nameInput.value.trim() || 'Herói';
      SaveModule.save();
      UI.renderPlayerName();
      // Só cai aqui sem nome já com ascensionCount>0 num save afetado pelo
      // bug antigo (playerName zerava na Ascensão) — mesma lógica de pular
      // a história de openClericIntro, pra não repetir 2x.
      if(state.ascensionCount > 0){
        this.renderWeaponChoices();
        this.showStep('clericStepWeapon');
      } else {
        this.showStoryStep();
      }
    };
    document.getElementById('clericNameConfirmBtn').addEventListener('click', confirmName);
    nameInput.addEventListener('keydown', e => { if(e.key === 'Enter') confirmName(); });

    document.getElementById('clericStoryContinueBtn').addEventListener('click', () => {
      this.renderWeaponChoices();
      this.showStep('clericStepWeapon');
    });

  }
};
