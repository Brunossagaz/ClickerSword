# Monster Attack Clicker

Idle clicker de combate contra monstros, inspirado em Cookie Clicker.

## Estrutura de pastas

```
monster-attack-clicker/
├── index.html          → shell HTML: layout da UI + carrega CSS/JS
├── css/
│   └── style.css        → todo o visual (tema pixel/dungeon), animações, responsivo
├── js/
│   ├── config.js         → constantes de balanceamento + definições de monstros/tropas/upgrades
│   ├── state.js           → estado do jogador (freshState()) — a "fonte da verdade" do save
│   ├── save.js             → localStorage: salvar, carregar, resetar, calcular ganhos offline
│   ├── sprites.js           → desenha no <canvas> os spritesheets PNG de assets/sprites/
│   ├── monster.js            → spawn de monstro (escopado à Dungeon ativa), escala de HP, chefes, monstro dourado, morte/drop (ouro ou item)
│   ├── dungeons.js            → escolha de Dungeon na cidade: desbloqueio, entrar, voltar
│   ├── player.js               → dano por clique, crítico, disparo do ataque manual
│   ├── troops.js                → compra de tropas, custo exponencial, cálculo de DPS total
│   ├── mining.js                 → Caverna de Mineração: mineradores rendem ouro passivamente
│   ├── upgrades.js               → compra de upgrades de combate (loja de ouro)
│   ├── prestige.js                → lógica de Ascensão: cálculo de Essência, reset, upgrades permanentes
│   ├── settings.js                 → menu de configurações: baixar/carregar save, áudio/idioma (placeholders)
│   ├── ui.js                        → toda renderização/DOM: barras, listas, textos flutuantes, toasts, views
│   └── main.js                       → game loop (tick de DPS, autosave) e boot() inicial
├── assets/
│   └── sprites/                     → um PNG por monstro (spritesheet: idle | piscar | dano, 128x128
│                                        por frame), referenciado em `js/config.js` (campo `image`)
└── tools/
    └── gen_sprites.py                → gerador Python (Pillow) de todos os PNGs de assets/sprites/
```

## Por que essa divisão

Segue a mesma separação de responsabilidades sugerida no GDD (seção 8), só que
100% vanilla JS sem bundler — os arquivos são carregados via `<script src="...">`
em `index.html`, na ordem de dependência (`config` → `state` → `save` →
`sprites` → `monster` → `player` → `troops` → `upgrades` → `prestige` → `ui` →
`main`). Cada módulo expõe um único objeto global (`MonsterModule`,
`TroopsModule`, `UI`, etc.), então dá pra abrir qualquer arquivo isolado e
entender uma responsabilidade só, sem precisar ler o jogo inteiro.

Todo monstro segue o mesmo padrão de arte: um spritesheet PNG com 3 frames
(idle, piscando, flash de dano) desenhado em `js/sprites.js` via
`ctx.drawImage`. Os PNGs em `assets/sprites/` não são editados à mão — eles
são gerados por `tools/gen_sprites.py` (veja a seção "Sprites dos monstros"
abaixo). Isso mantém a arte fácil de ajustar: muda a paleta/forma no Python,
roda o script, o jogo já pega o PNG novo.

Não usei `import`/`export` (ES Modules) de propósito: assim o jogo roda
abrindo o `index.html` direto no navegador (`file://`), sem precisar de
servidor local nem build step.

## Como rodar

Não há build step nem dependências para instalar — é HTML/CSS/JS puro.

### Opção 1 — abrir direto no navegador

Dê duplo clique em `index.html` (ou clique com o botão direito → "Abrir com" →
seu navegador). O jogo funciona 100% via `file://`, já que os módulos usam
`<script src="...">` comuns em vez de ES Modules.

### Opção 2 — servidor local (recomendado)

Útil se quiser testar em outro dispositivo na rede local, evitar qualquer
restrição de `file://` do navegador, ou futuramente testar service
workers/PWA. Rode a partir da pasta do projeto (mesma pasta do `index.html`):

```bash
npx serve .
# ou
python3 -m http.server 8008
# ou (Windows/PowerShell, se tiver Python instalado)
python -m http.server 8008
```

Depois acesse `http://localhost:8008` (ou a porta/URL que o comando indicar)
no navegador.

### Salvamento e reset

O progresso é salvo automaticamente no `localStorage` do navegador (chave
`monsterAttackClickerSave`, ver `js/config.js`). Isso significa que o save é
por origem (`file://` local ou `http://localhost:PORTA`) — trocar a forma de
rodar o jogo (arquivo local vs. servidor, ou mudar de porta) começa um save
novo. Para apagar o progresso, use o botão "Apagar progresso" na aba de
Ascensão dentro do próprio jogo.

## Cidade, Dungeons e Itens

O jogador começa numa **Cidade Abandonada** (tela de seleção) e escolhe em
qual **Dungeon** entrar — cada uma é uma família de monstros (`MAPS` em
`js/config.js`: `slimes`, `goblins`, `wilds`), com progresso independente
(`state.dungeons[key].killCount`). Dungeons desbloqueiam em sequência via
`unlockRequirement` (ex.: Goblin exige 30 mortes na Slime) — a lógica de
desbloqueio é **computada**, não guardada em flag (mesmo padrão de
`ProgressionModule`), então nunca dessincroniza.

Uma vez que os ciclos definidos de uma Dungeon acabam (hoje, 3 por Dungeon),
o padrão de monstros **repete** (`MonsterModule.typeFor` faz o wrap) — o HP
continua subindo normalmente, então nenhuma Dungeon "termina" de verdade, só
fica mais difícil.

Dungeons marcadas com `dropsItem` (hoje só `slimes`) dão **itens**
(`ITEM_DEFS`) em vez de ouro — vendidos na aba "🏪 LOJA" por um preço fixo.
As demais abas (Ferreiro/Guilda/Caverna/Ascensão) são as mesmas
mecânicas de sempre, só "vestidas" com nomes de locais da cidade.

Saves de antes dessa atualização (com `killCount`/`loop` únicos, sem conceito
de Dungeon) são migrados automaticamente em `SaveModule.applyLoaded()` —
o progresso linear antigo vira o progresso da Dungeon correspondente, sem
perder nada.

## Sprites dos monstros

Todos os monstros (`js/config.js` → `MONSTER_TYPES`) apontam para um PNG em
`assets/sprites/`, gerado por `tools/gen_sprites.py`. Cada PNG é um
spritesheet horizontal com 3 frames de 128x128px: idle, piscando (olhos
fechados) e flash de dano (silhueta branca, usado só para exportação — o
jogo já tem seu próprio flash de dano via CSS em `hitFlash()`).

Para mudar a arte de um monstro (cor, forma, acessórios) ou criar um novo:

```bash
# precisa do Pillow instalado uma vez:
python -m pip install pillow

# edite tools/gen_sprites.py (palette/silhueta do monstro) e rode:
python tools/gen_sprites.py
```

O script sobrescreve os PNGs em `assets/sprites/` — não precisa tocar em
`sprites.js` nem `config.js`, a menos que esteja **adicionando** um monstro
novo (aí é só acrescentar uma entrada em `MONSTER_TYPES` apontando pro PNG
novo). Campos disponíveis por monstro em `config.js`:

- `image` — caminho do PNG.
- `frameW`/`frameH` — sempre 128/128 no padrão atual.
- `spriteScale` — opcional, <1 desenha o monstro menor (ex.: `0.7` no Slime
  Azul, que é fisicamente menor que os outros).
- `hpMult` — opcional, multiplica o HP do monstro (ex.: `1.8` no Slime Azul,
  que é mais forte que o Slime normal).
- `blinkCapable` — ativa a animação periódica de piscar.

## Roadmap / Ideias futuras

### ✅ Já implementado (referência rápida)

- Mapas temáticos com tiers de força (Mapa 1: Slimes, Mapa 2: Reino Goblin,
  Mapa 3: Terras Selvagens)
- Timer de 15s por monstro + reset de ciclo em caso de falha no chefe
- Corrente de desbloqueio (`PROGRESSION_CHAIN`) intercalando upgrades e tropas
- Caverna de Mineração (fonte de ouro passiva, separada do combate)
- Árvore radial de upgrades (aba "UPGRADES"), com upgrade de sinergia
  (Ressonância de Combate: DPS ganha % do dano por clique)
- Ascensão baseada em mortes vitalícias (`totalKillsAll`), com limiar
  crescente a cada ascensão
- Cidade Abandonada + Dungeons selecionáveis (progresso independente por
  Dungeon, desbloqueio sequencial) + itens vendidos na Loja (Dungeon Slime)
- Menu de configurações (⚙): baixar/carregar save como arquivo, placeholders
  de áudio/idioma/conquistas

### Novas Dungeons (seguindo o padrão: 3 ciclos, 6 variantes, 3 chefes)

- **Dungeon da Necrópole**: mortos-vivos (Zumbi, Esqueleto Arqueiro, Zumbi
  Podre, Cavaleiro da Morte *(chefe)*, Necromante *(chefe)*, Lich Supremo
  *(chefe)*)
- **Dungeon da Floresta Élfica**: Elfo Batedor, Dríade, Elfo Arqueiro, Guardião
  Ancestral *(chefe)*, Rainha Dríade *(chefe)*, Ent Milenar *(chefe)*
- **Dungeon do Abismo Demoníaco**: tier de dificuldade bem mais alta, pensado
  pra pós-Selvagens (Imp, Súcubo, Cão do Inferno, Barão Infernal *(chefe)*,
  Arquidemônio *(chefe)*, Senhor do Abismo *(chefe)*)
- Dar tiers pra Dungeon das Terras Selvagens atual (orc/troll/dragão/demônio),
  que hoje só reaproveita os monstros antigos sem variantes — mesma ideia dos
  slimes/goblins
- Expandir itens/loot pra outras Dungeons além da Slime (hoje só ela dropa item)

### Novos monstros/mecânicas de combate

- **Resistência elemental**: monstros com fraqueza/resistência a um tipo de
  dano, incentivando variar upgrades/tropas
- **Elite raro**: chance pequena de um monstro normal (não só o 10º da
  fileira) spawnar como versão "elite" com HP/recompensa maior
- **Chefe com fases**: muda de forma/ataque na metade da vida
- **Monstro que foge**: se não for abatido rápido, foge e soma um bônus
  acumulado pro próximo — outro uso pro timer de 15s além da penalidade

### Sistemas novos

- **Equipamentos/loot**: chefes derrubam itens com bônus permanentes na run
- **Achievements**: conquistas com recompensas pequenas de essência/ouro (ex:
  "mate 500 slimes", "ascenda 10 vezes")
- **Expansão da mineração**: minério virar um recurso próprio (Gemas) que
  compra upgrades exclusivos, em vez de virar ouro direto
- **Auto-upgrade/auto-buy**: desbloqueável tarde, compra upgrades sozinho
- **2ª camada de prestígio**: acima da Ascensão (ex: "Transcendência"), só
  libera depois de X ascensões, com bônus mais fortes e raros

### Técnico

- Separar `config.js` em `config/monsters.js`, `config/troops.js`,
  `config/upgrades.js` se a lista crescer muito
- Adicionar `js/audio.js` para efeitos sonoros de clique/morte/ascensão
