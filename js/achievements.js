/* ---------------------------------------------------------------------
   ACHIEVEMENTS MODULE (achievements.js)
   Conquistas definidas em ACHIEVEMENT_DEFS (config.js), progresso em
   state.achievements (true/false por chave, validado em
   SaveModule.sanitizeLoaded). unlock() é o único ponto que desbloqueia:
   marca, salva na hora e avisa com um toast. A lista do modal de
   Conquistas é montada só com textContent (nada de innerHTML).
--------------------------------------------------------------------- */
const AchievementsModule = {
  isUnlocked(key){
    return !!(state.achievements && state.achievements[key]);
  },
  unlock(key){
    const def = ACHIEVEMENT_DEFS.find(d => d.key === key);
    if(!def || this.isUnlocked(key)) return false;
    state.achievements[key] = true;
    SaveModule.save();
    UI.showToast('CONQUISTA DESBLOQUEADA', def.name);
    this.render();
    return true;
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
      const row = document.createElement('div');
      row.className = 'shop-row achievement-row' + (unlocked ? ' unlocked' : '');
      const icon = document.createElement('div');
      icon.className = 'icon ' + (unlocked ? 'icon-trophy' : 'icon-lock');
      const info = document.createElement('div');
      info.className = 'shop-info';
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = hidden ? '???' : def.name;
      const desc = document.createElement('div');
      desc.className = 'desc';
      desc.textContent = hidden ? 'Conquista secreta.' : def.desc;
      info.append(name, desc);
      row.append(icon, info);
      el.appendChild(row);
    }
  }
};
