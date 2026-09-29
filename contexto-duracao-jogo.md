# Contexto: aumentar a duração do ClickerSword ("Beyond the Gate")

> Este documento resume o trabalho feito no Claude Code, com acesso ao repositório.
> No chat web você não tem acesso ao código: os valores e nomes abaixo vêm diretamente dele.
> Última atualização: 2026-09-28.

## 1. O projeto
- Idle clicker de combate em HTML/CSS/JS puro (sem build), em português. Repo: `ClickerSword-main`.
- Dados e balanceamento em `js/config.js` (`CONFIG`, `MONSTER_TYPES`, `MAPS`, `DUNGEON_ORDER`,
  `UPGRADE_DEFS`, `TROOP_DEFS`, `FORGED_WEAPON_DEFS`, `PROSPECTOR_DEFS`, `QUEST_DEFS`, `ARCANE_SKILL_DEFS`...).
- Sistemas: dungeon por andares e ciclos, tropas (Guilda), forja, Academia (árvore de upgrades),
  Habilidades Arcanas (Fogo/Raio/Gelo), Caverna (mineradores, minérios, Cristal Arcano), monstro dourado,
  Bestiário, conquistas, progresso offline.
- 5 andares (slimes → goblins → wilds → dragons → demons), com 5 ciclos cada. Limites de tempo: 10 s por monstro,
  20 s no chefe, 30 s por entrada.
- Simulador de progressão: `tools/balance_sim.js` (Node), com o núcleo em `tools/balance-core.js`
  (compartilhado com a aba Curvas do `tools/compendio.html`).

## 2. Decisões de design já tomadas
- **Sem Ascensão/prestígio.** O formato atual fica. `CONFIG.ascensionEnabled` continua `false`.
- A duração deve vir de **narrativa e conteúdo novo** (história, armas, monstros, talvez um 6º andar),
  não de números maiores.
- **Orçamento de tempo por andar** (1ª passagem, jogador típico a 4 cliques/s), em `MAPS[andar].timeBudgetH`:

  | andar | orçamento |
  |---|---|
  | slimes | 0,75 h |
  | goblins | 1,0 h |
  | wilds | 1,5 h |
  | dragons | 2,0 h |
  | demons | 2,5 h |
  | **total** | **7,75 h** |

- A história não trava a progressão: o próximo andar libera como antes, e a narrativa acompanha.
- As respostas prontas nos diálogos **não mudam a história**. Os NPCs só lembram delas e comentam depois.

## 3. O que já foi implementado
**Correção da trava do 1º slime**
- `MAPS.slimes.cycleHpMult = { 1: 0.5 }`: o 1º slime passou de 27 para 14 de vida.
- Agora basta ~1,4 clique/s (antes eram 2,7).

**Simulador confiável** (`tools/balance-core.js`). O jogador simulado agora:
- libera prédios na ordem real do jogo (Academia na 5ª entrada; Ferreiro, Guilda e Caverna pelas missões);
- tem inventário de verdade: guarda a receita da próxima forja e as entregas de missão, e vende o resto;
- forja com os materiais reais e volta a andares antigos atrás de drops de chefe quando compensa;
- usa a Caverna (compra o que se paga em até 30 min), com minério sorteado pelos pesos reais;
- tem o monstro dourado, o Faro de Caçador e o `extraDropChance` das armas;
- gasta os Pontos Arcanos no que mais aumenta o dano.

Comandos:
- `--amostras N`: sorteia drops N vezes (mediana e pior 10%).
- `--sem caverna,arcano,...`: mede o peso de cada sistema.
- Sai com código 1 se algum andar ficar fora do orçamento (±20%).

**Diálogos** (`js/dialogue.js`, roteiros em `js/dialogues-data.js`)
- Uma janela única de conversa, com as falas aparecendo letra por letra e pausas na pontuação.
- "Voz" sintetizada, com timbre próprio para cada personagem.
- Clique completa a fala; o clique seguinte avança.
- Velocidade do texto nas Configurações: lento, normal, rápido ou instantâneo.
- Respostas prontas ficam salvas em `state.dialogueMemory` e mudam falas futuras (campo `when`).
- As apresentações de NPC, que eram modais fixos, foram migradas para esse sistema.

**Passagem de andar como capítulo** (`js/story.js`):
- vencer o ciclo 5 do andar toca uma cena na dungeon, antes do resumo de loot;
- de volta à cidade, um NPC reage e aparece o cartão do próximo capítulo.

**Janela de Missões** (botão no HUD, com "!" quando há missão para concluir):
- aba História com o capítulo atual e o progresso;
- pedidos da cidade;
- lista de concluídas.

As missões saíram de dentro da Loja, do Ferreiro e da Igreja.

**Rascunho da história** (para revisão, em `js/dialogues-data.js`)
- Premissa: a dungeon está atrás de um **selo** da ordem do Irmão Anselmo, que está se partindo.
- Capítulo I, Pântano: onde o Rei Slime cai aparece o símbolo do selo, um círculo partido.
- Capítulo II, Goblins: os goblins adoravam um pedaço do selo. O Professor Aldo apresenta as Arcanas.
- Capítulo III, Selvagens: orcs e trolls não atacavam, estavam fugindo. Creiton reconhece marcas da forja do avô.
- Capítulo IV, Dragão: o dragão guardava a cidade do que está abaixo. Anselmo confessa que a ordem dele vigiava o portão.
- Capítulo V, Além do Portão: o selo se fecha, "por enquanto". Isso deixa o gancho para um 6º andar.

## 4. Segunda rodada (2026-09-29): Gelo, orçamento, armas, bruxa, missões e conquistas
**Gelo**
- Intervalo mínimo de 5 s para 2,5 s de congelamento: no máximo metade do tempo congelado.
- Teto de +60% no dano extra (`maxPower`). A aba Arcana mostra "MÁX".
- Resultado: o jogador simulado passou a dividir os pontos entre Gelo, Raio e Fogo.

**Orçamento**
- `CONFIG.balanceIdealShare = 0.7`: o simulador mira 70% do orçamento, porque um jogador real é ~40% mais lento.
- `hpScale`: slimes 8,5, goblins 43, wilds 1600, dragons 7900 e demons 34000.
- `cycleHpMult` suaviza ciclos triviais e paredões:
  - slimes: ciclo 1 em 0,0915, mantendo o 1º slime com 14 de vida;
  - dragons: ciclos 4 e 5 reforçados;
  - demons: entrada mais suave e ciclos 4 e 5 reforçados.
- Custos não mudaram. No teste com Academia e tropas 30% mais caras, o Demônio batia no limite de 40 min
  de farm e ficava 22% abaixo da meta.

**Armas**
- As 3 iniciais agora são diferentes: Espada +2 de dano, Arco +1 e 8% de crítico, Machado +1 e queimadura.
- 8 forjadas novas: 2 alternativas por andar (uma de clique, outra de tropas), com o efeito do andar:
  - Goblin: drop extra;
  - Selvagens: queimadura;
  - Dragão: crítico;
  - Demônio: dano bruto.
- 4 drops brutos novos:
  - Lâmina Goblin: Goblin Maior, 20%;
  - Clava do Troll: 2%;
  - Garra de Dragão: 4%;
  - Lâmina Demoníaca: 2%.
- O Ferreiro agrupa as receitas por andar e esconde as de andares trancados.
- O Machado Ancestral agora pede 1 Cristal Arcano (antes 3).
- **Ícones provisórios**: 12 PNGs em `assets/icons/` (`item-goblinblade`, `item-trollclub`, `item-dragonclaw`,
  `item-demonblade`, `weapon-goblinraiderdagger`, `weapon-goblinprieststaff`, `weapon-orctribalaxe`,
  `weapon-trollelderclub`, `weapon-dragonscaleblade`, `weapon-firelizardbow`, `weapon-demonhornsword`,
  `weapon-shadowscythe`) são cópias de ícones parecidos. Basta sobrescrevê-los.

**Madame Morgana** (`js/witch.js`, só à noite)
- Clicar nela abre a conversa:
  - apresentação com respostas (uma delas dá a conquista secreta "Quase Sapo");
  - depois, um menu com Alquimia, entregar pedido, pedir trabalho e "o que você sabe sobre o selo" (lore por capítulo).
- **Alquimia** (`ALCHEMY_RECIPES`): transforma material que sobra em minério raro, inclusive Cristal Arcano.
  Libera ao concluir o 1º pedido dela.
- **5 pedidos noturnos**, liberados por capítulo e entregues só à noite, com recompensa.
  Objetivos novos: `killMonster` (abates a partir do pedido) e `visitSpot` (clicar num ponto do mapa à noite).

**Pedidos dos moradores** (`js/requests.js`)
- 3 vagas repetíveis: caçada, entrega ou visita a um ponto do mapa (ponto dourado brilhando; o clique conclui na hora).
- Recompensa em moedas, proporcional ao andar mais alto liberado.
- A vaga volta 4 minutos depois de concluir; há o botão "Dispensar".

**Conquistas**: 28 → 51. As novas cobrem:
- os 5 capítulos;
- forja por andar e "todas";
- 25 vitórias contra cada chefe;
- todos os pedidos da cidade e da bruxa;
- 10 e 50 pedidos de moradores;
- Sob a Lua, Aprendiz de Alquimia, Cristal Destilado e Quase Sapo (secreta).

Só as missões dão recompensa; conquistas continuam só de coleção.

## 5. Números atuais do simulador (4 cliques/s, jogador ideal, sem ganho offline)
| andar | meta ideal (70%) | simulado | mediana com sorteio |
|---|---|---|---|
| slimes | 0,52 h | 0,52 h | 0,52 h |
| goblins | 0,70 h | 0,70 h | 0,72 h |
| wilds | 1,05 h | 0,91 h | 0,94 h |
| dragons | 1,40 h | 1,38 h | 1,32 h |
| demons | 1,75 h | 1,93 h | 1,75 h |
| **total** | **5,42 h** | **5,43 h** | **5,06 h** |

- Jogador real estimado: ~7,8 h, no orçamento de 7,75 h. Maior farm num ciclo: ~42 min.
- Pedidos repetíveis ficam fora do simulador; a Alquimia também. Os pedidos da bruxa entram.

**Achado em aberto: quem clica devagar sofre muito.**
- 3 cliques/s: ~8,7 h reais, com um paredão de 69 min.
- 1,4 clique/s: ~25 h, com paredão de 12 h no Demônio.
- As tropas são fracas e o jogo depende muito do clique. As armas "de tropas" ajudam, mas não resolvem.

## 6. Próximos passos sugeridos
1. Tornar as tropas e o Clique Automático viáveis para quem clica pouco (jogo mais idle), ou assumir o jogo como "ativo".
2. Arte final dos 12 ícones.
3. Revisar os textos (história e bruxa) em `js/dialogues-data.js`.
4. Ideias de narrativa ainda não feitas:
   - fala do chefe antes da luta;
   - lore no Bestiário;
   - diário do herói;
   - falas dos moradores por capítulo;
   - 6º andar.
