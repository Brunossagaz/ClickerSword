/* ---------------------------------------------------------------------
   SPRITES (PNG spritesheets, gerados por tools/gen_sprites.py)
--------------------------------------------------------------------- */
const Sprites = {
  blinking: false,
  blinkLoopStarted: false,
  imageCache: {},

  clear(ctx){ ctx.clearRect(0,0,128,128); },

  loadImage(src){
    if(!this.imageCache[src]){
      const img = new Image();
      img.src = src;
      img.onload = ()=>{
        // a imagem pode terminar de carregar depois do primeiro draw(); redesenha se ainda for o monstro atual
        if(MonsterModule.current && MonsterModule.current.type.image === src) UI.renderMonsterSprite();
      };
      this.imageCache[src] = img;
    }
    return this.imageCache[src];
  },

  // Todo monstro é um spritesheet horizontal (3 frames: idle, piscando, dano).
  // spriteScale (<1) desenha o monstro menor, centralizado no canvas 128x128.
  draw(ctx, monsterType, big, tintGold){
    this.clear(ctx);
    const img = this.loadImage(monsterType.image);
    if(!img.complete || img.naturalWidth === 0) return; // ainda carregando; onload redesenha
    const frameW = monsterType.frameW, frameH = monsterType.frameH;
    const frameIndex = this.blinking ? 1 : 0;
    const scale = monsterType.spriteScale || 1;
    const destSize = 128 * scale;
    const destOffset = (128 - destSize) / 2;
    ctx.drawImage(img, frameIndex*frameW, 0, frameW, frameH, destOffset, destOffset, destSize, destSize);
    if(tintGold){
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255,213,74,0.55)';
      ctx.fillRect(0, 0, 128, 128);
      ctx.restore();
    }
  },

  // Piscar de olhos periódico e independente do loop de dano, só ativo
  // enquanto o monstro atual suportar animação de piscar (blinkCapable).
  startBlinkLoop(){
    if(this.blinkLoopStarted) return;
    this.blinkLoopStarted = true;
    const scheduleNext = ()=>{
      setTimeout(()=>{
        if(MonsterModule.current && MonsterModule.current.type.blinkCapable){
          this.blinking = true;
          UI.renderMonsterSprite();
          setTimeout(()=>{
            this.blinking = false;
            if(MonsterModule.current && MonsterModule.current.type.blinkCapable) UI.renderMonsterSprite();
          }, 150);
        }
        scheduleNext();
      }, 2500 + Math.random()*3000);
    };
    scheduleNext();
  }
};
