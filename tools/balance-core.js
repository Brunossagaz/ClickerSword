/*
 * balance-core.js — núcleo do simulador de balanceamento, sem dependências.
 * Funciona no Node (tools/balance_sim.js) e no navegador (aba Curvas do
 * Compêndio, que roda de novo a cada valor editado).
 *
 * createBalanceSim(G, opts) recebe os dados do jogo (os mesmos objetos de
 * js/config.js: CONFIG, MONSTER_TYPES, MAPS, ...) e devolve:
 *   run(stopAfter)        simula a progressão (ver comentário em run)
 *   floorTimes(res)       horas gastas em cada andar × orçamento (MAPS[k].timeBudgetH)
 *   cycleMonsters(d, c)   monstros de um ciclo com vida e tempo limite
 *   killValue(key)        moedas esperadas por abate (vendendo os drops)
 *   oreValue(luckLvl)     moedas esperadas por minério da Caverna
 *   dungeonIncome(d)      moedas/s farmando o ciclo 1 de um andar (30s)
 *   troopCurve(n)         custo e custo por DPS da n-ésima unidade de cada tropa
 *   cavernCurve(n)        custo e tempo pra se pagar da n-ésima unidade de cada minerador
 *
 * O jogador simulado ("razoável", não ótimo) joga como o jogo exige:
 *   - prédios liberam na mesma ordem do jogo: Academia na 5ª entrada,
 *     Ferreiro/Guilda/Caverna pelas missões de QUEST_DEFS (ele entrega os
 *     itens assim que tem, e compra a 2ª arma simples se a missão pedir);
 *   - drops viram ITENS no inventário: ele guarda os materiais da próxima
 *     arma forjada e das missões pendentes e vende o resto na Loja;
 *   - forja só com a receita completa (drops de chefe, gel e minério). Se
 *     faltar drop de um andar antigo, volta pra farmar o ciclo que mais
 *     rende aquele item — quando isso dá mais dano por segundo de jogo do
 *     que continuar farmando moeda;
 *   - Caverna: compra minerador/upgrade que se pague em até
 *     opts.cavernPaybackMin minutos (padrão 30); minério sai pelos pesos
 *     reais (com Faro de Minérios) enquanto ele joga;
 *   - monstro dourado: fração do tempo dourado (chance por tick) multiplica
 *     os drops; Faro de Caçador soma nas chances raras; extraDropChance da arma;
 *   - Habilidades Arcanas: pontos por ciclo vencido, gastos no que mais
 *     aumenta o dano (Gelo também estica os relógios);
 *   - Expedições da Guilda só entram se CONFIG.guildExpeditionsEnabled.
 * Fora do modelo: ganho offline, Ascensão, queimadura das armas, grupos
 * (dupla/tripla usam a 1ª opção).
 *
 * opts: cps, maxHours, cavernPaybackMin, budgetTolerance (0.2 = ±20%),
 *   seed (número = sorteia drops/minério em vez de usar a média — pra medir
 *   variância, ex. do Cristal Arcano), disable (lista: 'caverna', 'dourado',
 *   'arcano', 'forja', 'missoes', 'guilda' — pra medir o peso de cada sistema).
 */
(function(root){
  function mulberry32(a){
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function poisson(rng, lambda){
    if(lambda <= 0) return 0;
    if(lambda > 30){
      const z = Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
      return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * z));
    }
    const L = Math.exp(-lambda); let k = 0, p = 1;
    do { k++; p *= rng(); } while(p > L);
    return k - 1;
  }

  function createBalanceSim(G, opts){
    opts = opts || {};
    const { CONFIG, MONSTER_TYPES, MAPS, DUNGEON_ORDER, ITEM_DEFS, WEAPON_DEFS, FORGED_WEAPON_DEFS, TROOP_DEFS, UPGRADE_DEFS, monsterHp } = G;
    const PROSPECTOR_DEFS = G.PROSPECTOR_DEFS || [], CAVERN_UPGRADE_DEFS = G.CAVERN_UPGRADE_DEFS || [];
    const ARCANE = G.ARCANE_SKILL_DEFS || [], QUESTS = G.QUEST_DEFS || [], EXPEDITIONS = G.GUILD_EXPEDITION_DEFS || [];
    const off = new Set(opts.disable || []);
    const CPS = opts.cps || CONFIG.balanceRefCps || 5; // cliques manuais por segundo
    const KILL_OVERHEAD = 0.35;                // s entre um monstro e outro
    const MAX_HOURS = opts.maxHours || 200;    // desiste depois disso (andar "impossível")
    const PAYBACK_MIN = opts.cavernPaybackMin || 30;
    const TOLERANCE = opts.budgetTolerance != null ? opts.budgetTolerance : 0.2;
    const rng = opts.seed != null ? mulberry32(opts.seed) : null;
    const itemMap = Object.fromEntries(ITEM_DEFS.map(i => [i.key, i]));
    const monMap = Object.fromEntries(MONSTER_TYPES.map(m => [m.key, m]));
    const item = k => itemMap[k];
    const mon = k => monMap[k];
    const MINERALS = ITEM_DEFS.filter(d => d.type === 'mineral');
    const allWeapons = [...WEAPON_DEFS, ...FORGED_WEAPON_DEFS];
    const weaponMap = Object.fromEntries(allWeapons.map(w => [w.key, w]));
    const clone = o => JSON.parse(JSON.stringify(o, (k, v) => k[0] === '_' ? undefined : v));

    // ---------- vida (a MESMA função do jogo: monsterHp em js/config.js) ----------
    const groupSize = slot => (!slot || !slot.pairChoices) ? 1 : Math.max(...slot.pairChoices.map(o => o.length));
    const kpcOf = sched => sched.reduce((s, slot) => s + groupSize(slot), 0);
    const cycleCache = {};
    function cycleMonsters(dKey, cycle){
      const ck = dKey + '|' + cycle;
      if(cycleCache[ck]) return cycleCache[ck];
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
      return (cycleCache[ck] = list);
    }
    function killValue(k){
      return (mon(k).drops || []).reduce((s, d) => s + (d.chance == null ? 1 : d.chance) * (d.qtyMin + d.qtyMax) / 2 * (item(d.item) ? item(d.item).sellPrice : 0), 0);
    }
    // DPS mínimo pra vencer um ciclo: o maior entre "cada monstro no seu
    // tempo" e "o ciclo inteiro dentro do tempo da Dungeon" (sem bônus)
    function requiredDps(list, bonusMs){
      const time = (CONFIG.dungeonTimeLimitMs + (bonusMs || 0)) / 1000 - KILL_OVERHEAD * list.length;
      const perMonster = Math.max(...list.map(m => m.hp / m.limit));
      const whole = list.reduce((s, m) => s + m.hp, 0) / Math.max(1, time);
      return Math.max(perMonster, whole);
    }

    // ---------- jogador ----------
    function recalc(st){
      const s = { clickDamageFlat: 0, critChance: 0, clickDamagePercent: 0, critDamagePercent: 0, dpsSynergyRatio: 0, rareDropChanceBonus: 0, goldenChanceBonus: 0, dungeonTimeBonusMs: 0 };
      for(const u of UPGRADE_DEFS) for(let i = 0; i < Math.min(u.maxLevel, st.upgrades[u.key]); i++) u.apply(s);
      st.stats = s;
    }
    function newPlayer(){
      const st = {
        gold: 0, inv: {}, clock: 0, entries: 0, cyclesDone: 0,
        upgrades: Object.fromEntries(UPGRADE_DEFS.map(u => [u.key, 0])),
        troops: Object.fromEntries(TROOP_DEFS.map(t => [t.key, 0])),
        weapons: { [WEAPON_DEFS[0].key]: 1 }, equipped: WEAPON_DEFS[0].key, stats: {},
        prospectors: Object.fromEntries(PROSPECTOR_DEFS.map(p => [p.key, 0])),
        cavernUpgrades: Object.fromEntries(CAVERN_UPGRADE_DEFS.map(u => [u.key, 0])),
        arcane: {}, quests: {}, maxCycle: Object.fromEntries(DUNGEON_ORDER.map(k => [k, 0])),
        events: [],
      };
      recalc(st);
      return st;
    }
    const mark = (st, text) => st.events.push({ hours: st.clock / 3600, text });

    // ---------- prédios e missões (mesma regra de OnboardingModule.isBuildingUnlocked) ----------
    function isOpen(st, building){
      if(building === 'academia') return st.entries >= (CONFIG.academiaUnlockEntries || 0);
      if(off.has('missoes')) return true;
      const q = QUESTS.find(x => x.unlocksBuilding === building);
      return !q || !!st.quests[q.key];
    }
    function isDungeonUnlocked(st, dKey){
      const req = MAPS[dKey] && MAPS[dKey].unlockRequirement;
      return !req || (st.maxCycle[req.dungeon] || 0) >= req.cycle;
    }
    // capítulos concluídos (andares vencidos em sequência) = state.story.chapter
    const chapterOf = st => { let c = 0; while(c < DUNGEON_ORDER.length && (st.maxCycle[DUNGEON_ORDER[c]] || 0) >= CONFIG.maxCycleNum) c++; return c; };
    function objectiveDone(st, obj){
      if(obj.type === 'deliverItem') return (st.inv[obj.itemKey] || 0) >= obj.itemQty;
      if(obj.type === 'defeatCycle') return st.cyclesDone >= obj.count;
      if(obj.type === 'ownWeapons') return WEAPON_DEFS.filter(d => st.weapons[d.key]).length >= obj.count;
      // abates pedidos e visitas a pontos do mapa: saem jogando normalmente
      // (o farm do andar já mata o monstro pedido; a visita é um clique)
      return true;
    }
    function tryQuests(st){
      if(off.has('missoes')) return;
      for(const q of QUESTS){
        if(st.quests[q.key]) continue;
        if(q.requiresChapter != null && chapterOf(st) < q.requiresChapter) continue; // bruxa só pede depois do capítulo
        // a 2ª arma simples da missão do Creiton: compra assim que puder
        for(const obj of q.objectives) if(obj.type === 'ownWeapons' && !objectiveDone(st, obj) && isOpen(st, 'ferreiro')){
          const w = WEAPON_DEFS.filter(d => !st.weapons[d.key] && !d.custom).sort((a, b) => (a.buyCost || 0) - (b.buyCost || 0))[0];
          if(w && st.gold >= (w.buyCost || 0)){ st.gold -= w.buyCost || 0; st.weapons[w.key] = 1; }
        }
        if(!q.objectives.every(obj => objectiveDone(st, obj))) continue;
        for(const obj of q.objectives) if(obj.type === 'deliverItem') st.inv[obj.itemKey] -= obj.itemQty;
        st.quests[q.key] = true;
        if(q.reward){
          st.gold += q.reward.gold || 0;
          for(const [k, n] of Object.entries(q.reward.items || {})) st.inv[k] = (st.inv[k] || 0) + n;
        }
        mark(st, `missão ${q.key}${q.unlocksBuilding ? ' → libera ' + q.unlocksBuilding : ''}`);
      }
    }

    // ---------- dano ----------
    const weaponOf = st => weaponMap[st.equipped];
    function clickDmg(st){
      const w = weaponOf(st);
      return (st.stats.clickDamageFlat + (w ? w.clickDamageBonus || 0 : 0)) * (1 + st.stats.clickDamagePercent);
    }
    function autoCps(st){
      if(!st.upgrades.battleAutoClick) return 0;
      let iv = 1000;
      for(const k of ['autoClickSpeed1', 'autoClickSpeed2', 'autoClickSpeed3']) if(st.upgrades[k]) iv -= 250;
      return 1000 / iv;
    }
    function troopDps(st){
      if(!isOpen(st, 'guilda')) return 0;
      const w = weaponOf(st);
      return TROOP_DEFS.reduce((s, t) => s + t.dps * st.troops[t.key], 0) + (w ? w.dpsBonus || 0 : 0) + clickDmg(st) * st.stats.dpsSynergyRatio;
    }
    function critMult(st){
      const w = weaponOf(st);
      const chance = Math.min(0.75, st.stats.critChance + ((w && w.critChanceBonus) || 0));
      return 1 + chance * (2 * (1 + st.stats.critDamagePercent + ((w && w.critDamageBonus) || 0)) - 1);
    }
    // Habilidades Arcanas (ver ArcaneModule): Fogo e Elétrico somam dano
    // proporcional ao clique; Gelo multiplica o dano recebido e desacelera os
    // relógios durante a fração do tempo em que o monstro está congelado.
    function arcaneFx(st){
      const fx = { add: 0, mult: 1, time: 1 };
      if(off.has('arcano')) return fx;
      const click = Math.max(1, clickDmg(st));
      for(const def of ARCANE){
        if(!st.arcane[def.key]) continue;
        const iv = Math.max(def.minIntervalMs, def.intervalMs * Math.pow(def.speedStep, st.arcane[def.key + 'Spd'] || 0)) / 1000;
        const raw = def.dmgBase + def.dmgPerLevel * (st.arcane[def.key + 'Dmg'] || 0);
        const power = def.maxPower != null ? Math.min(def.maxPower, raw) : raw;
        if(def.key === 'fire') fx.add += click * power / Math.max(iv, def.durationMs / 1000); // reaplicar renova, não empilha
        else if(def.key === 'lightning') fx.add += click * power / iv;
        else if(def.key === 'ice'){
          const frozen = Math.min(1, def.durationMs / 1000 / iv);
          fx.mult *= 1 + power * frozen;
          fx.time *= 1 / (1 - frozen * (1 - def.slowFactor));
        }
      }
      return fx;
    }
    // queimadura da arma (burnChance/burnDamagePercent): cada clique com
    // sorte reaplica (não empilha) `pct` do dano do clique ao longo de
    // CONFIG.burnDurationMs — reaplicar antes do fim perde o resto
    function weaponBurnDps(st, cps){
      const w = weaponOf(st);
      if(!w || !w.burnChance || !w.burnDamagePercent) return 0;
      const dur = (CONFIG.burnDurationMs || 3000) / 1000;
      return clickDmg(st) * critMult(st) * w.burnDamagePercent * Math.min(cps * w.burnChance, 1 / dur);
    }
    function dps(st, farming){
      const fx = arcaneFx(st);
      const cps = CPS + (farming ? autoCps(st) : 0);
      return (clickDmg(st) * cps * critMult(st) + weaponBurnDps(st, cps) + troopDps(st) + fx.add) * fx.mult;
    }
    const timeMult = st => arcaneFx(st).time;
    // dano "efetivo" pra comparar compras: Gelo estica o tempo, que vale como dano
    const effDps = st => dps(st, false) * timeMult(st);
    const dungeonTime = st => (CONFIG.dungeonTimeLimitMs + st.stats.dungeonTimeBonusMs) / 1000;
    function clearTime(st, list, farming){
      const d = dps(st, farming), tm = timeMult(st);
      let t = 0;
      for(const m of list){
        const tk = m.hp / d;
        if(tk > m.limit * tm) return null;
        t += tk + KILL_OVERHEAD;
      }
      return t <= dungeonTime(st) * tm ? t : null;
    }
    function partialRun(st, list){
      const d = dps(st, false), tm = timeMult(st);
      let t = 0; const killed = [];
      for(const m of list){
        const tk = m.hp / d;
        if(tk > m.limit * tm || t + tk > dungeonTime(st) * tm) break;
        t += tk + KILL_OVERHEAD; killed.push(m);
      }
      return { time: Math.max(t, 1), killed };
    }

    // ---------- drops, minério e venda ----------
    function goldenFrac(st){
      if(off.has('dourado') || !st.upgrades.battleGoldenChance) return 0;
      const p = CONFIG.goldenChancePerTick + (st.stats.goldenChanceBonus || 0);
      const n = CONFIG.goldenDurationMs / CONFIG.tickMs; // ticks que um dourado dura
      return n * p / (1 + n * p);
    }
    function runGains(st, list){
      const gm = 1 + goldenFrac(st) * ((CONFIG.goldenRewardMult || 1) - 1);
      const w = weaponOf(st), extra = 1 + ((w && w.extraDropChance) || 0);
      const out = {};
      for(const m of list) for(const d of (mon(m.key).drops || [])){
        const chance = d.chance == null ? 1 : Math.min(1, d.chance + st.stats.rareDropChanceBonus);
        out[d.item] = (out[d.item] || 0) + chance * (d.qtyMin + d.qtyMax) / 2 * gm * extra;
      }
      return out;
    }
    const valueOf = gains => Object.keys(gains).reduce((s, k) => s + gains[k] * (item(k) ? item(k).sellPrice : 0), 0);
    function addGains(st, gains){
      for(const k of Object.keys(gains)) st.inv[k] = (st.inv[k] || 0) + (rng ? poisson(rng, gains[k]) : gains[k]);
    }
    function mineralDist(luckLvl){
      const luckDef = CAVERN_UPGRADE_DEFS.find(u => u.key === 'oreLuck');
      const luck = (luckLvl || 0) * ((luckDef && luckDef.pct) || 0.10);
      const w = MINERALS.map(d => d.rarity === 'comum' ? d.weight : d.weight * (1 + luck));
      const tw = w.reduce((a, b) => a + b, 0) || 1;
      return Object.fromEntries(MINERALS.map((d, i) => [d.key, w[i] / tw]));
    }
    function oreValue(luckLvl){
      const dist = mineralDist(luckLvl);
      return MINERALS.reduce((s, d) => s + dist[d.key] * d.sellPrice, 0);
    }
    function baseOreRate(st){
      return PROSPECTOR_DEFS.reduce((s, p) => s + p.orePerSec * st.prospectors[p.key], 0);
    }
    function oreRate(st){
      if(off.has('caverna') || !isOpen(st, 'caverna')) return 0;
      const rate = CAVERN_UPGRADE_DEFS.find(u => u.key === 'oreRatePct');
      return baseOreRate(st) * (1 + (st.cavernUpgrades.oreRatePct || 0) * ((rate && rate.pct) || 0.10));
    }
    function guildItemsPerSec(st){
      if(off.has('guilda') || !CONFIG.guildExpeditionsEnabled || !isOpen(st, 'guilda')) return 0;
      const exp = EXPEDITIONS.filter(e => e.hours <= (opts.sessionHours || 4)).sort((a, b) => b.rateMult - a.rateMult)[0];
      const power = TROOP_DEFS.reduce((s, t) => s + t.dps * st.troops[t.key], 0);
      return (CONFIG.guildItemsPerHourPerPower || 0) * power * (exp ? exp.rateMult : 1) / 3600;
    }
    // o que rende sozinho enquanto ele joga dt segundos (Caverna e Expedições)
    function passive(st, dt){
      const gains = {};
      const ore = oreRate(st) * dt;
      if(ore > 0){ const dist = mineralDist(st.cavernUpgrades.oreLuck); for(const k of Object.keys(dist)) gains[k] = ore * dist[k]; }
      const gi = guildItemsPerSec(st) * dt;
      if(gi > 0){
        const pool = ITEM_DEFS.filter(d => d.type === 'material' && d.dungeon && isDungeonUnlocked(st, d.dungeon));
        const tw = pool.reduce((s, d) => s + (d.weight || 0), 0) || 1;
        for(const d of pool) gains[d.key] = (gains[d.key] || 0) + gi * (d.weight || 0) / tw;
      }
      addGains(st, gains);
    }
    // armas que dá pra mirar agora: não possui, pré-requisito ok, andar liberado
    function forgeCandidates(st){
      if(off.has('forja')) return [];
      return FORGED_WEAPON_DEFS.filter(w => !st.weapons[w.key] && (!w.requiresWeapon || st.weapons[w.requiresWeapon])
        && (!w.floor || !MAPS[w.floor] || isDungeonUnlocked(st, w.floor)));
    }
    // Quanto falta pra forjar `w`: tempo estimado (s) pra juntar os drops
    // (no melhor ciclo já vencido), esperar o minério da Caverna e as moedas.
    // null = hoje não tem de onde tirar algum material.
    function planFor(st, w){
      const farmList = st.farm ? cycleMonsters(st.farm.d, st.farm.c) : null;
      let tDrops = 0, oreWait = 0, src = null, srcT = 0;
      for(const m of w.recipe.materials || []){
        const miss = m.qty - (st.inv[m.itemKey] || 0);
        if(miss <= 0) continue;
        if(item(m.itemKey) && item(m.itemKey).type === 'mineral'){
          const r = oreRate(st) * (mineralDist(st.cavernUpgrades.oreLuck)[m.itemKey] || 0);
          if(r <= 0) return null;
          oreWait = Math.max(oreWait, miss / r);
          continue;
        }
        const sr = bestSource(st, m.itemKey);
        if(!sr) return null;
        const t = miss / sr.rate;
        tDrops += t;
        if(!src || t > srcT){ src = sr; srcT = t; }
      }
      const inc = income(st, farmList);
      const T = Math.max(tDrops, oreWait) + Math.max(0, (w.recipe.coinCost || 0) - st.gold) / Math.max(1e-9, inc);
      return { T: Math.max(1, T), src };
    }
    // A próxima forja que ele persegue: a de maior ganho de dano por tempo
    // pra conseguir (armas do mesmo andar são alternativas — fica com a
    // melhor pro estilo dele). Cache por instante do relógio.
    function nextForge(st){
      if(st._forgeAt === st.clock && st._forgeCache !== undefined) return st._forgeCache;
      let best = null, bestRate = 0, bestPlan = null;
      const base = effDps(st);
      for(const w of forgeCandidates(st)){
        const copy = clone(st); copy.weapons[w.key] = 1; equipBest(copy);
        const g = (effDps(copy) - base) / Math.max(1e-9, base);
        if(g <= 0.02) continue; // menos de 2%: não vale o trabalho
        const plan = planFor(st, w);
        if(!plan) continue;
        const rate = g / plan.T;
        if(rate > bestRate){ bestRate = rate; best = w; bestPlan = plan; }
      }
      st._forgeAt = st.clock; st._forgeCache = best; st._forgePlan = bestPlan;
      return best;
    }
    // itens que ele NÃO vende: entregas de missão pendentes + receita da próxima forja
    function reserve(st){
      const r = {};
      if(!off.has('missoes')) for(const q of QUESTS) if(!st.quests[q.key] && !(q.requiresChapter != null && chapterOf(st) < q.requiresChapter))
        for(const obj of q.objectives) if(obj.type === 'deliverItem') r[obj.itemKey] = (r[obj.itemKey] || 0) + obj.itemQty;
      const W = isOpen(st, 'ferreiro') ? nextForge(st) : null;
      if(W) for(const m of W.recipe.materials || []) r[m.itemKey] = (r[m.itemKey] || 0) + m.qty;
      return r;
    }
    function sell(st){
      const r = reserve(st);
      for(const k of Object.keys(st.inv)){
        const extra = st.inv[k] - (r[k] || 0);
        if(extra > 0 && item(k)){ st.gold += extra * item(k).sellPrice; st.inv[k] -= extra; }
      }
    }
    // moedas/s farmando `list` (vendendo tudo) — mede o que aumenta a renda
    function income(st, list){
      if(!list) return 1;
      const t = clearTime(st, list, true);
      return t ? valueOf(runGains(st, list)) / t : 1;
    }

    // ---------- compras ----------
    function canForge(st, w){
      if(!isOpen(st, 'ferreiro') || (w.requiresWeapon && !st.weapons[w.requiresWeapon])) return false;
      return (w.recipe.materials || []).every(m => (st.inv[m.itemKey] || 0) >= m.qty);
    }
    function forgeApply(w){
      return s => { for(const m of w.recipe.materials || []) s.inv[m.itemKey] -= m.qty; s.weapons[w.key] = 1; mark(s, 'forjou ' + w.key); };
    }
    function options(st){
      const out = [];
      if(isOpen(st, 'academia')) for(const u of UPGRADE_DEFS){
        const lvl = st.upgrades[u.key];
        if(lvl >= u.maxLevel) continue;
        if(u.requires){ const r = UPGRADE_DEFS.find(x => x.key === u.requires); if(r && st.upgrades[r.key] < r.maxLevel) continue; }
        out.push({ key: u.key, cost: Math.ceil(u.baseCost * Math.pow(u.costGrowth, lvl)), apply: s => { s.upgrades[u.key]++; } });
      }
      if(isOpen(st, 'guilda')) for(const t of TROOP_DEFS) out.push({ key: t.key, cost: Math.ceil(t.baseCost * Math.pow(t.costGrowth, st.troops[t.key])), apply: s => { s.troops[t.key]++; } });
      if(isOpen(st, 'ferreiro')){
        for(const w of WEAPON_DEFS) if(!st.weapons[w.key] && !w.custom) out.push({ key: w.key, cost: w.buyCost || 0, apply: s => { s.weapons[w.key] = 1; } });
        if(off.has('forja')){
          // modo antigo: material das forjadas = 3x as moedas da receita
          for(const w of FORGED_WEAPON_DEFS) if(!st.weapons[w.key] && (!w.requiresWeapon || st.weapons[w.requiresWeapon]))
            out.push({ key: w.key, cost: (w.recipe.coinCost || 0) * 3, apply: s => { s.weapons[w.key] = 1; } });
        } else {
          const W = nextForge(st);
          if(W && canForge(st, W)) out.push({ key: W.key, cost: W.recipe.coinCost || 0, apply: forgeApply(W), forge: true });
        }
      }
      return out;
    }
    function equipBest(st){
      let best = st.equipped, bestD = -1;
      for(const k of Object.keys(st.weapons)){ const prev = st.equipped; st.equipped = k; const d = effDps(st); if(d > bestD){ bestD = d; best = k; } st.equipped = prev; }
      st.equipped = best;
    }
    // ganho relativo de dano + ganho relativo de renda (dourado, Faro de
    // Caçador, Clique Automático) — os dois aceleram o jogo na mesma medida
    function gainOf(st, o, farmList, base){
      const copy = clone(st); o.apply(copy); recalc(copy); equipBest(copy);
      let rel = (effDps(copy) - base.dps) / Math.max(1e-9, base.dps);
      if(farmList) rel += (income(copy, farmList) - base.inc) / Math.max(1e-9, base.inc);
      if(o.key === 'dungeonTime' || o.key === 'dungeonTime2') rel += 0.15;
      return rel;
    }
    function bestOption(st, farmList, affordableOnly){
      const base = { dps: effDps(st), inc: income(st, farmList) };
      let best = null, bestScore = 0;
      for(const o of options(st)){
        if(affordableOnly && o.cost > st.gold) continue;
        const score = gainOf(st, o, farmList, base) / Math.max(1, o.cost);
        if(score > bestScore){ bestScore = score; best = o; }
      }
      return { best, bestScore };
    }
    function buyBest(st, farmList){
      const { best } = bestOption(st, farmList, true);
      if(!best) return false;
      st.gold -= best.cost; best.apply(st); recalc(st); equipBest(st);
      return true;
    }
    // Caverna: compra o que se paga em até PAYBACK_MIN minutos (moeda/s de minério)
    function buyCavern(st){
      if(off.has('caverna') || !isOpen(st, 'caverna')) return;
      for(;;){
        const ov = oreValue(st.cavernUpgrades.oreLuck), rate = oreRate(st);
        const rateDef = CAVERN_UPGRADE_DEFS.find(u => u.key === 'oreRatePct');
        const rateMult = 1 + (st.cavernUpgrades.oreRatePct || 0) * ((rateDef && rateDef.pct) || 0.10);
        const opts2 = [];
        for(const p of PROSPECTOR_DEFS){
          if(p.requiresDungeon && MAPS[p.requiresDungeon] && !isDungeonUnlocked(st, p.requiresDungeon)) continue;
          opts2.push({ cost: Math.ceil(p.baseCost * Math.pow(p.costGrowth, st.prospectors[p.key])), gps: p.orePerSec * rateMult * ov, apply: () => { st.prospectors[p.key]++; } });
        }
        for(const u of CAVERN_UPGRADE_DEFS){
          const lvl = st.cavernUpgrades[u.key];
          if(lvl >= u.maxLevel) continue;
          const gps = u.key === 'oreRatePct' ? baseOreRate(st) * u.pct * ov
            : u.key === 'oreLuck' ? rate * (oreValue(lvl + 1) - ov) : 0;
          opts2.push({ cost: Math.ceil(u.baseCost * Math.pow(u.costGrowth, lvl)), gps, apply: () => { st.cavernUpgrades[u.key]++; } });
        }
        const pick = opts2.filter(o => o.gps > 0 && o.cost <= st.gold && o.cost / o.gps / 60 <= PAYBACK_MIN)
          .sort((a, b) => a.cost / a.gps - b.cost / b.gps)[0];
        if(!pick) return;
        st.gold -= pick.cost; pick.apply();
      }
    }
    function arcaneOpen(st){
      return !off.has('arcano') && ARCANE.length && CONFIG.arcaneUnlockDungeon && (st.maxCycle[CONFIG.arcaneUnlockDungeon] || 0) >= CONFIG.maxCycleNum;
    }
    function spendArcane(st){
      if(!arcaneOpen(st)) return;
      const cost = CONFIG.arcanePointCost || 1;
      for(;;){
        const earned = DUNGEON_ORDER.reduce((s, k) => s + Math.min(CONFIG.maxCycleNum, st.maxCycle[k] || 0), 0);
        const spent = Object.values(st.arcane).reduce((a, b) => a + b, 0) * cost;
        if(earned - spent < cost) return;
        const base = effDps(st);
        let best = null, bestGain = 0;
        for(const def of ARCANE){
          const keys = st.arcane[def.key] ? [def.key + 'Dmg', def.key + 'Spd'] : [def.key];
          for(const k of keys){
            const copy = clone(st); copy.arcane[k] = (copy.arcane[k] || 0) + 1;
            const g = effDps(copy) - base;
            if(g > bestGain){ bestGain = g; best = k; }
          }
        }
        if(!best) return;
        st.arcane[best] = (st.arcane[best] || 0) + 1;
      }
    }

    // ---------- onde farmar ----------
    // melhor ciclo JÁ VENCIDO pra conseguir `itemKey` (itens por segundo)
    function bestSource(st, itemKey){
      let best = null;
      for(const dKey of DUNGEON_ORDER) for(let c = 1; c <= (st.maxCycle[dKey] || 0); c++){
        const list = cycleMonsters(dKey, c);
        const per = runGains(st, list)[itemKey];
        if(!per) continue;
        const t = clearTime(st, list, true);
        if(t == null) continue;
        if(!best || per / t > best.rate) best = { dKey, c, list, rate: per / t };
      }
      return best;
    }
    // Vale largar o farm de moeda pra buscar a receita da próxima forja?
    // Compara dano ganho por segundo de jogo: a arma (tempo pra juntar os
    // drops que faltam) × a melhor compra (tempo pra juntar as moedas).
    // Minério não se farma — só espera a Caverna, então não desvia o farm.
    function forgeDetour(st, farmList){
      const W = isOpen(st, 'ferreiro') ? nextForge(st) : null;
      if(!W || !farmList) return null;
      const plan = st._forgePlan;
      if(!plan || !plan.src) return null; // só minério faltando: o farm normal já espera por ele
      const src = plan.src, T = plan.T;
      const inc = income(st, farmList);
      const copy = clone(st); copy.weapons[W.key] = 1; equipBest(copy);
      const base = effDps(st);
      const forgeRate = (effDps(copy) - base) / Math.max(1e-9, base) / T;
      const altRate = bestOption(st, farmList, false).bestScore * inc;
      return forgeRate >= altRate ? src : null;
    }

    // ---------- simulação ----------
    function doRun(st, list, farming, clearsCycle){
      const t = farming === 'partial' ? null : clearTime(st, list, farming);
      let time, killed;
      if(t == null){ const pr = partialRun(st, list); time = pr.time; killed = pr.killed; }
      else { time = t; killed = list; }
      st.clock += time; st.entries++;
      if(st.entries === CONFIG.academiaUnlockEntries) mark(st, 'Academia liberada');
      addGains(st, runGains(st, killed));
      passive(st, time);
      if(killed.length === list.length && clearsCycle !== false) st.cyclesDone++;
      return killed.length;
    }
    function manage(st, farmList){
      st._forgeAt = -1;
      tryQuests(st);
      sell(st);
      buyCavern(st);
      spendArcane(st);
      while(buyBest(st, farmList)){ st._forgeAt = -1; }
      tryQuests(st);
    }
    // Tenta cada ciclo em ordem; se não passa, faz a gestão (missões, venda,
    // Caverna, Arcanas, compras) e farma: o ciclo mais alto já vencido, o
    // ciclo que rende a receita da próxima forja, ou entradas parciais no
    // começo. Cada linha: andar, ciclo, minutos pra passar, DPS etc.
    function run(stopAfter){
      if(stopAfter == null) stopAfter = DUNGEON_ORDER.length - 1;
      const st = newPlayer();
      const rows = [];
      let lastCleared = null;
      for(let di = 0; di <= stopAfter; di++){
        const dKey = DUNGEON_ORDER[di];
        for(let c = 1; c <= CONFIG.maxCycleNum; c++){
          const list = cycleMonsters(dKey, c);
          const need = requiredDps(list, 0);
          const start = st.clock;
          let farmRuns = 0, detourRuns = 0;
          for(;;){
            manage(st, lastCleared && lastCleared.list);
            if(clearTime(st, list, false) !== null) break;
            if(!lastCleared){
              if(!doRun(st, list, 'partial', false)){
                rows.push({ dungeon: dKey, cycle: c, stuck: true, softlock: true, hpMax: list[0].hp, dps: dps(st, false), need });
                return { rows, st, clock: st.clock, events: st.events };
              }
            } else {
              const src = forgeDetour(st, lastCleared.list);
              if(src){ doRun(st, src.list, true); detourRuns++; }
              else doRun(st, lastCleared.list, true);
            }
            farmRuns++;
            if(st.clock - start > MAX_HOURS * 3600){
              rows.push({ dungeon: dKey, cycle: c, stuck: true, hpMax: Math.max(...list.map(m => m.hp)), dps: dps(st, false), need });
              return { rows, st, clock: st.clock, events: st.events };
            }
          }
          doRun(st, list, false);
          if(c > (st.maxCycle[dKey] || 0)) st.maxCycle[dKey] = c;
          if(c === CONFIG.maxCycleNum && dKey === CONFIG.arcaneUnlockDungeon && arcaneOpen(st)) mark(st, 'Habilidades Arcanas liberadas');
          lastCleared = { list, dKey, c };
          st.farm = { d: dKey, c };
          rows.push({ dungeon: dKey, cycle: c, minutes: (st.clock - start) / 60, totalHours: st.clock / 3600, farmRuns, detourRuns,
            hpMax: Math.max(...list.map(m => m.hp)), hpSum: list.reduce((s, m) => s + m.hp, 0),
            dps: dps(st, false), need, clickDmg: clickDmg(st), clickPart: clickDmg(st) * CPS * critMult(st), troopPart: troopDps(st),
            arcanePart: arcaneFx(st).add, weapon: st.equipped, goldPerRun: valueOf(runGains(st, list)),
            oreRate: oreRate(st), golden: goldenFrac(st) });
        }
      }
      return { rows, st, clock: st.clock, events: st.events };
    }

    // horas por andar × meta do jogador ideal (MAPS[k].timeBudgetH ×
    // CONFIG.balanceIdealShare, ± opts.budgetTolerance). `budget` já vem nessa escala.
    const IDEAL_SHARE = CONFIG.balanceIdealShare || 1;
    function floorTimes(res){
      const out = [];
      let prev = 0;
      for(const k of DUNGEON_ORDER){
        const mine = res.rows.filter(r => r.dungeon === k);
        const budget = MAPS[k] && MAPS[k].timeBudgetH != null ? MAPS[k].timeBudgetH * IDEAL_SHARE : null;
        if(!mine.length) break;
        const last = mine[mine.length - 1];
        if(last.stuck){ out.push({ key: k, stuck: true, budget, status: 'trava' }); break; }
        const hours = last.totalHours - prev; prev = last.totalHours;
        const status = budget == null ? null : hours < budget * (1 - TOLERANCE) ? 'rapido' : hours > budget * (1 + TOLERANCE) ? 'lento' : 'ok';
        out.push({ key: k, hours, budget, status, pct: budget ? hours / budget : null });
      }
      return out;
    }

    // ---------- curvas pra análise ----------
    function dungeonIncome(dKey){
      const list = cycleMonsters(dKey, 1);
      const value = list.reduce((s, m) => s + killValue(m.key), 0);
      return value / (CONFIG.dungeonTimeLimitMs / 1000);
    }
    function troopCurve(n){
      return TROOP_DEFS.map(t => ({ key: t.key, name: t.name,
        points: Array.from({ length: n }, (_, i) => { const cost = Math.ceil(t.baseCost * Math.pow(t.costGrowth, i)); return { i: i + 1, cost, costPerDps: cost / Math.max(1e-9, t.dps) }; }) }));
    }
    function cavernCurve(n){
      const ov = oreValue(0);
      return PROSPECTOR_DEFS.map(p => ({ key: p.key, name: p.name, requiresDungeon: p.requiresDungeon,
        points: Array.from({ length: n }, (_, i) => { const cost = Math.ceil(p.baseCost * Math.pow(p.costGrowth, i)); const gps = p.orePerSec * ov; return { i: i + 1, cost, goldPerSec: gps, paybackMin: cost / Math.max(1e-9, gps) / 60 }; }) }));
    }

    return { run, floorTimes, IDEAL_SHARE, cycleMonsters, killValue, requiredDps, oreValue, dungeonIncome, troopCurve, cavernCurve, CPS, TOLERANCE };
  }
  if(typeof module !== 'undefined' && module.exports) module.exports = { createBalanceSim };
  else root.BalanceCore = { createBalanceSim };
})(this);
