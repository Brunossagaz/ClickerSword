/*
 * compendio-curves.js — aba "Curvas" do Compêndio.
 * Gráficos (SVG próprio, sem bibliotecas) + análise em texto de cada curva,
 * recalculados a partir dos valores ATUAIS (config + edições do Compêndio)
 * pelo mesmo núcleo do simulador (tools/balance-core.js). Todo texto entra
 * por textContent; o SVG é montado com createElementNS.
 *
 * Paleta: passos escuros da paleta de referência de dataviz, validados contra
 * o fundo do Compêndio (#241d30): CVD ΔE 8.4, visão normal ΔE 19.3, contraste
 * >= 3:1. Ordem fixa por série, nunca reciclada.
 */
const CurvesView = (() => {
  const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
  const SVGNS = 'http://www.w3.org/2000/svg';
  const FLOOR_SHORT = k => (MAPS[k] ? MAPS[k].name.replace(/^Andar d[aoe]s? /, '') : k);
  let timer = null;

  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(SVGNS, tag);
    for(const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    if(parent) parent.appendChild(e);
    return e;
  };
  const h = (tag, cls, text, parent) => {
    const e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text != null) e.textContent = text;
    if(parent) parent.appendChild(e);
    return e;
  };
  const num = n => {
    if(!isFinite(n)) return '—';
    const a = Math.abs(n);
    if(a >= 1e12) return (n / 1e12).toFixed(1).replace('.', ',') + ' tri';
    if(a >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',') + ' bi';
    if(a >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' mi';
    if(a >= 1e4) return Math.round(n / 1e3).toLocaleString('pt-BR') + ' mil';
    if(a >= 100) return Math.round(n).toLocaleString('pt-BR');
    return (Math.round(n * 10) / 10).toLocaleString('pt-BR');
  };
  const mins = m => m >= 90 ? (m / 60).toFixed(1).replace('.', ',') + ' h' : Math.round(m) + ' min';
  const hrsTxt = h => h.toFixed(2).replace('.', ',') + ' h';

  // ---------- gráfico de linhas (eixo Y log opcional) ----------
  // cfg: { series:[{name, points:[{x (índice), y, tip}]}], xLabels[], xGroups?[{from,to,label}], yLog, yFmt, yTitle, refLines?[{y,label}] }
  function lineChart(cfg){
    const W = 920, H = 320, M = { l: 70, r: 120, t: 16, b: cfg.xGroups ? 54 : 36 };
    const wrap = h('div', 'curve-chart');
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': cfg.title || 'gráfico' }, wrap);
    const all = cfg.series.flatMap(s => s.points.map(p => p.y)).concat((cfg.refLines || []).map(r => r.y)).filter(v => v > 0 && isFinite(v));
    let lo = Math.min(...all), hi = Math.max(...all);
    const n = cfg.xLabels.length;
    const X = i => M.l + (n <= 1 ? 0 : i / (n - 1) * (W - M.l - M.r));
    let Y, ticks;
    if(cfg.yLog){
      lo = Math.pow(10, Math.floor(Math.log10(lo))); hi = Math.pow(10, Math.ceil(Math.log10(hi)));
      if(hi === lo) hi = lo * 10;
      Y = v => H - M.b - (Math.log10(Math.max(v, lo)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * (H - M.t - M.b);
      ticks = []; for(let e = Math.log10(lo); e <= Math.log10(hi); e++) ticks.push(Math.pow(10, e));
      if(ticks.length > 8){ const step = Math.ceil(ticks.length / 7); ticks = ticks.filter((_, i) => i % step === 0); }
    } else {
      lo = 0; hi = hi * 1.1 || 1;
      Y = v => H - M.b - v / hi * (H - M.t - M.b);
      ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * hi);
    }
    // grade e eixo Y (recessivos)
    for(const t of ticks){
      el('line', { x1: M.l, x2: W - M.r, y1: Y(t), y2: Y(t), class: 'c-grid' }, svg);
      el('text', { x: M.l - 8, y: Y(t) + 4, 'text-anchor': 'end', class: 'c-tick' }, svg).textContent = (cfg.yFmt || num)(t);
    }
    if(cfg.yTitle) el('text', { x: 14, y: M.t + (H - M.t - M.b) / 2, class: 'c-axis-title', transform: `rotate(-90 14 ${M.t + (H - M.t - M.b) / 2})`, 'text-anchor': 'middle' }, svg).textContent = cfg.yTitle;
    // eixo X: rótulos (espaçados) e grupos (andares)
    const every = Math.max(1, Math.ceil(n / 14));
    cfg.xLabels.forEach((lab, i) => { if(i % every === 0 || i === n - 1) el('text', { x: X(i), y: H - M.b + 16, 'text-anchor': 'middle', class: 'c-tick' }, svg).textContent = lab; });
    for(const g of cfg.xGroups || []){
      const x1 = X(g.from), x2 = X(g.to);
      el('line', { x1, x2, y1: H - M.b + 26, y2: H - M.b + 26, class: 'c-group' }, svg);
      el('text', { x: (x1 + x2) / 2, y: H - M.b + 42, 'text-anchor': 'middle', class: 'c-tick c-group-label' }, svg).textContent = g.label;
      if(g.from > 0) el('line', { x1: X(g.from) - (X(1) - X(0)) / 2, x2: X(g.from) - (X(1) - X(0)) / 2, y1: M.t, y2: H - M.b, class: 'c-divider' }, svg);
    }
    for(const r of cfg.refLines || []){
      el('line', { x1: M.l, x2: W - M.r, y1: Y(r.y), y2: Y(r.y), class: 'c-ref' }, svg);
      el('text', { x: W - M.r + 6, y: Y(r.y) + 4, class: 'c-tick' }, svg).textContent = r.label;
    }
    // séries (rótulos diretos coletados pra depois afastar os que colidem)
    const labels = [];
    cfg.series.forEach((s, si) => {
      const color = SERIES[si % SERIES.length];
      const pts = s.points.filter(p => p.y > 0 && isFinite(p.y));
      if(!pts.length) return;
      el('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' '), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-dasharray': s.dash || '' }, svg);
      for(const p of pts) el('circle', { cx: X(p.x), cy: Y(p.y), r: 4, fill: color, stroke: 'var(--bg-panel)', 'stroke-width': 2 }, svg);
      // rótulo direto no fim (até 4 séries), com a cor como marca e o texto em tinta neutra
      if(cfg.series.length <= 4){
        const last = pts[pts.length - 1];
        labels.push({ y: Y(last.y), color, text: s.short || s.name });
      }
    });
    // afasta rótulos diretos: no mínimo 17 px entre um e outro, sem sair do gráfico
    labels.sort((a, b) => a.y - b.y);
    for(let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 17);
    const over = labels.length ? labels[labels.length - 1].y - (H - M.b) : 0;
    if(over > 0) labels.forEach(l => { l.y -= over; });
    for(const l of labels){
      el('circle', { cx: W - M.r + 10, cy: l.y, r: 4, fill: l.color }, svg);
      el('text', { x: W - M.r + 18, y: l.y + 4, class: 'c-direct' }, svg).textContent = l.text;
    }
    // legenda (sempre, com >= 2 séries)
    if(cfg.series.length >= 2){
      const leg = h('div', 'curve-legend', null, wrap);
      cfg.series.forEach((s, si) => { const it = h('span', 'curve-leg-item', null, leg); const sw = h('span', 'curve-swatch', null, it); sw.style.background = SERIES[si % SERIES.length]; if(s.dash) sw.classList.add('dashed'); it.append(s.name); });
    }
    // camada de hover: linha-guia + dica no índice X mais próximo
    const cross = el('line', { y1: M.t, y2: H - M.b, class: 'c-cross', visibility: 'hidden' }, svg);
    const hit = el('rect', { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b, fill: 'transparent' }, svg);
    const tip = h('div', 'curve-tip', null, wrap);
    hit.addEventListener('mousemove', (e) => {
      const r = svg.getBoundingClientRect();
      const sx = (e.clientX - r.left) / r.width * W;
      const i = Math.max(0, Math.min(n - 1, Math.round((sx - M.l) / ((W - M.l - M.r) / Math.max(1, n - 1)))));
      cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('visibility', 'visible');
      tip.replaceChildren(); h('div', 'curve-tip-title', cfg.tipTitle ? cfg.tipTitle(i) : cfg.xLabels[i], tip);
      cfg.series.forEach((s, si) => {
        const p = s.points.find(q => q.x === i); if(!p) return;
        const row = h('div', 'curve-tip-row', null, tip);
        const sw = h('span', 'curve-swatch', null, row); sw.style.background = SERIES[si % SERIES.length];
        row.append(`${s.short || s.name}: ${p.tip || (cfg.yFmt || num)(p.y)}`);
      });
      tip.style.display = 'block';
      const px = (X(i) / W) * r.width;
      tip.style.left = Math.min(r.width - tip.offsetWidth - 4, Math.max(0, px + 14)) + 'px';
      tip.style.top = '8px';
    });
    hit.addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); tip.style.display = 'none'; });
    return wrap;
  }

  // ---------- gráfico de barras (uma série) ----------
  function barChart(cfg){
    const W = 920, H = 260, M = { l: 70, r: 20, t: 20, b: 60 };
    const wrap = h('div', 'curve-chart');
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': cfg.title || 'gráfico' }, wrap);
    const max = Math.max(...cfg.bars.map(b => b.y), 1) * 1.15;
    const Y = v => H - M.b - v / max * (H - M.t - M.b);
    for(const f of [0, 0.25, 0.5, 0.75, 1]){ const t = f * max; el('line', { x1: M.l, x2: W - M.r, y1: Y(t), y2: Y(t), class: 'c-grid' }, svg); el('text', { x: M.l - 8, y: Y(t) + 4, 'text-anchor': 'end', class: 'c-tick' }, svg).textContent = num(t); }
    const bw = (W - M.l - M.r) / cfg.bars.length;
    const tip = h('div', 'curve-tip', null, wrap);
    cfg.bars.forEach((b, i) => {
      const x = M.l + i * bw + bw * 0.22, w = bw * 0.56, y = Y(b.y);
      const bar = el('rect', { x, y, width: w, height: Math.max(0, H - M.b - y), rx: 4, fill: SERIES[0] }, svg);
      el('text', { x: x + w / 2, y: y - 6, 'text-anchor': 'middle', class: 'c-direct' }, svg).textContent = num(b.y);
      el('text', { x: x + w / 2, y: H - M.b + 16, 'text-anchor': 'middle', class: 'c-tick' }, svg).textContent = b.label;
      if(b.sub) el('text', { x: x + w / 2, y: H - M.b + 32, 'text-anchor': 'middle', class: 'c-tick c-group-label' }, svg).textContent = b.sub;
      const hitR = el('rect', { x: M.l + i * bw, y: M.t, width: bw, height: H - M.t - M.b, fill: 'transparent' }, svg);
      hitR.addEventListener('mousemove', () => { tip.replaceChildren(); h('div', 'curve-tip-title', b.label, tip); h('div', 'curve-tip-row', b.tip || num(b.y), tip); tip.style.display = 'block'; tip.style.left = Math.min(svg.getBoundingClientRect().width - 220, ((x + w) / W) * svg.getBoundingClientRect().width + 8) + 'px'; tip.style.top = '8px'; bar.setAttribute('fill-opacity', '0.8'); });
      hitR.addEventListener('mouseleave', () => { tip.style.display = 'none'; bar.setAttribute('fill-opacity', '1'); });
    });
    return wrap;
  }

  // tabela de dados (acessibilidade: identidade nunca só por cor)
  function dataTable(headers, rows){
    const d = h('details', 'curve-table');
    h('summary', null, 'Ver tabela', d);
    const t = h('table', null, null, d);
    const tr = h('tr', null, null, h('thead', null, null, t));
    headers.forEach(x => h('th', null, x, tr));
    const tb = h('tbody', null, null, t);
    for(const r of rows){ const row = h('tr', null, null, tb); r.forEach(c => h('td', null, c, row)); }
    return d;
  }
  function analysis(items){
    const box = h('div', 'curve-analysis');
    h('div', 'curve-analysis-title', 'Análise', box);
    const ul = h('ul', null, null, box);
    for(const it of items){ const li = h('li', it.level ? 'lvl-' + it.level : null, null, ul); if(it.tag){ h('b', null, it.tag + ' ', li); } li.append(it.text); }
    return box;
  }
  function section(parent, title, chart, notes, table){
    const s = h('div', 'curve-section', null, parent);
    h('h2', null, title, s);
    s.appendChild(chart); if(table) s.appendChild(table); s.appendChild(notes);
  }

  // ---------- montagem ----------
  function render(){
    const body = document.getElementById('curvesBody');
    if(!body) return;
    const cps = Number(document.getElementById('curvesCps').value) || CONFIG.balanceRefCps || 5;
    const G = { CONFIG, MONSTER_TYPES, MAPS, DUNGEON_ORDER, ITEM_DEFS, WEAPON_DEFS, FORGED_WEAPON_DEFS, TROOP_DEFS, UPGRADE_DEFS, PROSPECTOR_DEFS, CAVERN_UPGRADE_DEFS, ARCANE_SKILL_DEFS, QUEST_DEFS, GUILD_EXPEDITION_DEFS, monsterHp };
    const sim = BalanceCore.createBalanceSim(G, { cps, maxHours: 30 });
    const res = sim.run();
    body.replaceChildren();

    // eixo X comum: um ponto por ciclo de cada andar
    const stages = [];
    for(const d of DUNGEON_ORDER) for(let c = 1; c <= CONFIG.maxCycleNum; c++) stages.push({ d, c });
    const xLabels = stages.map(s => 'C' + s.c);
    const xGroups = DUNGEON_ORDER.map((d, i) => ({ from: i * CONFIG.maxCycleNum, to: i * CONFIG.maxCycleNum + CONFIG.maxCycleNum - 1, label: FLOOR_SHORT(d) }));
    const tipTitle = i => `${FLOOR_SHORT(stages[i].d)} · ciclo ${stages[i].c}`;
    const rowAt = i => res.rows.find(r => r.dungeon === stages[i].d && r.cycle === stages[i].c);

    // ===== 1. Dano do jogador × dano necessário =====
    {
      const need = stages.map((s, i) => ({ x: i, y: sim.requiredDps(sim.cycleMonsters(s.d, s.c), 0) }));
      const have = stages.map((s, i) => { const r = rowAt(i); return r ? { x: i, y: r.dps, tip: num(r.dps) + (r.minutes != null ? ` · ${mins(r.minutes)} de farm` : '') } : null; }).filter(Boolean);
      const chart = lineChart({ title: 'Dano do jogador e dano necessário', series: [
        { name: 'DPS necessário pra passar o ciclo', short: 'Necessário', points: need },
        { name: 'DPS do jogador simulado ao passar', short: 'Jogador', points: have }], xLabels, xGroups, yLog: true, yTitle: 'dano por segundo (escala log)', tipTitle });
      const items = [];
      const stuck = res.rows.find(r => r.stuck);
      const done = res.rows.filter(r => !r.stuck);
      if(stuck) items.push({ level: 'bad', tag: 'Trava:', text: `o jogador simulado (${cps} cliques/s) não passa de ${FLOOR_SHORT(stuck.dungeon)} ciclo ${stuck.cycle}${stuck.softlock ? ' — o 1º monstro não morre no tempo com o dano inicial' : ` em 30 h de farm (precisa de ~${num(stuck.need)} de DPS, tem ${num(stuck.dps)})`}. Baixe o hpScale desse andar ou o crescimento por ciclo.` });
      else items.push({ level: 'ok', tag: 'Completo:', text: `o jogo inteiro é vencido em ~${(res.clock / 3600).toFixed(1).replace('.', ',')} h de jogo ativo (${cps} cliques/s, com forja, Caverna, monstro dourado e Habilidades Arcanas; sem ganho offline).` });
      // orçamento de tempo por andar (MAPS[k].timeBudgetH) — só vale na cadência de referência
      const budgetNote = cps === CONFIG.balanceRefCps ? '' : ` (o orçamento é pra ${CONFIG.balanceRefCps} cliques/s)`;
      for(const f of sim.floorTimes(res)){
        if(f.stuck || f.budget == null) continue;
        const diff = Math.round((f.pct - 1) * 100);
        items.push({ level: f.status === 'ok' ? 'ok' : 'warn', tag: 'Orçamento ' + FLOOR_SHORT(f.key) + ':', text: `${hrsTxt(f.hours)} de ${hrsTxt(f.budget)} planejadas (${diff >= 0 ? '+' : ''}${diff}%)${f.status === 'rapido' ? ' — rápido demais' : f.status === 'lento' ? ' — lento demais' : ''}${budgetNote}.` });
      }
      if(done.length){
        const worst = done.reduce((a, b) => (b.minutes > a.minutes ? b : a));
        items.push({ level: worst.minutes > 45 ? 'warn' : 'ok', tag: 'Maior farm:', text: `${FLOOR_SHORT(worst.dungeon)} ciclo ${worst.cycle} pede ${mins(worst.minutes)} de farm${worst.minutes > 45 ? ' — um paredão; o jogador casual pode desistir aqui' : ''}.` });
        const easy = done.filter(r => r.minutes < 1).length;
        if(easy > done.length * 0.3) items.push({ level: 'warn', tag: 'Ciclos triviais:', text: `${easy} de ${done.length} ciclos são vencidos na 1ª tentativa (< 1 min). O dano do jogador está sobrando nesses trechos — dá pra subir o hpScale do andar sem criar paredão.` });
        const last = done[done.length - 1];
        const clickShare = last.clickPart / Math.max(1, last.clickPart + last.troopPart);
        items.push({ tag: 'Composição do dano:', text: `no fim, ${Math.round(clickShare * 100)}% vem do clique e ${Math.round((1 - clickShare) * 100)}% das tropas/arma. ${clickShare > 0.85 ? 'Tropas quase não pesam — ficam baratas demais de ignorar ou caras demais pra valer a pena.' : clickShare < 0.25 ? 'O clique quase não importa no fim — o jogo vira idle puro.' : 'Equilíbrio saudável entre ativo e idle.'}` });
      }
      section(body, '1. Dano do jogador × dano necessário', chart, analysis(items),
        dataTable(['Andar', 'Ciclo', 'DPS necessário', 'DPS do jogador', 'Farm'], stages.map((s, i) => { const r = rowAt(i); return [FLOOR_SHORT(s.d), s.c, num(need[i].y), r ? num(r.dps) : '—', r && r.minutes != null ? mins(r.minutes) : (r && r.stuck ? 'trava' : '—')]; })));
    }

    // ===== 2. Vida dos monstros =====
    {
      const bossHp = stages.map((s, i) => ({ x: i, y: Math.max(...sim.cycleMonsters(s.d, s.c).map(m => m.hp)) }));
      const firstHp = stages.map((s, i) => ({ x: i, y: sim.cycleMonsters(s.d, s.c)[0].hp }));
      const chart = lineChart({ title: 'Vida dos monstros', series: [
        { name: 'Maior vida do ciclo (chefe)', short: 'Chefe', points: bossHp },
        { name: '1º monstro do ciclo', short: '1º monstro', points: firstHp }], xLabels, xGroups, yLog: true, yTitle: 'vida (escala log)', tipTitle });
      const items = [];
      items.push({ tag: 'Dentro do andar:', text: `cada ciclo multiplica a vida por ${CONFIG.hpCycleGrowth} (${num(Math.pow(CONFIG.hpCycleGrowth, CONFIG.maxCycleNum - 1))}x do ciclo 1 ao ${CONFIG.maxCycleNum}) e cada abate dentro do ciclo por ${CONFIG.hpKillGrowth}. O chefe tem ${CONFIG.bossHpMult}x a vida de um monstro comum.` });
      for(let i = 1; i < DUNGEON_ORDER.length; i++){
        const prev = DUNGEON_ORDER[i - 1], cur = DUNGEON_ORDER[i];
        const a = firstHp[i * CONFIG.maxCycleNum - 1].y, b = firstHp[i * CONFIG.maxCycleNum].y;
        const ratio = b / a;
        if(ratio < 0.8) items.push({ level: 'warn', tag: 'Recuo:', text: `${FLOOR_SHORT(cur)} ciclo 1 começa com ${Math.round((1 - ratio) * 100)}% menos vida que ${FLOOR_SHORT(prev)} ciclo ${CONFIG.maxCycleNum} — o andar novo começa mais fácil que o anterior terminou.` });
        else if(ratio > 6) items.push({ level: 'warn', tag: 'Salto:', text: `de ${FLOOR_SHORT(prev)} ciclo ${CONFIG.maxCycleNum} pra ${FLOOR_SHORT(cur)} ciclo 1 a vida sobe ${num(ratio)}x de uma vez.` });
        else items.push({ level: 'ok', tag: FLOOR_SHORT(cur) + ':', text: `começa com ${num(ratio)}x a vida do fim do andar anterior (hpScale ${MAPS[cur].hpScale}).` });
      }
      section(body, '2. Vida dos monstros por ciclo', chart, analysis(items),
        dataTable(['Andar', 'Ciclo', '1º monstro', 'Chefe'], stages.map((s, i) => [FLOOR_SHORT(s.d), s.c, num(firstHp[i].y), num(bossHp[i].y)])));
    }

    // ===== 3. Tropas =====
    {
      const N = 25, curves = sim.troopCurve(N);
      const chart = lineChart({ title: 'Tropas: custo por DPS', series: curves.map(c => ({ name: c.name, short: c.name, points: c.points.map((p, i) => ({ x: i, y: p.costPerDps, tip: `${num(p.cost)} moedas (${num(p.costPerDps)} por DPS)` })) })),
        xLabels: Array.from({ length: N }, (_, i) => String(i + 1)), yLog: true, yTitle: 'moedas por 1 DPS (log)', tipTitle: i => `${i + 1}ª unidade` });
      const items = [];
      const first = curves.map(c => ({ c, v: c.points[0].costPerDps }));
      const cheapest = first.reduce((a, b) => (b.v < a.v ? b : a));
      items.push({ tag: 'Melhor valor inicial:', text: `${cheapest.c.name} (${num(cheapest.v)} moedas por DPS na 1ª unidade).` });
      for(const t of TROOP_DEFS) items.push({ tag: t.name + ':', text: `custo sobe ${t.costGrowth}x por unidade — a 10ª custa ${num(Math.ceil(t.baseCost * Math.pow(t.costGrowth, 9)))} (${num(Math.pow(t.costGrowth, 9))}x a 1ª). Rende ${num(t.dps)} DPS cada.` });
      const inc = sim.dungeonIncome(DUNGEON_ORDER[DUNGEON_ORDER.length - 1]);
      const top = TROOP_DEFS[TROOP_DEFS.length - 1];
      items.push({ tag: 'Ritmo:', text: `farmando o último andar (~${num(inc)} moedas/s), a 1ª ${top.name} sai em ${mins(top.baseCost / inc / 60)} e a 10ª em ${mins(top.baseCost * Math.pow(top.costGrowth, 9) / inc / 60)}.` });
      section(body, '3. Tropas: custo por DPS da próxima unidade', chart, analysis(items),
        dataTable(['Tropa', 'DPS', '1ª', '10ª', '25ª'], curves.map((c, i) => [c.name, num(TROOP_DEFS[i].dps), num(c.points[0].cost), num(c.points[9].cost), num(c.points[24].cost)])));
    }

    // ===== 4. Caverna =====
    {
      const N = 15, curves = sim.cavernCurve(N);
      const chart = lineChart({ title: 'Caverna: tempo pra se pagar', series: curves.map(c => ({ name: c.name, short: c.name.split(' ')[0], points: c.points.map((p, i) => ({ x: i, y: p.paybackMin, tip: `${num(p.cost)} moedas · se paga em ${mins(p.paybackMin)}` })) })),
        xLabels: Array.from({ length: N }, (_, i) => String(i + 1)), yLog: true, yTitle: 'minutos pra se pagar (log)', yFmt: v => mins(v), tipTitle: i => `${i + 1}º minerador`,
        refLines: [{ y: 60, label: '1 hora' }] });
      const ov = sim.oreValue(0);
      const items = [{ tag: 'Minério:', text: `vale em média ${num(ov)} moedas na Loja (${num(sim.oreValue(10))} com Faro de Minérios no máximo).` }];
      for(const c of curves){
        const floor = c.requiresDungeon || DUNGEON_ORDER[0];
        const inc = sim.dungeonIncome(floor);
        const share = c.points[0].goldPerSec / Math.max(1e-9, inc);
        const pay = c.points[0].paybackMin;
        items.push({ level: pay < 10 ? 'bad' : pay < 20 ? 'warn' : 'ok', tag: c.name + ':', text: `o 1º se paga em ${mins(pay)} e rende ${Math.round(share * 100)}% do que farmar ${FLOOR_SHORT(floor)} rende (${num(inc)} moedas/s)${c.requiresDungeon ? `; libera com ${FLOOR_SHORT(c.requiresDungeon)}` : ''}.${pay < 10 ? ' Rápido demais — vira bola de neve.' : ''}` });
      }
      const eff = CONFIG.cavernOfflineEfficiency != null ? CONFIG.cavernOfflineEfficiency : CONFIG.offlineEfficiency;
      items.push({ tag: 'Offline:', text: `rende ${Math.round(eff * 100)}% por até ${CONFIG.offlineCapHours} h — ${num(CONFIG.offlineCapHours * eff)} h "cheias" de mineração por sessão fora.` });
      section(body, '4. Caverna: tempo pra se pagar do próximo minerador', chart, analysis(items),
        dataTable(['Minerador', 'Minério/s', '1º custa', 'Se paga em', '10º se paga em'], curves.map((c, i) => [c.name, PROSPECTOR_DEFS[i].orePerSec, num(c.points[0].cost), mins(c.points[0].paybackMin), mins(c.points[9].paybackMin)])));
    }

    // ===== 5. Armas =====
    {
      const weapons = [...WEAPON_DEFS, ...FORGED_WEAPON_DEFS];
      const chart = barChart({ title: 'Dano por clique das armas', bars: weapons.map(w => ({ y: w.clickDamageBonus || 0, label: w.name.length > 16 ? w.name.slice(0, 15) + '…' : w.name, sub: w.recipe ? 'forjada' : 'básica',
        tip: `+${num(w.clickDamageBonus || 0)} dano por clique${w.dpsBonus ? ', +' + num(w.dpsBonus) + ' DPS' : ''}` })) });
      const items = [];
      const basic = WEAPON_DEFS.map(w => w.clickDamageBonus || 0);
      if(new Set(basic).size === 1) items.push({ level: 'warn', tag: 'Básicas iguais:', text: `as ${WEAPON_DEFS.length} armas básicas dão o mesmo +${basic[0]} — comprar a 2ª/3ª não muda o dano (só serve pra coleção/missão).` });
      for(let i = 0; i < FORGED_WEAPON_DEFS.length; i++){
        const w = FORGED_WEAPON_DEFS[i], prev = i ? FORGED_WEAPON_DEFS[i - 1] : WEAPON_DEFS[0];
        const ratio = (w.clickDamageBonus || 0) / Math.max(1, prev.clickDamageBonus || 0);
        items.push({ tag: w.name + ':', text: `+${num(w.clickDamageBonus)} por clique (${num(ratio)}x a anterior)${w.requiresWeapon ? ', exige ' + (FORGED_WEAPON_DEFS.find(x => x.key === w.requiresWeapon) || {}).name : ''}.` });
      }
      const lastSlime = FORGED_WEAPON_DEFS[FORGED_WEAPON_DEFS.length - 1];
      items.push({ level: 'warn', tag: 'Lacuna:', text: `a última arma (${lastSlime.name}) sai com material do Pântano; do Goblin ao Demônio não há arma nova — o dano extra nos andares finais vem só de tropas e upgrades (veja a composição no gráfico 1).` });
      section(body, '5. Armas: dano por clique', chart, analysis(items), null);
    }
  }

  return {
    schedule(){
      clearTimeout(timer);
      timer = setTimeout(() => { if(document.getElementById('curvas').classList.contains('active')) render(); else pending = true; }, 250);
    },
    render,
    init(){
      document.getElementById('curvesCps').addEventListener('change', render);
      document.getElementById('tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab="curvas"]'); if(b) setTimeout(render, 0); });
    }
  };
})();
let pending = false;
document.addEventListener('DOMContentLoaded', () => { CurvesView.init(); if(location.hash === '#curvas') setTimeout(CurvesView.render, 0); });
