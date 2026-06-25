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

    // For battle nodes: check bag FIRST before consuming the node
    if (['battle','elite','boss'].includes(node.type)) {
      if (st.bag.length === 0) {
        window.UI.openModal(`
          <div class="panel-title">⚠ 背包是空的！</div>
          <div style="color:var(--text-dim);font-size:12px;line-height:2;margin-bottom:16px">
            請先把卡牌從<b style="color:var(--green)">倉庫</b>拖入<b style="color:var(--green)">背包格子</b>再進入戰鬥。
          </div>
          <div style="text-align:center">
            <button class="btn primary" onclick="window.UI.closeModal()">好的</button>
          </div>
        `);
        return;
      }
      // Warn if no damage cards in bag
      const hasDmg = st.bag.some(slot => {
        const def = window.State.getCardDef(slot.instanceId);
        return def && def.active && ['damage','damage_scaling','damage_hp_scaling',
          'damage_if_speed','damage_plus_per_enemy_shield','damage_plus_slow',
          'damage_plus_slow_all','damage_vs_slowed','damage_first_strike',
          'damage_cd_grow','damage_plus_burn_pct','burn','poison','poison_all'].includes(def.active.effect);
      });
      if (!hasDmg) {
        window.UI.openModal(`
          <div class="panel-title">⚠ 沒有攻擊卡！</div>
          <div style="color:var(--text-dim);font-size:12px;line-height:2;margin-bottom:16px">
            你的背包裡沒有能造成傷害的卡牌，無法傷害敵人。<br>
            請加入<b style="color:var(--amber)">傷害型</b>（⚡）、<b style="color:var(--fire)">燃燒型</b>（🔥）或<b style="color:var(--poison)">剧毒型</b>（☠）卡牌再戰鬥。<br><br>
            目前背包：${st.bag.map(s=>{const d=window.State.getCardDef(s.instanceId);return d?d.name:'?';}).join('、')}
          </div>
          <div style="display:flex;gap:8px;justify-content:center">
            <button class="btn primary" onclick="window.UI.closeModal()">返回整理</button>
            <button class="btn" onclick="window.UI.closeModal();window.Game._forceEnterBattle('${node.type}')">還是進入戰鬥</button>
          </div>
        `);
        return;
      }
    }

    // Now consume the node
    window.MapEngine.visitNode(st.map, node.id);
    const leveled = window.State.onEventCompleted();
    if (leveled) st._pendingUpgrade = true;

    switch (node.type) {
      case 'gold':    _handleGoldNode();        break;
      case 'rest':    _handleRestNode();        break;
      case 'shop':    _goToShop(1);             break;
      case 'random':  _handleRandomEvent();     break;
      case 'battle':  _startBattle(1);          break;
      case 'elite':   _startBattle(2);          break;
      case 'boss':    _startBattle(3, true);    break;
    }
  }

  function _handleGoldNode() {
    const events = window.EVENTS.filter(e => e.type === 'gold');
    const event  = events[Math.floor(Math.random() * events.length)];
    window.State.gainGold(event.effect.gold);
    window.UI.toast(`${event.icon} ${event.name}：獲得 ${event.effect.gold} 金幣`);
    _checkUpgradeOrMap();
  }

  function _handleRestNode() {
    const events = window.EVENTS.filter(e => e.type === 'rest');
    const event  = events[Math.floor(Math.random() * events.length)];
    const st     = window.State.get();
    const heal   = Math.round(st.maxHp * event.effect.healPct);
    window.State.healPlayer(heal);
    window.UI.toast(`${event.icon} ${event.name}：恢復 ${heal} HP`);
    _checkUpgradeOrMap();
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

    // Show win/lose overlay on battle screen
    const battleEl = document.getElementById('screen-battle');
    if (battleEl) {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position:absolute;inset:0;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:16px;
        background:rgba(0,0,0,0.75);z-index:999;
      `;
      const isWin = result === 'win';
      overlay.innerHTML = `
        <div style="font-family:var(--font-display);font-size:56px;
                    color:${isWin?'var(--green-bright)':'var(--red)'};
                    text-shadow:0 0 24px ${isWin?'var(--green)':'var(--red)'}">
          ${isWin ? '✅ 勝利' : '💀 失敗'}
        </div>
        <div style="font-size:13px;color:var(--text-dim)">
          ${isWin ? '正在繼續...' : '遊戲結束...'}
        </div>
      `;
      battleEl.style.position = 'relative';
      battleEl.appendChild(overlay);
    }

    // Navigate after delay
    setTimeout(() => {
      // Clear battle screen inline styles so showScreen works
      const bEl = document.getElementById('screen-battle');
      if (bEl) {
        bEl.style.flexDirection = '';
        bEl.style.padding = '';
        bEl.style.gap = '';
        bEl.style.height = '';
        bEl.style.boxSizing = '';
        bEl.style.position = '';
      }

      if (result === 'lose') {
        window.UI.showScreen('gameover');
        window.ScreenGameover.render(false);
        return;
      }
      if (isBoss && result === 'win') {
        window.UI.showScreen('gameover');
        window.ScreenGameover.render(true);
        return;
      }
      _checkUpgradeOrMap();
    }, 2200);
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

  function _forceEnterBattle(type) {
    const st = window.State.get();
    const node = st.map && st.map.nodes.find(n =>
      n.type === type && !n.visited && !n.skipped && !n.locked);
    if (node) { window.MapEngine.visitNode(st.map, node.id); _startBattle(type==='elite'?2:type==='boss'?3:1, type==='boss'); }
  }

  return { startNewRun, visitNode, leaveShop, afterUpgrade, _returnToMap, _forceEnterBattle };
})();

// ── Boot ─────────────────────────────────────────────────────
(function boot() {
  window.UI.showScreen('title');
  window.ScreenTitle.render();
})();
