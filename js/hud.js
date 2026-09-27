/* ---------------------------------------------------------------------
   HUD MODULE (hud.js)
   Controles de tela do jogo:
   - Botão da mochila: abre/fecha o inventário (gaveta no canto da tela).
   - Tela cheia: botão no canto + entra sozinho ao clicar em "COMECE A
     JOGAR" (precisa de clique do jogador, regra do navegador). Em tela
     cheia, trava a tecla ESC pro jogo (Keyboard Lock, onde existir) — senão
     o navegador usaria o ESC pra sair da tela cheia em vez de fechar o
     modal; pra sair, segurar ESC ou usar o botão.
   - ESC fecha o modal de cima (o mesmo que clicar no ✕). Modais sem ✕ de
     propósito (tempo esgotado, apresentação do Clérigo) não fecham; o botão
     marcado com [data-esc] vale como "cancelar".
--------------------------------------------------------------------- */
const HudModule = {
  init(){
    this.sidebar = document.getElementById('sidebarInventory');
    this.fsBtn = document.getElementById('fullscreenBtn');
    document.getElementById('inventoryToggleBtn').addEventListener('click', () => this.toggleInventory());
    this.fsBtn.addEventListener('click', () => this.toggleFullscreen());
    document.addEventListener('fullscreenchange', () => this.onFullscreenChange());
    document.addEventListener('keydown', (e) => { if(e.key === 'Escape') this.onEscape(e); });
    if(!document.fullscreenEnabled) this.fsBtn.style.display = 'none';
    this.onFullscreenChange();
  },

  toggleInventory(force){
    const open = force !== undefined ? force : !this.sidebar.classList.contains('expanded');
    this.sidebar.classList.toggle('expanded', open);
    document.getElementById('inventoryToggleBtn').classList.toggle('active', open);
  },

  isFullscreen(){ return !!document.fullscreenElement; },
  enterFullscreen(){
    if(this.isFullscreen() || !document.fullscreenEnabled) return;
    const p = document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    if(p && p.catch) p.catch(() => {}); // recusado (ex.: sem clique) — segue em janela
  },
  toggleFullscreen(){
    if(this.isFullscreen()){ const p = document.exitFullscreen(); if(p && p.catch) p.catch(() => {}); }
    else this.enterFullscreen();
  },
  onFullscreenChange(){
    const on = this.isFullscreen();
    this.fsBtn.classList.toggle('on', on);
    this.fsBtn.title = on ? 'Sair da tela cheia' : 'Tela cheia';
    this.fsBtn.setAttribute('aria-label', this.fsBtn.title);
    const kb = navigator.keyboard;
    if(kb && kb.lock){
      if(on) kb.lock(['Escape']).catch(() => {});
      else if(kb.unlock) kb.unlock();
    }
  },

  onEscape(e){
    const open = [...document.querySelectorAll('.modal-overlay.open')];
    if(open.length){
      // o de cima é o último no documento (todos têm o mesmo z-index)
      const top = open[open.length - 1];
      const help = top.querySelector('.help-popover.open');
      const btn = top.querySelector('.modal-close:not(#academiaHelpBtn), [data-esc]');
      if(help){ help.classList.remove('open'); e.preventDefault(); }
      else if(btn && btn.offsetParent !== null){ btn.click(); e.preventDefault(); }
      return;
    }
    if(this.sidebar.classList.contains('expanded')){ this.toggleInventory(false); e.preventDefault(); return; }
    if(typeof CityMapModule !== 'undefined' && CityMapModule.talking){ CityMapModule.hideBubble(); e.preventDefault(); }
  }
};
