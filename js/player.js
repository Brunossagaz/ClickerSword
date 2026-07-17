/* ---------------------------------------------------------------------
   PLAYER MODULE (player.js)
--------------------------------------------------------------------- */
const PlayerModule = {
  // Busca a def da arma ATIVA (state.equippedWeapon) em WEAPON_DEFS (armas
  // iniciais) e depois em FORGED_WEAPON_DEFS (forjadas no Ferreiro) — as
  // duas listas compartilham o mesmo pool de posse (state.weapons) e o
  // mesmo slot de equipada, mas só uma fica ativa por vez.
  equippedWeaponDef(){
    if(!state.equippedWeapon) return null;
    return WEAPON_DEFS.find(w=>w.key===state.equippedWeapon) || FORGED_WEAPON_DEFS.find(w=>w.key===state.equippedWeapon) || null;
  },
  // Troca a arma ativa — só entre as que o jogador já possui
  // (state.weapons[key]>0). Nunca empilha: o bônus de dano/DPS da arma
  // anterior some assim que outra é equipada (ver clickDamage/
  // TroopsModule.totalDps, que leem a arma ativa dinamicamente).
  equipWeapon(key){
    if(!state.weapons[key]) return;
    state.equippedWeapon = key;
    SaveModule.save();
    UI.renderAll();
  },
  // Intervalo atual do upgrade Clique Automático (ver UPGRADE_DEFS
  // battleAutoClick), em ms — começa em `autoClickIntervalMs` (1000) e cai
  // 25 pontos percentuais do valor BASE por upgrade de velocidade comprado
  // (autoClickSpeed1/autoClickSpeed2), acumulando: 1000 → 750 → 500.
  autoClickIntervalMs(){
    const def = UPGRADE_DEFS.find(u=>u.key==='battleAutoClick');
    let interval = def.autoClickIntervalMs;
    if(state.upgrades.autoClickSpeed1 > 0) interval -= def.autoClickIntervalMs * 0.25;
    if(state.upgrades.autoClickSpeed2 > 0) interval -= def.autoClickIntervalMs * 0.25;
    return interval;
  },
  // O Clique Automático só age dentro de uma Dungeon, com monstro ativo, E
  // só no ciclo atual se ele já tiver sido concluído antes (chefe já
  // derrotado ao menos 1x — mesmo dado do seletor de ciclo,
  // state.dungeons[key].maxCycleCompleted). Fora disso ele fica comprado
  // mas pausado — ver UI.renderAutoClickStatus pro aviso na tela.
  isAutoClickActive(){
    if(state.upgrades.battleAutoClick <= 0) return false;
    if(!MonsterModule.current || !state.currentDungeon) return false;
    const d = state.dungeons[state.currentDungeon];
    const cycle = MonsterModule.currentCycleFor(state.currentDungeon);
    return cycle <= (d.maxCycleCompleted || 0);
  },
  clickDamage(){
    // Sem base fixa: o personagem começa com 0 de dano por clique — só sobe
    // com upgrades (Academia, permanente em state.clickDamageFlat) e com a
    // arma ativa (dinâmico, ver equippedWeaponDef — NÃO fica gravado em
    // clickDamageFlat, some se o jogador trocar de arma).
    // clickDamagePercent (Academia de Combate) multiplica em cima do flat.
    const weaponDef = this.equippedWeaponDef();
    const weaponBonus = weaponDef ? weaponDef.clickDamageBonus : 0;
    const base = (state.clickDamageFlat + weaponBonus) * (1+state.clickDamagePercent);
    return base * (1+state.pClickMult);
  },
  handleClick(evt){
    // captura o estado ANTES de aplicar dano: se esse clique também matar o
    // monstro, applyDamage já dispara o spawn do próximo (que reseta
    // isGolden/monsterMaxHp) antes da checagem do bônus dourado abaixo.
    const wasGolden = state.isGolden;
    const goldenType = MonsterModule.current && MonsterModule.current.type;

    // critChanceBonus/critDamageBonus são opcionais (ver WEAPON_DEFS/
    // FORGED_WEAPON_DEFS) — armas sem esses campos simplesmente não somam nada.
    const weaponDef = this.equippedWeaponDef();
    let dmg = this.clickDamage();
    let isCrit = Math.random() < (state.critChance + state.pCritChance + (weaponDef ? (weaponDef.critChanceBonus||0) : 0));
    // critDamagePercent (Academia de Combate) multiplica em cima do critMult
    if(isCrit) dmg *= state.critMult * (1+state.critDamagePercent+(weaponDef ? (weaponDef.critDamageBonus||0) : 0));
    dmg = Math.max(1, Math.round(dmg));
    // burnChance/burnDamagePercent são opcionais (ver WEAPON_DEFS) — chance
    // por clique de aplicar/renovar queimadura, calculada sobre o dano DESTE
    // clique (já com crítico aplicado). Roda ANTES de applyDamage: mesmo que
    // esse clique mate o monstro, aplicar em cima do `current` de agora é
    // inofensivo (o objeto é descartado no spawn do próximo, ver MonsterModule.onDeath).
    if(weaponDef && weaponDef.burnChance && Math.random() < weaponDef.burnChance){
      MonsterModule.applyBurn(dmg * weaponDef.burnDamagePercent);
    }
    MonsterModule.applyDamage(dmg);
    UI.showFloatingDamage(dmg, isCrit, evt);
    UI.screenShake();
    UI.hitFlash();

    // Monstro Dourado: cada clique já rende um pouco do item PRINCIPAL
    // (a 1ª entrada de `drops`, sempre garantida) na hora, sem precisar
    // terminar de matá-lo dentro da janela dourada.
    if(wasGolden){
      const mainDrop = goldenType && goldenType.drops && goldenType.drops[0];
      if(mainDrop){
        const avgQty = (mainDrop.qtyMin + mainDrop.qtyMax) / 2;
        const qty = Math.max(1, Math.round(avgQty * 0.1));
        state.inventory[mainDrop.item] += qty;
        UI.showFloatingItemAt(qty, ITEM_DEFS.find(i=>i.key===mainDrop.item), evt);
      }
      UI.renderStats();
    }
  }
};
