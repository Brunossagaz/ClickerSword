/* ---------------------------------------------------------------------
   ACHIEVEMENTS MODULE (achievements.js)
   Conquistas definidas em ACHIEVEMENT_DEFS (config.js), progresso em
   state.achievements (true/false por chave, validado em
   SaveModule.sanitizeLoaded). unlock() é o único ponto que desbloqueia:
   marca e junta num aviso só tudo que desbloqueou no mesmo instante (ex.:
   várias de uma vez ao carregar um save antigo), salvando uma vez. As
   conquistas com `type` são conferidas por checkAll(), chamado depois de
   cada ação que pode completar uma (abate, compra de arma/tropa, forja,
   conversa com morador, carregar save). A lista do modal de Conquistas é
   montada só com textContent (nada de innerHTML).
--------------------------------------------------------------------- */
const AchievementsModule = {
  _pending: [],
  _flushTimer: null,

  // contagem por extenso ("1.000"), sem a abreviação de UI.fmt ("1.00K")
  num(n){
    return Math.floor(n).toLocaleString('pt-BR');
  },
  isUnlocked(key){
    return !!(state.achievements && state.achievements[key]);
  },
  // Nome/descrição: as geradas (por monstro/tropa) montam o texto na hora,
  // a partir do nome atual do monstro/tropa (que o Compêndio pode trocar).
  labelOf(def){
    if(def.type === 'monsterKills'){
      const m = MONSTER_TYPES.find(t => t.key === def.monster);
      const name = m ? BestiaryModule.displayName(m) : def.monster;
      return { name: `Caçador: ${name}`, desc: `Derrotou ${this.num(def.count)} monstros da espécie ${name}.` };
    }
    if(def.type === 'troop'){
      const t = TROOP_DEFS.find(d => d.key === def.troop);
      const name = t ? t.name : def.troop;
      return { name: `Nova Tropa: ${name}`, desc: `Recrutou pela primeira vez na Guilda: ${name}.` };
    }
    return { name: def.name, desc: def.desc };
  },
  // [atual, meta] pras conquistas contáveis (mostrado na lista); null nas outras
  progressOf(def){
    if(def.type === 'totalKills') return [state.totalKillsAll, def.count];
    if(def.type === 'monsterKills') return [(state.monsterKills && state.monsterKills[def.monster]) || 0, def.count];
    if(def.type === 'npcsMet') return [CITY_MAP.npcs.filter(n => state.npcsMet && state.npcsMet[n.key]).length, CITY_MAP.npcs.length];
    return null;
  },
  isMet(def){
    switch(def.type){
      case 'totalKills':
      case 'monsterKills':
      case 'npcsMet': {
        const [cur, max] = this.progressOf(def);
        return cur >= max;
      }
      case 'troop': return (state.troops[def.troop] || 0) > 0;
      case 'basicWeapons': return WEAPON_DEFS.every(w => state.weapons[w.key] > 0);
      case 'forge': return FORGED_WEAPON_DEFS.some(w => state.weapons[w.key] > 0);
      default: return false; // conquista de evento — só via unlock() direto
    }
  },
  checkAll(){
    for(const def of ACHIEVEMENT_DEFS){
      if(def.type && !this.isUnlocked(def.key) && this.isMet(def)) this.unlock(def.key);
    }
  },
  unlock(key){
    const def = ACHIEVEMENT_DEFS.find(d => d.key === key);
    if(!def || this.isUnlocked(key)) return false;
    state.achievements[key] = true;
    this._pending.push(this.labelOf(def).name);
    if(!this._flushTimer) this._flushTimer = setTimeout(() => this._flush(), 0);
    return true;
  },
  _flush(){
    this._flushTimer = null;
    const names = this._pending.splice(0);
    if(!names.length) return;
    SaveModule.save();
    UI.showToast(names.length > 1 ? `${names.length} CONQUISTAS DESBLOQUEADAS` : 'CONQUISTA DESBLOQUEADA', names.join(', '));
    this.render();
  },
  render(){
    const el = document.getElementById('achievementsList');
    if(!el) return;
    el.replaceChildren();
    const done = ACHIEVEMENT_DEFS.filter(d => this.isUnlocked(d.key)).length;
    const summary = document.createElement('div');
    summary.className = 'footer-note';
    summary.style.marginTop = '0';
    summary.textContent = `${done} de ${ACHIEVEMENT_DEFS.length} desbloqueada(s)`;
    el.appendChild(summary);
    for(const def of ACHIEVEMENT_DEFS){
      const unlocked = this.isUnlocked(def.key);
      const hidden = def.secret && !unlocked;
      const label = this.labelOf(def);
      const row = document.createElement('div');
      row.className = 'shop-row achievement-row' + (unlocked ? ' unlocked' : '');
      const icon = document.createElement('div');
      icon.className = 'icon ' + (unlocked ? 'icon-trophy' : 'icon-lock');
      const info = document.createElement('div');
      info.className = 'shop-info';
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = hidden ? '???' : label.name;
      const desc = document.createElement('div');
      desc.className = 'desc';
      desc.textContent = hidden ? 'Conquista secreta.' : label.desc;
      info.append(name, desc);
      const progress = !unlocked && this.progressOf(def);
      if(progress){
        const p = document.createElement('div');
        p.className = 'owned';
        p.textContent = `${this.num(Math.min(progress[0], progress[1]))} / ${this.num(progress[1])}`;
        info.appendChild(p);
      }
      row.append(icon, info);
      el.appendChild(row);
    }
  }
};
