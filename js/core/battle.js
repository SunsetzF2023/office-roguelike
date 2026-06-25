// ═══════════════════════════════════════
// js/core/battle.js  —  combat engine (unified sim time)
// ═══════════════════════════════════════
'use strict';

window.BattleEngine = (() => {

  const SE = window.StatusEngine;
  const TICK_MS    = 100;
  const BURN_TICK  = 500;
  const POISON_TICK= 1000;
  const MAX_SIM_MS = 120_000;

  let _running    = false;
  let _speed      = 1;
  let _intervalId = null;
  let _onLog = null, _onTick = null, _onEnd = null;

  let player = null, enemy = null;
  let playerSlots = [], enemySlots = [];
  let burnTimer = 0, poisonTimer = 0, simTime = 0;

  // ── Setup ─────────────────────────────────────────────────────
  function setup(playerBag, enemyDef, playerHp, playerMaxHp, callbacks) {
    _onLog  = callbacks.onLog  || (() => {});
    _onTick = callbacks.onTick || (() => {});
    _onEnd  = callbacks.onEnd  || (() => {});

    const st = window.State.get();

    player = _makeCombatant(playerHp, playerMaxHp, 'YOU');
    enemy  = _makeCombatant(1500, 1500, enemyDef.name || 'ENEMY');

    playerSlots = _buildPlayerSlots(playerBag, st.instances);
    enemySlots  = _buildEnemySlots(enemyDef.bag);

    _applyStaticPassives(playerSlots, 'player');
    _applyStaticPassives(enemySlots,  'enemy');

    burnTimer = 0; poisonTimer = 0; simTime = 0;
    _log(`⚡ 戰鬥開始：YOU vs ${enemy.name}`, 'log-status');
  }

  // ── Combatant ─────────────────────────────────────────────────
  function _makeCombatant(hp, maxHp, name) {
    return {
      name, hp, maxHp,
      shield: 0,
      poisonLayers: 0,
      burnStacks: [],     // [{layers, addedAtMs}]  uses simTime
      speedUntil: -1,     // simTime ms
      slowUntil:  -1,
      frozenUntil:-1,
      damageBonus: 0,
    };
  }

  // ── Slot builders ─────────────────────────────────────────────
  function _buildPlayerSlots(bag, instances) {
    return bag.map(s => {
      const inst = instances[s.instanceId];
      if (!inst) return null;
      const def = window.getCard(inst.cardId);
      if (!def) return null;
      const cdMax = def.active ? def.active.cd * 1000 : Infinity;
      return {
        instanceId: s.instanceId,
        cardId: inst.cardId, def,
        col: s.col, row: s.row,
        cdMax,
        cdCurrent: def.active ? cdMax * (0.1 + Math.random() * 0.5) : Infinity,
        attackCount: 1 + (inst.attackCountBonus || 0),
        damageBonus: inst.damageBonus || 0,
        extraEffects: inst.extraEffects || [],
        _firstStrikeDone: false,
      };
    }).filter(Boolean);
  }

  function _buildEnemySlots(bagConfig) {
    return (bagConfig || []).map((s, i) => {
      const def = window.getCard(s.cardId);
      if (!def || !def.active) return null;
      const cdMax = def.active.cd * 1000;
      return {
        instanceId: `e_${s.cardId}_${i}`,
        cardId: s.cardId, def,
        col: s.col, row: s.row,
        cdMax,
        cdCurrent: cdMax * (0.1 + Math.random() * 0.5),
        attackCount: 1,
        damageBonus: 0,
        extraEffects: [],
        _firstStrikeDone: false,
      };
    }).filter(Boolean);
  }

  // ── Static passives ───────────────────────────────────────────
  function _applyStaticPassives(slots, side) {
    const oppSlots = side === 'player' ? enemySlots : playerSlots;
    for (const slot of slots) {
      if (!slot.def.passive) continue;
      for (const p of slot.def.passive) {
        if (p.trigger !== 'static') continue;
        switch (p.effect) {
          case 'attack_count_per_ally_type':
            slot.attackCount += slots.filter(s => s.def.type === p.typeTag).length;
            break;
          case 'attack_count_per_adjacent_type':
            slot.attackCount += _adjSlots(slot, slots).filter(s => s.def.type === p.typeTag).length;
            break;
          case 'adjacent_attack_count_up':
            _adjSlots(slot, slots).forEach(a => a.attackCount += p.value);
            break;
          case 'adjacent_cd_reduction':
            _adjSlots(slot, slots).forEach(a => { a.cdMax *= (1 - p.value); a.cdCurrent = Math.min(a.cdCurrent, a.cdMax); });
            break;
          case 'attack_count_per_enemy_pairs':
            slot.attackCount += Math.floor(oppSlots.length / 2);
            break;
        }
      }
    }
  }

  // ── Adjacent helper ───────────────────────────────────────────
  function _adjSlots(slot, slots) {
    return slots.filter(s => {
      if (s.instanceId === slot.instanceId) return false;
      for (let a = 0; a < slot.def.size; a++)
        for (let b = 0; b < s.def.size; b++) {
          const dc = Math.abs((slot.col+a)-(s.col+b));
          const dr = Math.abs(slot.row - s.row);
          if ((dc===1&&dr===0)||(dc===0&&dr===1)) return true;
        }
      return false;
    });
  }

  // ── CD speed (uses simTime) ────────────────────────────────────
  function _cdMult(comb) {
    if (comb.frozenUntil >= simTime) return 0;
    let m = 1;
    if (comb.speedUntil >= simTime) m *= 2;
    if (comb.slowUntil  >= simTime) m *= 0.5;
    return m;
  }

  // ── Main tick ─────────────────────────────────────────────────
  function tick() {
    const dt = TICK_MS;               // real tick = 100ms
    const step = dt * _speed;         // sim advance per real tick
    simTime += step;

    if (simTime > MAX_SIM_MS) { endBattle('timeout'); return; }

    // Advance CDs
    _advanceSlots(playerSlots, player, enemy, step);
    _advanceSlots(enemySlots,  enemy,  player, step);

    // Burn (every BURN_TICK sim-ms)
    burnTimer += step;
    while (burnTimer >= BURN_TICK) {
      burnTimer -= BURN_TICK;
      const pd = _tickBurn(player);
      const ed = _tickBurn(enemy);
      if (pd > 0) _log(`🔥 YOU 受到 ${pd} 點燃燒傷害`, 'log-fire');
      if (ed > 0) _log(`🔥 ${enemy.name} 受到 ${ed} 點燃燒傷害`, 'log-fire');
    }

    // Poison (every POISON_TICK sim-ms)
    poisonTimer += step;
    while (poisonTimer >= POISON_TICK) {
      poisonTimer -= POISON_TICK;
      const pd = _tickPoison(player);
      const ed = _tickPoison(enemy);
      if (pd > 0) _log(`☠ YOU 受到 ${pd} 點劇毒傷害`, 'log-poison');
      if (ed > 0) _log(`☠ ${enemy.name} 受到 ${ed} 點劇毒傷害`, 'log-poison');
    }

    if (player.hp <= 0) { endBattle('lose'); return; }
    if (enemy.hp  <= 0) { endBattle('win');  return; }

    _onTick({ player, enemy, playerSlots, enemySlots, simTime });
  }

  function _advanceSlots(slots, self, opp, step) {
    const mult = _cdMult(self);
    if (mult === 0) return;
    for (const slot of slots) {
      if (!slot.def.active) continue;
      slot.cdCurrent -= step * mult;
      if (slot.cdCurrent <= 0) {
        slot.cdCurrent = slot.cdMax;
        for (let i = 0; i < slot.attackCount; i++)
          _activate(slot, self, opp, slots);
      }
    }
  }

  // ── Skill activation ─────────────────────────────────────────
  function _activate(slot, self, opp, allSlots) {
    const def = slot.def;
    const act = def.active;

    // Trigger passive: ally_activate on siblings
    for (const s of allSlots) {
      if (s.instanceId === slot.instanceId) continue;
      _notifyPassive('ally_activate', s, slot, allSlots, self);
    }
    // Adjacent_activate
    for (const a of _adjSlots(slot, allSlots))
      _notifyPassive('adjacent_activate', a, slot, allSlots, self);

    const totalDmg = (act.value || 0) + (slot.damageBonus || 0);

    switch (act.effect) {
      case 'damage':
      case 'damage_scaling': {
        const d = _dmg(opp, totalDmg);
        _log(`⚡ ${def.name} → ${opp.name} 造成 ${d} 傷害`, 'log-dmg');
        _extra(slot, opp, d);
        break;
      }
      case 'damage_hp_scaling': {
        const val = totalDmg * (self.hp/self.maxHp < 0.5 ? 2 : 1);
        const d = _dmg(opp, val);
        _log(`⚡ ${def.name} → ${opp.name} 造成 ${d} 傷害`, 'log-dmg');
        _extra(slot, opp, d);
        break;
      }
      case 'damage_if_speed': {
        const val = totalDmg + (self.speedUntil >= simTime ? (act.bonusIfSpeed||0) : 0);
        const d = _dmg(opp, val);
        _log(`⚡ ${def.name} → ${opp.name} 造成 ${d} 傷害`, 'log-dmg');
        _extra(slot, opp, d);
        break;
      }
      case 'damage_plus_per_enemy_shield': {
        const val = totalDmg + opp.shield * (act.perShield||0);
        const d = _dmg(opp, val);
        _log(`⚡ ${def.name} → ${opp.name} 造成 ${d} 傷害`, 'log-dmg');
        _extra(slot, opp, d);
        break;
      }
      case 'damage_plus_slow': {
        const d = _dmg(opp, totalDmg);
        _slow(opp, act.slowDur||2);
        _log(`⚡ ${def.name} 造成 ${d} 傷害 + 減速 ${act.slowDur||2}s`, 'log-dmg');
        _extra(slot, opp, d);
        break;
      }
      case 'damage_plus_slow_all': {
        const d = _dmg(opp, totalDmg);
        _slow(opp, act.slowDur||3);
        _log(`⚡ ${def.name} 造成 ${d} 傷害 + 全體減速`, 'log-dmg');
        _extra(slot, opp, d);
        break;
      }
      case 'damage_vs_slowed': {
        const slowed = opp.slowUntil >= simTime || opp.frozenUntil >= simTime;
        const d = _dmg(opp, totalDmg * (slowed ? 2 : 1));
        _log(`⚡ ${def.name} 造成 ${d} 傷害${slowed?' (×2)':''}`, 'log-dmg');
        _extra(slot, opp, d);
        break;
      }
      case 'damage_first_strike': {
        const bonus = slot._firstStrikeDone ? 0 : (act.firstBonus||0);
        slot._firstStrikeDone = true;
        const d = _dmg(opp, totalDmg + bonus);
        _log(`⚡ ${def.name} 造成 ${d} 傷害${bonus?' (首擊)':''}`, 'log-dmg');
        _extra(slot, opp, d);
        break;
      }
      case 'damage_cd_grow': {
        const d = _dmg(opp, totalDmg);
        slot.cdMax += (act.cdGrow||500);
        _log(`⚡ ${def.name} 造成 ${d} 傷害（CD+）`, 'log-dmg');
        _extra(slot, opp, d);
        break;
      }
      case 'damage_scaling_per_battle':
        // handled on endBattle; same as damage for now
        { const d = _dmg(opp, totalDmg); _log(`⚡ ${def.name} 造成 ${d} 傷害`, 'log-dmg'); _extra(slot, opp, d); break; }
      case 'poison':
      case 'poison_all':
        _addPoison(opp, act.value);
        _log(`☠ ${def.name} → ${opp.name} 施加 ${act.value} 層剧毒`, 'log-poison');
        break;
      case 'burn':
        _addBurn(opp, act.value);
        _log(`🔥 ${def.name} → ${opp.name} 施加 ${act.value} 層燃燒`, 'log-fire');
        break;
      case 'damage_plus_burn_pct': {
        const d = _dmg(opp, totalDmg);
        const bl = Math.max(1, Math.round(totalDmg * (act.burnPct||0.2)));
        _addBurn(opp, bl);
        _log(`⚡ ${def.name} 造成 ${d} 傷害 + ${bl} 層燃燒`, 'log-fire');
        break;
      }
      case 'speed_adjacent':
        _adjSlots(slot, allSlots).forEach(() => _speed_comb(self, act.value));
        _log(`💨 ${def.name} 相鄰加速 ${act.value}s`, 'log-status');
        break;
      case 'speed_random_allies': {
        const n = Math.min(act.count||2, allSlots.length);
        for (let i=0;i<n;i++) _speed_comb(self, act.value);
        _log(`💨 ${def.name} 隨機 ${n} 角色加速`, 'log-status');
        break;
      }
      case 'speed_one_slow_one':
        _speed_comb(self, act.speedVal||2);
        _slow(opp, act.slowVal||2);
        _log(`💨 ${def.name} 加速我方/減速敵方`, 'log-status');
        break;
      case 'speed_all_allies_plus_hits':
        _speed_comb(self, act.value);
        _log(`💨 ${def.name} 全體加速`, 'log-status');
        break;
      case 'shield_self':
        _addShield(self, act.value);
        _log(`🛡 ${def.name} 獲得 ${act.value} 護盾`, 'log-status');
        break;
      case 'shield_per_ally':
        _addShield(self, act.value * allSlots.length);
        _log(`🛡 ${def.name} 獲得 ${act.value * allSlots.length} 護盾`, 'log-status');
        break;
      case 'shield_all':
        _addShield(self, act.value);
        _log(`🛡 ${def.name} 全體護盾 ${act.value}`, 'log-status');
        break;
      case 'heal_player':
        { const h = Math.min(act.value, self.maxHp - self.hp);
          self.hp += h;
          _log(`💚 ${def.name} 恢復 ${h} HP`, 'log-heal'); break; }
      case 'freeze':
        _freeze(opp, act.value);
        _log(`❄ ${def.name} → ${opp.name} 冰凍 ${act.value}s`, 'log-status');
        break;
    }
  }

  // ── Status helpers (sim-time based) ───────────────────────────
  function _speed_comb(c, sec) { c.speedUntil  = Math.max(c.speedUntil,  simTime + sec*1000); }
  function _slow(c, sec)       { c.slowUntil   = Math.max(c.slowUntil,   simTime + sec*1000); }
  function _freeze(c, sec)     { c.frozenUntil = Math.max(c.frozenUntil, simTime + sec*1000); }
  function _addShield(c, n)    { c.shield += Math.max(0, Math.round(n)); }
  function _addPoison(c, n)    { c.poisonLayers += Math.round(n); }
  function _addBurn(c, n)      { c.burnStacks.push({ layers: Math.round(n), addedAtMs: simTime }); }

  function _dmg(c, amount, type='physical') {
    let d = Math.max(0, Math.round(amount));
    if (d === 0) return 0;
    if (type === 'burn') {
      if (c.shield > 0) d = Math.round(d * 0.5);
    } else if (type !== 'poison') {
      const abs = Math.min(c.shield, d);
      c.shield -= abs; d -= abs;
    }
    c.hp = Math.max(0, c.hp - d);
    return d;
  }

  function _tickBurn(c) {
    // Each stack: damage = layers each 0.5s, layers decrease by 1 each 1s
    let total = 0;
    const alive = [];
    for (const s of c.burnStacks) {
      const elapsed = (simTime - s.addedAtMs) / 1000;
      const layersNow = Math.max(0, s.layers - Math.floor(elapsed));
      if (layersNow > 0) { alive.push(s); total += layersNow; }
    }
    c.burnStacks = alive;
    return total > 0 ? _dmg(c, total, 'burn') : 0;
  }

  function _tickPoison(c) {
    if (c.poisonLayers <= 0) return 0;
    return _dmg(c, c.poisonLayers, 'poison');
  }

  // ── Passive notification ──────────────────────────────────────
  function _notifyPassive(trigger, slot, activator, allSlots, self) {
    if (!slot.def.passive) return;
    for (const p of slot.def.passive) {
      if (p.trigger !== trigger) continue;
      if (p.effect === 'self_charge')    slot.cdCurrent = Math.max(0, slot.cdCurrent - p.value*1000);
      if (p.effect === 'self_speed')     _speed_comb(self, p.value);
      if (p.effect === 'self_damage_up') slot.damageBonus += p.value;
    }
  }

  // ── Merge extra effects ───────────────────────────────────────
  function _extra(slot, opp, baseDmg) {
    for (const fx of (slot.extraEffects || [])) {
      switch(fx) {
        case 'damage_extra': { const b=Math.round(baseDmg*0.3); _dmg(opp,b); _log(`  ✨ 合成 +${b}傷害`,'log-dmg'); break; }
        case 'poison_extra': _addPoison(opp,2); _log(`  ✨ 合成附加 2層剧毒`,'log-poison'); break;
        case 'burn_extra':   _addBurn(opp,2);   _log(`  ✨ 合成附加 2層燃燒`,'log-fire'); break;
        case 'cd_reduce':    slot.cdCurrent = Math.max(0, slot.cdCurrent - 1000); break;
      }
    }
  }

  // ── End battle ────────────────────────────────────────────────
  function endBattle(result) {
    stop();
    const st = window.State.get();
    if (result === 'win') {
      _log(`✅ 勝利！擊敗 ${enemy.name}`, 'log-win');
      st.wins++;
      // Persist damage_scaling growth
      for (const slot of playerSlots) {
        const act = slot.def.active;
        if (act && (act.effect === 'damage_scaling' || act.effect === 'audit') && act.perBattle) {
          const inst = st.instances[slot.instanceId];
          if (inst) inst.damageBonus = (inst.damageBonus||0) + act.perBattle;
        }
      }
      const gold = 3 + Math.floor(Math.random()*3);
      window.State.gainGold(gold);
      _log(`💰 獲得 ${gold} 金幣`, 'log-status');
    } else if (result === 'lose') {
      _log(`💀 YOU 的HP歸零，失敗`, 'log-lose');
      st.losses++;
    } else {
      _log(`⏱ 超時平局`, 'log-status');
    }
    st.battleCount++;
    _onEnd({ result, player, enemy });
  }

  // ── Snapshot for UI ──────────────────────────────────────────
  function getStatusSnap(c) {
    const s = [];
    if (c.shield > 0) s.push({ type:'shield', val: c.shield });
    if (c.poisonLayers > 0) s.push({ type:'poison', val: c.poisonLayers });
    const burn = c.burnStacks.reduce((a,b)=>a+Math.max(0,b.layers-Math.floor((simTime-b.addedAtMs)/1000)),0);
    if (burn > 0) s.push({ type:'burn', val: burn });
    if (c.speedUntil  >= simTime) s.push({ type:'speed',  val: Math.ceil((c.speedUntil -simTime)/1000) });
    if (c.slowUntil   >= simTime) s.push({ type:'slow',   val: Math.ceil((c.slowUntil  -simTime)/1000) });
    if (c.frozenUntil >= simTime) s.push({ type:'freeze', val: Math.ceil((c.frozenUntil-simTime)/1000) });
    return s;
  }

  function _log(msg, cls='') { _onLog && _onLog(msg, cls); }

  function start() { if(_running)return; _running=true; _intervalId=setInterval(tick, TICK_MS); }
  function stop()  { _running=false; if(_intervalId){clearInterval(_intervalId);_intervalId=null;} }
  function setSpeed(s) { _speed=s; }
  function getSpeed()  { return _speed; }

  return {
    setup, start, stop, setSpeed, getSpeed,
    getPlayer: () => player,
    getEnemy:  () => enemy,
    getPlayerSlots: () => playerSlots,
    getEnemySlots:  () => enemySlots,
    getStatusSnap,
  };
})();
