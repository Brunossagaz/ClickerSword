# TODO — Próximos passos

Lista de trabalho organizada por fase (dependência + esforço). Itens já
detalhados no roadmap do `README.md` são referenciados, não duplicados.

## Fase 1 — Ganhos rápidos / reaproveita infra existente

- [x] **Auto click** — clique automático periódico. Feito como upgrade da
      Academia de Combate (`battleAutoClick`, 1000 moeda, 1 nível só, saindo
      direto da raiz): liga um clique automático a cada 1s (padrão) enquanto
      houver monstro ativo, reaproveitando `PlayerModule.handleClick()` sem
      evento de mouse (ver `js/main.js`/`tick()`). Só age em ciclos já
      concluídos antes (chefe já derrotado ao menos 1x nessa Dungeon — ver
      `PlayerModule.isAutoClickActive`); fora disso fica pausado, com aviso
      na tela da Dungeon e na aba Estatísticas (`UI.renderAutoClickStatus`).
      2 upgrades de velocidade encadeados (`autoClickSpeed1`/`2`, -25 pontos
      percentuais do intervalo cada, acumulando: 1s → 0.75s → 0.5s) —
      exigiu trocar `ProgressionModule.isUnlocked` de um limiar fixo
      (`UNLOCK_REQUIREMENT=5`) pro `maxLevel` de cada pré-requisito, já que
      esses upgrades têm 1 nível só (ver `js/progression.js`).
- [x] **Classificação de tipo de item** — `ITEM_DEFS` já usa `type` pra
      `'mineral'` e `'brokenWeapon'` (ver Fase 4); os drops comuns (Geleia de
      Slime, Orelha de Goblin etc.) agora têm `type:'material'` também.
      `UI.shopCategoryDefs` (`ui.js`) troca o filtro por exclusão por
      `d.type==='material'`, igual às outras categorias.
- [x] **Vender quantidade escolhida na Loja** — Feito: cada item tem um
      stepper (-/+/"Tudo", `ui.js`/`buildItemRow`, `UI.shopSellQty`) que
      define quanto vender antes de confirmar. Botões "Tudo Geral"/"Zero
      Geral" por aba (`UI.setAllSellQty`) ajustam a quantidade de todos os
      itens da categoria de uma vez, mas ainda não vendem sozinhos.
- [x] **Botão "Vender Selecionados" na Loja** — Feito: botão por aba
      (`UI.sellSelected`, `ui.js`) ao lado de "Tudo Geral"/"Zero Geral", que
      vende de uma vez todo item da categoria com quantidade > 0 em
      `shopSellQty`, sem precisar clicar `.sell-btn` linha por linha. Fica
      `disabled` (`.sell-selected-btn` em `style.css`) quando nada na aba
      tem quantidade selecionada.
- [ ] **Novas missões** — expandir `QUEST_DEFS` (`config.js`), hoje só tem 1
      missão (entrega do Barnabé).
- [ ] **Missão de desbloqueio da Caverna** — usar o mesmo padrão de
      `unlocksBuilding` já existente (Ferreiro), aplicado à Caverna. Hoje ela
      libera temporariamente junto com Loja/Guilda (`OnboardingModule.
      isBuildingUnlocked`), só pra dar pra testar a mineração — precisa
      voltar a ter sua própria condição quando essa missão existir.
- [ ] **Liberar Guilda por missão** — idem, aplicado à Guilda (hoje libera só
      por progresso genérico em `OnboardingModule.isBuildingUnlocked`).
- [ ] **Mais upgrades** — estender a árvore radial da Academia de Combate
      (`upgrades.js`/`progression.js`), hoje com 16 nós (4 ramos saindo da
      raiz; 3 deles com 3 filhos irmãos de Nível 2; o de Automação com 2
      filhos encadeados, Nível 2 e 3).
- [ ] **Timeout do chefe reinicia sozinho** — hoje, ao estourar o tempo
      contra QUALQUER monstro (inclusive o chefe, posição 10 do ciclo), abre
      o `timeUpModal` perguntando "Tentar de novo" ou "Voltar pra cidade"
      (ver `MonsterModule.checkTimeUp`/`onTimeUp`, `UI.showTimeUpModal`).
      Pedido: pro chefe especificamente, trocar isso por um contador de 3s
      direto na tela da arena (sem modal, sem escolha) que reinicia o ciclo
      sozinho ao zerar (mesmo efeito de `MonsterModule.retryCycle()`), com
      uma mensagem avisando o jogador que o ciclo vai reiniciar. Perguntas
      em aberto pra quando for implementar: essa mudança vale só pro chefe
      (posição 10) ou pra qualquer monstro? Mantém alguma forma de voltar
      pra cidade durante a contagem, ou fica 100% automático?
- [ ] **Redesenhar cabeçalho da Dungeon** — hoje é 1 linha só (`tierLabel`,
      `js/ui.js`/`renderMonsterInfo`, `.tier-label` em `style.css`), fonte
      pequena e texto longo (ex.: "Dungeon do Pântano dos Slimes · CICLO 3 ·
      MONSTRO 4/10 (ABATIDOS NO TOTAL: 128)"). Pedido: trocar por um bloco
      no canto superior direito da arena, empilhado verticalmente — nome do
      Mapa em cima, Ciclo embaixo dele, Monstro atual embaixo disso — mais
      legível que a linha única atual.

## Fase 2 — Conteúdo

- [x] **Dar tiers pro Andar das Terras Selvagens** — Feito: 5 ciclos (igual
      ao Slime/Goblin), com posições de dupla e tripla (Orc/Troll).
- [x] **2 andares novos** — Andar do Dragão (Lagarto de Fogo novo + Dragão,
      3 ciclos, chefe é uma DUPLA na última posição) e Andar do Demônio
      (Sombra + Mini Servo novos + Demônio, 3 ciclos). O motor de batalha
      em grupo (`pairChoices` em `MAPS`) agora aceita trio, não só dupla
      (ver `MonsterModule.groupSize`), e um grupo pode ser o chefe do ciclo
      (só a última fase do grupo fecha o ciclo, ver `MonsterModule.spawn`).
      Necrópole/Floresta Élfica (plano antigo em `README.md` → "Novas
      Dungeons") ainda não têm andar — usar o mesmo padrão dos 2 acima.
- [ ] **Finalizar Inventário estilo mochila** — a aba "Mochila" já existe
      (`ui.js`, só visualização — equipar arma agora é na aba Armas, ver
      Fase 4), falta organizar por slots/quantidade e usar a classificação
      de tipo (Fase 1) pra filtrar/agrupar.
- [x] **Expandir loot pra outras Dungeons** — todo andar dropa item hoje
      (Slime é o único com cadeia de arma bruta→forja, ver Fase 4).

## Fase 3 — Sistemas novos maiores

- [ ] **Conquistas (Achievements)** — hoje só existe a casca do modal (abre/
      fecha em `ui.js`, sem lista nem tracking). Definir lista de conquistas
      + hooks nos eventos (kills, ascensão, missões, etc.) + recompensas.
- [ ] **Liberar sprite de personagem** — não existe sprite jogável hoje (só
      monstros, via `gen_sprites.py`). Precisa estender a pipeline de arte
      pro personagem + condição de desbloqueio.

## Fase 4 — Sistema de equipamento

- [ ] **Equipamentos/loot com bônus permanente** — chefes derrubam itens
      equipáveis fora de arma (armadura, acessório etc.) — ainda não
      existe, é diferente do sistema de armas abaixo.
- [x] **Ferreiro conserta armas da dungeon**. Feito, e NÃO é sistema de
      durabilidade — é uma categoria de drop (`ITEM_DEFS type:'brokenWeapon'`
      pra Espada/Machado/Machado Maior de Gosma). Leva 3 unidades da mesma
      arma bruta + minério/Geleia de Slime + moeda até o Ferreiro (aba
      "Forjar", `FORGED_WEAPON_DEFS`/`ForgeModule` em `js/forge.js`) e
      consegue uma arma nova com bônus de dano por clique E de DPS (novo —
      só arma forjada dá DPS). Junto veio a "seleção de arma equipada"
      (`state.equippedWeapon`, `PlayerModule.equipWeapon`): agora só UMA
      arma fica ativa por vez (trocável na aba Armas do Inventário), pra
      TODA arma (inclusive as 3 iniciais do Clérigo/Ferreiro) — antes cada
      arma adquirida empilhava seu bônus pra sempre. O antigo mecanismo de
      "equipar item da Mochila" (`ITEM_DEFS.equip`/`state.equipment`) foi
      removido, ficou obsoleto com a mudança.

## Pendências técnicas soltas

- [x] Expansão da mineração — minério virar recurso próprio. Feito: 6
      minérios (`ITEM_DEFS` com `type:'mineral'`) com raridade, mineradores
      de minério (`PROSPECTOR_DEFS`) e upgrades de taxa/sorte
      (`CAVERN_UPGRADE_DEFS`) no modal da Caverna (`js/cavern.js`/
      `CavernModule`). Minério minerado cai num baú (`state.cavernChest`) e
      só vira item da mochila quando o jogador clica pra coletar. Ainda
      faltam, como itens separados: a missão de desbloqueio da Caverna (ver
      item já listado na Fase 1) e o crafting no Ferreiro usando minério
      (ver Fase 4).
- [x] Moeda única do jogo — a economia agora gira 100% em torno de vender
      item/minério na Loja. Removidos os mineradores passivos de ouro
      (antigo `MINER_DEFS`/`MiningModule`/aba "Ouro" da Caverna) por
      redundância com a venda de minério. O termo "Ouro" nos textos do jogo
      virou "Moeda" (a moeda continua sendo `state.gold` internamente, sem
      migração de save); "Ouro" como palavra ficou reservado só pro minério
      (`goldOre`/"Minério de Ouro"). O upgrade de prestígio "Toque de Midas"
      foi reaproveitado: era +15% ouro/seg da Caverna, agora é +15%
      velocidade de mineração de minério (`pOreRate`/`state.pOreRateMult`).
- [ ] Auto-upgrade/auto-buy (desbloqueável tarde).
- [ ] 2ª camada de prestígio ("Transcendência", acima da Ascensão).
- [ ] `js/audio.js` — efeitos sonoros de clique/morte/ascensão.
- [ ] Separar `config.js` em `config/monsters.js`, `config/troops.js`,
      `config/upgrades.js` se a lista crescer muito.

## Ícones da UI pendentes (`assets/icons/`)

Cada linha já tem uma classe CSS `.icon-<nome>` pronta em `css/style.css`, só
falta o PNG (64×64, fundo transparente, ver `README.md` → "Ícones da UI
(pixel art)" pro formato e passo a passo).

- [x] `ferreiro.png` — Prédio Ferreiro (~32px)
- [x] `guilda.png` — Prédio Guilda (~32px)
- [x] `caverna.png` — Prédio Caverna (~32px)
- [x] `loja.png` — Prédio Loja (~32px)
- [x] `igreja.png` — Prédio Igreja (~32px)
- [x] `dungeon.png` — Prédio Dungeons (~32px)
- [x] `inventario.png` — Prédio Inventário (~32px)
- [x] `academia.png` — Prédio Academia de Combate (~32px)
- [x] `gear.png` — Botão de Configurações (~18px)
- [x] `trophy.png` — Modal de Conquistas (~40px)
- [x] `lock.png` — Prédio/upgrade bloqueado (~12-14px)
- [ ] `coin.png` — Custo/recompensa em moeda (~14px)
- [x] `essence.png` — Custo em Essência (Ascensão) (~14px)
- [x] `boss.png` — Marcador de chefe (~16px)
- [x] `golden-monster.png` — Marcador de monstro dourado (~16px)
- [x] `item-slimegel.png` — Item Geleia de Slime (~20px)
- [ ] `item-slimecompound.png` — Item Composto de Slime (~20px)
- [ ] `item-slimesword.png` — Item Espada de Gosma (Bruta) (~20px)
- [ ] `item-slimeaxe.png` — Item Machado de Gosma (Bruto) (~20px)
- [ ] `item-slimeaxegreater.png` — Item Machado de Gosma Maior (Bruto) (~20px)
- [ ] `item-goblinear.png` — Item Orelha de Goblin (~20px)
- [ ] `item-goblinfang.png` — Item Presa de Goblin Vermelho (~20px)
- [ ] `item-goblinshard.png` — Item Fragmento Arcano Goblin (~20px)
- [ ] `item-goblinscale.png` — Item Escama de Armadura Goblin (~20px)
- [ ] `item-goblinamulet.png` — Item Amuleto Sagrado Goblin (~20px)
- [ ] `item-goblinseal.png` — Item Selo do Goblin Mestre (~20px)
- [ ] `item-goblincrown.png` — Item Coroa Menor Goblin (~20px)
- [ ] `item-orctusk.png` — Item Presa de Orc (~20px)
- [ ] `item-trollhide.png` — Item Pele de Troll (~20px)
- [ ] `item-dragonscale.png` — Item Escama de Dragão (~20px)
- [ ] `item-demonhorn.png` — Item Chifre de Demônio (~20px)
- [ ] `item-firelizardscale.png` — Item Escama de Lagarto de Fogo (~20px)
- [ ] `item-miniservoclaw.png` — Item Garra de Mini Servo (~20px)
- [ ] `item-shadowessence.png` — Item Essência das Sombras (~20px)
- [x] `weapon-sword.png` — Arma Espada Simples (~20-28px)
- [x] `weapon-bow.png` — Arma Arco e Flecha (~20-28px)
- [x] `weapon-axe.png` — Arma Machado (~20-28px)
- [ ] `weapon-slimewarriorsword.png` — Arma forjada Espada do Guerreiro Slime (~20-28px)
- [ ] `weapon-slimewarrioraxe.png` — Arma forjada Machado do Guerreiro Slime (~20-28px)
- [ ] `weapon-slimekinggreataxe.png` — Arma forjada Machado Ancestral do Rei Slime (~20-28px)
- [ ] `mineral-iron.png` — Minério Minério de Ferro (~20px)
- [ ] `mineral-bronze.png` — Minério Fragmento de Bronze (~20px)
- [ ] `mineral-silver.png` — Minério Minério de Prata (~20px)
- [ ] `mineral-gold.png` — Minério Minério de Ouro (~20px)
- [ ] `mineral-diamond.png` — Minério Diamante Bruto (~20px)
- [ ] `mineral-crystal.png` — Minério Cristal Arcano (~20px)
- [ ] `chest.png` — Baú da Caverna (~28px)

## Decisão futura — empacotar como executável

Hoje o jogo é HTML/CSS/JS puro sem build. Se um dia quiser um
`.exe`/instalador pra rodar sem abrir o navegador manualmente:

- [ ] **PWA** (manifest.json + service worker) — esforço quase zero, mas não
      é um `.exe` de verdade (ainda depende do navegador instalado).
- [ ] **Tauri** — binário pequeno (webview nativo do Windows), exige
      toolchain Rust pra compilar. Recomendado pra executável leve/uso pessoal.
- [ ] **Electron** — mais popular/documentado, mas executável pesado
      (100MB+, embute Chromium inteiro).
