// ═══════════════════════════════════════
// js/core/battle.js  —  combat engine v3
// Per-slot speed/slow/freeze; 2×6 grid UI data
// ═══════════════════════════════════════
'use strict';

window.BattleEngine = (() => {

  const TICK_MS     = 100;
  const BURN_TICK   = 500;
  const POISON_TICK = 1000;
  const MAX_SIM_MS  = 90_000;

  let _running = false, _speed = 1, _tid = null;
  let _onLog, _onTick, _onEnd;
  let player, enemy;
  let playerSlots, enemySlots;
  let burnTimer, poisonTimer, simTime;

  // ─────────────────────────────────────────────────────────────
  // COMBATANT  (shared HP/shield/poison/burn for each side)
  // ─────────────────────────────────────────────────────────────
  function _mkComb(hp, name) {
    return { name, hp, maxHp: hp, shield: 0,
             poisonLayers: 0, burnStacks: [] };
  }

  // ─────────────────────────────────────────────────────────────
  // SLOT  (one card in battle; carries its own CD + status)
  // ─────────────────────────────────────────────────────────────
  function _mkSlot(cardId, def, col, row, instanceId, overrides) {
    const cdMax = def.active ? def.active.cd * 1000 : Infinity;
    return {
      instanceId, cardId, def, col, row,
      cdMax,
      cdCurrent: cdMax * (0.1 + Math.random() * 0.5),
      attackCount: 1,
      damageBonus: 0,
      extraEffects: [],
      // Per-slot status (in sim-ms)
      speedUntil:  -1,
      slowUntil:   -1,
      frozenUntil: -1,
      _firstStrikeDone: false,
      ...overrides,
    };
  }

  function _cdMult(slot) {
    if (slot.frozenUntil >= simTime) return 0;
    let m = 1;
    if (slot.speedUntil >= simTime) m *= 2;
    if (slot.slowUntil  >= simTime) m *= 0.5;
    return m;
  }

  // ─────────────────────────────────────────────────────────────
  // SETUP
  // ─────────────────────────────────────────────────────────────
  function setup(playerBag, enemyDef, playerHp, playerMaxHp, cbs) {
    _onLog = cbs.onLog || (()=>{}); _onTick = cbs.onTick || (()=>{}); _onEnd = cbs.onEnd || (()=>{});
    const st = window.State.get();

    player = _mkComb(playerHp, 'YOU');   player.maxHp = playerMaxHp;
    enemy  = _mkComb(1500, enemyDef.name || 'ENEMY');

    playerSlots = _buildPlayerSlots(playerBag, st.instances);
    enemySlots  = _buildEnemySlots(enemyDef.bag || []);

    _applyStatic(playerSlots, enemySlots);
    _applyStatic(enemySlots,  playerSlots);

    burnTimer = 0; poisonTimer = 0; simTime = 0;
    _log(`⚡ 戰鬥：YOU vs ${enemy.name}`, 'log-status');
    _log(`我方 ${playerSlots.length} 張卡：${playerSlots.map(s=>s.def.name).join('、')}`, 'log-status');
    _log(`敵方 ${enemySlots.length} 張卡：${enemySlots.map(s=>s.def.name).join('、')}`, 'log-status');
    if (playerSlots.length === 0) _log('⚠ 警告：我方背包沒有卡牌！', 'log-lose');
  }

  function _buildPlayerSlots(bag, instances) {
    return bag.map(s => {
      const inst = instances[s.instanceId];
      if (!inst) return null;
      const def = window.getCard(inst.cardId);
      if (!def) return null;
      return _mkSlot(inst.cardId, def, s.col, s.row, s.instanceId, {
        damageBonus: inst.damageBonus || 0,
        extraEffects: inst.extraEffects || [],
      });
    }).filter(Boolean);
  }

  function _buildEnemySlots(bagCfg) {
    return bagCfg.map((s, i) => {
      const def = window.getCard(s.cardId);
      if (!def || !def.active) return null;
      return _mkSlot(s.cardId, def, s.col, s.row, `e_${s.cardId}_${i}`, {});
    }).filter(Boolean);
  }

  // ─────────────────────────────────────────────────────────────
  // STATIC PASSIVES  (computed once at battle start)
  // ─────────────────────────────────────────────────────────────
  function _applyStatic(slots, oppSlots) {
    for (const slot of slots) {
      if (!slot.def.passive) continue;
      for (const p of slot.def.passive) {
        if (p.trigger !== 'static') continue;
        switch (p.effect) {
          case 'attack_count_per_ally_type':
            slot.attackCount += slots.filter(s => s.def.type === p.typeTag).length;
            break;
          case 'attack_count_per_adjacent_type':
            slot.attackCount += _adj(slot, slots).filter(s => s.def.type === p.typeTag).length;
            break;
          case 'adjacent_attack_count_up':
            _adj(slot, slots).forEach(a => a.attackCount += (p.value||1));
            break;
          case 'adjacent_cd_reduction':
            _adj(slot, slots).forEach(a => {
              a.cdMax = Math.max(500, a.cdMax * (1 - p.value));
              a.cdCurrent = Math.min(a.cdCurrent, a.cdMax);
            });
            break;
          case 'attack_count_per_enemy_pairs':
            slot.attackCount += Math.floor(oppSlots.length / 2);
            break;
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ADJACENCY  (physical grid adjacency, same as bag)
  // ─────────────────────────────────────────────────────────────
  function _adj(slot, slots) {
    return slots.filter(s => {
      if (s.instanceId === slot.instanceId) return false;
      for (let a = 0; a < slot.def.size; a++)
        for (let b = 0; b < s.def.size; b++) {
          const dc = Math.abs((slot.col+a) - (s.col+b));
          const dr = Math.abs(slot.row - s.row);
          if ((dc===1&&dr===0)||(dc===0&&dr===1)) return true;
        }
      return false;
    });
  }

  // ─────────────────────────────────────────────────────────────
  // TICK
  // ─────────────────────────────────────────────────────────────
  function tick() {
    const step = TICK_MS * _speed;
    simTime += step;
    if (simTime > MAX_SIM_MS) { endBattle('timeout'); return; }

    _advSlots(playerSlots, player, enemy, step);
    _advSlots(enemySlots,  enemy,  player, step);

    burnTimer += step;
    while (burnTimer >= BURN_TICK) {
      burnTimer -= BURN_TICK;
      const pd = _tickBurn(player), ed = _tickBurn(enemy);
      if (pd>0) _log(`🔥 YOU 受到 ${pd} 燃燒傷害`, 'log-fire');
      if (ed>0) _log(`🔥 ${enemy.name} 受到 ${ed} 燃燒傷害`, 'log-fire');
    }
    poisonTimer += step;
    while (poisonTimer >= POISON_TICK) {
      poisonTimer -= POISON_TICK;
      const pd = _tickPoison(player), ed = _tickPoison(enemy);
      if (pd>0) _log(`☠ YOU 受到 ${pd} 剧毒傷害`, 'log-poison');
      if (ed>0) _log(`☠ ${enemy.name} 受到 ${ed} 剧毒傷害`, 'log-poison');
    }

    if (player.hp <= 0) { endBattle('lose'); return; }
    if (enemy.hp  <= 0) { endBattle('win');  return; }
    _onTick({ player, enemy, playerSlots, enemySlots, simTime });
  }

  function _advSlots(slots, self, opp, step) {
    for (const slot of slots) {
      if (!slot.def.active) continue;
      const m = _cdMult(slot);
      if (m === 0) continue;
      slot.cdCurrent -= step * m;
      if (slot.cdCurrent <= 0) {
        slot.cdCurrent = slot.cdMax;
        for (let i = 0; i < slot.attackCount; i++)
          _activate(slot, slots, self, opp);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ACTIVATE
  // ─────────────────────────────────────────────────────────────
  function _activate(slot, allSlots, self, opp) {
    const act = slot.def.active;
    const tdmg = (act.value || 0) + (slot.damageBonus || 0);

    // Notify passive triggers on allies
    for (const s of allSlots) {
      if (s.instanceId === slot.instanceId) continue;
      _passiveEvent('ally_activate', s, slot, allSlots, self);
    }
    for (const a of _adj(slot, allSlots))
      _passiveEvent('adjacent_activate', a, slot, allSlots, self);

    switch (act.effect) {

      // ── Direct damage ──────────────────────────────────────
      case 'damage':
      case 'damage_scaling': {
        const d = _dmg(opp, tdmg);
        _log(`⚡ ${slot.def.name} → ${opp.name} 造成 ${d} 傷害`, 'log-dmg');
        _extra(slot, opp, d); break;
      }
      case 'damage_hp_scaling': {
        const d = _dmg(opp, tdmg * (self.hp/self.maxHp < 0.5 ? 2 : 1));
        _log(`⚡ ${slot.def.name} 造成 ${d} 傷害`, 'log-dmg'); _extra(slot,opp,d); break;
      }
      case 'damage_if_speed': {
        const bonus = slot.speedUntil >= simTime ? (act.bonusIfSpeed||0) : 0;
        const d = _dmg(opp, tdmg + bonus);
        _log(`⚡ ${slot.def.name} 造成 ${d} 傷害${bonus?` (+${bonus}加速)`:''}`,'log-dmg');
        _extra(slot,opp,d); break;
      }
      case 'damage_plus_per_enemy_shield': {
        const d = _dmg(opp, tdmg + opp.shield*(act.perShield||0));
        _log(`⚡ ${slot.def.name} 造成 ${d} 傷害`,'log-dmg'); _extra(slot,opp,d); break;
      }
      case 'damage_plus_slow': {
        const d = _dmg(opp, tdmg);
        const isP = !slot.instanceId.startsWith('e_');
        _slowAllOpp(isP, act.slowDur||2);
        _log(`⚡ ${slot.def.name} 造成 ${d} 傷害 + 減速`,'log-dmg'); _extra(slot,opp,d); break;
      }
      case 'damage_plus_slow_all': {
        const d = _dmg(opp, tdmg);
        const isP2 = !slot.instanceId.startsWith('e_');
        _slowAllOpp(isP2, act.slowDur||3);
        _log(`⚡ ${slot.def.name} 造成 ${d} 傷害 + 全體減速`,'log-dmg'); _extra(slot,opp,d); break;
      }
      case 'damage_vs_slowed': {
        const sl = enemySlots.some(s=>s.slowUntil>=simTime||s.frozenUntil>=simTime);
        const d = _dmg(opp, tdmg * (sl?2:1));
        _log(`⚡ ${slot.def.name} 造成 ${d} 傷害${sl?' (×2)':''}`,'log-dmg'); _extra(slot,opp,d); break;
      }
      case 'damage_first_strike': {
        const b = slot._firstStrikeDone ? 0 : (act.firstBonus||0);
        slot._firstStrikeDone = true;
        const d = _dmg(opp, tdmg+b);
        _log(`⚡ ${slot.def.name} 造成 ${d} 傷害${b?' (首擊)':''}`,'log-dmg'); _extra(slot,opp,d); break;
      }
      case 'damage_cd_grow': {
        const d = _dmg(opp, tdmg); slot.cdMax += (act.cdGrow||500);
        _log(`⚡ ${slot.def.name} 造成 ${d} 傷害 (CD↑)`,'log-dmg'); _extra(slot,opp,d); break;
      }

      // ── DoT ───────────────────────────────────────────────
      case 'poison': case 'poison_all':
        opp.poisonLayers += act.value;
        _log(`☠ ${slot.def.name} → ${opp.name} +${act.value}剧毒`,'log-poison'); break;
      case 'burn':
        opp.burnStacks.push({layers:act.value, addedAtMs:simTime});
        _log(`🔥 ${slot.def.name} → ${opp.name} +${act.value}燃燒`,'log-fire'); break;
      case 'damage_plus_burn_pct': {
        const d = _dmg(opp, tdmg);
        const bl = Math.max(1, Math.round(tdmg*(act.burnPct||0.2)));
        opp.burnStacks.push({layers:bl, addedAtMs:simTime});
        _log(`⚡ ${slot.def.name} 造成 ${d} 傷害 +${bl}燃燒`,'log-fire'); break;
      }

      // ── Speed (per-slot, only affects specified targets) ───
      case 'speed_adjacent':
        // Apply speed only to adjacent slots
        _adj(slot, allSlots).forEach(a => _applySpeedSlot(a, act.value));
        _log(`💨 ${slot.def.name} 相鄰卡牌加速 ${act.value}s`,'log-status'); break;

      case 'speed_random_allies': {
        // Pick random ally slots (not self)
        const pool = allSlots.filter(s=>s.instanceId!==slot.instanceId);
        const n = Math.min(act.count||2, pool.length);
        pool.sort(()=>Math.random()-0.5).slice(0,n).forEach(s=>_applySpeedSlot(s,act.value));
        _log(`💨 ${slot.def.name} 隨機 ${n} 個卡牌加速`,'log-status'); break;
      }
      case 'speed_one_slow_one': {
        // Speed: one random ally slot; Slow: one random enemy slot
        const ally = allSlots.filter(s=>s.instanceId!==slot.instanceId);
        if (ally.length) _applySpeedSlot(ally[Math.floor(Math.random()*ally.length)], act.speedVal||2);
        const oppSl = (slot.instanceId.startsWith('e_') ? playerSlots : enemySlots);
        if (oppSl.length) _applySlowSlot(oppSl[Math.floor(Math.random()*oppSl.length)], act.slowVal||2);
        _log(`💨 ${slot.def.name} 加速我方/減速敵方`,'log-status'); break;
      }
      case 'speed_all_allies_plus_hits':
        allSlots.forEach(s => _applySpeedSlot(s, act.value));
        _log(`💨 ${slot.def.name} 全體加速 ${act.value}s`,'log-status'); break;

      // ── Shield/Heal ────────────────────────────────────────
      case 'shield_self':
        self.shield += Math.round(act.value);
        _log(`🛡 ${slot.def.name} 獲得 ${act.value} 護盾`,'log-status'); break;
      case 'shield_per_ally':
        self.shield += Math.round(act.value * allSlots.length);
        _log(`🛡 ${slot.def.name} 獲得 ${act.value*allSlots.length} 護盾`,'log-status'); break;
      case 'shield_all':
        self.shield += Math.round(act.value);
        _log(`🛡 ${slot.def.name} 護盾 +${act.value}`,'log-status'); break;
      case 'heal_player': {
        const h = Math.min(act.value, self.maxHp-self.hp); self.hp += h;
        _log(`💚 ${slot.def.name} 恢復 ${h} HP`,'log-heal'); break;
      }
      case 'freeze': {
        const isP3 = !slot.instanceId.startsWith('e_');
        const targets = isP3 ? enemySlots : playerSlots;
        targets.forEach(s => _applyFreezeSlot(s, act.value));
        _log(`❄ ${slot.def.name} 冰凍對方 ${act.value}s`,'log-status'); break;
      }
    }
  }

  function _applySpeedSlot(s, sec)  { s.speedUntil  = Math.max(s.speedUntil,  simTime + sec*1000); }
  function _applySlowSlot(s, sec)   { s.slowUntil   = Math.max(s.slowUntil,   simTime + sec*1000); }
  function _applyFreezeSlot(s, sec) { s.frozenUntil = Math.max(s.frozenUntil, simTime + sec*1000); }

  // Slow all slots of the opponent side
  function _slowAllOpp(isPlayerSlot, sec) {
    const targets = isPlayerSlot ? enemySlots : playerSlots;
    targets.forEach(s => _applySlowSlot(s, sec));
  }

  // ─────────────────────────────────────────────────────────────
  // DAMAGE / DoT
  // ─────────────────────────────────────────────────────────────
  function _dmg(c, amount, type='physical') {
    let d = Math.max(0, Math.round(amount));
    if (d === 0) return 0;
    if (type === 'burn') {
      if (c.shield > 0) d = Math.round(d * 0.5);
    } else if (type !== 'poison') {
      const abs = Math.min(c.shield, d); c.shield -= abs; d -= abs;
    }
    c.hp = Math.max(0, c.hp - d);
    return d;
  }

  function _tickBurn(c) {
    let total = 0;
    c.burnStacks = c.burnStacks.filter(s => {
      const layersNow = Math.max(0, s.layers - Math.floor((simTime - s.addedAtMs)/1000));
      total += layersNow;
      return layersNow > 0;
    });
    return total > 0 ? _dmg(c, total, 'burn') : 0;
  }
  function _tickPoison(c) {
    return c.poisonLayers > 0 ? _dmg(c, c.poisonLayers, 'poison') : 0;
  }

  // ─────────────────────────────────────────────────────────────
  // PASSIVES (dynamic triggers)
  // ─────────────────────────────────────────────────────────────
  function _passiveEvent(trigger, slot, activator, allSlots, self) {
    if (!slot.def.passive) return;
    for (const p of slot.def.passive) {
      if (p.trigger !== trigger) continue;
      if (p.effect === 'self_charge')    slot.cdCurrent = Math.max(0, slot.cdCurrent - p.value*1000);
      if (p.effect === 'self_speed')     _applySpeedSlot(slot, p.value);
      if (p.effect === 'self_damage_up') slot.damageBonus += p.value;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MERGE EXTRA EFFECTS
  // ─────────────────────────────────────────────────────────────
  function _extra(slot, opp, baseDmg) {
    for (const fx of (slot.extraEffects||[])) {
      switch(fx) {
        case 'damage_extra': { const b=Math.round(baseDmg*0.3); _dmg(opp,b); _log(`  ✨ +${b}傷害`,'log-dmg'); break; }
        case 'poison_extra': opp.poisonLayers+=2; _log(`  ✨ +2剧毒`,'log-poison'); break;
        case 'burn_extra':   opp.burnStacks.push({layers:2,addedAtMs:simTime}); _log(`  ✨ +2燃燒`,'log-fire'); break;
        case 'cd_reduce':    slot.cdCurrent = Math.max(0, slot.cdCurrent-1000); break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // STATUS SNAPSHOT (for UI, uses simTime)
  // ─────────────────────────────────────────────────────────────
  function getStatusSnap(c, slots) {
    const s = [];
    if (c.shield > 0) s.push({type:'shield', val:c.shield});
    if (c.poisonLayers > 0) s.push({type:'poison', val:c.poisonLayers});
    const burn = c.burnStacks.reduce((a,b)=>a+Math.max(0,b.layers-Math.floor((simTime-b.addedAtMs)/1000)),0);
    if (burn > 0) s.push({type:'burn', val:burn});
    return s;
  }

  function getSlotStatusSnap(slot) {
    const s = [];
    if (slot.speedUntil  >= simTime) s.push({type:'speed',  val:((slot.speedUntil -simTime)/1000).toFixed(1)});
    if (slot.slowUntil   >= simTime) s.push({type:'slow',   val:((slot.slowUntil  -simTime)/1000).toFixed(1)});
    if (slot.frozenUntil >= simTime) s.push({type:'freeze', val:((slot.frozenUntil-simTime)/1000).toFixed(1)});
    return s;
  }

  // ─────────────────────────────────────────────────────────────
  // END
  // ─────────────────────────────────────────────────────────────
  function endBattle(result) {
    stop();
    const st = window.State.get();
    if (result === 'win') {
      _log(`✅ 勝利！擊敗 ${enemy.name}`, 'log-win');
      st.wins++;
      for (const slot of playerSlots) {
        const act = slot.def.active;
        if (act && act.perBattle) {
          const inst = st.instances[slot.instanceId];
          if (inst) inst.damageBonus = (inst.damageBonus||0) + act.perBattle;
        }
      }
      const gold = 3 + Math.floor(Math.random()*4);
      window.State.gainGold(gold);
      _log(`💰 獲得 ${gold} 金幣`, 'log-status');
    } else if (result==='lose') {
      _log(`💀 YOU HP歸零，失敗`, 'log-lose');
      st.losses++;
    } else {
      _log(`⏱ 超時`, 'log-status');
    }
    st.battleCount++;
    _onEnd({result, player, enemy});
  }

  function _log(m,c='') { _onLog&&_onLog(m,c); }
  function start() { if(_running)return; _running=true; _tid=setInterval(tick,TICK_MS); }
  function stop()  { _running=false; if(_tid){clearInterval(_tid);_tid=null;} }
  function setSpeed(s){_speed=s;} function getSpeed(){return _speed;}

  return {
    setup, start, stop, setSpeed, getSpeed,
    getPlayer:()=>player, getEnemy:()=>enemy,
    getPlayerSlots:()=>playerSlots, getEnemySlots:()=>enemySlots,
    getStatusSnap, getSlotStatusSnap,
  };
})();
