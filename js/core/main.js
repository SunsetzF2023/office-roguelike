// ═══════════════════════════════════════
// js/core/main.js  —  game orchestration
// ═══════════════════════════════════════
'use strict';

window.Game = (() => {

  // ── New Run ──────────────────────────────────────────────────
  function startNewRun() {
    window.State.reset();
    const st = window.State.get();

    // Give 2 starter cards
    const starterIds = ['it_support', 'card_J'];
    for (const id of starterIds) {
      const instId = window.State.createInstance(id);
      window.State.addToWarehouse(instId);
    }

    // Generate map
    st.map = window.MapEngine.generate();

    window.UI.showScreen('map');
    window.ScreenMap.render();
  }

  // ── Visit a map node ─────────────────────────────────────────
  function visitNode(node) {
    const st = window.State.get();
    window.MapEngine.visitNode(st.map, node.id);
    const leveled = window.State.onEventCompleted();

    switch (node.type) {
      case 'gold':
        _handleGoldNode(node);
        break;
      case 'rest':
        _handleRestNode(node);
        break;
      case 'shop':
        _goToShop(1);
        break;
      case 'random':
        _handleRandomEvent();
        break;
      case 'battle':
        _startBattle(1);
        break;
      case 'elite':
        _startBattle(2);
        break;
      case 'boss':
        _startBattle(3, true);
        break;
    }

    if (leveled) {
      // Upgrade screen will be shown after current event resolves
      st._pendingUpgrade = true;
    }
  }

  function _handleGoldNode(node) {
    const event = window.EVENTS.filter(e => e.type === 'gold')[
      Math.floor(Math.random() * window.EVENTS.filter(e => e.type === 'gold').length)
    ];
    const gold = event.effect.gold;
    window.State.gainGold(gold);
    window.UI.toast(`${event.icon} ${event.name}：獲得 ${gold} 金幣`, '');
    _refreshMap();
  }

  function _handleRestNode(node) {
    const event = window.EVENTS.filter(e => e.type === 'rest')[
      Math.floor(Math.random() * window.EVENTS.filter(e => e.type === 'rest').length)
    ];
    const st = window.State.get();
    const heal = Math.round(st.maxHp * event.effect.healPct);
    window.State.healPlayer(heal);
    window.UI.toast(`${event.icon} ${event.name}：恢復 ${heal} HP`, '');
    _refreshMap();
  }

  function _handleRandomEvent() {
    const pool   = window.EVENTS.filter(e => e.type === 'random');
    const event  = pool[Math.floor(Math.random() * pool.length)];
    const st     = window.State.get();

    const choicesHtml = event.choices.map((c, i) => `
      <div class="event-choice" data-choice="${i}">${c.text}</div>`).join('');

    window.UI.openModal(`
      <div class="panel-title">${event.icon} ${event.name}</div>
      <div style="color:var(--text-dim);font-size:12px;margin-bottom:12px">${event.desc}</div>
      <div class="event-choice-list">${choicesHtml}</div>
    `);

    document.querySelectorAll('.event-choice').forEach(el => {
      el.addEventListener('click', () => {
        const choice = event.choices[+el.dataset.choice];
        _applyEventEffect(choice.effect, st);
        window.UI.closeModal();
        _refreshMap();
      });
    });
  }

  function _applyEventEffect(effect, st) {
    if (effect.gold)       window.State.gainGold(effect.gold);
    if (effect.gold < 0)   window.State.spendGold(Math.abs(effect.gold));
    if (effect.hpFlat)     {
      if (effect.hpFlat < 0) window.State.damagePlayer(Math.abs(effect.hpFlat));
      else window.State.healPlayer(effect.hpFlat);
    }
    if (effect.healPct)    window.State.healPlayer(Math.round(st.maxHp * effect.healPct));
    if (effect.maxHpPct)   {
      const delta = Math.round(st.maxHp * Math.abs(effect.maxHpPct));
      if (effect.maxHpPct < 0) st.maxHp = Math.max(100, st.maxHp - delta);
      else st.maxHp += delta;
    }
    if (effect.freeCard) {
      const pool = window.CARDS.filter(c => c.cost <= 3);
      const card = pool[Math.floor(Math.random() * pool.length)];
      if (card) {
        const instId = window.State.createInstance(card.id);
        window.State.addToWarehouse(instId);
        window.UI.toast(`獲得免費卡牌：${card.name}`, '');
      }
    }
    if (effect.gamble) {
      const win = Math.random() < 0.5;
      _applyEventEffect(win ? effect.gamble.win : effect.gamble.lose, st);
      window.UI.toast(win ? '🎰 賭贏了！' : '🎰 賭輸了…', win ? '' : 'warn');
    }
  }

  function _goToShop(tier) {
    window.UI.showScreen('shop');
    window.ScreenShop.render(tier);
  }

  function leaveShop() {
    _checkUpgradeOrMap();
  }

  // ── Battle ───────────────────────────────────────────────────
  function _startBattle(tier, isBoss = false) {
    const st = window.State.get();

    // Warn if bag is empty
    if (st.bag.length === 0) {
      window.UI.openModal(`
        <div class="panel-title">⚠ 背包是空的！</div>
        <div style="color:var(--text-dim);font-size:12px;line-height:2;margin-bottom:16px">
          你需要先把卡牌從<b style="color:var(--green)">倉庫</b>拖入<b style="color:var(--green)">背包格子</b>才能進入戰鬥。<br>
          回到地圖，打開背包面板，把卡牌拖進格子吧！
        </div>
        <div style="text-align:center">
          <button class="btn primary" onclick="window.UI.closeModal();window.Game._returnToMap()">
            返回整理背包
          </button>
        </div>
      `);
      return;
    }

    // Pick enemy
    let enemyDef;
    if (isBoss) {
      enemyDef = window.getBoss();
    } else {
      const pool = window.getEnemiesByTier(tier);
      enemyDef   = pool[Math.floor(Math.random() * pool.length)];
    }
    if (!enemyDef) { _refreshMap(); return; }

    // Apply battle shield if player has that upgrade
    if (st._battleShieldPct) {
      st._startShield = Math.round(st.maxHp * st._battleShieldPct);
    }

    window.UI.showScreen('battle');
    window.ScreenBattle.render(enemyDef);

    // Setup engine
    window.BattleEngine.setup(
      st.bag,
      enemyDef,
      st.hp,
      st.maxHp,
      {
        onLog:  (msg, cls) => window.ScreenBattle.addLog(msg, cls),
        onTick: (data)     => window.ScreenBattle.updateTick(data),
        onEnd:  (result)   => _onBattleEnd(result, isBoss),
      }
    );

    // Apply start shield
    if (st._startShield) {
      window.StatusEngine.addShield(window.BattleEngine.getPlayer(), st._startShield);
      st._startShield = 0;
    }

    window.BattleEngine.start();
  }

  function _onBattleEnd(result, isBoss) {
    const st = window.State.get();

    // Sync player HP back to state
    const battlePlayer = window.BattleEngine.getPlayer();
    st.hp = Math.max(0, Math.round(battlePlayer.hp));

    // Show result briefly then continue
    setTimeout(() => {
      if (result.result === 'lose') {
        window.UI.showScreen('gameover');
        window.ScreenGameover.render(false);
        return;
      }
      if (isBoss && result.result === 'win') {
        window.UI.showScreen('gameover');
        window.ScreenGameover.render(true);
        return;
      }
      _checkUpgradeOrMap();
    }, 2000);
  }

  // ── Upgrade flow ─────────────────────────────────────────────
  function _checkUpgradeOrMap() {
    const st = window.State.get();
    if (st._pendingUpgrade) {
      st._pendingUpgrade = false;
      window.UI.showScreen('upgrade');
      window.ScreenUpgrade.render(window.ScreenUpgrade.generateOptions());
    } else {
      _refreshMap();
    }
  }

  function afterUpgrade() {
    _refreshMap();
  }

  function _refreshMap() {
    window.UI.showScreen('map');
    window.ScreenMap.render();
  }

  function _returnToMap() { _refreshMap(); }

  return { startNewRun, visitNode, leaveShop, afterUpgrade, _returnToMap };
})();

// ── Boot ─────────────────────────────────────────────────────
(function boot() {
  window.UI.showScreen('title');
  window.ScreenTitle.render();
})();
