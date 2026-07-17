# Diagrama de Progressão — Beyond the Gate

> **Como manter este arquivo atualizado**
> Este diagrama é gerado a partir do código-fonte, não é uma spec paralela. Sempre que uma missão, desbloqueio, NPC ou sequência de história for **adicionada, removida ou alterada** em `js/config.js`, `js/onboarding.js`, `js/quests.js`, `js/dungeons.js`, `js/forge.js`, `js/progression.js`, `js/prestige.js`, `js/cavern.js` ou nos modais de `index.html`, **atualize as seções correspondentes abaixo na mesma alteração/commit**. Cada seção cita o arquivo:linha de origem — confira contra o código antes de confiar em uma seção antiga.
>
> Última sincronização com o código: **2026-07-17** (missão `creitonMilitia` com objetivos variados + Expedições da Guilda).

---

## 1. Visão geral — cidade, NPCs e missões

```mermaid
flowchart TD
    Start(["Jogador abre a cidade pela 1ª vez"]) --> Cleric["Irmão Anselmo: intro do Clérigo\n(nome + história + escolhe 1 arma grátis)"]
    Cleric --> Dungeon["🏰 Dungeon liberada\n(hasChosenWeapon OU hasFacedDungeon)"]

    Dungeon --> Kill1["Mata 1 monstro na Dungeon"]
    Kill1 --> Loja["🏪 Loja liberada\n(hasFacedDungeon)"]
    Loja --> MeetBarnabe["Conhece Barnabé na Loja"]
    MeetBarnabe --> QuestSlime["📜 Missão: slimeGelDelivery\nEntregar 10x Geleia de Slime a Barnabé"]
    QuestSlime --> Ferreiro["⚒️ Ferreiro liberado"]

    Ferreiro --> MeetCreiton["Conhece Creiton no Ferreiro"]
    MeetCreiton --> QuestMilitia["📜 Missão: creitonMilitia (3 objetivos)\n① Entregar 8x Composto de Slime\n② Derrotar o chefe de 1 ciclo em qualquer Dungeon\n③ Possuir 2 armas iniciais diferentes"]
    QuestMilitia --> Guilda["🛡️ Guilda liberada"]
    Guilda --> GuildExp["⚔️ Expedições da Guilda\n(coleta offline de material, ver seção 5b)"]

    Igreja["⛪ Igreja\n(sempre aberta)"] --> QuestCave["📜 Missão: caveClearance\nEntregar 20x Geleia de Slime a Irmão Anselmo"]
    QuestCave --> Caverna["⛏️ Caverna liberada"]

    Dungeon --> Entries["5ª entrada na Dungeon\n(state.dungeonEntriesCount)"]
    Entries --> Academia["🎓 Academia de Combate liberada"]

    style Cleric fill:#5b8def,color:#fff
    style MeetBarnabe fill:#5b8def,color:#fff
    style MeetCreiton fill:#5b8def,color:#fff
    style Igreja fill:#5b8def,color:#fff
    style QuestSlime fill:#e0a13c,color:#000
    style QuestMilitia fill:#e0a13c,color:#000
    style QuestCave fill:#e0a13c,color:#000
```

Fonte: `js/onboarding.js:38-47` (regras de desbloqueio), `js/config.js:433-452` (`QUEST_DEFS`), `js/quests.js:10-87` (motor de missão).

### Tabela de NPCs

| NPC | Local | Papel | Onde aparece | Dá / Exige |
|---|---|---|---|---|
| **Irmão Anselmo** | Igreja | Narrador do onboarding, dá a 1ª arma, dono da missão da Caverna | `js/onboarding.js` (`clericModal`, `shopUnlockModal`, `academiaUnlockModal`), `index.html:318-383` | Pede nome do jogador, conta a história, libera escolha de arma grátis. Depois exige **20x Geleia de Slime** (missão `caveClearance`) para reabrir a Caverna. |
| **Barnabé** | Loja | Comerciante, irmão do Creiton | `js/quests.js` (`openBarnabeIntro`), `index.html:387-403` | Exige **10x Geleia de Slime** (missão `slimeGelDelivery`) → libera o Ferreiro. |
| **Creiton** | Ferreiro | Ferreiro, irmão do Barnabé, vende armas e forja | `js/quests.js` (`openCreitonIntro`), `js/forge.js`, `index.html:130-160, 407-419` | Vende armas iniciais avulsas (500 moedas) e forja armas quebradas. Exige **8x Composto de Slime** (missão `creitonMilitia`) → libera a Guilda. |

> Observação: `ANSELMO_LINES` existe em `config.js:335-339` mas não está conectado a nenhuma renderização de falas — é conteúdo órfão/planejado, ao contrário de `BARNABE_LINES`/`CREITON_LINES` que já são usados.

### Tabela de missões (`QUEST_DEFS`, `js/config.js`)

Cada missão tem um array `objectives` (motor genérico em `QuestModule.objectiveDone`/`canComplete`, `js/quests.js`) — só pode ser concluída quando **todos** os objetivos estiverem feitos. Tipos de objetivo suportados hoje: `deliverItem` (entrega item, consumido ao concluir), `defeatCycle` (checa `state.totalCyclesCompleted`, vitalício mesmo entre Ascensões) e `ownWeapons` (checa quantas `WEAPON_DEFS` distintas o jogador já possui).

| # | Chave | NPC | Objetivos | Recompensa | Persistência |
|---|---|---|---|---|---|
| 1 | `slimeGelDelivery` | Barnabé | Entregar 10x `slimeGel` | Libera **Ferreiro** | `state.quests.slimeGelDelivery` |
| 2 | `creitonMilitia` | Creiton | ① Entregar 8x `slimeCompound` · ② Derrotar o chefe de 1 ciclo em qualquer Dungeon · ③ Possuir 2 armas iniciais diferentes | Libera **Guilda** | `state.quests.creitonMilitia` |
| 3 | `caveClearance` | Irmão Anselmo | Entregar 20x `slimeGel` | Libera **Caverna** | `state.quests.caveClearance` |

Essas 3 são as únicas missões implementadas hoje. Todos os outros desbloqueios da cidade (Dungeon, Loja, Academia) são **computados ao vivo** a partir do progresso, não guardados como flag de missão (comentário explícito em `js/onboarding.js:12-14`: entrega de item é irreversível, então precisa de flag; o resto dá pra recalcular).

---

## 2. Dungeons

```mermaid
flowchart LR
    Slimes["🟢 Pântano dos Slimes\n(slimes)\nsempre liberada · dropa itens"] -->|"30 kills"| Goblins["🟠 Reino Goblin\n(goblins)"]
    Goblins -->|"30 kills"| Wilds["🔴 Terras Selvagens\n(wilds)"]
```

Fonte: `MAPS` em `js/config.js:167-228`, lógica em `js/dungeons.js:7-11`. Cada dungeon tem 10 posições por ciclo (posição 10 = chefe; posições 5 e 9 podem ter spawn duplo). Só `slimes` dropa itens hoje — expandir loot pras outras é item pendente do `TODO.md:78`.

---

## 3. Armas e forja (Ferreiro)

```mermaid
flowchart TD
    Cleric2["Intro do Clérigo"] -->|"escolhe 1 grátis"| W0{"swordSimple\nOU bowArrow\nOU axe"}
    W0 --> Buy["Ferreiro: comprar as outras 2\n(500 moedas cada)"]

    Drop1["Drop: slimeSword x3\n(Dungeon slimes)"] --> Forge1["Forja: +300 slimeGel, 50 ironOre,\n50 bronzeChunk, 5 goldOre, 700 coin"]
    Forge1 --> Out1["slimeWarriorSword\n+50 dano/clique, +20 DPS"]

    Drop2["Drop: slimeAxe x3"] --> Forge2["Forja: +900 slimeGel, 100 ironOre,\n100 bronzeChunk, 15 goldOre,\n5 rawDiamond, 2000 coin"]
    Forge2 --> Out2["slimeWarriorAxe\n+150 dano/clique, +60 DPS"]

    Drop3["Drop: slimeAxeGreater x3"] --> Forge3["Forja: +2000 slimeGel, 300 ironOre,\n250 bronzeChunk, 40 goldOre,\n15 rawDiamond, 3 arcaneCrystal, 5000 coin"]
    Forge3 --> Out3["slimeKingGreatAxe\n+400 dano/clique, +150 DPS"]
```

Fonte: `WEAPON_DEFS`/`FORGED_WEAPON_DEFS` em `js/config.js:362-423`, execução em `js/forge.js`. Só uma arma equipada por vez (`state.equippedWeapon`); minérios só vêm da Caverna (seção 5).

---

## 4. Academia de Combate — árvore de upgrades

```mermaid
flowchart TD
    Root["battleClickDmg\n'Fúria do Guerreiro' · 5 níveis"]
    Root --> Crit1["battleCritChance\n5 níveis"]
    Root --> Dmg1["battleDmgPercent\n5 níveis"]
    Root --> CritDmg1["battleCritDmgPercent\n5 níveis"]
    Root --> Auto1["battleAutoClick\n1 nível · libera auto-clique"]

    Crit1 --> Crit2A["critChance2A"] & Crit2B["critChance2B"] & Crit2C["critChance2C"]
    Dmg1 --> Dmg2A["dmgPercent2A"] & Dmg2B["dmgPercent2B"] & Dmg2C["dmgPercent2C"]
    CritDmg1 --> CD2A["critDmgPercent2A"] & CD2B["critDmgPercent2B"] & CD2C["critDmgPercent2C"]
    Auto1 --> Speed1["autoClickSpeed1"] --> Speed2["autoClickSpeed2"]
```

Fonte: `UPGRADE_DEFS`/`UPGRADE_TREE` em `js/config.js:478-599`; regra de desbloqueio (`requires` precisa atingir `maxLevel` do próprio pai) em `js/progression.js:16-21`.

---

## 5. Caverna (mineração)

Liberada pela missão `caveClearance` (seção 1). Sem pré-requisitos internos — compra livre, custo exponencial:

```mermaid
flowchart LR
    Caverna2["⛏️ Caverna liberada"] --> Apprentice["apprentice"]
    Caverna2 --> Veteran["veteranMiner"]
    Caverna2 --> Blaster["blaster"]
    Caverna2 --> Golem["excavatorGolem"]
    Caverna2 --> OreRate["oreRatePct ×10 níveis"]
    Caverna2 --> OreLuck["oreLuck ×10 níveis"]
```

Fonte: `PROSPECTOR_DEFS`/`CAVERN_UPGRADE_DEFS` em `js/config.js:292-311`, `js/cavern.js`.

---

## 5b. Expedições da Guilda (coleta offline)

Liberada junto com a Guilda (missão `creitonMilitia`, seção 1). Manda as **tropas já compradas** (`TROOP_DEFS`/`state.troops`) coletarem material de Dungeon sozinhas por uma duração fixa escolhida pelo jogador — resolve sozinha, online ou offline, sem etapa de "baú" (item cai direto na mochila assim que o ciclo termina).

```mermaid
flowchart TD
    Guilda3["🛡️ Guilda liberada"] --> HasTroop{"Possui alguma tropa?\n(troopPower > 0)"}
    HasTroop -->|não| Hint["Painel mostra: 'Compre ao menos\n1 tropa pra habilitar expedições'"]
    HasTroop -->|sim| Pick["Escolhe 1 dos 5 presets de duração"]
    Pick --> Curta["Curta 1h ×1.0"] & Media["Média 4h ×1.15"] & Longa["Longa 8h ×1.30"] & Extensa["Extensa 12h ×1.45"] & Expedicao["Expedição 24h ×1.60"]
    Curta & Media & Longa & Extensa & Expedicao --> Active["state.guild = {active, cycleKey, startedAt, durationMs}"]
    Active -->|"tempo passa\n(tick do jogo OU volta de offline)"| Resolve["GuildModule.resolveIfDone()"]
    Resolve --> Roll["Sorteia itens por peso entre os\nmateriais de Dungeon já desbloqueada"]
    Roll --> Inv["Itens direto na mochila + toast\n'EXPEDIÇÃO DA GUILDA'"]
```

- **Rendimento**: `itemsTotal = round(CONFIG.guildItemsPerHourPerPower × troopPower × horas × rateMult)`, onde `troopPower` é a soma de `dps × quantidade` só das `TROOP_DEFS` (sem bônus de arma/prestígio — é poder de tropa "cru", não dano de combate). Presets mais longos têm `rateMult` maior de propósito, pra recompensar esperar mais.
- **Sorteio de item**: só materiais (`ITEM_DEFS.type==='material'`) de Dungeon já desbloqueada (`DungeonModule.isUnlocked`), ponderado pelo campo `weight` de cada item (mesmo padrão de `MINERAL_DEFS`/`CavernModule.rollMineral`).
- **Resolução**: chamada tanto no tick do jogo (`js/main.js`, enquanto o jogo está aberto) quanto ao carregar um save (`js/mainmenu.js`, `finishEnteringLoadedGame`) — cobre expedição concluída com o jogo fechado.

Fonte: `GUILD_EXPEDITION_DEFS`/`CONFIG.guildItemsPerHourPerPower` em `js/config.js`, `dungeon`/`weight` em `ITEM_DEFS` (`js/config.js`), lógica em `js/guild.js` (`GuildModule`), UI em `UI.renderGuildExpedition` (`js/ui.js`).

---

## 6. Prestígio / Ascensão

```mermaid
flowchart TD
    Cond["totalKillsAll >= 100 + 100×ascensionCount\nE potentialEssence() > 0"] --> Ascend["Ascender"]
    Ascend --> Essence["Ganha Essência"]
    Essence --> P1["pClick"]
    Essence --> P2["pDps"]
    Essence --> P3["pOreRate"]
    Essence --> P4["pCrit"]
    Ascend -.->|reseta| Reset["Dungeons, armas,\nupgrades, Caverna"]
    Ascend -.->|mantém| Keep["Missões, NPCs conhecidos,\nentradas na dungeon, ciclos"]
```

Fonte: `PRESTIGE_UPGRADE_DEFS` em `js/config.js:601-606`, lógica em `js/prestige.js` (reset/keep em `js/prestige.js:33-42`).

---

## 7. Planejado / não implementado (roadmap, `TODO.md`)

- Novas missões além das 3 atuais (`TODO.md:37`).
- Novas Dungeons (Necrópole, Floresta Élfica, Abismo Demoníaco) — mencionado no `TODO.md:71-73`, mas a seção correspondente não existe mais no `README.md` atual.
- Sistema de conquistas — só o modal existe (`js/ui.js:337-350`), sem lista nem tracking.
- Sprite jogável (hoje só monstros têm sprite).
- Equipamentos além de armas (armadura, acessórios).
- Auto-upgrade/auto-buy, 2ª camada de prestígio ("Transcendência"), áudio.

> ⚠️ O `TODO.md` ainda lista "Missão de desbloqueio da Caverna" e "Liberar Guilda por missão" como pendentes (linhas 39-45), mas ambas já estão implementadas no código (`caveClearance`, `creitonMilitia`). Trate este diagrama — sincronizado direto com `js/config.js` — como fonte de verdade sobre o que já existe; o `TODO.md` está desatualizado nesse ponto.
