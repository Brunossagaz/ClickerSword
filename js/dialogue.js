/* ---------------------------------------------------------------------
   DIALOGUE MODULE (dialogue.js)
   Conversas com personagem numa janela só (#dialogueModal): retrato ao
   lado, nome no topo e as falas aparecendo letra por letra, com um "bip"
   de voz por personagem e pausas na pontuação. Roteiros em DIALOGUES
   (js/dialogues-data.js).
   - Clique (ou Espaço/Enter) durante a digitação: mostra a fala inteira.
     Clique de novo: próxima fala.
   - Respostas prontas: botões que aparecem no fim da fala; o NPC reage
     (choice.reply) e a escolha fica em state.dialogueMemory pra ser
     lembrada depois (linhas com `when`). Nunca mudam a história.
   - opts.action: ação de DialogueModule.actions que roda no fim (depois da fila).
   - Fila: play() com outra conversa aberta espera ela acabar. Também espera
     telas que não podem ser cobertas (resumo de loot, tempo esgotado...) —
     ver BLOCKERS — a menos que venha com { immediate: true }.
   - Enquanto a janela está aberta o jogo fica pausado (ver PauseModule).
   typeInto() reaproveita a mesma digitação em textos soltos (introdução do
   Clérigo, fala do NPC na Loja/Ferreiro, balão dos moradores da cidade).
--------------------------------------------------------------------- */
const DialogueModule = {
  // ms por letra de cada opção de SettingsModule.current.textSpeed
  SPEEDS: { lenta: 55, normal: 30, rapida: 14, instantanea: 0 },
  BLOCKERS: ['repeatCycleResultModal', 'timeUpModal', 'clericModal', 'nameEntryModal', 'leaveConfirmModal'],
  queue: [],
  cur: null,     // { script, idx, opts, endActions, pendingReply }
  typing: null,  // controlador da digitação atual (ver typeInto)
  typers: new Set(), // textos soltos digitando agora (Clérigo, Loja, balões) — ver typeInto
  waitTimer: null,
  audioCtx: null,

  // ações que uma resposta pode disparar ao fim da conversa (choice.action)
  actions: {
    openAcademia(){
      document.getElementById('openAcademiaBtn').click(); // mesmo caminho do clique na placa
      UI.showAcademiaTab('academiaTabTree');
    },
    showArcaneTab(){
      document.getElementById('academiaModal').classList.add('open');
      UI.renderAll(); // mostra a aba que acabou de liberar
      UI.showAcademiaTab('academiaTabArcane');
    },
  },

  init(){
    this.el = {
      modal: document.getElementById('dialogueModal'),
      panel: document.getElementById('dialoguePortraitPanel'),
      portrait: document.getElementById('dialoguePortrait'),
      sheet: document.getElementById('dialoguePortraitSheet'),
      role: document.getElementById('dialogueRole'),
      box: document.getElementById('dialogueBox'),
      name: document.getElementById('dialogueName'),
      chapter: document.getElementById('dialogueChapter'),
      chapterNum: document.getElementById('dialogueChapterNum'),
      chapterTitle: document.getElementById('dialogueChapterTitle'),
      text: document.getElementById('dialogueText'),
      choices: document.getElementById('dialogueChoices'),
      hint: document.getElementById('dialogueHint'),
    };
    this.el.modal.addEventListener('click', (e) => {
      if(e.target.closest('.dialogue-choice')) return;
      this.advance();
    });
    // Fora da janela de conversa, qualquer clique completa os textos que
    // ainda estão digitando (introdução do Clérigo, fala da Loja/Ferreiro,
    // balão do morador) — em captura, antes da ação normal do clique.
    document.addEventListener('click', () => {
      if(this.cur) return; // a janela de conversa trata o próprio clique (advance)
      for(const t of [...this.typers]) if(t.el.isConnected && t.el.offsetParent !== null) t.finish();
    }, true);
    document.addEventListener('keydown', (e) => {
      if(!this.cur || (e.key !== ' ' && e.key !== 'Enter')) return;
      if(document.activeElement && document.activeElement.closest && document.activeElement.closest('.dialogue-choice')) return;
      e.preventDefault();
      this.advance();
    });
  },

  isOpen(){ return !!this.cur; },

  // key = chave de DIALOGUES ou o próprio roteiro { lines: [...] }
  play(key, opts){
    opts = opts || {};
    const script = typeof key === 'string' ? DIALOGUES[key] : key;
    if(!script || !script.lines || !script.lines.length){ if(opts.onEnd) opts.onEnd(); return; }
    this.queue.push({ script, opts });
    // no próximo ciclo: quem chamou pode estar prestes a abrir uma tela que
    // a conversa deve esperar (ex.: DungeonModule.leaveWithSummary chama
    // leaveToCity, que enfileira as conversas da volta, ANTES de mostrar o
    // resumo de loot)
    setTimeout(() => this.pump(), 0);
  },
  blocked(){
    return this.BLOCKERS.some(id => { const el = document.getElementById(id); return el && el.classList.contains('open'); });
  },
  pump(){
    if(this.cur || !this.queue.length) return;
    if(!this.queue[0].opts.immediate && this.blocked()){
      clearTimeout(this.waitTimer);
      this.waitTimer = setTimeout(() => this.pump(), 200);
      return;
    }
    const next = this.queue.shift();
    this.cur = { script: next.script, opts: next.opts, idx: -1, endActions: next.opts.action ? [next.opts.action] : [], pendingReply: null };
    this.el.modal.classList.add('open');
    this.next();
  },

  // ---- linhas
  matches(when){
    if(!when) return true;
    const mem = state.dialogueMemory || {};
    if(when[0] === '!') return mem[when.slice(1)] == null;
    const [k, v] = when.split('=');
    return v === undefined ? mem[k] != null : mem[k] === v;
  },
  fill(text){
    return String(text || '')
      .replace(/\{nome\}/g, state.playerName || 'Herói')
      .replace(/\{pontosArcanos\}/g, () => typeof ArcaneModule !== 'undefined' ? ArcaneModule.pointsAvailable() : 0);
  },
  next(){
    const c = this.cur;
    if(c.pendingReply){ const r = c.pendingReply; c.pendingReply = null; this.show(r); return; }
    const lines = c.script.lines;
    do { c.idx++; } while(c.idx < lines.length && !this.matches(lines[c.idx].when));
    if(c.idx >= lines.length){ this.end(); return; }
    this.show(lines[c.idx]);
  },
  speaker(key){
    return DIALOGUE_SPEAKERS[key] || { name: '', narrator: true, voice: this.voiceFor(key) };
  },
  show(line){
    const el = this.el;
    el.choices.replaceChildren();
    el.hint.classList.remove('show');
    const isChapter = !!line.chapter;
    el.modal.classList.toggle('is-chapter', isChapter);
    el.chapter.style.display = isChapter ? '' : 'none';
    let voice = null;
    if(isChapter){
      el.chapterNum.textContent = line.chapter;
      el.chapterTitle.textContent = line.title || '';
      el.panel.style.display = 'none';
      el.name.parentElement.style.display = 'none';
      el.modal.classList.remove('is-narrator');
      voice = this.speaker('narrador').voice;
    } else {
      const sp = this.speaker(line.speaker);
      voice = sp.voice;
      el.modal.classList.toggle('is-narrator', !!sp.narrator);
      el.name.parentElement.style.display = sp.name ? '' : 'none';
      el.name.textContent = (sp.name || '').toUpperCase();
      if(sp.portrait){
        el.panel.style.display = '';
        // `frame`: 1º quadro de uma folha de morador (cols × rows quadros)
        el.portrait.style.display = sp.frame ? 'none' : '';
        el.sheet.style.display = sp.frame ? '' : 'none';
        if(sp.frame){
          el.sheet.style.backgroundImage = `url('${sp.portrait}')`;
          el.sheet.style.backgroundSize = `${sp.frame.cols * 100}% ${sp.frame.rows * 100}%`;
          el.sheet.style.aspectRatio = `${sp.frame.w} / ${sp.frame.h}`;
        } else {
          el.portrait.src = sp.portrait;
          el.portrait.alt = sp.name;
          el.portrait.classList.toggle('is-sprite', !!sp.sprite);
        }
        el.role.textContent = sp.role || '';
      } else {
        el.panel.style.display = 'none';
      }
    }
    // velocidade "instantânea" termina dentro do próprio typeInto — só guarda
    // o controlador se ainda estiver digitando
    let finished = false;
    const ctrl = this.typeInto(el.text, this.fill(line.text || ''), voice, () => {
      finished = true;
      this.typing = null;
      if(line.choices && line.choices.length) this.showChoices(line);
      else el.hint.classList.add('show');
    });
    if(!finished) this.typing = ctrl;
  },
  showChoices(line){
    const el = this.el;
    for(const ch of line.choices){
      const btn = document.createElement('button');
      btn.className = 'small-btn dialogue-choice';
      btn.textContent = this.fill(ch.text);
      btn.addEventListener('click', () => this.choose(line, ch));
      el.choices.appendChild(btn);
    }
    const first = el.choices.querySelector('button');
    if(first) first.focus({ preventScroll: true });
  },
  choose(line, ch){
    const c = this.cur;
    if(!c) return;
    if(line.memory){
      if(!state.dialogueMemory) state.dialogueMemory = {};
      state.dialogueMemory[line.memory] = ch.id;
    }
    if(ch.action) c.endActions.push(ch.action);
    if(ch.achievement) AchievementsModule.unlock(ch.achievement);
    this.el.choices.replaceChildren();
    if(ch.reply) c.pendingReply = { speaker: line.speaker, text: ch.reply };
    this.next();
  },
  advance(){
    if(!this.cur) return;
    if(this.typing){ this.typing.finish(); return; }
    if(this.el.choices.childElementCount) return; // precisa escolher uma resposta
    this.next();
  },
  end(){
    const c = this.cur;
    this.cur = null;
    this.el.modal.classList.remove('open', 'is-chapter', 'is-narrator');
    SaveModule.save();
    // ações das respostas (ex.: abrir a Academia) esperam a fila de conversas
    // acabar — senão a próxima conversa abriria por cima da tela aberta
    this.pendingActions = (this.pendingActions || []).concat(c.endActions);
    if(c.opts.onEnd) c.opts.onEnd();
    UI.renderAll();
    this.pump();
    if(!this.cur && !this.queue.length){
      const acts = this.pendingActions; this.pendingActions = [];
      for(const a of acts) if(this.actions[a]) this.actions[a]();
    }
  },

  // ---- digitação (também usada fora da janela de conversa)
  textDelayMs(){
    const s = (typeof SettingsModule !== 'undefined' && SettingsModule.current.textSpeed) || 'normal';
    return this.SPEEDS[s] != null ? this.SPEEDS[s] : this.SPEEDS.normal;
  },
  // *negrito* → segmentos { t, b }
  parseMarkup(text){
    const out = [];
    text.split('*').forEach((t, i) => { if(t) out.push({ t, b: i % 2 === 1 }); });
    return out;
  },
  // Digita `text` dentro de `el`. Uma cópia invisível do texto inteiro
  // reserva o espaço desde o começo (a caixa não "cresce" enquanto digita).
  // Devolve { finish() }; onDone roda uma vez quando o texto termina.
  typeInto(el, text, voice, onDone){
    if(el._typing) el._typing.cancel();
    const segs = this.parseMarkup(text);
    const ghost = document.createElement('span');
    ghost.className = 'tw-ghost';
    const live = document.createElement('span');
    live.className = 'tw-live';
    const nodes = segs.map(s => {
      const g = document.createElement(s.b ? 'b' : 'span'); g.textContent = s.t; ghost.appendChild(g);
      const n = document.createElement(s.b ? 'b' : 'span'); live.appendChild(n); return n;
    });
    el.classList.add('tw');
    el.replaceChildren(ghost, live);
    let si = 0, ci = 0, timer = null, done = false, count = 0;
    const base = this.textDelayMs();
    const typers = this.typers;
    const finishAll = () => {
      if(done) return;
      done = true; clearTimeout(timer);
      segs.forEach((s, i) => { nodes[i].textContent = s.t; });
      el._typing = null;
      typers.delete(ctrl);
      if(onDone) onDone();
    };
    const ctrl = { el, finish: finishAll, cancel(){ done = true; clearTimeout(timer); el._typing = null; typers.delete(ctrl); } };
    el._typing = ctrl;
    if(!this.el || el !== this.el.text) typers.add(ctrl); // o texto da janela de conversa é tratado pelo advance()
    if(!base || !segs.length){ finishAll(); return ctrl; }
    const step = () => {
      if(done) return;
      const seg = segs[si], ch = seg.t[ci], nextCh = seg.t[ci + 1];
      nodes[si].textContent += ch;
      if(++ci >= seg.t.length){ si++; ci = 0; }
      if(/[\p{L}\p{N}]/u.test(ch) && (count++ % 2 === 0) && voice) this.voiceBlip(voice);
      if(si >= segs.length){ finishAll(); return; }
      let d = base;
      if(/[.!?…]/.test(ch)) d = nextCh === '.' || nextCh === '!' || nextCh === '?' ? base * 3 : base * 9;
      else if(/[,;:—]/.test(ch)) d = base * 5;
      timer = setTimeout(step, d);
    };
    timer = setTimeout(step, base);
    return ctrl;
  },

  // ---- voz: um bip curto de oscilador por sílaba (WebAudio, sem arquivo)
  voiceFor(key){
    if(DIALOGUE_SPEAKERS[key]) return DIALOGUE_SPEAKERS[key].voice;
    let h = 0;
    for(const ch of String(key || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return { pitch: 150 + (h % 260), wave: ['square', 'triangle', 'sine'][h % 3], vary: 0.12 };
  },
  voiceBlip(voice){
    const cfg = typeof SettingsModule !== 'undefined' ? SettingsModule.current : null;
    if(!cfg || !cfg.audioEnabled || !cfg.volume) return;
    try{
      if(!this.audioCtx){
        const AC = window.AudioContext || window.webkitAudioContext;
        if(!AC) return;
        this.audioCtx = new AC();
      }
      const ctx = this.audioCtx;
      if(ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = voice.wave || 'square';
      osc.frequency.setValueAtTime(voice.pitch * (1 + (Math.random() - 0.5) * (voice.vary || 0.1)), t);
      const peak = 0.05 * cfg.volume / 100 * (osc.type === 'square' || osc.type === 'sawtooth' ? 0.6 : 1);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.065);
    }catch(e){ /* sem áudio nesse navegador — segue só com o texto */ }
  },
};
