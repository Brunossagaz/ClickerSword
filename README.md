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
│   ├── monster.js            → spawn de monstro, escala de HP, chefes, monstro dourado, morte/drop
│   ├── player.js               → dano por clique, crítico, disparo do ataque manual
│   ├── troops.js                → compra de tropas, custo exponencial, cálculo de DPS total
│   ├── upgrades.js               → compra de upgrades de combate (loja de ouro)
│   ├── prestige.js                → lógica de Ascensão: cálculo de Essência, reset, upgrades permanentes
│   ├── ui.js                       → toda renderização/DOM: barras, listas, textos flutuantes, toasts
│   └── main.js                      → game loop (tick de DPS, autosave) e boot() inicial
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

## Próximos passos sugeridos

- Separar `config.js` em `config/monsters.js`, `config/troops.js`,
  `config/upgrades.js` se a lista crescer muito
- Adicionar `js/audio.js` para efeitos sonoros de clique/morte/ascensão
