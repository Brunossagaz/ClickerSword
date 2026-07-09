/* ---------------------------------------------------------------------
   UI MODULE (ui.js)
--------------------------------------------------------------------- */
const UI = {
  canvas:null, ctx:null,
  init(){
    this.canvas = document.getElementById('monsterCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.parentElement.addEventListener('click', (e)=>PlayerModule.handleClick(e));

    document.querySelectorAll('.tab-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
      });
    });

    document.getElementById('ascendBtn').addEventListener('click', ()=>PrestigeModule.ascend());
    document.getElementById('resetBtn').addEventListener('click', ()=>{
      if(confirm('Tem certeza que deseja apagar todo o progresso?')) SaveModule.reset();
    });
  },
  fmt(n){
    n = Math.floor(n);
    if(n < 1000) return ''+n;
    const units = ['','K','M','B','T','Qa','Qi','Sx'];
    let u = 0;
    let val = n;
    while(val >= 1000 && u < units.length-1){ val/=1000; u++; }
    return val.toFixed(val<10?2:1)+units[u];
  },
  renderMonsterSprite(){
    const big = MonsterModule.current.isBoss;
    Sprites.draw(this.ctx, MonsterModule.current.type, big, state.isGolden);
    this.canvas.style.width = big ? '256px' : '224px';
    this.canvas.style.height = big ? '256px' : '224px';
  },
  renderMonsterInfo(){
    const t = MonsterModule.current.type;
    const posInCycle = state.killCount % CONFIG.cycleLength;
    const mapName = MAPS.slimes.cycles[state.loop] ? MAPS.slimes.name
      : MAPS.goblins.cycles[state.loop] ? MAPS.goblins.name
      : MAPS.wilds.name;
    document.getElementById('monsterName').textContent = (MonsterModule.current.isBoss ? '★ CHEFE: ' : '') + t.name;
    document.getElementById('tierLabel').textContent = `${mapName} · CICLO ${state.loop} · MONSTRO ${posInCycle+1}/${CONFIG.cycleLength} (ABATIDOS: ${state.totalKillsAll})`;
  },
  renderHpBar(){
    const pct = Math.max(0, (state.monsterHp/state.monsterMaxHp)*100);
    document.getElementById('hpFill').style.width = pct+'%';
    document.getElementById('hpText').textContent = `${Math.max(0,Math.ceil(state.monsterHp))} / ${state.monsterMaxHp}`;
  },
  renderTimer(){
    if(!MonsterModule.current) return;
    const remainingMs = Math.max(0, CONFIG.monsterTimeLimitMs - (Date.now() - state.monsterSpawnedAt));
    const pct = Math.max(0, (remainingMs/CONFIG.monsterTimeLimitMs)*100);
    const fill = document.getElementById('timerFill');
    const text = document.getElementById('timerText');
    fill.style.width = pct+'%';
    text.textContent = Math.ceil(remainingMs/1000)+'s';
    fill.classList.toggle('urgent', remainingMs < 5000);
  },
  setGoldenVisible(v){
    document.getElementById('goldenTag').style.display = v ? 'block' : 'none';
    this.renderMonsterSprite();
  },
  renderStats(){
    document.getElementById('statGold').textContent = this.fmt(state.gold);
    document.getElementById('statClickDmg').textContent = this.fmt(PlayerModule.clickDamage());
    document.getElementById('statDps').textContent = this.fmt(TroopsModule.totalDps());
    document.getElementById('statCrit').textContent = Math.round((state.critChance+state.pCritChance)*100)+'%';
  },
  renderTroopList(){
    const el = document.getElementById('troopList');
    el.innerHTML = '';
    // ordem de exibição vem da PROGRESSION_CHAIN (não de TROOP_DEFS), pra
    // sempre bater com a ordem real de desbloqueio — fonte única de verdade
    const orderedDefs = PROGRESSION_CHAIN.filter(e=>e.type==='troop').map(e=>TROOP_DEFS.find(t=>t.key===e.key));
    for(const def of orderedDefs){
      const row = document.createElement('div');
      if(!ProgressionModule.isUnlocked('troop', def.key)){
        row.className = 'shop-row locked';
        row.innerHTML = `
          <div class="shop-info">
            <div class="name">🔒 ${def.name}</div>
            <div class="desc">${ProgressionModule.lockLabel('troop', def.key)}</div>
          </div>`;
        el.appendChild(row);
        continue;
      }
      const owned = state.troops[def.key];
      const cost = TroopsModule.costFor(def);
      const canAfford = state.gold >= cost;
      row.className = 'shop-row'+(canAfford?'':' disabled');
      row.innerHTML = `
        <div class="shop-info">
          <div class="name">${def.name}</div>
          <div class="desc">${def.desc} cada</div>
          <div class="owned">Possui: ${owned}</div>
        </div>
        <button class="buy-btn" ${canAfford?'':'disabled'}>💰 ${UI.fmt(cost)}</button>`;
      row.querySelector('button').addEventListener('click', ()=>TroopsModule.buy(def.key));
      el.appendChild(row);
    }
  },
  renderUpgradeList(){
    const el = document.getElementById('upgradeList');
    el.innerHTML = '';
    // mesma ideia: ordem de exibição vem da PROGRESSION_CHAIN
    const orderedDefs = PROGRESSION_CHAIN.filter(e=>e.type==='upgrade').map(e=>UPGRADE_DEFS.find(u=>u.key===e.key));
    for(const def of orderedDefs){
      const row = document.createElement('div');
      if(!ProgressionModule.isUnlocked('upgrade', def.key)){
        row.className = 'shop-row locked';
        row.innerHTML = `
          <div class="shop-info">
            <div class="name">🔒 ${def.name}</div>
            <div class="desc">${ProgressionModule.lockLabel('upgrade', def.key)}</div>
          </div>`;
        el.appendChild(row);
        continue;
      }
      const lvl = state.upgrades[def.key];
      const maxed = lvl >= def.maxLevel;
      const cost = UpgradesModule.costFor(def);
      const canAfford = !maxed && state.gold >= cost;
      row.className = 'shop-row'+(canAfford?'':' disabled');
      row.innerHTML = `
        <div class="shop-info">
          <div class="name">${def.name}</div>
          <div class="desc">${def.desc}</div>
          <div class="owned">Nível: ${lvl}/${def.maxLevel}</div>
        </div>
        <button class="buy-btn" ${canAfford?'':'disabled'}>${maxed?'MÁX':'💰 '+UI.fmt(cost)}</button>`;
      if(!maxed) row.querySelector('button').addEventListener('click', ()=>UpgradesModule.buy(def.key));
      el.appendChild(row);
    }
  },
  renderPrestigeTab(){
    document.getElementById('essenceCount').textContent = UI.fmt(state.essence);
    const gain = PrestigeModule.potentialEssence();
    document.getElementById('essenceGain').textContent = gain;
    const btn = document.getElementById('ascendBtn');
    btn.disabled = !PrestigeModule.canAscend();
    btn.textContent = PrestigeModule.canAscend() ? 'ASCENDER' : `MATE ${CONFIG.ascendKillThreshold} MONSTROS PARA ASCENDER`;

    const el = document.getElementById('prestigeUpgradeList');
    el.innerHTML = '';
    for(const def of PRESTIGE_UPGRADE_DEFS){
      const cost = PrestigeModule.costFor(def);
      const canAfford = state.essence >= cost;
      const row = document.createElement('div');
      row.className = 'shop-row'+(canAfford?'':' disabled');
      row.innerHTML = `
        <div class="shop-info">
          <div class="name">${def.name}</div>
          <div class="desc">${def.desc}</div>
          <div class="owned">Nível: ${state.prestige[def.key]}</div>
        </div>
        <button class="buy-btn" ${canAfford?'':'disabled'}>✦ ${UI.fmt(cost)}</button>`;
      row.querySelector('button').addEventListener('click', ()=>PrestigeModule.buy(def.key));
      el.appendChild(row);
    }
  },
  renderAll(){
    this.renderStats();
    this.renderMonsterInfo();
    this.renderHpBar();
    this.renderTimer();
    this.renderTroopList();
    this.renderUpgradeList();
    this.renderPrestigeTab();
  },
  showFloatingDamage(dmg, isCrit, evt){
    const stage = document.getElementById('monsterStage');
    const div = document.createElement('div');
    div.className = 'float-dmg'+(isCrit?' crit':'');
    div.textContent = (isCrit?'CRÍT! ':'')+'-'+this.fmt(dmg);
    const rect = stage.getBoundingClientRect();
    const relX = evt && evt.clientX ? (evt.clientX-rect.left) : rect.width/2;
    div.style.left = relX+'px';
    div.style.top = (evt && evt.clientY ? (evt.clientY-rect.top-20) : rect.height/2)+'px';
    stage.appendChild(div);
    setTimeout(()=>div.remove(), 850);
  },
  showFloatingGold(amount){
    const stage = document.getElementById('monsterStage');
    const div = document.createElement('div');
    div.className = 'float-dmg';
    div.style.color = '#ffd54a';
    div.textContent = '+'+this.fmt(amount)+' 🪙';
    div.style.left = '50%';
    div.style.top = '50%';
    stage.appendChild(div);
    setTimeout(()=>div.remove(), 850);
  },
  showFloatingGoldAt(amount, evt){
    const stage = document.getElementById('monsterStage');
    const div = document.createElement('div');
    div.className = 'float-dmg';
    div.style.color = '#ffd54a';
    div.textContent = '+'+this.fmt(amount)+' 🪙';
    const rect = stage.getBoundingClientRect();
    const relX = evt && evt.clientX ? (evt.clientX-rect.left) : rect.width/2;
    div.style.left = relX+'px';
    div.style.top = (evt && evt.clientY ? (evt.clientY-rect.top+10) : rect.height/2)+'px';
    stage.appendChild(div);
    setTimeout(()=>div.remove(), 850);
  },
  screenShake(){
    const c = document.getElementById('monsterCanvas');
    c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
  },
  hitFlash(){
    const c = document.getElementById('monsterCanvas');
    c.classList.add('flash');
    setTimeout(()=>c.classList.remove('flash'), 90);
  },
  showToast(title, msg){
    const div = document.createElement('div');
    div.className = 'toast';
    div.innerHTML = `<span class="pixel">${title}</span>${msg}`;
    document.body.appendChild(div);
    setTimeout(()=>{ div.style.transition='opacity .5s'; div.style.opacity='0'; setTimeout(()=>div.remove(),500); }, 3800);
  }
};
