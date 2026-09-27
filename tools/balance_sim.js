/*
 * balance_sim.js — simulador de progressão (Node, sem dependências).
 *
 * Carrega o js/config.js DE VERDADE (e js/overrides-data.js, se houver) e
 * simula um jogador que:
 *   1. tenta o próximo ciclo (andar por andar): precisa matar cada monstro
 *      dentro do tempo dele (10s / 20s no chefe) e o ciclo inteiro dentro do
 *      tempo da Dungeon (30s + bônus do ramo Tempo);
 *   2. se não passa, farma o ciclo mais alto já vencido (clique manual +
 *      Clique Automático), vende os drops e compra o que mais aumenta o dano
 *      por moeda gasta (upgrades da Academia, tropas, armas);
 *   3. repete até passar — e registra quanto tempo de jogo levou.
 *
 * Uso:
 *   node tools/balance_sim.js            tabela por ciclo
 *   node tools/balance_sim.js --cps 4    cliques manuais por segundo (padrão 5)
 *   node tools/balance_sim.js --json     saída em JSON
 *
 * Simplificações (de propósito, pra ser um "jogador razoável", não ótimo):
 * sem monstro dourado, sem Caverna/Guilda, sem Ascensão; materiais das armas
 * forjadas considerados farmados junto; grupos (dupla/tripla) usam a 1ª opção.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? Number(process.argv[i + 1]) : def; };
const CPS = arg('cps', 5);                 // cliques manuais por segundo
const KILL_OVERHEAD = 0.35;                // s entre um monstro e outro (spawn/animação)
const MAX_HOURS = arg('max', 200);         // desiste depois disso (andar "impossível")

// ---------- carregar config ----------
const ctx = { window: {}, console, document: undefined };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf8') + `
;this.X = { CONFIG, MONSTER_TYPES, MAPS, DUNGEON_ORDER, ITEM_DEFS, WEAPON_DEFS, FORGED_WEAPON_DEFS, TROOP_DEFS, UPGRADE_DEFS, UPGRADE_STATS, MINERAL_DEFS, monsterHp };`, ctx);
const ovPath = path.join(ROOT, 'js/overrides-data.js');
if(fs.existsSync(ovPath)){
  vm.runInContext(fs.readFileSync(ovPath, 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/overrides.js'), 'utf8'), ctx);
}
const { CONFIG, MONSTER_TYPES, MAPS, DUNGEON_ORDER, ITEM_DEFS, WEAPON_DEFS, FORGED_WEAPON_DEFS, TROOP_DEFS, UPGRADE_DEFS, monsterHp } = ctx.X;
const item = k => ITEM_DEFS.find(i => i.key === k);
const mon = k => MONSTER_TYPES.find(m => m.key === k);

// ---------- vida (a MESMA função do jogo: monsterHp em js/config.js) ----------
const groupSize = slot => (!slot || !slot.pairChoices) ? 1 : Math.max(...slot.pairChoices.map(o => o.length));
const kpcOf = sched => sched.reduce((s, slot) => s + groupSize(slot), 0);
function cycleMonsters(dKey, cycle){
  const map = MAPS[dKey], cyclesMap = map.cycles || { 1: map.order };
  const total = Object.keys(cyclesMap).length, kpc = kpcOf(cyclesMap[1]);
  const sched = cyclesMap[((cycle - 1) % total) + 1];
  const list = []; let consumed = 0;
  sched.forEach((slot, i) => {
    const size = groupSize(slot), last = i === sched.length - 1;
    const keys = slot.pairChoices ? slot.pairChoices[0] : [slot];
    keys.forEach((k, sub) => {
      const killIdx = (cycle - 1) * kpc + consumed + sub;
      const boss = slot.pairChoices ? (last && sub === size - 1) : last;
      const extra = slot.pairChoices && slot.strong ? 1.5 : 1;
      const t = mon(k);
      const hp = monsterHp(dKey, cycle, killIdx % kpc, boss, (t.hpMult || 1) * extra);
      list.push({ key: k, hp, boss, limit: (boss ? CONFIG.bossTimeLimitMs : CONFIG.monsterTimeLimitMs) / 1000 });
    });
    consumed += size;
  });
  return list;
}
// moedas esperadas por abate (vendendo tudo)
function killValue(k){
  return (mon(k).drops || []).reduce((s, d) => s + (d.chance ?? 1) * (d.qtyMin + d.qtyMax) / 2 * (item(d.item) ? item(d.item).sellPrice : 0), 0);
}

// ---------- jogador ----------
function newPlayer(){
  const st = { gold: 0, upgrades: Object.fromEntries(UPGRADE_DEFS.map(u => [u.key, 0])), troops: Object.fromEntries(TROOP_DEFS.map(t => [t.key, 0])),
    weapons: { swordSimple: 1 }, equipped: 'swordSimple', stats: {} };
  recalc(st);
  return st;
}
function recalc(st){
  const s = { clickDamageFlat: 0, critChance: 0, clickDamagePercent: 0, critDamagePercent: 0, dpsSynergyRatio: 0, rareDropChanceBonus: 0, goldenChanceBonus: 0, dungeonTimeBonusMs: 0 };
  for(const u of UPGRADE_DEFS) for(let i = 0; i < st.upgrades[u.key]; i++) u.apply(s);
  st.stats = s;
}
const allWeapons = () => [...WEAPON_DEFS, ...FORGED_WEAPON_DEFS];
function clickDmg(st){
  const w = allWeapons().find(x => x.key === st.equipped);
  return (st.stats.clickDamageFlat + (w ? w.clickDamageBonus || 0 : 0)) * (1 + st.stats.clickDamagePercent);
}
function autoCps(st){
  if(!st.upgrades.battleAutoClick) return 0;
  let iv = 1000;
  for(const k of ['autoClickSpeed1', 'autoClickSpeed2', 'autoClickSpeed3']) if(st.upgrades[k]) iv -= 250;
  return 1000 / iv;
}
function dps(st, farming){
  const w = allWeapons().find(x => x.key === st.equipped);
  const crit = 1 + Math.min(0.75, st.stats.critChance) * (2 * (1 + st.stats.critDamagePercent) - 1);
  const cps = CPS + (farming ? autoCps(st) : 0);
  let troops = TROOP_DEFS.reduce((s, t) => s + t.dps * st.troops[t.key], 0) + (w ? w.dpsBonus || 0 : 0);
  troops += clickDmg(st) * st.stats.dpsSynergyRatio;
  return clickDmg(st) * cps * crit + troops;
}
const dungeonTime = st => (CONFIG.dungeonTimeLimitMs + st.stats.dungeonTimeBonusMs) / 1000;
// tempo pra vencer o ciclo (null = não passa)
function clearTime(st, list, farming){
  const d = dps(st, farming);
  let t = 0;
  for(const m of list){
    const tk = m.hp / d;
    if(tk > m.limit) return null;
    t += tk + KILL_OVERHEAD;
  }
  return t <= dungeonTime(st) ? t : null;
}

// entrada parcial: mata em ordem o que der dentro dos limites (por monstro e
// da Dungeon) e fica com o loot — é assim que o começo do jogo funciona
function partialRun(st, list){
  const d = dps(st, false); let t = 0, value = 0;
  for(const m of list){
    const tk = m.hp / d;
    if(tk > m.limit || t + tk > dungeonTime(st)) break;
    t += tk + KILL_OVERHEAD; value += killValue(m.key);
  }
  return { time: Math.max(t, 1), value };
}

// ---------- compras ----------
function options(st, reachedDungeon){
  const out = [];
  for(const u of UPGRADE_DEFS){
    const lvl = st.upgrades[u.key];
    if(lvl >= u.maxLevel) continue;
    if(u.requires){ const r = UPGRADE_DEFS.find(x => x.key === u.requires); if(st.upgrades[r.key] < r.maxLevel) continue; }
    out.push({ kind: 'up', key: u.key, cost: Math.ceil(u.baseCost * Math.pow(u.costGrowth, lvl)), apply: s => { s.upgrades[u.key]++; recalc(s); } });
  }
  for(const t of TROOP_DEFS){
    out.push({ kind: 'troop', key: t.key, cost: Math.ceil(t.baseCost * Math.pow(t.costGrowth, st.troops[t.key])), apply: s => { s.troops[t.key]++; } });
  }
  for(const w of WEAPON_DEFS) if(!st.weapons[w.key]) out.push({ kind: 'weapon', key: w.key, cost: w.buyCost, apply: s => { s.weapons[w.key] = 1; } });
  // armas forjadas: só depois de vencer o Pântano (materiais de slime)
  if(reachedDungeon > 0) for(const w of FORGED_WEAPON_DEFS) if(!st.weapons[w.key]) out.push({ kind: 'weapon', key: w.key, cost: w.recipe.coinCost * 3, apply: s => { s.weapons[w.key] = 1; } });
  return out;
}
function equipBest(st){
  let best = st.equipped, bestD = -1;
  for(const k of Object.keys(st.weapons)){ const prev = st.equipped; st.equipped = k; const d = dps(st, false); if(d > bestD){ bestD = d; best = k; } st.equipped = prev; }
  st.equipped = best;
}
// compra a opção com melhor ganho de DPS (ou de tempo) por moeda, se couber no bolso
function buyBest(st, reachedDungeon){
  const base = dps(st, false);
  let best = null, bestScore = 0;
  for(const o of options(st, reachedDungeon)){
    if(o.cost > st.gold) continue;
    const copy = JSON.parse(JSON.stringify(st)); o.apply(copy); recalc(copy); equipBest(copy);
    let gain = dps(copy, false) - base;
    if(o.key === 'dungeonTime' || o.key === 'dungeonTime2') gain = base * 0.15;          // mais tempo vale como ~15% de DPS
    if(o.key.startsWith('autoClick') || o.key === 'battleAutoClick') gain = base * 0.05;  // ajuda o farm
    const score = gain / o.cost;
    if(score > bestScore){ bestScore = score; best = o; }
  }
  if(!best) return false;
  st.gold -= best.cost; best.apply(st); recalc(st); equipBest(st);
  return true;
}

// ---------- simulação ----------
function run(stopAfter = DUNGEON_ORDER.length - 1){
  const st = newPlayer();
  let clock = 0; // segundos de jogo
  const rows = [];
  let lastCleared = null; // { list, value }
  for(let di = 0; di <= stopAfter; di++){
    const dKey = DUNGEON_ORDER[di];
    for(let c = 1; c <= CONFIG.maxCycleNum; c++){
      const list = cycleMonsters(dKey, c);
      const value = list.reduce((s, m) => s + killValue(m.key), 0);
      const start = clock;
      let farmRuns = 0;
      while(clearTime(st, list, false) === null){
        while(buyBest(st, di)){}
        if(clearTime(st, list, false) !== null) break;
        if(!lastCleared){ // nada vencido ainda: entradas parciais no próprio ciclo
          const pr = partialRun(st, list);
          if(!pr.value){ rows.push({ dungeon: dKey, cycle: c, stuck: true, softlock: true, hpMax: list[0].hp, dps: dps(st, false) }); return { rows, st, clock }; }
          clock += pr.time; st.gold += pr.value; farmRuns++;
        } else {
          const t = clearTime(st, lastCleared.list, true) || dungeonTime(st);
          clock += t; st.gold += lastCleared.value; farmRuns++;
        }
        if(clock - start > MAX_HOURS * 3600){
          rows.push({ dungeon: dKey, cycle: c, stuck: true, hpMax: Math.max(...list.map(m => m.hp)), dps: dps(st, false) });
          return { rows, st, clock };
        }
      }
      const t = clearTime(st, list, false);
      clock += t; st.gold += value;
      lastCleared = { list, value };
      rows.push({ dungeon: dKey, cycle: c, minutes: (clock - start) / 60, totalHours: clock / 3600, farmRuns,
        hpMax: Math.max(...list.map(m => m.hp)), hpSum: list.reduce((s, m) => s + m.hp, 0), dps: dps(st, false), clickDmg: clickDmg(st), weapon: st.equipped });
    }
  }
  return { rows, st, clock };
}

// --calibrar: acha o MAIOR hpScale de cada andar em que nenhum ciclo exige
// mais que o teto de minutos de farm (andar por andar, em ordem) — assim a
// dificuldade sobe sem paredões.
if(process.argv.includes('--calibrar')){
  const target = { slimes: 10, goblins: 18, wilds: 25, dragons: 30, demons: 35 };
  // o Pântano fica fixo (definido no config): o 1º slime precisa morrer em
  // 10s com o dano inicial (1 por clique) — ver checagem de softlock
  for(let di = 1; di < DUNGEON_ORDER.length; di++){
    const key = DUNGEON_ORDER[di];
    let lo = Math.log(0.05), hi = Math.log(1e9);
    for(let it = 0; it < 32; it++){
      const mid = (lo + hi) / 2;
      MAPS[key].hpScale = Math.exp(mid);
      const r = run(di);
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
const res = run();
if(process.argv.includes('--json')){ console.log(JSON.stringify(res.rows)); process.exit(0); }
const fmt = n => n >= 1e6 ? n.toExponential(2) : Math.round(n).toLocaleString('pt-BR');
console.log(`cliques/s: ${CPS} | tempo da dungeon base: ${CONFIG.dungeonTimeLimitMs / 1000}s | hpCycleGrowth ${CONFIG.hpCycleGrowth} | hpKillGrowth ${CONFIG.hpKillGrowth}`);
console.log('andar      ciclo  tempo p/ passar   total(h)  vida máx          vida do ciclo     DPS jogador   arma');
for(const r of res.rows){
  if(r.softlock){ console.log(`${r.dungeon.padEnd(10)} ${String(r.cycle).padStart(5)}  TRAVA NO INÍCIO: o 1º monstro (vida ${fmt(r.hpMax)}) não morre no tempo com o dano inicial`); continue; }
  if(r.stuck){ console.log(`${r.dungeon.padEnd(10)} ${String(r.cycle).padStart(5)}  TRAVOU (> ${MAX_HOURS}h farmando)  vida máx ${fmt(r.hpMax)}  DPS ${fmt(r.dps)}`); continue; }
  console.log(`${r.dungeon.padEnd(10)} ${String(r.cycle).padStart(5)}  ${(r.minutes.toFixed(1) + ' min').padStart(14)}  ${r.totalHours.toFixed(2).padStart(8)}  ${fmt(r.hpMax).padStart(16)}  ${fmt(r.hpSum).padStart(16)}  ${fmt(r.dps).padStart(12)}   ${r.weapon}`);
}
