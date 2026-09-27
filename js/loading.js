/* ---------------------------------------------------------------------
   LOADING MODULE (loading.js)
   Tela preta com um slime pulando (#loadingScreen, já visível no HTML
   desde o primeiro quadro):
   - start(): na abertura do jogo, baixa e DECODIFICA todas as imagens
     (cenários, peças de UI, NPCs, monstros, ícones) e espera as fontes,
     com barra de progresso — sem isso a decodificação dos PNGs grandes
     acontecia na hora de mostrar cada tela e travava a animação.
   - flash(): nas trocas de tela do menu (Novo Jogo/Continuar/entrar no
     jogo), cobre a troca por um instante enquanto o novo layout monta.
   Só usa arquivos locais (CSP 'self').
--------------------------------------------------------------------- */
const LoadingModule = {
  MAX_WAIT_MS: 12000,   // nunca prende o jogador mais que isso
  FLASH_MS: 380,
  cache: [],            // mantém as imagens decodificadas vivas
  flashTimer: null,

  el(){ return document.getElementById('loadingScreen'); },

  // tudo que o jogo desenha; repetidos e vazios são descartados
  imageList(){
    const ui = ['frame', 'frame-sm', 'btn', 'btn-hover', 'btn-press', 'btn-disabled', 'btn-active', 'btn-green', 'btn-green-hover',
      'btn-red', 'btn-red-hover', 'btn-orange', 'btn-orange-hover', 'slot', 'slot-active', 'close', 'close-hover', 'divider',
      'clock-dial', 'backpack', 'fullscreen-on', 'fullscreen-off'].map(n => `assets/ui/${n}.png`);
    const icons = [...ITEM_DEFS, ...WEAPON_DEFS, ...FORGED_WEAPON_DEFS].map(d => `assets/icons/${d.icon}.png`)
      .concat(['gear', 'coin', 'lock', 'trophy', 'chest', 'menu-ribbon', 'tree-bg-tile', 'essence', 'boss', 'golden-monster',
        'ferreiro', 'guilda', 'caverna', 'loja', 'igreja', 'dungeon', 'academia', 'inventario'].map(n => `assets/icons/${n}.png`));
    const list = [
      ...Object.values(CITY_MAP.images),
      ...CITY_MAP.npcs.map(n => n.sprite),
      ...MONSTER_TYPES.map(m => m.image),
      'assets/portraits/anselmo.png', 'assets/portraits/barnabe.png', 'assets/portraits/creiton.png',
      ...ui, ...icons,
    ];
    return [...new Set(list.filter(Boolean))];
  },
  loadImage(src){
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        this.cache.push(img);
        // decode() adianta a decodificação; se falhar, a imagem carregada já basta
        (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(resolve);
      };
      img.onerror = () => resolve(); // ícone que ainda não existe não trava o carregamento
      img.src = src;
    });
  },
  fontsReady(){
    if(!document.fonts) return Promise.resolve();
    return Promise.all([
      document.fonts.load('16px "Press Start 2P"'),
      document.fonts.load('20px "VT323"'),
    ]).catch(() => {}).then(() => document.fonts.ready);
  },

  start(){
    const fill = document.getElementById('loadingFill');
    const list = this.imageList();
    let done = 0;
    const total = list.length + 1;
    const tick = () => { done += 1; fill.style.width = Math.round(done / total * 100) + '%'; };
    const all = Promise.all([...list.map(src => this.loadImage(src).then(tick)), this.fontsReady().then(tick)]);
    const timeout = new Promise(resolve => setTimeout(resolve, this.MAX_WAIT_MS));
    return Promise.race([all, timeout]).then(() => this.afterPaint()).then(() => this.hide());
  },

  // espera o navegador montar e pintar o layout novo (2 quadros)
  afterPaint(){
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  },
  show(){
    const el = this.el();
    el.classList.remove('hidden', 'fading');
  },
  hide(){
    const el = this.el();
    el.classList.add('fading');
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => el.classList.add('hidden'), 260);
  },
  flash(){
    this.show();
    clearTimeout(this.flashTimer);
    const started = performance.now();
    this.afterPaint().then(() => {
      this.flashTimer = setTimeout(() => this.hide(), Math.max(0, this.FLASH_MS - (performance.now() - started)));
    });
  }
};
