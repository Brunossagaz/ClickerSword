/* ---------------------------------------------------------------------
   MAIN GAME LOOP
--------------------------------------------------------------------- */
// Acumula o dano de DPS entre ticks pra mostrar 1 número flutuante por
// segundo (ver UI.showFloatingDpsDamage) em vez de um a cada 200ms — a
// soma nesse intervalo já bate com o próprio valor de DPS exibido no stat.
let dpsFloatAccum = 0;
let dpsFloatElapsedMs = 0;
// Acumulador do upgrade Clique Automático (Academia, ver UPGRADE_DEFS
// battleAutoClick) — dispara um clique de verdade (PlayerModule.handleClick,
// sem evento de mouse) a cada `autoClickIntervalMs`.
let autoClickElapsedMs = 0;

// Conversas com personagem (introdução do Clérigo e toda conversa da janela
// de diálogo — ver DialogueModule): enquanto qualquer uma estiver
// aberta o jogo fica pausado — tick() não roda nada. Loja/Ferreiro também
// mostram o retrato do NPC mas são painéis de compra, não entram aqui.
// Os relógios que usam Date.now() (tempo do monstro, dourado, queimadura,
// expedição da Guilda) são empurrados pra frente pelo tempo pausado ao
// fechar a conversa; o resto (tempo da Dungeon, DPS, Caverna) é por tick e
// já para sozinho.
const DIALOG_MODAL_IDS = ['clericModal', 'dialogueModal'];
const PauseModule = {
  pausedAt: null,
  isDialogOpen(){
    return DIALOG_MODAL_IDS.some(id => document.getElementById(id).classList.contains('open'));
  },
  // chamado no começo de cada tick — true = pausado, pula o tick inteiro
  update(){
    const open = this.isDialogOpen();
    if(open && this.pausedAt === null){
      this.pausedAt = Date.now();
    } else if(!open && this.pausedAt !== null){
      this.shiftClocks(Date.now() - this.pausedAt);
      this.pausedAt = null;
    }
    return open;
  },
  shiftClocks(ms){
    state.monsterSpawnedAt += ms;
    if(state.isGolden) state.goldenExpiresAt += ms;
    const burn = MonsterModule.current && MonsterModule.current.burn;
    if(burn) burn.nextTickAt += ms;
    if(state.guild.active) state.guild.startedAt += ms;
  }
};

function tick(){
  if(PauseModule.update()) return;
  MonsterModule.checkGoldenExpiry();
  MonsterModule.maybeTriggerGolden();
  // Gelo (Habilidades Arcanas): enquanto o monstro está congelado, o tempo
  // do monstro e o da Dungeon andam mais devagar (ver ArcaneModule.timeScale)
  // — o do monstro usa Date.now(), então é empurrado pra frente o que "sobrou".
  const timeScale = ArcaneModule.timeScale();
  if(timeScale < 1) state.monsterSpawnedAt += CONFIG.tickMs * (1 - timeScale);
  MonsterModule.checkTimeUp();
  DungeonModule.tickRunTimer(CONFIG.tickMs * timeScale);
  MonsterModule.checkBurnTick();
  ArcaneModule.tick(CONFIG.tickMs);
  const dps = TroopsModule.totalDps();
  if(dps > 0 && MonsterModule.current){
    const dmg = MonsterModule.applyDamage(dps * (CONFIG.tickMs/1000));
    dpsFloatAccum += dmg;
    dpsFloatElapsedMs += CONFIG.tickMs;
    if(dpsFloatElapsedMs >= 1000){
      UI.showFloatingDpsDamage(dpsFloatAccum);
      dpsFloatAccum = 0;
      dpsFloatElapsedMs = 0;
    }
  }
  // Clique Automático: PlayerModule.handleClick() sem `evt` já cai pro
  // centro da arena sozinho (ver UI.showFloatingDamage/showFloatingItemAt),
  // então dá pra reaproveitar 100% da lógica de clique manual (crítico,
  // bônus de monstro dourado, tudo) sem duplicar nada aqui. Só age em
  // ciclos já concluídos antes (ver PlayerModule.isAutoClickActive) — fora
  // disso o acumulador é zerado, sem "bancar" tempo parado.
  if(PlayerModule.isAutoClickActive()){
    autoClickElapsedMs += CONFIG.tickMs;
    const interval = PlayerModule.autoClickIntervalMs();
    if(autoClickElapsedMs >= interval){
      autoClickElapsedMs -= interval;
      PlayerModule.handleClick();
    }
  } else {
    autoClickElapsedMs = 0;
  }
  CavernModule.tick(CONFIG.tickMs/1000);
  GuildModule.resolveIfDone();
  UI.renderStats();
  UI.renderTimer();
  UI.renderAutoClickStatus();
  UI.renderArcaneBar();
}

function boot(){
  LoadingModule.start(); // tela de carregamento até as imagens/fontes estarem prontas
  UI.init();
  Sprites.startBlinkLoop();
  MainMenuModule.init();
  SettingsModule.loadGlobalSettings();
  SaveModule.migrateLegacyIfNeeded();

  // O jogo sempre começa no menu principal — o jogador escolhe Novo Jogo ou
  // Continuar, que leva pro seletor de saves (ver MainMenuModule). Nenhum
  // save é carregado automaticamente aqui.
  UI.showMainMenu();
  UI.renderAll(); // seguro: state==freshState() aqui, todo render já tolera esse estado

  setInterval(tick, CONFIG.tickMs);
  setInterval(()=>SaveModule.save(), CONFIG.autosaveMs); // no-op enquanto nenhum slot está ativo
  window.addEventListener('beforeunload', ()=>SaveModule.save());
}

boot();
