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
    document.getElementById('leaveDungeonBtn').addEventListener('click', ()=>DungeonModule.leaveToCity());

    document.getElementById('cycleContinueBtn').addEventListener('click', ()=>{
      document.getElementById('cycleCompleteModal').classList.remove('open');
      MonsterModule.spawn(false);
      UI.renderAll();
    });
    document.getElementById('cycleLeaveBtn').addEventListener('click', ()=>{
      document.getElementById('cycleCompleteModal').classList.remove('open');
      DungeonModule.leaveToCity();
    });

    this.initSettingsModal();
  },
  showCityView(){
    document.getElementById('view-city').classList.add('active');
    document.getElementById('view-dungeon').classList.remove('active');
  },
  showDungeonView(){
    document.getElementById('view-city').classList.remove('active');
    document.getElementById('view-dungeon').classList.add('active');
  },
  // Chamado pelo MonsterModule.onDeath() quando o chefe de um ciclo é
  // derrotado — pausa o jogo (MonsterModule.current fica null) até o
  // jogador escolher continuar pro próximo ciclo ou voltar pra cidade.
  showCycleCompleteModal(){
    const d = state.dungeons[state.currentDungeon];
    const justFinishedCycle = Math.floor((d.killCount - 1) / CONFIG.cycleLength) + 1;
    const nextCycle = Math.floor(d.killCount / CONFIG.cycleLength) + 1;
    document.getElementById('cycleCompleteText').textContent =
      `Você derrotou o chefe do Ciclo ${justFinishedCycle} de ${MAPS[state.currentDungeon].name}! Quer continuar para o Ciclo ${nextCycle}?`;
    document.getElementById('cycleCompleteModal').classList.add('open');
  },
  initSettingsModal(){
    const settingsModal = document.getElementById('settingsModal');
    const achievementsModal = document.getElementById('achievementsModal');
    const openModal = (modal)=> modal.classList.add('open');
    const closeModal = (modal)=> modal.classList.remove('open');

    document.getElementById('settingsGearBtn').addEventListener('click', ()=>{
      // reflete as preferências salvas nos controles toda vez que abre
      document.getElementById('audioToggle').checked = state.settings.audioEnabled;
      document.getElementById('audioToggleLabel').textContent = state.settings.audioEnabled ? 'Ativado' : 'Desativado';
      document.getElementById('volumeSlider').value = state.settings.volume;
      document.getElementById('languageSelect').value = state.settings.language;
      openModal(settingsModal);
    });
    document.getElementById('settingsCloseBtn').addEventListener('click', ()=>closeModal(settingsModal));
    settingsModal.addEventListener('click', (e)=>{ if(e.target === settingsModal) closeModal(settingsModal); });

    document.getElementById('achievementsBtn').addEventListener('click', ()=>{
      closeModal(settingsModal);
      openModal(achievementsModal);
    });
    document.getElementById('achievementsCloseBtn').addEventListener('click', ()=>closeModal(achievementsModal));
    achievementsModal.addEventListener('click', (e)=>{ if(e.target === achievementsModal) closeModal(achievementsModal); });

    document.getElementById('downloadSaveBtn').addEventListener('click', ()=>SettingsModule.downloadSave());

    const uploadInput = document.getElementById('uploadSaveInput');
    document.getElementById('uploadSaveBtn').addEventListener('click', ()=>uploadInput.click());
    uploadInput.addEventListener('change', ()=>{
      const file = uploadInput.files[0];
      SettingsModule.uploadSaveFromFile(file).then(()=>{
        closeModal(settingsModal);
        this.showToast('SAVE CARREGADO', 'Seu progresso foi importado com sucesso!');
      }).catch(msg=>{
        alert(msg);
      }).finally(()=>{
        uploadInput.value = '';
      });
    });

    document.getElementById('audioToggle').addEventListener('change', (e)=>{
      SettingsModule.setAudioEnabled(e.target.checked);
      document.getElementById('audioToggleLabel').textContent = e.target.checked ? 'Ativado' : 'Desativado';
    });
    document.getElementById('volumeSlider').addEventListener('input', (e)=>SettingsModule.setVolume(Number(e.target.value)));
    document.getElementById('languageSelect').addEventListener('change', (e)=>SettingsModule.setLanguage(e.target.value));
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
    if(!MonsterModule.current) return; // sem monstro ativo (jogador está na cidade)
    const t = MonsterModule.current.type;
    const d = state.dungeons[state.currentDungeon];
    const posInCycle = d.killCount % CONFIG.cycleLength;
    const loop = Math.floor(d.killCount / CONFIG.cycleLength) + 1;
    document.getElementById('monsterName').textContent = (MonsterModule.current.isBoss ? '★ CHEFE: ' : '') + t.name;
    document.getElementById('tierLabel').textContent = `${MAPS[state.currentDungeon].name} · CICLO ${loop} · MONSTRO ${posInCycle+1}/${CONFIG.cycleLength} (ABATIDOS NO TOTAL: ${state.totalKillsAll})`;
  },
  renderHpBar(){
    if(!MonsterModule.current) return;
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
    document.getElementById('statMiningGps').textContent = this.fmt(MiningModule.totalGoldPerSecond());
  },
  renderDungeonList(){
    const el = document.getElementById('dungeonList');
    el.innerHTML = '';
    for(const key of Object.keys(MAPS)){
      const map = MAPS[key];
      const row = document.createElement('div');
      if(!DungeonModule.isUnlocked(key)){
        const req = map.unlockRequirement;
        row.className = 'shop-row locked';
        row.innerHTML = `
          <div class="shop-info">
            <div class="name">🔒 ${map.name}</div>
            <div class="desc">Requer ${req.kills} mortes na ${MAPS[req.dungeon].name}</div>
          </div>`;
        el.appendChild(row);
        continue;
      }
      row.className = 'shop-row';
      row.innerHTML = `
        <div class="shop-info">
          <div class="name">${map.name}</div>
          <div class="desc">${DungeonModule.progressLabel(key)}${map.dropsItem ? ' · dropa itens em vez de ouro' : ''}</div>
        </div>
        <button class="buy-btn">ENTRAR</button>`;
      row.querySelector('button').addEventListener('click', ()=>DungeonModule.enter(key));
      el.appendChild(row);
    }
  },
  renderShop(){
    const el = document.getElementById('shopList');
    el.innerHTML = '';
    for(const def of ITEM_DEFS){
      const qty = state.inventory[def.key];
      const hasAny = qty > 0;
      const row = document.createElement('div');
      row.className = 'shop-row'+(hasAny?'':' disabled');
      row.innerHTML = `
        <div class="shop-info">
          <div class="name">${def.icon} ${def.name}</div>
          <div class="desc">Vende por ${def.sellPrice} ouro cada</div>
          <div class="owned">Possui: ${qty}</div>
        </div>
        <button class="buy-btn" ${hasAny?'':'disabled'}>💰 Vender tudo</button>`;
      if(hasAny) row.querySelector('button').addEventListener('click', ()=>{
        state.gold += qty * def.sellPrice;
        state.inventory[def.key] = 0;
        UI.renderAll();
      });
      el.appendChild(row);
    }
  },
  renderMinerList(){
    const el = document.getElementById('minerList');
    el.innerHTML = '';
    for(const def of MINER_DEFS){
      const owned = state.miners[def.key];
      const cost = MiningModule.costFor(def);
      const canAfford = state.gold >= cost;
      const row = document.createElement('div');
      row.className = 'shop-row'+(canAfford?'':' disabled');
      row.innerHTML = `
        <div class="shop-info">
          <div class="name">${def.name}</div>
          <div class="desc">${def.desc} cada</div>
          <div class="owned">Possui: ${owned}</div>
        </div>
        <button class="buy-btn" ${canAfford?'':'disabled'}>💰 ${UI.fmt(cost)}</button>`;
      row.querySelector('button').addEventListener('click', ()=>MiningModule.buy(def.key));
      el.appendChild(row);
    }
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
  // Desenha a árvore de upgrades (aba UPGRADES) a partir dos dados puramente
  // visuais em UPGRADE_TREE (config.js). O desbloqueio continua sendo
  // decidido só pela PROGRESSION_CHAIN via ProgressionModule — esta função
  // só posiciona os mesmos nós que renderUpgradeList() desenhava em lista.
  renderUpgradeTree(){
    const linesEl = document.getElementById('upgradeTreeLines');
    const nodesEl = document.getElementById('upgradeTreeNodes');
    linesEl.innerHTML = '';
    nodesEl.innerHTML = '';

    const hub = UPGRADE_TREE.hub;
    const svgLine = (x1,y1,x2,y2,color)=>{
      const line = document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1', x1+'%'); line.setAttribute('y1', y1+'%');
      line.setAttribute('x2', x2+'%'); line.setAttribute('y2', y2+'%');
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '2');
      line.setAttribute('opacity', '0.7');
      linesEl.appendChild(line);
    };

    for(const branch of UPGRADE_TREE.branches){
      // rótulo da branch, um pouco além do último nó (o mais afastado do hub)
      // — perto do primeiro nó ele colidia com o círculo (fica perto demais do hub)
      const outer = branch.nodes[branch.nodes.length-1];
      const labelX = Math.max(6, Math.min(94, outer.x + (outer.x-hub.x)*0.22));
      const labelY = Math.max(4, Math.min(96, outer.y + (outer.y-hub.y)*0.22));
      const label = document.createElement('div');
      label.className = 'tree-branch-label';
      label.style.left = labelX+'%';
      label.style.top = labelY+'%';
      label.style.color = branch.color;
      label.textContent = branch.label;
      nodesEl.appendChild(label);

      // linhas conectando hub -> nó1 -> nó2 -> ...
      let prev = hub;
      for(const node of branch.nodes){
        svgLine(prev.x, prev.y, node.x, node.y, branch.color);
        prev = node;
      }

      for(const node of branch.nodes){
        const def = UPGRADE_DEFS.find(u=>u.key===node.key);
        const el = document.createElement('div');
        el.className = 'tree-node';
        el.style.left = node.x+'%';
        el.style.top = node.y+'%';
        el.style.borderColor = branch.color;

        if(!ProgressionModule.isUnlocked('upgrade', node.key)){
          el.classList.add('locked');
          el.innerHTML = `<div class="node-name">🔒 ${def.name}</div>`;
          el.title = ProgressionModule.lockLabel('upgrade', node.key);
          nodesEl.appendChild(el);
          continue;
        }

        const lvl = state.upgrades[node.key];
        const maxed = lvl >= def.maxLevel;
        const cost = UpgradesModule.costFor(def);
        const canAfford = !maxed && state.gold >= cost;
        if(maxed) el.classList.add('maxed');
        else if(!canAfford) el.classList.add('disabled');

        el.innerHTML = `
          <div class="node-name">${def.name}</div>
          <div class="node-level">${lvl}/${def.maxLevel}</div>
          <div class="node-cost">${maxed ? 'MÁX' : '💰'+UI.fmt(cost)}</div>`;
        el.title = def.desc;
        if(!maxed) el.addEventListener('click', ()=>UpgradesModule.buy(node.key));
        nodesEl.appendChild(el);
      }
    }
  },
  renderPrestigeTab(){
    document.getElementById('essenceCount').textContent = UI.fmt(state.essence);
    const gain = PrestigeModule.potentialEssence();
    document.getElementById('essenceGain').textContent = gain;

    // state.totalKillsAll (vitalício, o mesmo "ABATIDOS NO TOTAL" da arena) é
    // o que conta pra ascender — nunca reseta, nem por timeout de chefe nem
    // por ascensão. Assim o progresso mostrado aqui bate com o que a arena
    // já exibe, sem depender de mortes só desta run.
    const threshold = PrestigeModule.currentAscendThreshold();
    const killsSoFar = Math.min(state.totalKillsAll, threshold);
    document.getElementById('ascendProgress').textContent = `Abatidos no total: ${killsSoFar}/${threshold}`;

    const btn = document.getElementById('ascendBtn');
    const killsOk = state.totalKillsAll >= threshold;
    btn.disabled = !PrestigeModule.canAscend();
    if(PrestigeModule.canAscend()){
      btn.textContent = 'ASCENDER';
    } else if(!killsOk){
      btn.textContent = `MATE ${threshold} MONSTROS NO TOTAL PARA ASCENDER`;
    } else {
      btn.textContent = 'GANHE MAIS OURO NESTE RUN PARA ASCENDER';
    }

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
    this.renderDungeonList();
    this.renderTroopList();
    this.renderMinerList();
    this.renderShop();
    this.renderUpgradeTree();
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
  showFloatingItem(qty, itemDef){
    const stage = document.getElementById('monsterStage');
    const div = document.createElement('div');
    div.className = 'float-dmg';
    div.style.color = '#8fe0c8';
    div.textContent = '+'+qty+' '+itemDef.icon+' '+itemDef.name;
    div.style.left = '50%';
    div.style.top = '50%';
    stage.appendChild(div);
    setTimeout(()=>div.remove(), 850);
  },
  showFloatingItemAt(qty, itemDef, evt){
    const stage = document.getElementById('monsterStage');
    const div = document.createElement('div');
    div.className = 'float-dmg';
    div.style.color = '#8fe0c8';
    div.textContent = '+'+qty+' '+itemDef.icon;
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
