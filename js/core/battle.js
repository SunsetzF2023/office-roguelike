// ═══════════════════════════════════════
// js/core/battle.js  —  combat engine
// ═══════════════════════════════════════
'use strict';

window.BattleEngine = (() => {

  const SE = window.StatusEngine;
  const TICK_MS   = 100;   // simulation tick
  const BURN_TICK = 500;   // burn fires every 500ms
  const POISON_TICK = 1000;// poison fires every 1000ms
  const MAX_SIM_SECONDS = 120;

  let _running    = false;
  let _speed      = 1;
  let _intervalId = null;
  let _onLog      = null;
  let _onTick     = null;
  let _onEnd      = null;

  // ── Battle state ─────────────────────────────────────────────
  let player = null;
  let enemy  = null;

  // Card runtime slots
  // { instanceId, cardId, def, cdMax, cdCurrent, attackCount, damageBonus }
  let playerSlots = [];
  let enemySlots  = [];

  // Timers for periodic DoTs
  let burnTimer   = 0;
  let poisonTimer = 0;
  let simTime     = 0;  // ms

  // ── Setup ─────────────────────────────────────────────────────
  function setup(playerBag, enemyBagConfig, playerHp, playerMaxHp, callbacks) {
    _onLog  = callbacks.onLog  || (() => {});
    _onTick = callbacks.onTick || (() => {});
    _onEnd  = callbacks.onEnd  || (() => {});

    const st = window.State.get();

    player = SE.makeCombatant(playerHp, 'YOU', true);
    player.maxHp = playerMaxHp;

    // Enemy HP scales with tier
    const enemyHp = 1500;
    enemy = SE.makeCombatant(enemyHp, enemyBagConfig.name || 'ENEMY', false);

    // Build player slots from bag
    playerSlots = buildSlots(playerBag, st.instances, true);

    // Build enemy slots from enemy definition bag
    enemySlots  = buildEnemySlots(enemyBagConfig.bag);

    // Apply static passives (G, K, C, F)
    applyStaticPassives(playerSlots, player, 'player');
    applyStaticPassives(enemySlots,  enemy,  'enemy');

    burnTimer   = 0;
    poisonTimer = 0;
    simTime     = 0;

    _log(`⚡ 戰鬥開始：YOU vs ${enemy.name}`, 'log-status');
  }

  function buildSlots(bag, instances, isPlayer) {
    return bag.map(slot => {
      const inst = instances[slot.instanceId];
      if (!inst) return null;
      const def = window.getCard(inst.cardId);
      if (!def) return null;
      // Cards without active skill still participate (for passive effects)
      const cdMax = def.active ? def.active.cd * 1000 : Infinity;
      return {
        instanceId: slot.instanceId,
        cardId: inst.cardId,
        def,
        col: slot.col, row: slot.row,
        cdMax,
        cdCurrent: def.active ? cdMax * Math.random() : Infinity,
        attackCount: 1 + (inst.attackCountBonus || 0),
        damageBonus: inst.damageBonus || 0,
        isPlayer,
      };
    }).filter(Boolean);
  }

  function buildEnemySlots(bagConfig) {
    return (bagConfig || []).map(slot => {
      const def = window.getCard(slot.cardId);
      if (!def || !def.active) return null;
      return {
        instanceId: `enemy_${slot.cardId}_${slot.col}`,
        cardId: slot.cardId,
        def,
        col: slot.col, row: slot.row,
        cdMax: def.active.cd * 1000,
        cdCurrent: def.active.cd * 1000 * Math.random(),
        attackCount: 1,
        damageBonus: 0,
        isPlayer: false,
      };
    }).filter(Boolean);
  }

  // ── Static passive application ────────────────────────────────
  function applyStaticPassives(slots, combatant, side) {
    const st = window.State.get();
    for (const slot of slots) {
      if (!slot.def.passive) continue;
      for (const p of slot.def.passive) {
        if (p.trigger !== 'static') continue;

        if (p.effect === 'attack_count_per_ally_type') {
          // C: count ally slots that are "poison type"
          const count = slots.filter(s => s.def.type === p.typeTag).length;
          slot.attackCount += count;
        }
        if (p.effect === 'attack_count_per_adjacent_type') {
          // F: count adjacent slots with typeTag
          const adj = getAdjacentSlotsRuntime(slot, slots);
          const count = adj.filter(s => s.def.type === p.typeTag).length;
          slot.attackCount += count;
        }
        if (p.effect === 'adjacent_attack_count_up') {
          // G, CFO: give adjacent slots +1 attackCount
          const adj = getAdjacentSlotsRuntime(slot, slots);
          for (const a of adj) a.attackCount += p.value;
        }
        if (p.effect === 'adjacent_cd_reduction') {
          // G, micromanager: reduce adjacent cdMax
          const adj = getAdjacentSlotsRuntime(slot, slots);
          for (const a of adj) a.cdMax *= (1 - p.value);
        }
        if (p.effect === 'attack_count_per_enemy_pairs') {
          // K: enemy count / 2 (floor)
          const enemyCount = side === 'player' ? enemySlots.length : playerSlots.length;
          slot.attackCount += Math.floor(enemyCount / 2);
        }
      }
    }
  }

  function getAdjacentSlotsRuntime(slot, slots) {
    const size = slot.def.size;
    return slots.filter(s => {
      if (s.instanceId === slot.instanceId) return false;
      const sSize = s.def.size;
      // Check if any cell of s is adjacent to any cell of slot
      for (let a = 0; a < size; a++) {
        for (let b = 0; b < sSize; b++) {
          const dc = Math.abs((slot.col + a) - (s.col + b));
          const dr = Math.abs(slot.row - s.row);
          if ((dc === 1 && dr === 0) || (dc === 0 && dr === 1)) return true;
        }
      }
      return false;
    });
  }

  // ── Main simulation tick ──────────────────────────────────────
  function tick() {
    const dt = TICK_MS * _speed;
    const now = performance.now();
    simTime += dt;

    if (simTime > MAX_SIM_SECONDS * 1000) {
      endBattle('timeout');
      return;
    }

    // Advance card CDs
    advanceSlots(playerSlots, player, enemy, now);
    advanceSlots(enemySlots,  enemy,  player, now);

    // Periodic DoTs
    burnTimer   += dt;
    poisonTimer += dt;

    if (burnTimer >= BURN_TICK) {
      burnTimer -= BURN_TICK;
      const pd = SE.tickBurn(player, now);
      const ed = SE.tickBurn(enemy,  now);
      if (pd > 0) _log(`🔥 YOU 受到 ${pd} 點燃燒傷害`, 'log-fire');
      if (ed > 0) _log(`🔥 ${enemy.name} 受到 ${ed} 點燃燒傷害`, 'log-fire');
    }

    if (poisonTimer >= POISON_TICK) {
      poisonTimer -= POISON_TICK;
      const pd = SE.tickPoison(player);
      const ed = SE.tickPoison(enemy);
      if (pd > 0) _log(`☠ YOU 受到 ${pd} 點劇毒傷害`, 'log-poison');
      if (ed > 0) _log(`☠ ${enemy.name} 受到 ${ed} 點劇毒傷害`, 'log-poison');
    }

    // Check death
    if (player.hp <= 0) { endBattle('lose'); return; }
    if (enemy.hp  <= 0) { endBattle('win');  return; }

    _onTick({ player, enemy, playerSlots, enemySlots });
  }

  function advanceSlots(slots, self, opponent, nowMs) {
    for (const slot of slots) {
      const mult = SE.getCdSpeedMult(self, nowMs);
      if (mult === 0) continue; // frozen

      slot.cdCurrent -= TICK_MS * _speed * mult;

      if (slot.cdCurrent <= 0) {
        // Reset CD
        slot.cdCurrent = slot.cdMax;
        // Fire active skill attackCount times
        for (let i = 0; i < slot.attackCount; i++) {
          activateSlot(slot, self, opponent, slots, nowMs);
        }
      }
    }
  }

  // ── Skill activation ─────────────────────────────────────────
  function activateSlot(slot, self, opponent, allSlots, nowMs) {
    const def = slot.def;
    const act = def.active;
    if (!act) return;

    // Notify passives: ally_activate
    notifyPassive('ally_activate', slot, allSlots, self);

    // Adjacent passive: adjacent_activate
    const adj = getAdjacentSlotsRuntime(slot, allSlots);
    for (const a of adj) {
      notifyPassiveOnSlot('adjacent_activate', a, slot, allSlots, self);
    }

    // Execute active effect
    const totalDmg = (act.value || 0) + (slot.damageBonus || 0);

    switch (act.effect) {
      case 'damage': {
        const d = SE.applyDamage(opponent, totalDmg);
        _log(`⚡ ${def.name} 攻擊造成 ${d} 傷害`, 'log-dmg');
        break;
      }
      case 'damage_scaling': {
        const d = SE.applyDamage(opponent, totalDmg);
        _log(`⚡ ${def.name} 攻擊造成 ${d} 傷害`, 'log-dmg');
        break;
      }
      case 'damage_hp_scaling': {
        let dmgVal = act.value + slot.damageBonus;
        if (self.hp / self.maxHp < 0.5) dmgVal *= 2;
        const d = SE.applyDamage(opponent, dmgVal);
        _log(`⚡ ${def.name} 攻擊造成 ${d} 傷害`, 'log-dmg');
        break;
      }
      case 'damage_plus_burn_pct': {
        const d = SE.applyDamage(opponent, totalDmg);
        const burnLayers = Math.max(1, Math.round(totalDmg * act.burnPct));
        SE.addBurn(opponent, burnLayers);
        _log(`⚡ ${def.name} 造成 ${d} 傷害 + ${burnLayers} 層燃燒`, 'log-fire');
        break;
      }
      case 'poison': {
        SE.addPoison(opponent, act.value);
        _log(`☠ ${def.name} 施加 ${act.value} 層劇毒`, 'log-poison');
        break;
      }
      case 'poison_all': {
        SE.addPoison(opponent, act.value);
        _log(`☠ ${def.name} 施加 ${act.value} 層劇毒（全體）`, 'log-poison');
        break;
      }
      case 'burn': {
        SE.addBurn(opponent, act.value);
        _log(`🔥 ${def.name} 施加 ${act.value} 層燃燒`, 'log-fire');
        break;
      }
      case 'speed_adjacent': {
        const adjSlots = getAdjacentSlotsRuntime(slot, allSlots);
        for (const a of adjSlots) SE.applySpeed(self, act.value);
        _log(`💨 ${def.name} 給相鄰角色施加加速 ${act.value}s`, 'log-status');
        break;
      }
      case 'speed_random_allies': {
        const shuffled = [...allSlots].sort(() => Math.random() - 0.5);
        shuffled.slice(0, act.count).forEach(() => SE.applySpeed(self, act.value));
        _log(`💨 ${def.name} 給 ${act.count} 個角色施加加速`, 'log-status');
        break;
      }
      case 'speed_one_slow_one': {
        SE.applySpeed(self,     act.speedVal);
        SE.applySlow(opponent,  act.slowVal);
        _log(`💨 ${def.name} 加速我方 / 減速敵方`, 'log-status');
        break;
      }
      case 'speed_all_allies_plus_hits': {
        SE.applySpeed(self, act.value);
        _log(`💨 ${def.name} 全體加速 ${act.value}s`, 'log-status');
        break;
      }
      case 'shield_self': {
        SE.addShield(self, act.value);
        _log(`🛡 ${def.name} 獲得 ${act.value} 層護盾`, 'log-status');
        break;
      }
      case 'shield_per_ally': {
        const count = allSlots.length;
        SE.addShield(self, act.value * count);
        _log(`🛡 ${def.name} 獲得 ${act.value * count} 層護盾（共${count}角色）`, 'log-status');
        break;
      }
      case 'shield_all': {
        SE.addShield(self, act.value);
        _log(`🛡 ${def.name} 全體獲得 ${act.value} 層護盾`, 'log-status');
        break;
      }
      case 'heal_player': {
        const h = SE.heal(self, act.value);
        _log(`💚 ${def.name} 恢復 ${h} 點生命`, 'log-heal');
        break;
      }
      case 'freeze': {
        SE.applyFreeze(opponent, act.value);
        _log(`❄ ${def.name} 冰凍敵方 ${act.value}s`, 'log-status');
        break;
      }
    }
  }

  // ── Passive notification ──────────────────────────────────────
  function notifyPassive(trigger, activatorSlot, allSlots, self) {
    for (const slot of allSlots) {
      if (slot.instanceId === activatorSlot.instanceId) continue;
      notifyPassiveOnSlot(trigger, slot, activatorSlot, allSlots, self);
    }
  }

  function notifyPassiveOnSlot(trigger, slot, activatorSlot, allSlots, self) {
    if (!slot.def.passive) return;
    for (const p of slot.def.passive) {
      if (p.trigger !== trigger) continue;

      if (p.effect === 'self_charge') {
        slot.cdCurrent = Math.max(0, slot.cdCurrent - p.value * 1000);
      }
      if (p.effect === 'self_speed') {
        SE.applySpeed(self, p.value);
      }
      if (p.effect === 'self_damage_up') {
        slot.damageBonus += p.value;
      }
    }
  }

  // ── End battle ───────────────────────────────────────────────
  function endBattle(result) {
    stop();
    const st = window.State.get();

    if (result === 'win') {
      _log(`✅ 勝利！YOU 擊敗了 ${enemy.name}`, 'log-win');
      st.wins++;
      // Scale card_B damage for next battle
      for (const slot of playerSlots) {
        if (slot.def.active && slot.def.active.effect === 'damage_scaling') {
          const inst = st.instances[slot.instanceId];
          if (inst) inst.damageBonus = (inst.damageBonus || 0) + slot.def.active.perBattle;
        }
      }
      // Battle reward gold
      const gold = 3 + Math.floor(Math.random() * 3);
      window.State.gainGold(gold);
      _log(`💰 獲得 ${gold} 金幣`, 'log-status');
    } else if (result === 'lose') {
      _log(`💀 失敗！YOU 的HP歸零`, 'log-lose');
      st.losses++;
    } else {
      _log(`⏱ 超時，判定平局`, 'log-status');
    }

    st.battleCount++;
    _onEnd({ result, player, enemy });
  }

  // ── Log helper ───────────────────────────────────────────────
  function _log(msg, cls = '') {
    _onLog && _onLog(msg, cls);
  }

  // ── Control ──────────────────────────────────────────────────
  function start() {
    if (_running) return;
    _running = true;
    _intervalId = setInterval(tick, TICK_MS);
  }

  function stop() {
    _running = false;
    if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
  }

  function setSpeed(s) { _speed = s; }
  function getSpeed()  { return _speed; }

  return {
    setup,
    start,
    stop,
    setSpeed,
    getSpeed,
    getPlayer: () => player,
    getEnemy:  () => enemy,
    getPlayerSlots: () => playerSlots,
    getEnemySlots:  () => enemySlots,
  };
})();
