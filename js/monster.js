/* ---------------------------------------------------------------------
   MONSTER MODULE (monster.js)
   Todo o progresso de ciclo/monstro é escopado à Dungeon ativa
   (state.dungeons[state.currentDungeon]) — ver DungeonModule pra entrar/sair.
--------------------------------------------------------------------- */
const MonsterModule = {
  current:null,
  // Schedule "canônico" de uma Dungeon (usado só pra saber o FORMATO dos
  // ciclos — quantas posições, quais são duplas): todo ciclo definido de uma
  // mesma Dungeon usa o mesmo formato, só a cor/tipo dos monstros muda de
  // ciclo pra ciclo (ver MAPS.slimes) — por isso basta olhar o ciclo 1.
  scheduleFor(dungeonKey){
    const map = MAPS[dungeonKey];
    return map.cycles ? map.cycles[1] : map.order;
  },
  // Quantidade de monstros que UMA posição do schedule consome: 1 pra
  // posição normal, ou o tamanho da dupla/tripla (`pairChoices`) — o nome
  // do campo ficou "pairChoices" por história, mas hoje aceita opções de
  // qualquer tamanho (todas as opções da MESMA posição precisam ter o mesmo
  // tamanho entre si, ver MAPS). `slot.pairChoices[0].length` bastaria pra
  // ler o tamanho, mas usar Math.max cobre o caso incomum de alguém digitar
  // opções de tamanhos diferentes na mesma posição sem quebrar o resto.
  groupSize(slot){
    if(!slot || !slot.pairChoices) return 1;
    return Math.max(...slot.pairChoices.map(opt => opt.length));
  },
  // Quantidade de MONSTROS (não de "posições") que um ciclo inteiro dessa
  // Dungeon consome — cada posição normal vale 1, cada posição de dupla/
  // tripla (`pairChoices`) vale o tamanho do grupo. Usado no lugar de
  // CONFIG.cycleLength, que só servia quando toda posição era sempre 1 monstro.
  killsPerCycle(schedule){
    return schedule.reduce((sum, slot) => sum + this.groupSize(slot), 0);
  },
  killsPerCycleFor(dungeonKey){
    return this.killsPerCycle(this.scheduleFor(dungeonKey));
  },
  // Número do ciclo atual (1-based) dentro da Dungeon indicada, a partir do
  // killCount acumulado — mesma conta usada em UI.renderMonsterInfo, também
  // usada por PlayerModule.isAutoClickActive pra comparar com
  // state.dungeons[key].maxCycleCompleted (Clique Automático só age em
  // ciclos já vencidos antes).
  currentCycleFor(dungeonKey){
    const d = state.dungeons[dungeonKey];
    const kpc = this.killsPerCycleFor(dungeonKey);
    return Math.floor(d.killCount / kpc) + 1;
  },
  // Acha, dentro do schedule de UM ciclo, qual posição (slotIdx, 0-based) e
  // qual monstro do grupo (subKill: 0-based, sempre 0 se a posição for
  // única — pode ir até 2 numa posição tripla) correspondem ao
  // `killIdxInCycle`-ésimo monstro morto desde o início do ciclo atual.
  resolveSlot(schedule, killIdxInCycle){
    let consumed = 0;
    for(let slotIdx=0; slotIdx<schedule.length; slotIdx++){
      const slot = schedule[slotIdx];
      const size = this.groupSize(slot);
      if(killIdxInCycle < consumed + size){
        return { slotIdx, subKill: killIdxInCycle - consumed, slot, isLastSlot: slotIdx === schedule.length-1 };
      }
      consumed += size;
    }
    // não deveria acontecer (killIdxInCycle sempre < killsPerCycle), mas por
    // segurança devolve a última posição em vez de quebrar
    const lastIdx = schedule.length-1;
    return { slotIdx:lastIdx, subKill:0, slot:schedule[lastIdx], isLastSlot:true };
  },
  hpFor(killIndexInRun, isBoss, hpMult){
    let hp = CONFIG.baseHp * Math.pow(CONFIG.hpGrowth, killIndexInRun);
    if(isBoss) hp *= CONFIG.bossHpMult;
    hp *= hpMult || 1;
    return Math.ceil(hp);
  },
  maybeTriggerGolden(){
    if(state.isGolden) return;
    if(Math.random() < CONFIG.goldenChancePerTick + state.goldenChanceBonus){
      state.isGolden = true;
      state.goldenExpiresAt = Date.now() + CONFIG.goldenDurationMs;
      UI.setGoldenVisible(true);
    }
  },
  checkGoldenExpiry(){
    if(state.isGolden && Date.now() > state.goldenExpiresAt){
      state.isGolden = false;
      UI.setGoldenVisible(false);
    }
  },
  // Tempo limite pra derrotar o monstro ATUAL antes de reiniciar o ciclo —
  // chefe (último monstro do ciclo) tem folga maior (ver CONFIG.bossTimeLimitMs),
  // já que costuma ter bem mais vida (ver CONFIG.bossHpMult). Usado tanto
  // aqui quanto em UI.renderTimer, pra barra e checagem nunca desalinharem.
  timeLimitMs(){
    return (this.current && this.current.isBoss) ? CONFIG.bossTimeLimitMs : CONFIG.monsterTimeLimitMs;
  },
  checkTimeUp(){
    if(!this.current) return;
    if(Date.now() - state.monsterSpawnedAt > this.timeLimitMs()){
      this.onTimeUp();
    }
  },
  onTimeUp(){
    // pausa o jogo (igual ao fim de ciclo) até o jogador escolher tentar de
    // novo ou voltar pra cidade, em vez de resetar sozinho
    this.current = null;
    UI.renderAll();
    UI.showTimeUpModal();
  },
  // Queimadura (ver WEAPON_DEFS.burnChance/burnDamagePercent, PlayerModule.
  // handleClick) — dano total já vem calculado (% do dano do clique que
  // aplicou), aqui só divide em ticks. Reaplicar SUBSTITUI a queimadura
  // anterior (não empilha) — sempre o efeito do clique mais recente.
  applyBurn(totalDamage){
    if(!this.current) return;
    const ticks = Math.max(1, Math.round(CONFIG.burnDurationMs / CONFIG.burnTickMs));
    this.current.burn = {
      dmgPerTick: totalDamage / ticks,
      ticksLeft: ticks,
      nextTickAt: Date.now() + CONFIG.burnTickMs
    };
  },
  // Chamado a cada tick do game loop (ver main.js) — aplica 1 tick de
  // queimadura quando o intervalo passa. Reaproveita applyDamage() (mesmo
  // caminho de morte/drops que dano de clique ou DPS das tropas).
  checkBurnTick(){
    const burn = this.current && this.current.burn;
    if(!burn || burn.ticksLeft <= 0) return;
    if(Date.now() < burn.nextTickAt) return;
    burn.ticksLeft -= 1;
    burn.nextTickAt += CONFIG.burnTickMs;
    const dmg = Math.max(1, Math.round(burn.dmgPerTick));
    UI.showFloatingBurnDamage(dmg);
    this.applyDamage(dmg);
  },
  retryCycle(){
    const d = state.dungeons[state.currentDungeon];
    const kpc = this.killsPerCycleFor(state.currentDungeon);
    d.killCount = Math.floor(d.killCount / kpc) * kpc; // volta pro monstro 1 do ciclo atual
    d.pendingSlot = null; // descarta o sorteio de dupla em andamento, se houver
    this.spawn(false);
    UI.renderAll();
  },
  // Chamado quando o jogador sai da dungeon manualmente (botão "Voltar pra
  // cidade" durante o combate, com o monstro ainda vivo) — mesmo reset de
  // retryCycle(), só que sem spawnar de novo (quem chama já está saindo pra
  // cidade). Precisa rodar ANTES de DungeonModule.leaveToCity() zerar
  // state.currentDungeon, senão perde a referência de qual Dungeon resetar.
  abandonCycle(){
    const d = state.dungeons[state.currentDungeon];
    const kpc = this.killsPerCycleFor(state.currentDungeon);
    d.killCount = Math.floor(d.killCount / kpc) * kpc; // volta pro monstro 1 do ciclo atual
    d.pendingSlot = null;
  },
  spawn(isFirst){
    const d = state.dungeons[state.currentDungeon];
    const map = MAPS[state.currentDungeon];
    const cyclesMap = map.cycles || { 1: map.order };
    const totalCycles = Object.keys(cyclesMap).length;
    const schedule1 = cyclesMap[1];
    const kpc = this.killsPerCycle(schedule1);
    // Ciclo máximo = CONFIG.maxCycleNum (ver onDeath, que trava o avanço pra
    // não passar disso daqui pra frente) — este clamp é só rede de segurança
    // pra saves salvos ANTES desse limite existir, cujo killCount podia estar
    // bem além do último ciclo: trava no início dele em vez de continuar
    // mostrando um "Ciclo 6+" que não deveria mais existir.
    if(d.killCount >= kpc * CONFIG.maxCycleNum){
      d.killCount = kpc * (CONFIG.maxCycleNum - 1);
      d.pendingSlot = null;
    }
    const killIdx = d.killCount;
    const cycleNum = Math.floor(killIdx / kpc) + 1;
    const killIdxInCycle = killIdx % kpc;
    const wrappedCycle = ((cycleNum - 1) % totalCycles) + 1;
    const schedule = cyclesMap[wrappedCycle];
    const { slotIdx, subKill, slot, isLastSlot } = this.resolveSlot(schedule, killIdxInCycle);

    const isDouble = !!(slot && slot.pairChoices);
    let monsterKey, isBoss = false, extraHpMult = 1, groupSize = 1;

    if(isDouble){
      // sorteia o grupo (dupla ou tripla) dessa posição só na 1ª parte — as
      // seguintes reaproveitam o mesmo sorteio (ver state.dungeons[key].pendingSlot)
      if(subKill === 0 || !d.pendingSlot){
        const options = slot.pairChoices;
        const chosen = options[Math.floor(Math.random()*options.length)];
        d.pendingSlot = { keys: chosen, phaseDrops: [] };
      }
      monsterKey = d.pendingSlot.keys[subKill] || d.pendingSlot.keys[0];
      groupSize = d.pendingSlot.keys.length;
      if(slot.strong) extraHpMult = 1.5; // posição "mais forte" (ver MAPS.slimes)
      // Posição de grupo na ÚLTIMA vaga do ciclo (ver MAPS.dragons): só a
      // ÚLTIMA fase do grupo conta como chefe de verdade (bônus de
      // CONFIG.bossHpMult + fecha o ciclo) — as fases anteriores são parte
      // da "luta do chefe" visualmente (ver isDouble em UI.renderMonsterInfo)
      // mas não disparam o fim de ciclo sozinhas.
      isBoss = (!isFirst) && isLastSlot && (subKill === groupSize - 1);
    } else {
      monsterKey = slot;
      isBoss = (!isFirst) && isLastSlot; // último monstro do ciclo = chefe
    }

    const type = MONSTER_TYPES.find(t=>t.key===monsterKey);
    this.current = { type, isBoss, isDouble, doubleSubKill: subKill, groupSize, slotIdx, totalSlots: schedule.length };

    // killIdx (killCount da Dungeon ativa) reseta a cada ascensão, então a
    // dificuldade dos monstros também reseta — sem isso o HP nunca voltaria
    // ao nível 1.
    //
    // Ciclo 1 usa killIdx puro (sem ajuste). A partir do Ciclo 2, o 1º
    // monstro do ciclo precisa ter a mesma vida do ÚLTIMO monstro ANTES do
    // chefe do ciclo anterior (não continua subindo em cima do próprio
    // chefe, que já tem CONFIG.bossHpMult à parte) — isso evita a sensação
    // de "reset" de dificuldade ao virar de ciclo. Cada ciclo cheio soma
    // `kpc` ao índice corrido, mas o monstro pré-chefe fica só `kpc-2`
    // posições à frente do início do ciclo anterior — descontar 2 por ciclo
    // já concluído reproduz exatamente esse alvo, pra qualquer `kpc`
    // (cancela algebricamente, ver histórico do commit).
    //
    // Só esse "reaproveitamento" do índice deixaria o Ciclo 2+ um pouco MAIS
    // FRACO do que a curva contínua de antes desta mudança (o índice para
    // de crescer no fim do ciclo anterior em vez de continuar subindo em
    // cima do chefe) — por pedido, todo Ciclo 2 em diante recebe +100% de
    // vida (fator fixo, não acumula ciclo após ciclo) em cima disso, pra
    // garantir que fique sempre mais difícil do que estava antes, sem
    // explodir em runs longas dentro do mesmo Andar.
    //
    // map.hpKillOffset (ver config.js, calculado a partir de DUNGEON_ORDER)
    // soma quantas mortes as Dungeons ANTERIORES somariam do Ciclo 1 ao
    // último — sem isso, toda Dungeon nova voltava a usar killIdx=0 (mesmo
    // HP inicial do jogo, trivial pra quem já teve que zerar a anterior).
    // Com o offset, o 1º monstro de uma Dungeon nova continua a MESMA curva
    // exponencial de onde a anterior parou, em vez de resetar.
    const hpKillIndex = (map.hpKillOffset || 0) + killIdx - 2*(cycleNum-1);
    const cycleDifficultyMult = cycleNum > 1 ? 2 : 1;
    const hp = this.hpFor(hpKillIndex, isBoss, (type.hpMult||1) * extraHpMult) * cycleDifficultyMult;
    state.monsterHp = hp;
    state.monsterMaxHp = hp;
    state.isBoss = isBoss;
    state.isGolden = false;
    state.monsterSpawnedAt = Date.now();
    UI.setGoldenVisible(false);

    UI.renderMonsterSprite();
    UI.renderMonsterInfo();
    UI.renderHpBar();
  },
  // Sorteia a quantidade de UMA entrada de `drops` (qtyMin-qtyMax, ambos
  // iguais = fixo). Monstro dourado multiplica, como bônus de evento (não
  // escala com HP/posição no ciclo, só com isso — ver tabela em config.js).
  itemQtyFor(dropDef){
    const span = dropDef.qtyMax - dropDef.qtyMin;
    let qty = dropDef.qtyMin + (span > 0 ? Math.floor(Math.random()*(span+1)) : 0);
    if(state.isGolden) qty *= CONFIG.goldenRewardMult;
    return Math.max(1, Math.floor(qty));
  },
  // Roda a chance de cada entrada em type.drops de forma independente — um
  // monstro pode dar 0, 1 ou vários itens diferentes na mesma morte (ver
  // MONSTER_TYPES). Retorna [{item, qty}] só com o que efetivamente dropou.
  // extraDropChance (opcional, ver WEAPON_DEFS/FORGED_WEAPON_DEFS): chance
  // de rolar a tabela inteira de novo, empilhando com o resultado normal.
  // state.rareDropChanceBonus (ver ramo "Sorte" da Academia, config.js
  // UPGRADE_DEFS) só soma nas entradas que JÁ têm `chance` própria (as
  // raras) — entradas garantidas (chance == null) não têm o que melhorar.
  rollDrops(){
    const drops = (this.current && this.current.type.drops) || [];
    const rollOnce = () => {
      const results = [];
      for(const d of drops){
        const chance = d.chance == null ? 1 : Math.min(1, d.chance + state.rareDropChanceBonus);
        if(Math.random() < chance) results.push({ item:d.item, qty:this.itemQtyFor(d) });
      }
      return results;
    };
    const results = rollOnce();
    const weaponDef = PlayerModule.equippedWeaponDef();
    if(weaponDef && weaponDef.extraDropChance && Math.random() < weaponDef.extraDropChance){
      results.push(...rollOnce());
    }
    return results;
  },
  applyDamage(dmg){
    state.monsterHp -= dmg;
    UI.renderHpBar();
    if(state.monsterHp <= 0){
      this.onDeath();
    }
  },
  onDeath(){
    const d = state.dungeons[state.currentDungeon];
    const wasBoss = this.current.isBoss; // captura antes do spawn() sobrescrever this.current
    const wasDouble = this.current.isDouble;
    const doubleSubKill = this.current.doubleSubKill;
    const groupSize = this.current.groupSize || 1;
    const slotPos = this.current.slotIdx + 1; // posição no ciclo (1-based), ver UI.renderMonsterInfo
    const drops = this.rollDrops();

    if(wasDouble && doubleSubKill > 0){
      // bônus de 10% pra cada item que TAMBÉM caiu em alguma fase ANTERIOR
      // do mesmo grupo (dupla ou tripla, recompensa a posição de grupo, mais
      // difícil — soma todas as fases já mortas antes de aplicar, ver
      // MAPS.slimes/MAPS.dragons). Itens que só uma fase dropou não ganham bônus.
      const priorPhases = (d.pendingSlot && d.pendingSlot.phaseDrops) || [];
      const priorTotals = {};
      for(const phase of priorPhases) for(const pd of phase) priorTotals[pd.item] = (priorTotals[pd.item]||0) + pd.qty;
      for(const drop of drops){
        if(priorTotals[drop.item]) drop.qty += Math.ceil((priorTotals[drop.item] + drop.qty) * 0.10);
      }
    }
    drops.forEach((drop, i)=>{
      state.inventory[drop.item] += drop.qty;
      UI.showFloatingItem(drop.qty, ITEM_DEFS.find(item=>item.key===drop.item), i);
    });
    UI.logDrops(slotPos, drops);
    // "Repetir Ciclo" ativo (ver DungeonModule.startAtCycleRepeat): soma o
    // loot de TODO monstro morto durante a sessão (não só o chefe), pro
    // resumo final (ver UI.showRepeatCycleResultModal).
    if(d.repeatCycleNum){
      if(!d.repeatLootTotals) d.repeatLootTotals = {};
      for(const drop of drops){
        d.repeatLootTotals[drop.item] = (d.repeatLootTotals[drop.item] || 0) + drop.qty;
      }
    }
    if(wasDouble){
      if(!d.pendingSlot.phaseDrops) d.pendingSlot.phaseDrops = []; // save antigo/estado defensivo
      d.pendingSlot.phaseDrops.push(drops);
      if(doubleSubKill >= groupSize - 1) d.pendingSlot = null; // última fase do grupo — encerra
    }

    d.killCount += 1;
    state.totalKillsAll += 1; // continua vitalício e global, alimenta a Ascensão

    if(wasBoss){
      state.totalCyclesCompleted += 1; // vitalício, ver OnboardingModule/QuestModule
      // captura ANTES de setar a flag — dispara o auto-retorno pra cidade no
      // 1º chefe da vida do personagem (ver abaixo). Independente do bloqueio
      // do botão de voltar, que é por ENTRADA na dungeon, não por ciclo
      // completo — ver OnboardingModule.isFirstDungeonEntry.
      const isFirstCycleEver = !state.firstCycleEverCompleted;
      // marca esse ciclo como concluído pra sempre (vitalício, não reseta ao
      // abandonar/tentar de novo) — habilita o seletor de ciclo pra voltar
      // até aqui depois (ver DungeonModule.startAtCycle/UI.openCyclePicker)
      const kpc = this.killsPerCycleFor(state.currentDungeon);
      const justFinishedCycle = Math.floor((d.killCount - 1) / kpc) + 1;
      d.maxCycleCompleted = Math.max(d.maxCycleCompleted || 0, justFinishedCycle);
      this.current = null;

      if(isFirstCycleEver){
        // 1º chefe da vida do personagem: nada de escolha, marca concluído e
        // volta pra cidade sozinho. Salva na hora (mesmo padrão de
        // shopUnlockAnnounced/metBarnabe) — sem isso, um refresh antes do
        // próximo autosave "esquece" que já rolou esse auto-retorno.
        state.firstCycleEverCompleted = true;
        SaveModule.save();
        DungeonModule.leaveToCity();
      } else if(d.repeatRemaining > 0 && d.repeatCycleNum === justFinishedCycle){
        // "Repetir Ciclo" ativo pra ESTE ciclo (ver DungeonModule.
        // startAtCycleRepeat/UI.openRepeatCycleModal): conta essa vitória e,
        // se ainda sobrar repetição, volta pro monstro 1 do MESMO ciclo em
        // vez de avançar pro próximo.
        d.repeatRemaining -= 1;
        if(d.repeatRemaining > 0){
          d.killCount = kpc * (justFinishedCycle - 1); // volta pro monstro 1 do ciclo repetido
          d.pendingSlot = null;
          this.spawn(false);
          UI.renderAll();
        } else {
          // última repetição: em vez de avançar pro próximo ciclo, encerra o
          // modo, entrega o resumo do loot acumulado e volta pra tela de
          // seleção de Dungeons (ver UI.showRepeatCycleResultModal) — não
          // continua a run sozinho.
          const lootTotals = d.repeatLootTotals || {};
          d.repeatCycleNum = null;
          d.repeatLootTotals = null;
          const finishedDungeonKey = state.currentDungeon;
          DungeonModule.leaveToCity();
          UI.showRepeatCycleResultModal(finishedDungeonKey, lootTotals);
        }
      } else {
        // fim de ciclo normal: avança pro próximo automaticamente, sem
        // perguntar — pra sair, o jogador usa o botão "Voltar pra cidade" do
        // cabeçalho (ver OnboardingModule.isFirstDungeonEntry). Ciclo MÁXIMO
        // (CONFIG.maxCycleNum): ao bater o chefe do último ciclo, não existe
        // "próximo" — volta pro monstro 1 DESSE MESMO ciclo, que passa a se
        // repetir pra sempre (ver também o clamp de saves antigos no topo de
        // spawn()).
        if(justFinishedCycle >= CONFIG.maxCycleNum){
          d.killCount = kpc * (CONFIG.maxCycleNum - 1);
          d.pendingSlot = null;
        }
        this.spawn(false);
        UI.renderAll();
      }
    } else {
      this.spawn(false);
      UI.renderAll();
    }
  }
};
