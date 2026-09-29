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

## 4. Números atuais do simulador (4 cliques/s, jogador ideal, sem ganho offline)
| andar | orçamento | simulado |
|---|---|---|
| slimes | 0,75 h | 0,18 h |
| goblins | 1,0 h | 0,60 h |
| wilds | 1,5 h | 0,56 h |
| dragons | 2,0 h | 0,42 h |
| demons | 2,5 h | 0,08 h |
| **total** | **7,75 h** | **1,85 h** |

- A 3 cliques/s: 2,13 h. Um jogador real deve levar ~30 a 50% a mais, por navegação, leitura e compras não ideais.
- O modelo antigo dava 4,4 h porque ignorava as Habilidades Arcanas e a Caverna.

**Achado principal: o Gelo das Habilidades Arcanas domina o jogo.**
- Com 6 pontos em Velocidade, o intervalo do Gelo (2,5 s) fica igual à duração do congelamento. O monstro fica
  congelado o tempo todo: os relógios andam na metade da velocidade e o dano recebido sobe sem teto
  (+0,08 por nível de Dano).
- O jogador simulado põe todos os pontos em Gelo.
- Só desligar as Arcanas já leva o total de 1,85 h para 3,44 h.
- Com Arcanas, Caverna e dourado desligados: 8,17 h.

**Outros achados**
- A variância do Cristal Arcano quase não pesa hoje: o jogador termina o jogo sem forjar o Machado Ancestral
  (fica com 2 de 3 cristais), porque as Arcanas tornam a arma dispensável.
- As tropas quase não são compradas no fim (12 recrutas e 7 arqueiros).

## 5. Próximos passos sugeridos (ainda não feitos)
1. **Rebalancear as Arcanas**:
   - intervalo mínimo do Gelo maior que a duração, para ele não congelar o tempo todo;
   - teto no bônus de dano do Gelo;
   - ou custo crescente por nível.
2. **Rebalancear contra o orçamento**, usando o simulador (subir `hpScale` por andar e ajustar custos).
   O maior déficit está em demons e dragons.
3. **Narrativa como ritmo**, expandindo a passagem de andar:
   - **Missões de capítulo com etapas**: além de vencer o ciclo 5, pedir 1 ou 2 objetivos temáticos do andar
     ("traga o amuleto do Goblin Maior", "forje uma arma com escamas de dragão"), só para a história, sem travar o andar.
   - **Chefe com fala antes da luta**: uma fala curta ao aparecer o chefe do ciclo 5 (a janela de diálogo já pausa o jogo).
   - **Fragmentos de lore no Bestiário**: 25/100/500 abates por espécie liberam um trecho de história.
   - **Diário do herói**: uma aba nas Missões que registra as cenas vistas e as respostas dadas, para reler.
   - **NPCs de ambiente com falas por capítulo**: as falas soltas dos moradores (`lines`) mudam conforme `state.story.chapter`.
   - **6º andar**: o gancho do final ("por enquanto") abre espaço para "o que espera além do portão".
4. **Uma arma forjada por andar**, feita com drops daquele andar. Hoje só existem armas do Pântano.
5. **Sistema de pena para o Cristal Arcano**, se ele voltar a ser necessário.
