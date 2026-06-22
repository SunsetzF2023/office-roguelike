// ═══════════════════════════════════════
// js/core/status.js  —  status effect system
// ═══════════════════════════════════════
'use strict';

// A Combatant has:
//   hp, maxHp, shield (layers),
//   statuses: Map<type, StatusInstance>
//   burnStacks: [{layers, appliedAt}]  (separate because burn is complex)
//   poisonLayers: number
//   speedUntil: timestamp  (ms)
//   slowUntil: timestamp
//   frozenUntil: timestamp

window.StatusEngine = (() => {

  // ── Combatant factory ────────────────────────────────────────
  function makeCombatant(hp, name, isPlayer = false) {
    return {
      name,
      isPlayer,
      hp,
      maxHp: hp,
      shield: 0,
      burnStacks: [],    // [{layers, appliedAt(ms)}]
      poisonLayers: 0,
      speedUntil: 0,
      slowUntil: 0,
      frozenUntil: 0,
      // runtime damage bonus from passives
      damageBonus: 0,
      attackCountBonus: 0,
    };
  }

  // ── Apply damage (respects shield, burn reduction) ──────────
  function applyDamage(combatant, amount, type = 'physical') {
    let dmg = Math.max(0, Math.round(amount));
    if (dmg === 0) return 0;

    if (type === 'burn') {
      // Shield reduces burn by 50%
      if (combatant.shield > 0) {
        const reduced = Math.max(0, dmg * 0.5);
        dmg = Math.round(reduced);
      }
    } else if (type !== 'poison') {
      // Normal damage absorbed by shield first
      const absorbed = Math.min(combatant.shield, dmg);
      combatant.shield -= absorbed;
      dmg -= absorbed;
    }
    // Poison ignores shield entirely

    combatant.hp = Math.max(0, combatant.hp - dmg);
    return dmg;
  }

  // ── Shield ───────────────────────────────────────────────────
  function addShield(combatant, layers) {
    combatant.shield += Math.max(0, Math.round(layers));
  }

  // ── Heal ────────────────────────────────────────────────────
  function heal(combatant, amount) {
    const actual = Math.min(amount, combatant.maxHp - combatant.hp);
    combatant.hp += actual;
    // Remove 5% of heal amount worth of poison/burn
    const clearAmt = Math.ceil(amount * 0.05);
    combatant.poisonLayers = Math.max(0, combatant.poisonLayers - clearAmt);
    // Clear burn layers
    let remaining = clearAmt;
    for (let i = combatant.burnStacks.length - 1; i >= 0 && remaining > 0; i--) {
      const remove = Math.min(combatant.burnStacks[i].layers, remaining);
      combatant.burnStacks[i].layers -= remove;
      remaining -= remove;
    }
    combatant.burnStacks = combatant.burnStacks.filter(s => s.layers > 0);
    return actual;
  }

  // ── Burn ─────────────────────────────────────────────────────
  function addBurn(combatant, layers) {
    // New stack with current timestamp
    combatant.burnStacks.push({ layers: Math.round(layers), appliedAt: performance.now() });
  }

  // Calculate burn damage at a given time, also mutate stacks
  function tickBurn(combatant, nowMs) {
    let totalDmg = 0;
    const newStacks = [];

    for (const stack of combatant.burnStacks) {
      const elapsed = (nowMs - stack.appliedAt) / 1000; // seconds
      // Each 0.5s interval: damage = currentLayers, then after 1s: layers -1
      // Remaining layers = original - floor(elapsed)
      const layersNow = Math.max(0, stack.layers - Math.floor(elapsed));
      if (layersNow > 0) {
        newStacks.push({ ...stack });
      }
    }
    combatant.burnStacks = newStacks;

    // Damage = sum of all current layer counts, once per tick (0.5s)
    for (const stack of combatant.burnStacks) {
      const elapsed = (nowMs - stack.appliedAt) / 1000;
      const layersNow = Math.max(0, stack.layers - Math.floor(elapsed));
      totalDmg += layersNow;
    }

    return applyDamage(combatant, totalDmg, 'burn');
  }

  // ── Poison ───────────────────────────────────────────────────
  function addPoison(combatant, layers) {
    combatant.poisonLayers += Math.round(layers);
  }

  function tickPoison(combatant) {
    if (combatant.poisonLayers <= 0) return 0;
    return applyDamage(combatant, combatant.poisonLayers, 'poison');
  }

  // ── Speed / Slow / Freeze ─────────────────────────────────────
  function applySpeed(combatant, durationSec) {
    const untilMs = performance.now() + durationSec * 1000;
    combatant.speedUntil = Math.max(combatant.speedUntil, untilMs);
  }

  function applySlow(combatant, durationSec) {
    const untilMs = performance.now() + durationSec * 1000;
    combatant.slowUntil = Math.max(combatant.slowUntil, untilMs);
  }

  function applyFreeze(combatant, durationSec) {
    const untilMs = performance.now() + durationSec * 1000;
    combatant.frozenUntil = Math.max(combatant.frozenUntil, untilMs);
  }

  // ── CD speed multiplier (for a given combatant slot) ─────────
  function getCdSpeedMult(combatant, nowMs = performance.now()) {
    if (combatant.frozenUntil > nowMs) return 0;       // frozen: no CD
    let mult = 1.0;
    if (combatant.speedUntil > nowMs) mult *= 2.0;    // speed: +100%
    if (combatant.slowUntil  > nowMs) mult *= 0.5;    // slow: -50%
    return mult;
  }

  // ── Status snapshot (for UI) ─────────────────────────────────
  function getStatusSnapshot(combatant, nowMs = performance.now()) {
    const statuses = [];
    if (combatant.shield > 0)
      statuses.push({ type: 'shield', val: combatant.shield });
    if (combatant.poisonLayers > 0)
      statuses.push({ type: 'poison', val: combatant.poisonLayers });
    const totalBurn = combatant.burnStacks.reduce((s,b) => s + b.layers, 0);
    if (totalBurn > 0)
      statuses.push({ type: 'burn', val: totalBurn });
    if (combatant.speedUntil > nowMs)
      statuses.push({ type: 'speed', val: Math.ceil((combatant.speedUntil - nowMs)/1000) });
    if (combatant.slowUntil > nowMs)
      statuses.push({ type: 'slow', val: Math.ceil((combatant.slowUntil - nowMs)/1000) });
    if (combatant.frozenUntil > nowMs)
      statuses.push({ type: 'freeze', val: Math.ceil((combatant.frozenUntil - nowMs)/1000) });
    return statuses;
  }

  return {
    makeCombatant,
    applyDamage,
    addShield,
    heal,
    addBurn,
    tickBurn,
    addPoison,
    tickPoison,
    applySpeed,
    applySlow,
    applyFreeze,
    getCdSpeedMult,
    getStatusSnapshot,
  };
})();
