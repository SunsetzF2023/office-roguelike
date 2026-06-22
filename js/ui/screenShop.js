// ═══════════════════════════════════════
// js/ui/screenShop.js
// ═══════════════════════════════════════
'use strict';

window.ScreenShop = (() => {
  let _inventory = [];

  function render(tier = 1) {
    _inventory = window.ShopEngine.generateInventory(tier);
    const st = window.State.get();
    const el = document.getElementById('screen-shop');

    el.innerHTML = `
      <div id="shop-inventory">
        <div id="player-statbar" style="margin-bottom:8px">
          <div class="stat-item">
            <span class="stat-label">HP</span>
            <span class="stat-val">${st.hp} / ${st.maxHp}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Gold</span>
            ${window.UI.goldHtml(st.gold)}
          </div>
        </div>

        <div class="panel" style="flex:1">
          <div class="panel-title">🛒 商店</div>
          <div id="shop-card-list"></div>
        </div>

        <div style="text-align:center;margin-top:8px">
          <button class="btn primary" id="btn-leave-shop">離開商店 →</button>
        </div>
      </div>

      <div id="shop-sidebar">
        <div class="panel">
          <div class="panel-title">背包</div>
          <div id="shop-bag-container"></div>
        </div>
        <div class="panel">
          <div class="panel-title">倉庫</div>
          <div id="shop-warehouse-container"></div>
        </div>
      </div>
    `;

    _renderInventory();

    window.BagPanel.init(
      document.getElementById('shop-bag-container'),
      () => window.BagPanel.renderWarehouse(document.getElementById('shop-warehouse-container'))
    );
    window.BagPanel.renderWarehouse(document.getElementById('shop-warehouse-container'));

    document.getElementById('btn-leave-shop').onclick = () => window.Game.leaveShop();
  }

  function _renderInventory() {
    const st = window.State.get();
    const list = document.getElementById('shop-card-list');
    if (!list) return;

    list.innerHTML = _inventory.map((card, i) => {
      const canAfford = st.gold >= card.cost;
      return `
        <div class="shop-card-row ${canAfford?'':'unaffordable'}" data-idx="${i}">
          <div class="shop-card-preview">
            ${card.type==='poison'?'☠':card.type==='fire'?'🔥':card.type==='shield'?'🛡':
              card.type==='heal'?'💚':card.type==='speed'?'💨':card.type==='ice'?'❄':
              card.type==='buff'?'⭐':'⚡'}
          </div>
          <div class="shop-card-info">
            <div class="shop-card-name">${card.name}</div>
            <div class="shop-card-desc">${card.lore || ''}</div>
            <div class="shop-card-meta">
              <span class="shop-card-cost">¥${card.cost}</span>
              <span class="shop-card-size-tag">${['','小','中','大'][card.size]||''}型</span>
              ${card.active ? `<span class="dim" style="font-size:10px">CD: ${card.active.cd}s</span>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.shop-card-row').forEach(row => {
      const idx  = +row.dataset.idx;
      const card = _inventory[idx];
      row.addEventListener('mouseenter', e => window.UI.showTooltip(card, e.clientX, e.clientY));
      row.addEventListener('mousemove',  e => window.UI.showTooltip(card, e.clientX, e.clientY));
      row.addEventListener('mouseleave', () => window.UI.hideTooltip());
      row.addEventListener('click', () => {
        const result = window.ShopEngine.buyCard(card);
        if (result.ok) {
          window.UI.toast(`已購買：${card.name}`, '');
          _inventory.splice(idx, 1);
          _renderInventory();
          window.BagPanel.renderWarehouse(document.getElementById('shop-warehouse-container'));
          // Update gold display
          const gEl = document.querySelector('#shop-inventory .gold-display');
          if (gEl) gEl.textContent = window.State.get().gold;
        } else {
          window.UI.toast(result.reason, 'warn');
        }
      });
    });
  }

  return { render };
})();


// ═══════════════════════════════════════
// js/ui/screenBattle.js
// ═══════════════════════════════════════
window.ScreenBattle = (() => {

  let _logEl = null;

  function render(enemyDef) {
    const st  = window.State.get();
    const el  = document.getElementById('screen-battle');

    el.innerHTML = `
      <div id="battle-header">
        <div style="display:flex;align-items:center;gap:16px">
          <span class="glow-green" style="font-family:var(--font-display);font-size:18px">YOU</span>
          <span style="font-size:12px;color:var(--text-dim)">HP:</span>
          <span id="b-player-hp" style="font-family:var(--font-display);font-size:18px;color:var(--green-bright)">${st.hp}</span>
          <div style="width:120px">${window.UI.hpBar(st.hp, st.maxHp)}</div>
        </div>
        <div id="battle-vs-label" style="font-family:var(--font-display);font-size:28px;color:var(--red);text-shadow:0 0 12px var(--red)">VS</div>
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:120px">${window.UI.hpBar(1500, 1500)}</div>
          <span style="font-size:12px;color:var(--text-dim)">HP:</span>
          <span id="b-enemy-hp" style="font-family:var(--font-display);font-size:18px;color:var(--red)">1500</span>
          <span class="red" style="font-family:var(--font-display);font-size:18px">${enemyDef.name}</span>
        </div>
      </div>

      <div id="battle-arena">
        <!-- Player side -->
        <div class="combatant-panel" id="b-player-panel">
          <div class="battle-bag-label">我方陣容</div>
          <div id="b-player-cards"></div>
          <div class="combatant-statuses" id="b-player-statuses"></div>
        </div>

        <!-- VS -->
        <div id="battle-vs" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
          <div id="speed-ctrl">
            <span class="dim" style="font-size:10px">速度</span>
            <button class="btn active" data-spd="1">×1</button>
            <button class="btn" data-spd="2">×2</button>
            <button class="btn" data-spd="3">×3</button>
          </div>
        </div>

        <!-- Enemy side -->
        <div class="combatant-panel" id="b-enemy-panel">
          <div class="battle-bag-label">敵方陣容</div>
          <div id="b-enemy-cards"></div>
          <div class="combatant-statuses" id="b-enemy-statuses"></div>
        </div>
      </div>

      <div id="battle-log-wrap">
        <div id="battle-log"></div>
      </div>
    `;

    _logEl = document.getElementById('battle-log');

    // Speed buttons
    document.querySelectorAll('#speed-ctrl .btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#speed-ctrl .btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        window.BattleEngine.setSpeed(+btn.dataset.spd);
      });
    });
  }

  function updateTick(data) {
    const { player, enemy, playerSlots, enemySlots } = data;

    // HP
    const phEl = document.getElementById('b-player-hp');
    const ehEl = document.getElementById('b-enemy-hp');
    if (phEl) phEl.textContent = Math.max(0, Math.round(player.hp));
    if (ehEl) ehEl.textContent = Math.max(0, Math.round(enemy.hp));

    // HP bars in header
    const now = performance.now();

    // Statuses
    const psEl = document.getElementById('b-player-statuses');
    const esEl = document.getElementById('b-enemy-statuses');
    if (psEl) psEl.innerHTML = window.UI.statusBadges(window.StatusEngine.getStatusSnapshot(player, now));
    if (esEl) esEl.innerHTML = window.UI.statusBadges(window.StatusEngine.getStatusSnapshot(enemy, now));

    // Card CD bars
    _renderBattleCards('b-player-cards', playerSlots, false);
    _renderBattleCards('b-enemy-cards',  enemySlots,  true);
  }

  function _renderBattleCards(containerId, slots, isEnemy) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = slots.map(slot => {
      const cdPct = 1 - (slot.cdCurrent / slot.cdMax);
      const ready = cdPct >= 0.99;
      const cdSec = Math.max(0, slot.cdCurrent / 1000).toFixed(1);
      return `
        <div class="battle-card ${isEnemy?'enemy-card':''} ${ready?'attacking':''}">
          <div class="battle-card-name">${slot.def.name}</div>
          <div class="battle-card-cd ${ready?'ready':''}">${ready?'▶ 就緒':cdSec+'s'}</div>
          <div class="battle-card-bar">
            <div class="battle-card-bar-fill ${isEnemy?'enemy':''}" style="width:${cdPct*100}%"></div>
          </div>
        </div>`;
    }).join('');
  }

  function addLog(msg, cls) {
    if (!_logEl) return;
    const div = document.createElement('div');
    div.className = `log-entry ${cls}`;
    div.textContent = msg;
    _logEl.prepend(div);
    if (_logEl.children.length > 80) _logEl.lastChild.remove();
  }

  return { render, updateTick, addLog };
})();


// ═══════════════════════════════════════
// js/ui/screenUpgrade.js
// ═══════════════════════════════════════
window.ScreenUpgrade = (() => {

  function render(options) {
    const el = document.getElementById('screen-upgrade');
    el.innerHTML = `
      <div style="font-family:var(--font-display);font-size:32px;color:var(--green-bright);
                  letter-spacing:0.1em;text-align:center">
        ⬆ 等級提升
      </div>
      <div style="color:var(--text-dim);font-size:12px;text-align:center">選擇一項強化</div>
      <div class="upgrade-options">
        ${options.map((opt, i) => `
          <div class="upgrade-card" data-idx="${i}">
            <div class="upgrade-card-icon">${opt.icon}</div>
            <div class="upgrade-card-title">${opt.title}</div>
            <div class="upgrade-card-desc">${opt.desc}</div>
          </div>`).join('')}
      </div>
    `;

    el.querySelectorAll('.upgrade-card').forEach(card => {
      card.addEventListener('click', () => {
        const opt = options[+card.dataset.idx];
        opt.apply();
        window.UI.toast(`已選擇：${opt.title}`);
        window.Game.afterUpgrade();
      });
    });
  }

  function generateOptions() {
    const st = window.State.get();
    return [
      {
        icon: '❤',
        title: '最大血量 +5%',
        desc: `最大HP從 ${st.maxHp} 提升至 ${Math.round(st.maxHp * 1.05)}`,
        apply: () => {
          const bonus = Math.round(st.maxHp * 0.05);
          st.maxHp += bonus;
          st.hp = Math.min(st.hp + bonus, st.maxHp);
        },
      },
      {
        icon: '🛡',
        title: '戰前護盾',
        desc: '每次進入戰鬥時，獲得最大HP 5% 的護盾值',
        apply: () => { st._battleShieldPct = (st._battleShieldPct || 0) + 0.05; },
      },
      {
        icon: '💰',
        title: '獲得 3 金幣',
        desc: '立即到手，不打折',
        apply: () => { window.State.gainGold(3); },
      },
    ];
  }

  return { render, generateOptions };
})();


// ═══════════════════════════════════════
// js/ui/screenGameover.js
// ═══════════════════════════════════════
window.ScreenGameover = (() => {

  function render(win) {
    const st = window.State.get();
    const el = document.getElementById('screen-gameover');

    el.innerHTML = `
      <div id="gameover-title" class="${win?'win':''}">
        ${win ? '🏆 逃出生天' : '💀 被制度消滅'}
      </div>
      <div id="gameover-stats">
        <div>戰鬥場次：${st.battleCount}</div>
        <div>勝場：${st.wins} / 敗場：${st.losses}</div>
        <div>最終血量：${Math.max(0, st.hp)} / ${st.maxHp}</div>
        <div>最終金幣：${st.gold}</div>
      </div>
      <div class="title-btn-group">
        <button class="btn primary" id="btn-restart">[ 再來一局 ]</button>
        <button class="btn" id="btn-title">返回標題</button>
      </div>
    `;

    document.getElementById('btn-restart').onclick = () => window.Game.startNewRun();
    document.getElementById('btn-title').onclick   = () => {
      window.State.reset();
      window.UI.showScreen('title');
      window.ScreenTitle.render();
    };
  }

  return { render };
})();
