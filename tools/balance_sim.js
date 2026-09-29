/*
 * balance_sim.js — simulador de progressão (Node, sem dependências).
 *
 * Carrega o js/config.js DE VERDADE (e js/overrides-data.js, se houver) e
 * simula um jogador que:
 *   1. tenta o próximo ciclo (andar por andar): precisa matar cada monstro
 *      dentro do tempo dele (10s / 20s no chefe) e o ciclo inteiro dentro do
 *      tempo da Dungeon (30s + bônus do ramo Tempo);
 *   2. se não passa: entrega missões, vende o que não é da próxima forja,
 *      compra Caverna/Academia/tropas/armas e farma (moeda, ou a receita da
 *      forja num andar antigo);
 *   3. repete até passar — e registra quanto tempo de jogo levou.
 * No fim compara as horas de cada andar com o orçamento (MAPS[k].timeBudgetH).
 *
 * Uso:
 *   node tools/balance_sim.js                 tabela por ciclo + orçamento por andar
 *   node tools/balance_sim.js --cps 3         cliques manuais por segundo (padrão CONFIG.balanceRefCps)
 *   node tools/balance_sim.js --amostras 50   sorteia drops/minério 50 vezes: mediana e pior 10%
 *   node tools/balance_sim.js --sem caverna,dourado   desliga sistemas (caverna, dourado,
 *                                             arcano, forja, missoes, guilda) pra medir o peso de cada um
 *   node tools/balance_sim.js --json          saída em JSON
 *   node tools/balance_sim.js --calibrar      acha o hpScale de cada andar (teto de farm por ciclo)
 * Sai com código 1 se algum andar ficar fora do orçamento ou travar (serve de checagem).
 *
 * Detalhes do jogador simulado: ver tools/balance-core.js (núcleo
 * compartilhado com a aba Curvas do Compêndio).
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const argStr = name => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : undefined; };
const arg = (name, def) => { const v = argStr(name); return v === undefined ? def : Number(v); };
const has = name => process.argv.includes('--' + name);

// ---------- carregar config (o de verdade + overrides do Compêndio) ----------
const ctx = { window: {}, console, document: undefined };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf8') +
  ';this.X = { CONFIG, MONSTER_TYPES, MAPS, DUNGEON_ORDER, ITEM_DEFS, WEAPON_DEFS, FORGED_WEAPON_DEFS, TROOP_DEFS, UPGRADE_DEFS, UPGRADE_STATS, MINERAL_DEFS, PROSPECTOR_DEFS, CAVERN_UPGRADE_DEFS, ARCANE_SKILL_DEFS, QUEST_DEFS, GUILD_EXPEDITION_DEFS, monsterHp };', ctx);
const ovPath = path.join(ROOT, 'js/overrides-data.js');
if(fs.existsSync(ovPath)){
  vm.runInContext(fs.readFileSync(ovPath, 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/overrides.js'), 'utf8'), ctx);
}
const { CONFIG, MAPS, DUNGEON_ORDER } = ctx.X;
const { createBalanceSim } = require('./balance-core.js');
const CPS = arg('cps', CONFIG.balanceRefCps || 5);
const MAX_HOURS = arg('max', 200);
const disable = (argStr('sem') || '').split(',').map(s => s.trim()).filter(Boolean);
const simOpts = extra => Object.assign({ cps: CPS, maxHours: MAX_HOURS, disable }, extra);
const sim = createBalanceSim(ctx.X, simOpts());
const run = stop => sim.run(stop);

// --calibrar: acha o MAIOR hpScale de cada andar em que nenhum ciclo exige
// mais que o teto de minutos de farm (andar por andar, em ordem) — assim a
// dificuldade sobe sem paredões.
if(has('calibrar')){
  const target = { slimes: 10, goblins: 18, wilds: 25, dragons: 30, demons: 35 };
  // o Pântano fica fixo (definido no config): o 1º slime precisa morrer em
  // 10s com o dano inicial (1 por clique) — ver checagem de softlock
  for(let di = 1; di < DUNGEON_ORDER.length; di++){
    const key = DUNGEON_ORDER[di];
    let lo = Math.log(0.05), hi = Math.log(1e9);
    for(let it = 0; it < 32; it++){
      const mid = (lo + hi) / 2;
      MAPS[key].hpScale = Math.exp(mid);
      const r = createBalanceSim(ctx.X, simOpts()).run(di);
      const mine = r.rows.filter(x => x.dungeon === key);
      const stuck = mine.some(x => x.stuck);
      const minutes = Math.max(...mine.map(x => x.minutes || 0));
      if(stuck || minutes > target[key]) hi = mid; else lo = mid;
    }
    // arredonda pra 2 algarismos significativos
    const v = Math.exp(lo), p = Math.pow(10, Math.floor(Math.log10(v)) - 1);
    MAPS[key].hpScale = Math.max(0.1, Math.floor(v / p) * p); // pra baixo: nunca estoura o teto
    console.log(key.padEnd(8), 'hpScale =', MAPS[key].hpScale);
  }
}

const fmt = n => n >= 1e6 ? n.toExponential(2) : Math.round(n).toLocaleString('pt-BR');
const hrs = h => h.toFixed(2).replace('.', ',') + ' h';
const STATUS = { ok: 'OK', rapido: 'RÁPIDO DEMAIS', lento: 'LENTO DEMAIS', trava: 'TRAVA' };
const pct = (list, p) => { const s = [...list].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };

// --amostras N: roda N vezes sorteando drops e minério (em vez da média) —
// mostra a variância de itens raros (drops de chefe, Cristal Arcano)
const samples = arg('amostras', 0);
if(samples > 0){
  const perFloor = Object.fromEntries(DUNGEON_ORDER.map(k => [k, []]));
  const totals = []; let stuck = 0;
  for(let i = 1; i <= samples; i++){
    const s = createBalanceSim(ctx.X, simOpts({ seed: i }));
    const r = s.run();
    const ft = s.floorTimes(r);
    if(ft.some(f => f.stuck)){ stuck++; continue; }
    for(const f of ft) perFloor[f.key].push(f.hours);
    totals.push(r.clock / 3600);
  }
  console.log(`${samples} amostras com sorteio | ${CPS} cliques/s${disable.length ? ' | sem ' + disable.join(', ') : ''}${stuck ? ` | ${stuck} travaram` : ''}`);
  console.log('andar       orçamento     mediana    pior 10%   melhor 10%');
  let bad = false;
  for(const k of DUNGEON_ORDER){
    const v = perFloor[k]; if(!v.length) continue;
    const b = MAPS[k].timeBudgetH, med = pct(v, 0.5);
    const out = b != null && Math.abs(med / b - 1) > sim.TOLERANCE;
    bad = bad || out;
    console.log(`${k.padEnd(10)} ${(b != null ? hrs(b) : '—').padStart(10)}  ${hrs(med).padStart(10)}  ${hrs(pct(v, 0.9)).padStart(10)}  ${hrs(pct(v, 0.1)).padStart(10)}${out ? '   ← fora do orçamento' : ''}`);
  }
  if(totals.length) console.log(`${'total'.padEnd(10)} ${hrs(DUNGEON_ORDER.reduce((s, k) => s + (MAPS[k].timeBudgetH || 0), 0)).padStart(10)}  ${hrs(pct(totals, 0.5)).padStart(10)}  ${hrs(pct(totals, 0.9)).padStart(10)}  ${hrs(pct(totals, 0.1)).padStart(10)}`);
  process.exit(bad || stuck ? 1 : 0);
}

const res = run();
const floors = sim.floorTimes(res);
if(has('json')){ console.log(JSON.stringify({ rows: res.rows, floors, events: res.events })); process.exit(0); }

console.log(`cliques/s: ${CPS} | tempo da dungeon base: ${CONFIG.dungeonTimeLimitMs / 1000}s | hpCycleGrowth ${CONFIG.hpCycleGrowth} | hpKillGrowth ${CONFIG.hpKillGrowth}${disable.length ? ' | sem ' + disable.join(', ') : ''}`);
console.log('andar      ciclo  tempo p/ passar   total(h)  vida máx      DPS jogador  minério/s  dourado  arma');
for(const r of res.rows){
  if(r.softlock){ console.log(`${r.dungeon.padEnd(10)} ${String(r.cycle).padStart(5)}  TRAVA NO INÍCIO: o 1º monstro (vida ${fmt(r.hpMax)}) não morre no tempo com o dano inicial`); continue; }
  if(r.stuck){ console.log(`${r.dungeon.padEnd(10)} ${String(r.cycle).padStart(5)}  TRAVOU (> ${MAX_HOURS}h farmando)  vida máx ${fmt(r.hpMax)}  DPS ${fmt(r.dps)}`); continue; }
  const detour = r.detourRuns ? ` (${r.detourRuns} p/ forja)` : '';
  console.log(`${r.dungeon.padEnd(10)} ${String(r.cycle).padStart(5)}  ${(r.minutes.toFixed(1) + ' min').padStart(14)}  ${r.totalHours.toFixed(2).padStart(8)}  ${fmt(r.hpMax).padStart(12)}  ${fmt(r.dps).padStart(12)}  ${r.oreRate.toFixed(2).padStart(9)}  ${(Math.round(r.golden * 100) + '%').padStart(7)}  ${r.weapon}${detour}`);
}

console.log('\nMarcos:');
for(const e of res.events) console.log(`  ${hrs(e.hours).padStart(8)}  ${e.text}`);

console.log(`\nOrçamento por andar (1ª passagem, ±${Math.round(sim.TOLERANCE * 100)}%):`);
console.log('andar       orçamento   simulado   situação');
for(const f of floors){
  if(f.stuck){ console.log(`${f.key.padEnd(10)} ${(f.budget != null ? hrs(f.budget) : '—').padStart(10)}  ${'—'.padStart(9)}   TRAVA`); continue; }
  const diff = f.pct != null ? ` (${f.pct >= 1 ? '+' : ''}${Math.round((f.pct - 1) * 100)}%)` : '';
  console.log(`${f.key.padEnd(10)} ${(f.budget != null ? hrs(f.budget) : '—').padStart(10)}  ${hrs(f.hours).padStart(9)}   ${f.status ? STATUS[f.status] : 'sem orçamento'}${diff}`);
}
const budgetTotal = DUNGEON_ORDER.reduce((s, k) => s + (MAPS[k].timeBudgetH || 0), 0);
console.log(`${'total'.padEnd(10)} ${hrs(budgetTotal).padStart(10)}  ${hrs(res.clock / 3600).padStart(9)}`);
process.exit(floors.some(f => f.status && f.status !== 'ok') ? 1 : 0);
