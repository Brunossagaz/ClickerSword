# TODO — Próximos passos

Lista de trabalho organizada por fase (dependência + esforço). Itens já
detalhados no roadmap do `README.md` são referenciados, não duplicados.

## Fase 1 — Ganhos rápidos / reaproveita infra existente

- [x] **Auto click** — upgrade da Academia (`battleAutoClick`, 1 nível,
      saindo da raiz): clique automático periódico reaproveitando
      `PlayerModule.handleClick()` sem evento de mouse (ver `tick()` em
      `js/main.js`). Só age em ciclos já concluídos antes
      (`PlayerModule.isAutoClickActive`), com aviso na tela quando pausado.
      3 upgrades de velocidade encadeados (`autoClickSpeed1`/`2`/`3`, -25
      pontos percentuais cada: 1s → 0.75s → 0.5s → 0.25s, ver
      `PlayerModule.autoClickIntervalMs`). O 3º (Reflexos Infinitos) não era
      contado no intervalo — corrigido.
- [x] **Classificação de tipo de item** — todo `ITEM_DEFS` tem `type`
      (`'material'`/`'brokenWeapon'`/`'mineral'`), usado pelas abas da Loja
      (`UI.shopCategoryDefs`) e pelos filtros da Mochila.
- [x] **Vender quantidade escolhida na Loja** — stepper -/+/"Tudo" por item
      (`UI.shopSellQty`) + "Tudo Geral"/"Zero Geral" por aba.
- [x] **Botão "Vender Selecionados" na Loja** (`UI.sellSelected`).
- [x] **Novas missões** — 3 em `QUEST_DEFS`: entrega do Barnabé
      (`slimeGelDelivery`), milícia do Creiton (`creitonMilitia`) e limpeza
      da caverna do Anselmo (`caveClearance`).
- [x] **Missão de desbloqueio da Caverna** — liberada por `caveClearance`
      (`OnboardingModule.isBuildingUnlocked`).
- [x] **Liberar Guilda por missão** — liberada por `creitonMilitia`.
- [x] **Mais upgrades** — árvore da Academia com 33 nós: Dano % ganhou
      Nível 3 e 4 encadeados, Automação ganhou a 3ª velocidade, e ramos novos
      de Sorte, Monstro Dourado e Tempo (ver abaixo). Continua aberto pra
      mais ramos — pra adicionar: entrada em `UPGRADE_DEFS` (com `effects`)
      + posição em `UPGRADE_TREE`.
- [ ] **Timeout do chefe reinicia sozinho** — hoje, ao estourar o tempo
      contra QUALQUER monstro, abre o `timeUpModal` ("Tentar de novo" /
      "Voltar pra cidade"). Pedido: pro chefe, trocar por um contador de 3s
      na arena que reinicia o ciclo sozinho (mesmo efeito de
      `MonsterModule.retryCycle()`, que agora também zera o tempo da
      Dungeon), com mensagem de aviso. Perguntas em aberto: vale só pro chefe
      ou pra qualquer monstro? Dá pra voltar pra cidade durante a contagem?
- [ ] **Redesenhar cabeçalho da Dungeon** — hoje é 1 linha só (`tierLabel`,
      `UI.renderMonsterInfo`), fonte pequena e texto longo. Pedido: bloco no
      canto superior direito da arena, empilhado (Mapa / Ciclo / Monstro).
      Ficou mais urgente com as 2 barras de tempo embaixo do monstro.

## Feito recentemente (fora das fases originais)

- [x] **Duas barras de tempo na Dungeon** — tempo do monstro (10s/20s
      chefe) + tempo da entrada inteira (`CONFIG.dungeonTimeLimitMs`, 30s,
      `DungeonModule.tickRunTimer`/`runTimeLimitMs`). Só corre com monstro
      ativo; ao zerar volta pra cidade e mostra o loot da entrada
      (`UI.showLootSummaryModal`). "Tentar de novo" reinicia esse tempo.
- [x] **Ramo Tempo na Academia** — Fôlego do Explorador + Resistência
      Incansável, +5s por nível (até +50s, `state.dungeonTimeBonusMs`).
- [x] **Monstro dourado** — só existe depois de comprar Sorte Dourada
      (`MonsterModule.isGoldenUnlocked`); recompensa caiu de ×20 pra ×3
      (`CONFIG.goldenRewardMult`).
- [x] **Jogo pausa em conversas com NPC** (`PauseModule` em `js/main.js`,
      lista em `DIALOG_MODAL_IDS`). Loja/Ferreiro não pausam (são painéis de
      compra) — é só incluir os ids se mudar de ideia.
- [x] **Compêndio editável** (`tools/compendio.html`) — monstros, vida,
      itens, armas, tropas e árvore de habilidades; cria itens e armas.
      Salva só a diferença em `js/overrides-data.js` (aplicada por
      `js/overrides.js` por cima do `config.js`) via `tools/dev_server.py`.
      Efeitos dos upgrades viraram dados (`effects` + `UPGRADE_STATS`).
- [x] **Cidade como mapa (plano A)** — a arte da vila virou a tela da
      Cidade (`CityMapModule`, `js/citymap.js`; dados em `CITY_MAP`): placas
      dos prédios em cima de cada construção (os mesmos botões de antes) e
      Anselmo, Barnabé e Creiton andando pela praça com animação de 3
      direções; clicar num morador mostra uma fala dele. Sprites de corpo
      inteiro desenhados no GridFab (`art/npc/`, `assets/sprites/npc-*.png`).
      Congela durante conversas e só anima com a Cidade visível. No celular o
      mapa rola na horizontal.
- [x] **Cidade viva** — fonte da praça interativa (deposita de 1 a 999
      moedas, total em `state.fountainCoins`), 7 moradores de ambiente
      (2 crianças, mulher, idosa, idoso, guerreiro, bruxa) com falas e card no
      Compêndio, e ciclo de dia e noite (`CITY_MAP.dayLengthMs`/`dayPhases`)
      com moradores que só aparecem de dia ou de noite. Usa as pinturas de noite
      (`dungeon-wallpaper.png`) e de dia (`dungeon-wallpaper2.png`); o
      entardecer/amanhecer (`city-dusk.png`) é gerado da de dia por
      `tools/gen_city_daylight.py` (degradê de cor, sem recorte). Relógio
      pixel art no canto do mapa (`art/ui/clock-dial` + ponteiro no canvas).
      NPCs refeitos em 24x32 com sombreamento automático.
- [x] **Jogo em tela cheia** — cidade e dungeon sem moldura de página (a
      pintura da cidade cobre a janela), botões no canto (mochila = inventário
      em gaveta, tela cheia, configurações), entra em tela cheia ao clicar em
      "COMECE A JOGAR" (`HudModule`, `js/hud.js`). ESC fecha o modal de cima
      (em tela cheia a tecla é travada pro jogo via Keyboard Lock). Tela de
      carregamento com slime pulando (`LoadingModule`, `js/loading.js`):
      decodifica todas as imagens na abertura e cobre as trocas de tela do menu.
- [ ] **Mapa explorável (plano B)** — personagem do jogador andando
      (teclado/clique), colisão, câmera e NPCs com rotina; exige tileset,
      prédios vistos de cima e sprite do jogador. A Dungeon fica como está.
- [x] **UI em pixel art "pedra + ouro"** — `css/ui-skin.css` por cima do
      `style.css`: molduras, botões (normal/hover/press/disabled + verde/
      vermelho/laranja), abas, fechar, divisórias, barras, slots, tooltips,
      scrollbars. Peças desenhadas no GridFab (fonte em `art/ui/<peça>/`,
      PNGs em `assets/ui/`). Layout de celular (≤600px) incluído.

## Fase 2 — Conteúdo

- [x] **Tiers pro Andar das Terras Selvagens** — 5 ciclos com duplas/triplas.
- [x] **2 andares novos** — Andar do Dragão e Andar do Demônio (grupo pode
      ser trio e pode ser o chefe, ver `MonsterModule.groupSize`/`spawn`).
      Necrópole/Floresta Élfica (plano em `README.md` → "Novas Dungeons")
      ainda não têm andar — usar o mesmo padrão.
- [x] **Inventário estilo mochila** — aba Mochila em slots
      (`UI.renderInventoryBag`): ícone + quantidade por slot, sem limite,
      filtros Tudo/Materiais/Armas/Minérios, detalhe do item selecionado
      (tipo, raridade, preço de venda). Só visualização; vender continua na
      Loja.
- [x] **Expandir loot pra outras Dungeons** — todo andar dropa item.
- [ ] **Balancear com o tempo de Dungeon de 30s** — conferir na aba Vida do
      Compêndio se o dano disponível em cada fase alcança o "DPS mín." A vida
      cresce muito nos andares finais (Demônio passa de 1 quatrilhão).

## Fase 3 — Sistemas novos maiores

- [ ] **Conquistas (Achievements)** — sistema pronto (`ACHIEVEMENT_DEFS`,
      `AchievementsModule.unlock`, lista no modal, secretas com "???",
      sobrevivem à Ascensão). Só existe "Meio Besta" (333 moedas na fonte de
      uma vez). Falta: mais conquistas + hooks nos eventos (kills, ascensão,
      missões...) + recompensas.
- [ ] **Liberar sprite de personagem** — não existe sprite jogável (só
      monstros). Estender a pipeline de arte + condição de desbloqueio.

## Fase 4 — Sistema de equipamento

- [ ] **Equipamentos/loot com bônus permanente** — armadura, acessório etc.
      vindos de chefes (diferente do sistema de armas).
- [x] **Ferreiro conserta armas da dungeon** — arma bruta
      (`type:'brokenWeapon'`) + materiais + moeda → arma forjada
      (`FORGED_WEAPON_DEFS`/`ForgeModule`). Só uma arma ativa por vez
      (`state.equippedWeapon`, aba Armas do Inventário).

## Pendências técnicas soltas

- [x] Expansão da mineração — 6 minérios com raridade, mineradores,
      upgrades e baú (`js/cavern.js`).
- [x] Moeda única do jogo — economia gira em torno de vender item/minério.
- [ ] Compêndio: criar monstros e habilidades novas (hoje só edita; monstro
      precisa de sprite e lugar nos ciclos, habilidade precisa de posição em
      `UPGRADE_TREE`).
- [ ] Efeito de upgrade editado não é retroativo — níveis já comprados num
      save guardam o valor antigo nos stats de `state`. Se virar problema:
      recalcular os stats a partir de `state.upgrades` ao carregar o save.
- [ ] Auto-upgrade/auto-buy (desbloqueável tarde).
- [ ] 2ª camada de prestígio ("Transcendência", acima da Ascensão).
- [ ] `js/audio.js` — efeitos sonoros de clique/morte/ascensão.
- [ ] Separar `config.js` em `config/monsters.js`, `config/troops.js`,
      `config/upgrades.js` se a lista crescer muito.

## Ícones da UI (`assets/icons/`)

Todos os ícones referenciados pelo jogo existem (64×64, 16×16 em 4x). O
último que faltava, `coin.png`, foi desenhado no GridFab (`art/ui/coin/`) e
agora é usado por `.icon-coin` (antes caía no `gold.png`). Itens criados no
Compêndio aparecem com contorno vermelho até existir
`assets/icons/<ícone>.png` — dá pra desenhar com o GridFab
(`python -m gridfab init --size 16x16 art/<nome>` e exportar em 4x).

## Decisão futura — empacotar como executável

Hoje o jogo é HTML/CSS/JS puro sem build. Se um dia quiser um
`.exe`/instalador pra rodar sem abrir o navegador manualmente:

- [ ] **PWA** (manifest.json + service worker) — esforço quase zero, mas não
      é um `.exe` de verdade (ainda depende do navegador instalado).
- [ ] **Tauri** — binário pequeno (webview nativo do Windows), exige
      toolchain Rust pra compilar. Recomendado pra executável leve/uso pessoal.
- [ ] **Electron** — mais popular/documentado, mas executável pesado
      (100MB+, embute Chromium inteiro).
