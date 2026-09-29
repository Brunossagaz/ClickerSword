/* ---------------------------------------------------------------------
   CITY MAP MODULE (citymap.js)
   Tela da Cidade como mapa: a arte da vila (CITY_MAP.images) com as placas
   dos prédios por cima (os mesmos <button> de antes — cliques, travas e
   progresso continuam em ui.js/onboarding.js), os moradores de
   CITY_MAP.npcs andando pela praça num <canvas>, a fonte clicável (depósito
   de moedas) e um ciclo de dia e noite. Clicar num morador mostra um balão
   com uma fala dele (e conta pra conquista de conhecer todos). A cachoeira
   e a lua da arte têm conquistas secretas (ver onClick). Só anima enquanto a Cidade está visível, e congela
   junto com o resto do jogo durante conversas (ver PauseModule em main.js).
   Todo texto vindo de dados entra por textContent (nunca innerHTML).
--------------------------------------------------------------------- */
const CityMapModule = {
  FRAME_W: CITY_MAP.frameW, FRAME_H: CITY_MAP.frameH,
  STEP_MS: 150,          // duração de cada frame da caminhada
  BUBBLE_MS: 3500,       // quanto tempo o balão de fala fica na tela
  FADE_MS: 1200,         // morador entrando/saindo de cena (horário)
  ROWS: { down: 0, up: 1, side: 2 },
  WALK_FRAMES: [1, 0, 2, 0],
  npcs: [],
  active: false,
  rafId: null,
  lastTs: 0,
  talking: null,         // { npc, until }
  ripples: [],           // ondinhas na fonte depois de um depósito (e respingos na cachoeira)
  waterfallHits: 0,      // cliques seguidos na cachoeira (conquista secreta)
  waterfallLastAt: 0,
  dayTime: 0,            // fração do dia (0 = meia-noite), avança só com o jogo rodando
  daylight: 0,           // 0 = noite, 1 = dia pleno
  lastDaylightKey: '',

  init(){
    this.mapEl = document.getElementById('cityMap');
    this.canvas = document.getElementById('cityMapCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.bubble = document.getElementById('cityMapBubble');
    this.dayEl = document.getElementById('cityMapDay');
    this.duskEl = document.getElementById('cityMapDusk');
    // as 3 pinturas vêm do config (o HTML só tem um fallback)
    document.getElementById('cityMapBg').src = CITY_MAP.images.night;
    this.dayEl.src = CITY_MAP.images.day;
    this.duskEl.src = CITY_MAP.images.dusk;
    this.tintEl = document.getElementById('cityMapTint');
    this.clockEl = document.getElementById('cityMapClock');
    this.dayTime = CITY_MAP.startTime || 0;

    // placas: cada botão de prédio vai pro ponto dele na imagem
    const place = (btn, x, y) => {
      btn.style.left = (x / CITY_MAP.width * 100) + '%';
      btn.style.top = (y / CITY_MAP.height * 100) + '%';
    };
    for(const s of CITY_MAP.signs){
      const btn = document.getElementById(s.btn);
      if(btn) place(btn, s.x, s.y);
    }
    const f = CITY_MAP.fountain;
    place(document.getElementById('openFountainBtn'), f.x, f.signY);

    this.npcs = CITY_MAP.npcs.map((def, i) => {
      const img = new Image();
      img.src = def.sprite;
      const idx = i % def.path.length;
      const start = def.path[idx];
      return { def, img, x: start[0], y: start[1], idx, target: null, alpha: 1,
        dir: 'down', flip: false, walking: false, waitMs: 800 + Math.random() * 1500, animMs: 0 };
    });

    new ResizeObserver(() => this.resize()).observe(this.mapEl);
    this.canvas.addEventListener('click', (e) => this.onClick(e));
    this.canvas.addEventListener('mousemove', (e) => {
      const p = this.pointOf(e);
      this.hoverFountain = !this.npcAt(p) && this.inFountain(p);
      this.canvas.style.cursor = (this.npcAt(p) || this.hoverFountain) ? 'pointer' : 'default';
    });
    this.canvas.addEventListener('mouseleave', () => { this.hoverFountain = false; });
    document.addEventListener('visibilitychange', () => this.updateLoop());
    this.initFountain();
    this.applyDaylight(true);
  },

  // chamado por UI.showScreen — liga/desliga a animação com a tela da Cidade
  setActive(on){
    this.active = on;
    if(!on) this.hideBubble();
    this.updateLoop();
    // tela alta (celular em pé): o mapa é mais largo que a janela e rola na
    // horizontal — abre centralizado na praça
    if(on) requestAnimationFrame(() => {
      const sc = this.mapEl.parentElement;
      if(sc && sc.scrollWidth > sc.clientWidth) sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2;
    });
  },
  updateLoop(){
    const run = this.active && !document.hidden;
    if(run && this.rafId === null){
      this.lastTs = performance.now();
      this.resize();
      this.rafId = requestAnimationFrame((t) => this.frame(t));
    } else if(!run && this.rafId !== null){
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  },

  resize(){
    const w = this.mapEl.clientWidth, h = this.mapEl.clientHeight;
    if(!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.scale = this.canvas.width / CITY_MAP.width; // px do canvas por px da imagem
    this.draw();
  },

  frame(ts){
    const dt = Math.min(100, ts - this.lastTs);
    this.lastTs = ts;
    // conversa com NPC aberta = jogo pausado (mesma regra do tick principal)
    if(typeof PauseModule === 'undefined' || !PauseModule.isDialogOpen()) this.update(dt);
    this.draw();
    this.rafId = requestAnimationFrame((t) => this.frame(t));
  },

  // ---- ciclo de dia e noite ----
  // luz do dia (0-1) a partir da hora: noite -> amanhecer (sobe) -> dia ->
  // entardecer (desce) -> noite, com a borda suavizada
  daylightAt(t){
    const p = CITY_MAP.dayPhases;
    const smooth = x => x * x * (3 - 2 * x);
    if(t < p.dawnStart || t >= p.nightStart) return 0;
    if(t < p.dayStart) return smooth((t - p.dawnStart) / (p.dayStart - p.dawnStart));
    if(t < p.duskStart) return 1;
    return 1 - smooth((t - p.duskStart) / (p.nightStart - p.duskStart));
  },
  phaseName(t){
    const p = CITY_MAP.dayPhases;
    if(t >= p.dawnStart && t < p.dayStart) return 'Amanhecer';
    if(t >= p.dayStart && t < p.duskStart) return 'Dia';
    if(t >= p.duskStart && t < p.nightStart) return 'Entardecer';
    return 'Noite';
  },
  // Três versões da mesma arte empilhadas: noite (original, embaixo), dia e
  // entardecer (geradas por tools/gen_city_daylight.py). O dia aparece com
  // a luz do dia; o entardecer (que também serve de amanhecer) aparece por
  // cima dele no pico das transições. Só mexe no DOM quando muda.
  applyDaylight(force){
    const t = this.dayTime, d = this.daylightAt(t);
    const p = CITY_MAP.dayPhases;
    // calor: pico no meio do amanhecer e do entardecer
    const mid = (a, b) => (a + b) / 2, half = (a, b) => (b - a) / 2;
    const bump = (a, b) => Math.max(0, 1 - Math.abs(t - mid(a, b)) / (half(a, b) * 1.4));
    const warm = Math.max(bump(p.dawnStart, p.dayStart), bump(p.duskStart, p.nightStart));
    this.daylight = d;
    // inclui a posição do ponteiro (1/128 do dia), senão ele pararia em pleno dia/noite
    const key = `${d.toFixed(3)}|${warm.toFixed(3)}|${Math.floor(t * 128)}`;
    if(!force && key === this.lastDaylightKey) return;
    this.lastDaylightKey = key;
    this.dayEl.style.opacity = d.toFixed(3);
    this.duskEl.style.opacity = Math.min(1, warm * 1.15).toFixed(3);
    // brilho quente leve por cima no auge do amanhecer/entardecer
    this.tintEl.style.backgroundColor = `rgba(255,150,80,${(0.12 * warm).toFixed(3)})`;
    // relógio: só o desenho — o nome da fase fica no title/aria-label
    const phase = this.phaseName(t);
    this.clockEl.title = phase;
    this.clockEl.setAttribute('aria-label', 'Hora do dia: ' + phase);
    this.drawClockHand(t);
  },

  // Ponteiro do relógio num canvas 32x32 por cima do mostrador
  // (art/ui/clock-dial): 0 = meia-noite embaixo, horário, meio-dia em cima.
  // Desenhado pixel a pixel (contorno escuro + dourado), então fica nítido
  // ampliado junto com o mostrador.
  drawClockHand(t){
    const ctx = this.clockCtx || (this.clockCtx = document.getElementById('cityMapClockHand').getContext('2d'));
    const ang = t * Math.PI * 2, dx = -Math.sin(ang), dy = Math.cos(ang);
    const cx = 15.5, cy = 15.5, len = 10.5;
    const pts = [];
    for(let i = 0; i <= len; i += 0.5) pts.push([Math.floor(cx + dx * i), Math.floor(cy + dy * i)]);
    ctx.clearRect(0, 0, 32, 32);
    ctx.fillStyle = '#0d0a12';
    for(const [x, y] of pts) ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillRect(14, 14, 4, 4);
    ctx.fillStyle = '#e0a52a';
    for(const [x, y] of pts) ctx.fillRect(x, y, 1, 1);
    const [tx, ty] = pts[pts.length - 1];
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(tx, ty, 1, 1);
    ctx.fillStyle = '#ffd54a';
    ctx.fillRect(15, 15, 2, 2);
  },

  // ---- moradores ----
  onSchedule(n){
    const s = n.def.schedule;
    if(s === 'day') return this.daylight >= 0.5;
    if(s === 'night') return this.daylight < 0.5;
    return true;
  },
  update(dt){
    this.dayTime = (this.dayTime + dt / CITY_MAP.dayLengthMs) % 1;
    this.applyDaylight();
    const now = performance.now();
    if(this.talking && (now > this.talking.until || this.talking.npc.alpha < 0.5)) this.hideBubble();
    this.ripples = this.ripples.filter(r => (r.age += dt) < r.life);
    for(const n of this.npcs){
      // entra/sai de cena conforme o horário (some e reaparece no mesmo lugar)
      const targetAlpha = this.onSchedule(n) ? 1 : 0;
      const step = dt / this.FADE_MS;
      n.alpha = targetAlpha > n.alpha ? Math.min(1, n.alpha + step) : Math.max(0, n.alpha - step);
      if(n.alpha === 0) continue;
      if(this.talking && this.talking.npc === n){ n.walking = false; n.dir = 'down'; continue; }
      if(!n.walking){
        n.waitMs -= dt;
        if(n.waitMs <= 0){
          // próximo ponto: um dos 2 vizinhos na trilha fechada
          const len = n.def.path.length;
          n.idx = (n.idx + (Math.random() < 0.5 ? 1 : len - 1)) % len;
          n.target = n.def.path[n.idx];
          n.walking = true;
        }
        continue;
      }
      const dx = n.target[0] - n.x, dy = n.target[1] - n.y;
      const dist = Math.hypot(dx, dy);
      const stepLen = (n.def.speed || CITY_MAP.walkSpeed) * dt / 1000;
      if(dist <= stepLen){
        n.x = n.target[0]; n.y = n.target[1];
        n.walking = false;
        n.waitMs = 1200 + Math.random() * 3500;
        n.dir = 'down';
      } else {
        n.x += dx / dist * stepLen;
        n.y += dy / dist * stepLen;
        if(Math.abs(dx) > Math.abs(dy) * 0.8){ n.dir = 'side'; n.flip = dx < 0; }
        else n.dir = dy > 0 ? 'down' : 'up';
      }
      n.animMs += dt;
    }
    if(this.talking) this.placeBubble(this.talking.npc);
  },

  draw(){
    const ctx = this.ctx, s = this.scale;
    if(!s) return;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;
    const f = CITY_MAP.fountain;
    // destaque da fonte ao passar o mouse
    if(this.hoverFountain){
      ctx.strokeStyle = 'rgba(255,213,74,0.8)';
      ctx.lineWidth = 2 * (window.devicePixelRatio || 1);
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.ellipse(f.x * s, f.y * s, f.rx * s, f.ry * s, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    // ondinhas + brilho de moeda na água
    for(const r of this.ripples){
      if(r.age < 0) continue; // ainda esperando a vez (ondas em sequência)
      const k = r.age / r.life;
      ctx.strokeStyle = `rgba(190,230,255,${(0.8 * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = 2 * (window.devicePixelRatio || 1);
      ctx.beginPath(); ctx.ellipse(r.x * s, r.y * s, (8 + 60 * k) * s, (3 + 22 * k) * s, 0, 0, Math.PI * 2); ctx.stroke();
      if(k < 0.4 && r.coin !== false){
        ctx.fillStyle = `rgba(255,213,74,${(1 - k / 0.4).toFixed(3)})`;
        ctx.fillRect(r.x * s - 3 * s, (r.y - 18 - 30 * k) * s, 6 * s, 6 * s);
      }
    }
    // px do canvas por pixel de arte, INTEIRO: escala quebrada deixava uns
    // pixels maiores que outros e o traço borrado
    const k = Math.max(1, Math.round(CITY_MAP.spriteScale * s));
    const w = this.FRAME_W * k, h = this.FRAME_H * k;
    // luz do ambiente também nos moradores
    const light = 0.78 + 0.3 * this.daylight;
    // de trás pra frente (quem está mais embaixo na tela fica na frente)
    for(const n of [...this.npcs].sort((a, b) => a.y - b.y)){
      if(n.alpha <= 0) continue;
      const x = n.x * s, y = n.y * s;
      ctx.globalAlpha = n.alpha;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(x, y - k, w * 0.32, k * 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      if(n.img.complete && n.img.naturalWidth){
        ctx.filter = `brightness(${light.toFixed(2)})`;
        const frame = n.walking ? this.WALK_FRAMES[Math.floor(n.animMs / this.STEP_MS) % this.WALK_FRAMES.length] : 0;
        const sx = frame * this.FRAME_W, sy = this.ROWS[n.dir] * this.FRAME_H;
        const dx = Math.round(x - w / 2), dy = Math.round(y - h);
        if(n.dir === 'side' && n.flip){
          ctx.save();
          ctx.translate(dx + w, dy);
          ctx.scale(-1, 1);
          ctx.drawImage(n.img, sx, sy, this.FRAME_W, this.FRAME_H, 0, 0, w, h);
          ctx.restore();
        } else {
          ctx.drawImage(n.img, sx, sy, this.FRAME_W, this.FRAME_H, dx, dy, w, h);
        }
        ctx.filter = 'none';
      }
    }
    ctx.globalAlpha = 1;
  },

  // posição do cursor em px da imagem original
  pointOf(e){
    const rect = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width * CITY_MAP.width, y: (e.clientY - rect.top) / rect.height * CITY_MAP.height };
  },
  // morador sob o ponto (caixa do sprite, com folga pra ficar fácil clicar)
  npcAt(p){
    if(!this.scale) return null;
    const hw = this.FRAME_W * CITY_MAP.spriteScale / 2 + 6, hh = this.FRAME_H * CITY_MAP.spriteScale + 6;
    const hits = this.npcs.filter(n => n.alpha >= 0.5 && Math.abs(p.x - n.x) <= hw && p.y <= n.y + 6 && p.y >= n.y - hh);
    return hits.sort((a, b) => b.y - a.y)[0] || null; // o da frente ganha
  },
  // ponto dentro de uma elipse {x, y, rx, ry} de CITY_MAP (fonte, cachoeira, lua)
  inEllipse(p, e){
    const dx = (p.x - e.x) / e.rx, dy = (p.y - e.y) / e.ry;
    return dx * dx + dy * dy <= 1;
  },
  inFountain(p){
    return this.inEllipse(p, CITY_MAP.fountain);
  },
  onClick(e){
    const p = this.pointOf(e);
    const n = this.npcAt(p);
    if(n) return this.say(n);
    if(this.inFountain(p)) return this.openFountain();
    if(this.inEllipse(p, CITY_MAP.waterfall)) return this.splashWaterfall(p);
    // a lua só está no céu de noite (de dia a pintura do dia cobre ela)
    if(this.inEllipse(p, CITY_MAP.moon) && this.phaseName(this.dayTime) === 'Noite') AchievementsModule.unlock('moon');
  },
  // 3 cliques seguidos (no máximo CITY_MAP.waterfall.gapMs entre eles)
  splashWaterfall(p){
    const w = CITY_MAP.waterfall, now = performance.now();
    this.waterfallHits = (now - this.waterfallLastAt <= w.gapMs) ? this.waterfallHits + 1 : 1;
    this.waterfallLastAt = now;
    this.ripples.push({ x: p.x, y: p.y, age: 0, life: 700, coin: false });
    if(this.waterfallHits >= 3) AchievementsModule.unlock('waterfall');
  },
  say(n){
    if(!state.npcsMet[n.def.key]){
      state.npcsMet[n.def.key] = true;
      AchievementsModule.checkAll(); // Rosto Conhecido (todos os moradores)
    }
    const lines = n.def.lines || [];
    const name = document.createElement('b');
    name.textContent = n.def.name;
    const text = document.createElement('span');
    this.bubble.replaceChildren(name, text);
    this.bubble.classList.add('open');
    // fala aparece aos poucos, com a "voz" do morador (ver DialogueModule)
    if(lines.length) DialogueModule.typeInto(text, `"${lines[Math.floor(Math.random() * lines.length)]}"`, DialogueModule.voiceFor(n.def.key));
    this.talking = { npc: n, until: performance.now() + this.BUBBLE_MS };
    this.placeBubble(n);
  },
  placeBubble(n){
    this.bubble.style.left = (n.x / CITY_MAP.width * 100) + '%';
    this.bubble.style.top = ((n.y - this.FRAME_H * CITY_MAP.spriteScale - 6) / CITY_MAP.height * 100) + '%';
  },
  hideBubble(){
    this.talking = null;
    if(this.bubble) this.bubble.classList.remove('open');
  },

  // ---- fonte: depositar moedas ----
  initFountain(){
    this.fountainModal = document.getElementById('fountainModal');
    this.fountainInput = document.getElementById('fountainInput');
    const f = CITY_MAP.fountain;
    this.fountainInput.min = f.minCoins;
    this.fountainInput.max = f.maxCoins;
    document.getElementById('openFountainBtn').addEventListener('click', () => this.openFountain());
    document.getElementById('fountainCloseBtn').addEventListener('click', () => this.fountainModal.classList.remove('open'));
    this.fountainModal.addEventListener('click', (e) => { if(e.target === this.fountainModal) this.fountainModal.classList.remove('open'); });
    const nudge = (delta) => {
      const v = this.parseCoins(this.fountainInput.value);
      this.fountainInput.value = Math.max(f.minCoins, Math.min(f.maxCoins, (v === null ? f.minCoins : v) + delta));
      this.renderFountainInfo();
    };
    document.getElementById('fountainMinusBtn').addEventListener('click', () => nudge(-1));
    document.getElementById('fountainPlusBtn').addEventListener('click', () => nudge(1));
    this.fountainInput.addEventListener('input', () => this.renderFountainInfo());
    this.fountainInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') this.deposit(); });
    document.getElementById('fountainDepositBtn').addEventListener('click', () => this.deposit());
  },
  openFountain(){
    this.renderFountainInfo();
    this.fountainModal.classList.add('open');
    this.fountainInput.focus();
    this.fountainInput.select();
  },
  // aceita só inteiro puro dentro da faixa — qualquer outra coisa é null
  parseCoins(raw){
    const f = CITY_MAP.fountain;
    const txt = String(raw).trim();
    if(!/^\d{1,4}$/.test(txt)) return null;
    const n = Number(txt);
    return Number.isInteger(n) && n >= f.minCoins && n <= f.maxCoins ? n : null;
  },
  renderFountainInfo(){
    const n = this.parseCoins(this.fountainInput.value);
    const f = CITY_MAP.fountain;
    const gold = Math.floor(state.gold);
    let msg = `Você tem ${UI.fmt(gold)} moeda(s). Já jogou ${UI.fmt(state.fountainCoins || 0)} na fonte.`;
    if(n === null) msg = `Escolha um valor inteiro de ${f.minCoins} a ${f.maxCoins}. ` + msg;
    else if(n > gold) msg = 'Moedas insuficientes. ' + msg;
    document.getElementById('fountainInfo').textContent = msg;
    document.getElementById('fountainDepositBtn').disabled = n === null || n > gold;
  },
  deposit(){
    const n = this.parseCoins(this.fountainInput.value);
    if(n === null || n > Math.floor(state.gold)){ this.renderFountainInfo(); return; }
    state.gold -= n;
    state.fountainCoins = (state.fountainCoins || 0) + n;
    const f = CITY_MAP.fountain;
    for(let i = 0; i < Math.min(4, 1 + Math.floor(Math.log10(n))); i++){
      this.ripples.push({ x: f.x + (Math.random() - 0.5) * f.rx, y: f.y + (Math.random() - 0.5) * f.ry * 0.6, age: -i * 180, life: 1400 });
    }
    SaveModule.save();
    UI.renderStats();
    // a conquista já mostra o próprio aviso — sem dois toasts sobrepostos
    if(!(n === 333 && AchievementsModule.unlock('meioBesta'))){
      UI.showToast('FONTE DOS DESEJOS', `Você jogou ${n} moeda(s) na fonte. Plim!`);
    }
    this.renderFountainInfo();
  }
};
