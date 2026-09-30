/* ---------------------------------------------------------------------
   OVERRIDES (overrides.js)
   Valores customizados no Compêndio (tools/compendio.html), salvos em
   js/overrides-data.js (window.CONFIG_OVERRIDES). Carrega logo depois de
   config.js e ANTES de state.js — itens/armas novos já entram em
   freshState()/SaveModule.applyLoaded, que derivam inventário/armas das
   listas de config.js.

   Só dados: troca nomes/números e acrescenta entradas nas listas — nada de
   regra nova. Formato (tudo opcional):
     { config: { baseHp: 20, ... },
       monsters: { patch: { slime: { name:'...', hpMult:2, drops:[...] } } },
       items: { patch: {...}, add: [ { key, name, type, ... } ] },
       weapons / forgedWeapons: { patch, add }, troops / upgrades: { patch },
       prospectors / cavernUpgrades: { patch }, maps: { patch: { slimes: { hpScale } } },
       npcLines: { barnabe: ['fala 1', 'fala 2'], kidBoy: [...] } }
   npcLines troca a lista inteira de falas soltas de um morador de
   CITY_MAP.npcs (balão na cidade; Barnabé/Creiton também na Loja/Ferreiro —
   são os mesmos arrays BARNABE_LINES/CREITON_LINES/ANSELMO_LINES).
   `null` num campo do patch remove o campo (ex.: tirar um bônus de arma).
--------------------------------------------------------------------- */
const WEAPON_BONUS_KEYS = ['clickDamageBonus', 'dpsBonus', 'critChanceBonus', 'critDamageBonus', 'extraDropChance', 'burnChance', 'burnDamagePercent'];
const ConfigOverrides = {
  // só números simples de CONFIG — o resto (chaves de save, etc.) não é editável
  CONFIG_KEYS: ['baseHp', 'hpCycleGrowth', 'hpKillGrowth', 'bossHpMult', 'monsterTimeLimitMs', 'bossTimeLimitMs', 'dungeonTimeLimitMs',
    'goldenChancePerTick', 'goldenDurationMs', 'goldenRewardMult', 'cavernOfflineEfficiency'],
  COLLECTIONS: {
    monsters:      { target: 'MONSTER_TYPES',      fields: ['name', 'hpMult', 'drops'], canAdd: false },
    items:         { target: 'ITEM_DEFS',          fields: ['name', 'icon', 'sellPrice', 'type', 'dungeon', 'weight', 'rarity'], canAdd: true },
    weapons:       { target: 'WEAPON_DEFS',        fields: ['name', 'icon', 'buyCost', ...WEAPON_BONUS_KEYS], canAdd: true },
    forgedWeapons: { target: 'FORGED_WEAPON_DEFS', fields: ['name', 'icon', 'recipe', 'requiresWeapon', ...WEAPON_BONUS_KEYS], canAdd: true },
    troops:        { target: 'TROOP_DEFS',         fields: ['name', 'desc', 'baseCost', 'costGrowth', 'dps'], canAdd: false },
    // efeitos por nível (ver UPGRADE_DEFS/UPGRADE_STATS em config.js) — o apply
    // de cada upgrade lê def.effects na hora da compra
    upgrades:      { target: 'UPGRADE_DEFS',       fields: ['name', 'desc', 'baseCost', 'costGrowth', 'maxLevel', 'effects'], canAdd: false },
    // Caverna: mineradores (requiresDungeon = andar que libera) e upgrades (pct por nível)
    prospectors:   { target: 'PROSPECTOR_DEFS',    fields: ['name', 'desc', 'baseCost', 'costGrowth', 'orePerSec', 'requiresDungeon'], canAdd: false },
    cavernUpgrades:{ target: 'CAVERN_UPGRADE_DEFS', fields: ['name', 'desc', 'baseCost', 'costGrowth', 'maxLevel', 'pct'], canAdd: false },
    // MAPS é um objeto { chave: andar }, não uma lista — ver _entry
    maps:          { target: 'MAPS', object: true, fields: ['hpScale'], canAdd: false },
  },
  KEY_RE: /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/,
  MAX_NPC_LINES: 40,
  // falas soltas: texto de até 200 caracteres, sem < > (vira texto na UI, mas
  // mesma regra dos outros campos de texto); lista nunca vazia
  cleanLines(lines){
    if(!Array.isArray(lines)) return null;
    const out = lines.filter(l => typeof l === 'string').map(l => l.trim())
      .filter(l => l && l.length <= 200 && !/[<>]/.test(l)).slice(0, this.MAX_NPC_LINES);
    return out.length ? out : null;
  },
  ICON_RE: /^[a-zA-Z0-9_-]{1,60}$/,

  // `t` = { CONFIG, MONSTER_TYPES, ITEM_DEFS, WEAPON_DEFS, FORGED_WEAPON_DEFS,
  // TROOP_DEFS, UPGRADE_DEFS, MINERAL_DEFS, PROSPECTOR_DEFS, CAVERN_UPGRADE_DEFS,
  // MAPS } — as próprias listas de config.js, alteradas no lugar
  apply(t, ov){
    if(!ov || typeof ov !== 'object') return;
    const cfg = ov.config || {};
    for(const k of this.CONFIG_KEYS){
      if(typeof cfg[k] === 'number' && isFinite(cfg[k]) && cfg[k] >= 0) t.CONFIG[k] = cfg[k];
    }
    for(const [name, spec] of Object.entries(this.COLLECTIONS)){
      const list = t[spec.target];
      if(!list) continue;
      const c = ov[name] || {};
      for(const [key, patch] of Object.entries(c.patch || {})){
        const entry = this._entry(list, spec, key);
        if(entry && patch && typeof patch === 'object') this._assign(entry, patch, spec.fields);
      }
      if(!spec.canAdd) continue;
      for(const add of (Array.isArray(c.add) ? c.add : [])){
        if(!add || !this.KEY_RE.test(add.key) || this.keyTaken(t, add.key)) continue;
        const entry = { key: add.key, custom: true };
        this._assign(entry, add, spec.fields);
        list.push(entry);
      }
    }
    // falas soltas dos moradores: troca o conteúdo do array NO LUGAR (Loja e
    // Ferreiro usam BARNABE_LINES/CREITON_LINES, o mesmo array do morador)
    if(t.CITY_MAP && ov.npcLines && typeof ov.npcLines === 'object'){
      for(const n of t.CITY_MAP.npcs){
        const lines = this.cleanLines(ov.npcLines[n.key]);
        if(!lines) continue;
        if(!Array.isArray(n.lines)) n.lines = [];
        n.lines.splice(0, n.lines.length, ...lines);
      }
    }
    // MINERAL_DEFS é um filter de ITEM_DEFS feito em config.js — refaz em
    // cima da lista final (minério novo/tipo trocado)
    t.MINERAL_DEFS.splice(0, t.MINERAL_DEFS.length, ...t.ITEM_DEFS.filter(d => d.type === 'mineral'));
  },
  // Tipo esperado de cada campo editável — nome/desc/tipo/raridade acabam em
  // innerHTML/atributos class na UI do jogo, então valor fora do formato é
  // ignorado em vez de aplicado.
  TEXT_FIELDS: ['name', 'desc'],
  TOKEN_FIELDS: ['type', 'dungeon', 'rarity', 'requiresWeapon', 'requiresDungeon'],
  STRUCT_FIELDS: ['drops', 'recipe', 'effects'],
  TOKEN_RE: /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/,
  _valid(f, v){
    if(this.TEXT_FIELDS.includes(f)) return typeof v === 'string' && v.length <= 200 && !/[<>]/.test(v);
    if(f === 'icon') return typeof v === 'string' && this.ICON_RE.test(v);
    if(this.TOKEN_FIELDS.includes(f)) return typeof v === 'string' && this.TOKEN_RE.test(v);
    if(this.STRUCT_FIELDS.includes(f)) return v !== null && typeof v === 'object';
    return typeof v === 'number' && isFinite(v);
  },
  _entry(list, spec, key){
    if(spec.object) return Object.prototype.hasOwnProperty.call(list, key) ? list[key] : undefined;
    return list.find(e => e.key === key);
  },
  _assign(entry, patch, fields){
    for(const f of fields){
      if(!Object.prototype.hasOwnProperty.call(patch, f)) continue;
      if(patch[f] === null) delete entry[f];
      else if(this._valid(f, patch[f])) entry[f] = JSON.parse(JSON.stringify(patch[f]));
      else console.warn(`Override ignorado: campo "${f}" com valor inválido`, patch[f]);
    }
  },
  keyTaken(t, key){
    return [t.ITEM_DEFS, t.WEAPON_DEFS, t.FORGED_WEAPON_DEFS].some(list => list.some(e => e.key === key));
  },

  // Inverso de apply() (usado pelo Compêndio pra salvar): compara as listas
  // atuais com uma cópia de antes do apply e devolve só o que mudou.
  diff(base, cur){
    const out = { version: 1, config: {} };
    for(const k of this.CONFIG_KEYS) if(cur.config[k] !== base.config[k]) out.config[k] = cur.config[k];
    for(const [name, spec] of Object.entries(this.COLLECTIONS)){
      const baseList = base[name], curList = cur[name];
      if(!baseList || !curList) continue;
      const patch = {};
      for(const b of baseList){
        const e = curList.find(x => x.key === b.key);
        if(!e) continue;
        const p = {};
        for(const f of spec.fields){
          if(JSON.stringify(b[f]) !== JSON.stringify(e[f])) p[f] = e[f] === undefined ? null : e[f];
        }
        if(Object.keys(p).length) patch[b.key] = p;
      }
      const c = {};
      if(Object.keys(patch).length) c.patch = patch;
      if(spec.canAdd){
        const add = curList.filter(e => !baseList.some(b => b.key === e.key)).map(e => {
          const o = { key: e.key };
          for(const f of spec.fields) if(e[f] !== undefined) o[f] = e[f];
          return o;
        });
        if(add.length) c.add = add;
      }
      if(Object.keys(c).length) out[name] = c;
    }
    if(base.npcLines && cur.npcLines){
      const lines = {};
      for(const k of Object.keys(cur.npcLines)){
        if(JSON.stringify(base.npcLines[k] || []) !== JSON.stringify(cur.npcLines[k])) lines[k] = cur.npcLines[k].slice();
      }
      if(Object.keys(lines).length) out.npcLines = lines;
    }
    return out;
  },
  countChanges(ov){
    let n = Object.keys(ov.config || {}).length;
    for(const name of Object.keys(this.COLLECTIONS)){
      const c = ov[name] || {};
      for(const p of Object.values(c.patch || {})) n += Object.keys(p).length;
      n += (c.add || []).length;
    }
    n += Object.keys(ov.npcLines || {}).length; // 1 por morador com falas alteradas
    return n;
  },

  // Ícones: style.css só tem regra .icon-<nome> pros ícones que já existiam
  // — pra item/arma nova (ou ícone trocado) cria a regra aqui.
  injectIconCss(defs, knownIcons){
    if(typeof document === 'undefined') return;
    const rules = [];
    for(const d of defs){
      if(!d.icon || knownIcons.has(d.icon) || !this.ICON_RE.test(d.icon)) continue;
      knownIcons.add(d.icon);
      rules.push(`.icon-${d.icon}{background-image:url('assets/icons/${d.icon}.png'); width:20px; height:20px;}`);
    }
    if(!rules.length) return;
    const style = document.createElement('style');
    style.textContent = rules.join('\n');
    document.head.appendChild(style);
  }
};

(function applyToGame(){
  const target = { CONFIG, MONSTER_TYPES, ITEM_DEFS, WEAPON_DEFS, FORGED_WEAPON_DEFS, TROOP_DEFS, UPGRADE_DEFS, MINERAL_DEFS,
    PROSPECTOR_DEFS, CAVERN_UPGRADE_DEFS, MAPS, CITY_MAP };
  const allDefs = () => [...ITEM_DEFS, ...WEAPON_DEFS, ...FORGED_WEAPON_DEFS];
  const knownIcons = new Set(allDefs().map(d => d.icon));
  try{
    ConfigOverrides.apply(target, window.CONFIG_OVERRIDES);
  }catch(e){
    console.warn('Falha ao aplicar js/overrides-data.js', e);
  }
  ConfigOverrides.injectIconCss(allDefs(), knownIcons);
})();
