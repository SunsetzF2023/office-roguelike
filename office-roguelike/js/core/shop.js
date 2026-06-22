// ═══════════════════════════════════════
// js/core/shop.js  —  shop logic
// ═══════════════════════════════════════
'use strict';

window.ShopEngine = (() => {

  function generateInventory(tier = 1) {
    const pool = [...window.CARDS];
    // Weight by tier
    const available = pool.filter(c => {
      if (tier === 1) return c.cost <= 4;
      if (tier === 2) return c.cost <= 6;
      return true;
    });
    // Pick 4-5 random cards
    const count = 4 + Math.floor(Math.random() * 2);
    const shuffled = available.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(c => ({ ...c, _shopId: Math.random() }));
  }

  function buyCard(cardDef) {
    const st = window.State.get();
    if (!window.State.spendGold(cardDef.cost)) return { ok: false, reason: '金幣不足' };
    const instanceId = window.State.createInstance(cardDef.id);
    window.State.addToWarehouse(instanceId);
    return { ok: true, instanceId };
  }

  return { generateInventory, buyCard };
})();
