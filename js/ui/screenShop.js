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
// ScreenBattle  —  2×6 grid layout (秘宝对决 style)
// ═══════════════════════════════════════
window.ScreenBattle = (() => {

  let _logEl = null;
  const CELL = 72, GAP = 4, COLS = 6, ROWS = 2;

  function render(enemyDef) {
    const st = window.State.get();
    const el = document.getElementById('screen-battle');

    el.style.cssText = 'display:flex;flex-direction:column;padding:10px;gap:8px;height:100%;box-sizing:border-box;';
    el.innerHTML = `
      <!-- TOP: enemy -->
      <div id="b-enemy-area" style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-family:var(--font-display);font-size:20px;color:var(--red)">${enemyDef.name}</span>
          <span id="b-enemy-hp" style="font-family:var(--font-display);font-size:20px;color:var(--red)">1500</span>
          <div class="hp-bar-wrap" style="width:200px;height:10px" id="b-enemy-hpbar">
            <div class="hp-bar-fill" style="width:100%;background:var(--red)"></div>
          </div>
          <div id="b-enemy-statuses" style="display:flex;gap:4px;flex-wrap:wrap"></div>
        </div>
        <!-- Enemy 2×6 grid (flipped: row0 on bottom, so enemy cards "face" player) -->
        <div id="b-enemy-grid" style="
          display:grid;
          grid-template-columns:repeat(${COLS},${CELL}px);
          grid-template-rows:repeat(${ROWS},${CELL}px);
          gap:${GAP}px;
          padding:6px;
          background:rgba(229,57,53,0.06);
          border:1px solid var(--red-dim);
          border-radius:4px;
        "></div>
      </div>

      <!-- MIDDLE: VS bar + speed -->
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;padding:4px 0;
                  border-top:1px solid var(--border);border-bottom:1px solid var(--border)">
        <span style="font-family:var(--font-display);font-size:22px;color:var(--red);
                     text-shadow:0 0 12px var(--red)">VS</span>
        <div id="speed-ctrl" style="display:flex;gap:4px;align-items:center">
          <span style="font-size:10px;color:var(--text-dim)">速度</span>
          <button class="btn active" data-spd="1">×1</button>
          <button class="btn" data-spd="2">×2</button>
          <button class="btn" data-spd="3">×3</button>
        </div>
      </div>

      <!-- BOTTOM: player -->
      <div id="b-player-area" style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <!-- Player 2×6 grid -->
        <div id="b-player-grid" style="
          display:grid;
          grid-template-columns:repeat(${COLS},${CELL}px);
          grid-template-rows:repeat(${ROWS},${CELL}px);
          gap:${GAP}px;
          padding:6px;
          background:rgba(76,175,80,0.06);
          border:1px solid var(--border-bright);
          border-radius:4px;
        "></div>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="hp-bar-wrap" style="width:200px;height:10px" id="b-player-hpbar">
            <div class="hp-bar-fill" style="width:100%"></div>
          </div>
          <span id="b-player-hp" style="font-family:var(--font-display);font-size:20px;color:var(--green-bright)">${st.hp}</span>
          <span style="font-family:var(--font-display);font-size:20px;color:var(--green-bright)">YOU</span>
          <div id="b-player-statuses" style="display:flex;gap:4px;flex-wrap:wrap"></div>
        </div>
      </div>

      <!-- LOG -->
      <div id="battle-log-wrap" style="flex:1;overflow-y:auto;border-top:1px solid var(--border);padding-top:4px;min-height:60px">
        <div id="battle-log" style="font-size:11px;color:var(--text-dim);line-height:1.7"></div>
      </div>
    `;

    _logEl = document.getElementById('battle-log');

    // Speed buttons
    el.querySelectorAll('#speed-ctrl .btn').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('#speed-ctrl .btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        window.BattleEngine.setSpeed(+btn.dataset.spd);
      });
    });

    // Draw initial empty grids
    _initGrid('b-player-grid', false);
    _initGrid('b-enemy-grid',  true);
  }

  // ── Draw empty grid cells ─────────────────────────────────────
  function _initGrid(id, isEnemy) {
    const grid = document.getElementById(id);
    if (!grid) return;
    grid.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('div');
        cell.dataset.col = c;
        cell.dataset.row = isEnemy ? (ROWS-1-r) : r; // enemy grid flipped visually
        cell.style.cssText = `
          width:${CELL}px;height:${CELL}px;
          background:var(--bg);
          border:1px solid var(--border);
          border-radius:3px;
          position:relative;
        `;
        grid.appendChild(cell);
      }
    }
  }

  // ── Update on each tick ───────────────────────────────────────
  function updateTick(data) {
    const { player, enemy, playerSlots, enemySlots } = data;

    // HP
    const ph = document.getElementById('b-player-hp');
    const eh = document.getElementById('b-enemy-hp');
    if (ph) ph.textContent = Math.max(0, Math.round(player.hp));
    if (eh) eh.textContent = Math.max(0, Math.round(enemy.hp));

    // HP bars
    _updateHpBar('b-player-hpbar', player.hp, player.maxHp, false);
    _updateHpBar('b-enemy-hpbar',  enemy.hp,  enemy.maxHp,  true);

    // Side statuses (shield/poison/burn on combatant)
    const ps = document.getElementById('b-player-statuses');
    const es = document.getElementById('b-enemy-statuses');
    if (ps) ps.innerHTML = window.UI.statusBadges(window.BattleEngine.getStatusSnap(player));
    if (es) es.innerHTML = window.UI.statusBadges(window.BattleEngine.getStatusSnap(enemy));

    // Render card grids
    _renderGrid('b-player-grid', playerSlots, false);
    _renderGrid('b-enemy-grid',  enemySlots,  true);
  }

  function _updateHpBar(id, hp, maxHp, isEnemy) {
    const el = document.getElementById(id);
    if (!el) return;
    const pct = Math.max(0, hp/maxHp*100);
    const color = isEnemy ? 'var(--red)' : (pct<25?'var(--red)':pct<50?'var(--amber)':'var(--green)');
    el.innerHTML = `<div style="height:100%;width:${pct}%;background:${color};
                                border-radius:2px;transition:width 0.15s;
                                box-shadow:0 0 6px ${color}44"></div>`;
  }

  // ── Render 2×6 grid of cards ──────────────────────────────────
  function _renderGrid(gridId, slots, isEnemy) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    // Clear card chips (keep cell divs)
    grid.querySelectorAll('.b-card-chip').forEach(c=>c.remove());

    const typeColors = {
      poison:'#8bc34a', fire:'#ff7043', shield:'#90caf9',
      heal:'#66bb6a',   speed:'#76d275', ice:'#80deea',
      buff:'#ab47bc',   damage:'#ffb300'
    };
    const typeIcons = {
      poison:'☠', fire:'🔥', shield:'🛡', heal:'💚',
      speed:'💨', ice:'❄',  buff:'⭐',   damage:'⚡'
    };

    for (const slot of slots) {
      const def = slot.def;
      const col = slot.col, row = slot.row;

      // Find the anchor cell in the grid
      // For enemy grid, visual row is flipped: visual_r = ROWS-1-row
      const visualRow = isEnemy ? (ROWS-1-row) : row;
      const cellIdx   = visualRow * COLS + col;
      const cells     = grid.querySelectorAll('div[data-col]');
      const anchor    = cells[cellIdx];
      if (!anchor) continue;

      const cdPct  = slot.cdMax === Infinity ? 1 : Math.max(0, 1 - slot.cdCurrent/slot.cdMax);
      const ready  = cdPct >= 0.99;
      const cdSec  = slot.cdMax === Infinity ? '∞' : Math.max(0, slot.cdCurrent/1000).toFixed(1);
      const color  = typeColors[def.type] || '#558b57';
      const icon   = typeIcons[def.type]  || '⚡';
      const w      = CELL * def.size + GAP * (def.size-1);
      const inst   = !isEnemy ? window.State.getInstance(slot.instanceId) : null;
      const lvBadge= inst && inst.mergeLevel>1
        ? `<div style="position:absolute;top:2px;right:3px;font-size:8px;color:var(--amber);font-weight:bold">Lv${inst.mergeLevel}</div>` : '';

      // Speed/slow/freeze badges on this slot
      const slotStatuses = window.BattleEngine.getSlotStatusSnap(slot);
      const slotBadgeHtml = slotStatuses.map(s=>{
        const sc = s.type==='speed'?'var(--green-bright)':s.type==='slow'?'var(--blue)':'var(--ice)';
        const si = s.type==='speed'?'💨':s.type==='slow'?'🐢':'❄';
        return `<span style="font-size:8px;color:${sc}">${si}${s.val}s</span>`;
      }).join('');

      // Glow if ready
      const glow = ready
        ? `box-shadow:0 0 10px ${color}, 0 0 20px ${color}44;`
        : `box-shadow:0 0 4px ${color}44;`;
      const borderColor = ready ? color : (isEnemy?'var(--red-dim)':'var(--green-dim)');

      const chip = document.createElement('div');
      chip.className = 'b-card-chip';
      chip.style.cssText = `
        position:absolute;
        top:0;left:0;
        width:${w}px;height:${CELL}px;
        background:var(--bg-card);
        border:1px solid ${borderColor};
        border-left:3px solid ${color};
        border-radius:3px;
        z-index:${ready?5:2};
        display:flex;flex-direction:column;
        justify-content:space-between;
        padding:3px 5px 2px 7px;
        box-sizing:border-box;
        cursor:default;
        transition:box-shadow 0.15s;
        ${glow}
        ${ready?'animation:pulse-card 0.4s ease-out;':''}
      `;
      chip.innerHTML = `
        ${lvBadge}
        <div style="display:flex;align-items:center;gap:3px">
          <span style="font-size:12px">${icon}</span>
          <span style="font-size:8px;color:var(--text-label);white-space:nowrap;
                       overflow:hidden;text-overflow:ellipsis;max-width:${w-36}px">${def.name}</span>
        </div>
        <div style="display:flex;gap:3px;flex-wrap:wrap">${slotBadgeHtml}</div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-family:var(--font-display);font-size:${ready?14:12}px;
                       color:${ready?color:'var(--text-dim)'}">
            ${ready ? '▶ 出擊!' : cdSec+'s'}
          </span>
          <span style="font-size:8px;color:var(--text-dim)">${['小','中','大'][def.size-1]||''}</span>
        </div>
        <!-- CD bar -->
        <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:var(--bg);border-radius:0 0 3px 3px">
          <div style="height:100%;width:${cdPct*100}%;background:${color};border-radius:0 0 3px 3px;transition:width 0.1s"></div>
        </div>
      `;

      // Tooltip
      chip.addEventListener('mouseenter', e=>{
        const d = window.State.getCardDef ? window.State.getCardDef(slot.instanceId) : def;
        window.UI.showTooltip(def, e.clientX, e.clientY);
      });
      chip.addEventListener('mousemove',  e=>window.UI.showTooltip(def, e.clientX, e.clientY));
      chip.addEventListener('mouseleave', ()=>window.UI.hideTooltip());

      anchor.style.position = 'relative';
      anchor.appendChild(chip);
    }
  }

  function addLog(msg, cls) {
    if (!_logEl) return;
    const d = document.createElement('div');
    d.style.cssText = 'padding:1px 0;border-bottom:1px solid var(--border)';
    d.className = cls || '';
    d.textContent = msg;
    if (cls==='log-dmg')    d.style.color='var(--amber)';
    if (cls==='log-poison') d.style.color='var(--poison)';
    if (cls==='log-fire')   d.style.color='var(--fire)';
    if (cls==='log-heal')   d.style.color='var(--heal)';
    if (cls==='log-status') d.style.color='var(--blue)';
    if (cls==='log-win')    d.style.color='var(--green-bright)';
    if (cls==='log-lose')   d.style.color='var(--red)';
    _logEl.prepend(d);
    if (_logEl.children.length > 60) _logEl.lastChild.remove();
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
