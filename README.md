# Monster Attack Clicker

Idle clicker de combate contra monstros, inspirado em Cookie Clicker.

## Estrutura de pastas

```
monster-attack-clicker/
├── index.html          → shell HTML: layout da UI + carrega CSS/JS
├── css/
│   └── style.css        → todo o visual (tema pixel/dungeon), animações, responsivo, ícones pixel art
├── js/
│   ├── config.js         → constantes de balanceamento + definições de monstros/tropas/upgrades/itens/missões
│   ├── progression.js      → corrente de desbloqueio genérica (upgrades da Academia de Combate)
│   ├── state.js             → estado do jogador (freshState()) — a "fonte da verdade" do save
│   ├── save.js                → sistema de 3 saves (slots), migração de saves antigos, ganhos offline
│   ├── sprites.js               → desenha no <canvas> os spritesheets PNG de assets/sprites/
│   ├── monster.js                → spawn de monstro (escopado à Dungeon ativa), ciclos/posições
│   │                                (incl. posições de monstro duplo), escala de HP, chefes, monstro
│   │                                dourado, morte/drop (ouro ou item)
│   ├── dungeons.js                 → escolha de Dungeon na cidade: desbloqueio, entrar, voltar
│   ├── onboarding.js                 → 1ª conversa com o Clérigo (nome, história, escolha de arma) +
│   │                                    desbloqueio computado dos prédios da cidade
│   ├── quests.js                      → missões de NPC (ex.: entrega de item pro Barnabé), desbloqueiam prédios
│   ├── player.js                       → dano por clique, crítico, disparo do ataque manual
│   ├── troops.js                        → compra de tropas (Guilda), custo exponencial, cálculo de DPS total
│   ├── mining.js                         → Caverna de Mineração: mineradores rendem ouro passivamente
│   ├── upgrades.js                       → compra de upgrades da Academia de Combate (árvore radial)
│   ├── prestige.js                        → lógica de Ascensão: cálculo de Essência, reset, upgrades permanentes
│   ├── settings.js                         → preferências globais (áudio/idioma) + baixar/carregar save
│   ├── ui.js                                → toda renderização/DOM: barras, listas, textos flutuantes, modais, views
│   ├── mainmenu.js                           → menu principal, seletor de saves (3 slots), criação de personagem
│   └── main.js                                → game loop (tick de DPS, autosave) e boot() inicial
├── assets/
│   ├── sprites/                              → um PNG por monstro (spritesheet: idle | piscar | dano, 128x128
│   │                                             por frame), referenciado em `js/config.js` (campo `image`)
│   ├── portraits/                            → retratos de NPCs em pixel art (128x128), usados nas falas
│   │                                             de diálogo (Clérigo, Barnabé)
│   └── icons/                                → ÍCONES PIXEL ART DA UI (prédios, itens, armas, etc.) — ver
│                                                 seção "Ícones da UI" abaixo, pasta ainda vazia (pendente)
└── tools/
    ├── gen_sprites.py                         → gerador Python (Pillow) dos PNGs de assets/sprites/
    ├── gen_portraits.py                       → gerador Python (Pillow) dos PNGs de assets/portraits/
    └── resize_sprite.py                       → redimensiona um sprite desenhado à mão pro padrão 384x128
                                                   (3 frames de 128x128), mantendo proporção
```

## Por que essa divisão

Segue a mesma separação de responsabilidades sugerida no GDD (seção 8), só que
100% vanilla JS sem bundler — os arquivos são carregados via `<script src="...">`
em `index.html`, na ordem de dependência (`config` → `progression` → `state`
→ `save` → `sprites` → `monster` → `dungeons` → `onboarding` → `quests` →
`player` → `troops` → `mining` → `upgrades` → `prestige` → `settings` →
`ui` → `mainmenu` → `main`). Cada módulo expõe um único objeto global
(`MonsterModule`, `TroopsModule`, `UI`, etc.), então dá pra abrir qualquer
arquivo isolado e entender uma responsabilidade só, sem precisar ler o jogo
inteiro.

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

O jogo tem **3 slots de save** independentes, cada um sua própria chave no
`localStorage` (`CONFIG.saveKeySlot(n)`, ver `js/config.js`/`js/save.js`) —
escolhidos na tela de "Menu Principal" ao abrir o jogo (Novo Jogo/Continuar).
Preferências globais (áudio/idioma) ficam fora de qualquer slot
(`CONFIG.settingsKey`), então não mudam de personagem pra personagem. Saves
únicos de antes desse sistema (chave antiga `monsterAttackClickerSave`) são
migrados automaticamente pro slot 1 na 1ª vez que o jogo abre depois da
atualização (`SaveModule.migrateLegacyIfNeeded`) — a chave antiga nunca é
apagada, fica como backup. Dentro do jogo, o menu de Configurações (ícone de
engrenagem) tem "Trocar de personagem" (volta ao menu principal sem apagar
nada) e "Apagar progresso" (apaga só o slot ativo).

## Cidade, Dungeons e Itens

O jogo começa com uma conversa com o **Clérigo** (Igreja) — nome do
personagem, história rápida e escolha da 1ª arma (`js/onboarding.js`). Só
depois disso a **Cidade Abandonada** (tela de prédios clicáveis) libera
Dungeon/Loja/Inventário/Igreja; os demais prédios (Ferreiro/Guilda/
Caverna/Academia) liberam progressivamente conforme o jogador avança —
inclusive o Ferreiro, que só abre depois de concluir a missão de entrega do
Barnabé, dono da Loja (`js/quests.js`, `QUEST_DEFS` em `config.js`). Toda
essa lógica de desbloqueio é **computada** a partir do progresso atual
(`OnboardingModule.isBuildingUnlocked`), nunca guardada como flag solta —
então um save antigo com progresso suficiente nunca fica "trancado" à toa.

Dentro da Cidade, o jogador escolhe em qual **Dungeon** entrar — cada uma é
uma família de monstros (`MAPS` em `js/config.js`: `slimes`, `goblins`,
`wilds`), com progresso independente (`state.dungeons[key].killCount`).
Dungeons desbloqueiam em sequência via `unlockRequirement` (ex.: Goblin exige
30 mortes na Slime).

Cada ciclo de uma Dungeon tem 10 **posições** — a última é sempre o chefe.
Toda posição normal spawna 1 monstro só, mas uma posição pode ser marcada
como **dupla** (`{ pairChoices:[[...], ...] }` em `MAPS`): aparecem 2
monstros em sequência (o 2º spawna assim que o 1º morre), contando como 1
posição só — a Dungeon Slime usa isso nas posições 5 (dupla normal) e 9
(dupla "mais forte", com +50% de HP). Derrotar os dois monstros de uma dupla
dá a recompensa individual de cada um, mais um bônus de +10% (arredondado
pra cima) na quantidade de item dropado. Ver `MonsterModule.resolveSlot` /
`killsPerCycle` pra a lógica de posição↔monstro morto. Uma vez que os ciclos
definidos de uma Dungeon acabam (hoje, 5 no caso da Slime, 3 nas demais), o
padrão de monstros **repete** — o HP continua subindo normalmente, então
nenhuma Dungeon "termina" de verdade, só fica mais difícil.

Dungeons marcadas com `dropsItem` (hoje só `slimes`) dão **itens**
(`ITEM_DEFS`) em vez de ouro — vendidos na Loja por um preço fixo. As demais
abas (Ferreiro/Guilda/Caverna/Academia/Ascensão) são as mesmas mecânicas de
sempre, só "vestidas" com nomes de locais da cidade.

Saves de antes dessa atualização (com `killCount`/`loop` únicos, sem conceito
de Dungeon, onboarding ou missões) são migrados automaticamente em
`SaveModule.applyLoaded()` — o progresso antigo vira o progresso da Dungeon
correspondente e os prédios já acessíveis continuam liberados, sem perder nada.

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

Se tiver um sprite desenhado à mão fora do padrão 384×128 (3 frames de
128×128), `python tools/resize_sprite.py assets/sprites/nome.png`
redimensiona mantendo a proporção (sem esticar/distorcer), com borda
transparente onde sobrar espaço, e faz backup do arquivo original em
`nome_before_resize.png`.

## Retratos de NPCs — `assets/portraits/`

Falas de diálogo (Clérigo, Barnabé) podem usar um retrato 128×128 em pixel
art, gerado pelo mesmo sistema de grade dos sprites (`tools/gen_portraits.py`,
que já inclui `_TEMPLATE_128x128.png` como guia em branco). Pra adicionar um
NPC novo: gere/desenhe o PNG nesse padrão, salve em `assets/portraits/`, e
referencie no `<img>`/`background-image` do modal de diálogo correspondente
em `index.html`.

## Ícones da UI (pixel art) — `assets/icons/`

Todo emoji foi removido da interface (prédios da cidade, botões de
custo/recompensa, itens, armas, marcador de chefe, etc.). No lugar, cada um
desses pontos já tem uma classe CSS `.icon-<nome>` pronta em
`css/style.css`, apontando para um PNG em `assets/icons/<nome>.png` que
**ainda não existe** — a pasta está vazia de propósito, esperando a arte.
Até os arquivos serem criados, o espaço fica simplesmente em branco (não
quebra o layout, não aparece "imagem quebrada").

**Formato**: 64×64 px, fundo transparente, unidade de pixel de 4px (mesmo
sistema de `tools/gen_sprites.py`/`gen_portraits.py`, numa grade menor pra
ficar nítido em tamanho de ícone). Salvar com `image-rendering: pixelated`
já configurado — não precisa suavizar/antialiasing.

### Lista de ícones pendentes

| Arquivo (`assets/icons/…`) | Onde aparece | Tamanho na tela |
|---|---|---|
| `ferreiro.png` | Prédio Ferreiro | ~32px |
| `guilda.png` | Prédio Guilda | ~32px |
| `caverna.png` | Prédio Caverna | ~32px |
| `loja.png` | Prédio Loja | ~32px |
| `igreja.png` | Prédio Igreja | ~32px |
| `dungeon.png` | Prédio Dungeons | ~32px |
| `inventario.png` | Prédio Inventário | ~32px |
| `academia.png` | Prédio Academia de Combate | ~32px |
| `gear.png` | Botão de Configurações (engrenagem) | ~18px |
| `trophy.png` | Modal de Conquistas | ~40px |
| `lock.png` | Prédio/upgrade bloqueado (cadeado) | ~12-14px |
| `gold.png` | Custo/recompensa em ouro | ~14px |
| `essence.png` | Custo em Essência (upgrades de Ascensão) | ~14px |
| `boss.png` | Marcador de chefe no nome do monstro | ~16px |
| `golden-monster.png` | Marcador de monstro dourado | ~16px |
| `item-slimegel.png` | Item Geleia de Slime (Loja/Inventário) | ~20px |
| `weapon-sword.png` | Arma Espada Simples | ~20-28px |
| `weapon-bow.png` | Arma Arco e Flecha | ~20-28px |
| `weapon-axe.png` | Arma Machado | ~20-28px |

### Passo a passo pra implementar

1. Desenhe/exporte cada PNG no formato acima (64×64, fundo transparente).
2. Salve dentro de `assets/icons/`, usando **exatamente** o nome de arquivo
   da tabela (é o nome que o CSS já espera — sem isso, renomear ou trocar
   maiúscula/minúscula quebra o link).
3. Dê refresh no jogo (`Ctrl+F5` se estiver com cache). Não precisa editar
   `.js`, `.html` nem `.css` — a classe `.icon-<nome>` já existe e já está
   aplicada em todos os lugares certos (ver `--icon-*` no topo de
   `css/style.css`, seção "Ícones pixel art").
4. Se quiser adicionar um ícone **novo** (que não está na lista, ex. pra uma
   Dungeon futura), o padrão é: escolher um nome em kebab-case, adicionar
   `--icon-nome:url('../assets/icons/nome.png');` e a classe
   `.icon-nome{background-image:var(--icon-nome);}` em `css/style.css`, e
   usar `<div class="icon icon-nome"></div>` no HTML/JS onde o ícone deve
   aparecer.

## Empacotar como executável (planos futuros)

Hoje o jogo é HTML/CSS/JS puro sem build (ver "Como rodar" acima). Se um dia
quiser um `.exe`/instalador pra rodar localmente sem depender de abrir o
navegador manualmente, as opções realistas:

- **PWA** (manifest.json + service worker): esforço quase zero, dá pra
  "instalar" pelo Chrome/Edge com ícone próprio. Não é um `.exe` de verdade —
  ainda depende do navegador instalado, não dá pra distribuir sozinho.
- **Tauri**: empacota usando o webview nativo do Windows (não embute um
  Chromium inteiro) → binário bem menor (poucos MB). Exige instalar o
  toolchain Rust uma vez pra compilar, mas depois disso o empacotamento é
  simples. Recomendado se o objetivo é um executável leve só pra uso pessoal.
- **Electron**: mais popular, mais tutorial disponível, empacotamento com
  `electron-builder` é direto — mas o executável fica bem mais pesado
  (100MB+) porque embute o Chromium inteiro. Recomendado se preferir a
  comunidade/documentação maior e não se importar com o tamanho do arquivo.

Nenhuma dessas opções foi implementada ainda — é só a decisão a tomar quando
for a hora.

## Roadmap / Ideias futuras

### ✅ Já implementado (referência rápida)

- Mapas temáticos com tiers de força (Mapa 1: Slimes — 5 ciclos, com
  posições de monstro duplo; Mapa 2: Reino Goblin; Mapa 3: Terras Selvagens)
- Timer de 15s por monstro + reset de ciclo em caso de falha ou saída manual
  da dungeon (com modal de confirmação próprio, sem `confirm()` nativo)
- Onboarding com o Clérigo (nome, história, escolha da 1ª arma) + missão de
  entrega pro Barnabé (Loja) que libera o Ferreiro — desbloqueio de prédios
  100% computado a partir do progresso, nunca uma flag solta
- Academia de Combate: árvore radial de upgrades (4 nós, corrente de
  desbloqueio sequencial)
- Caverna de Mineração (fonte de ouro passiva, separada do combate)
- Ascensão baseada em mortes vitalícias (`totalKillsAll`), com limiar
  crescente a cada ascensão
- Cidade Abandonada + Dungeons selecionáveis (progresso independente por
  Dungeon, desbloqueio sequencial) + itens vendidos na Loja (Dungeon Slime)
- Menu principal com 3 slots de save independentes (nome de personagem,
  continuar/apagar/baixar por slot) + migração automática de saves antigos
- Preferências globais (áudio/idioma) fora de qualquer save
- Interface 100% sem emoji — ícones pixel art via `assets/icons/` (ver seção
  acima; PNGs ainda pendentes de criar)

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
