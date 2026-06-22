// ═══════════════════════════════════════
// js/ui/terminal.js  —  shared UI helpers
// ═══════════════════════════════════════
'use strict';

window.UI = (() => {

  // ── Screen switching ─────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(`screen-${id}`);
    if (el) el.classList.add('active');
  }

  // ── Toast notifications ───────────────────────────────────────
  let _toastWrap = null;
  function _ensureToast() {
    if (!_toastWrap) {
      _toastWrap = document.createElement('div');
      _toastWrap.id = 'toast-container';
      document.body.appendChild(_toastWrap);
    }
  }

  function toast(msg, type = '') {
    _ensureToast();
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    _toastWrap.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // ── Modal ─────────────────────────────────────────────────────
  let _overlay = null;
  function _ensureModal() {
    if (!_overlay) {
      _overlay = document.createElement('div');
      _overlay.id = 'modal-overlay';
      _overlay.innerHTML = `<div id="modal-box"></div>`;
      document.body.appendChild(_overlay);
      _overlay.addEventListener('click', e => {
        if (e.target === _overlay) closeModal();
      });
    }
  }

  function openModal(html) {
    _ensureModal();
    document.getElementById('modal-box').innerHTML = html;
    _overlay.classList.add('active');
  }

  function closeModal() {
    if (_overlay) _overlay.classList.remove('active');
  }

  // ── HP bar HTML ───────────────────────────────────────────────
  function hpBar(hp, maxHp) {
    const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    const cls = pct < 25 ? 'crit' : pct < 50 ? 'low' : '';
    return `
      <div class="hp-bar-wrap">
        <div class="hp-bar-fill ${cls}" style="width:${pct}%"></div>
      </div>`;
  }

  // ── Status badges HTML ────────────────────────────────────────
  const STATUS_META = {
    shield: { cls: 'shield-c',  icon: '🛡', label: '護盾' },
    poison: { cls: 'poison-c',  icon: '☠',  label: '剧毒' },
    burn:   { cls: 'fire-c',    icon: '🔥', label: '燃燒' },
    speed:  { cls: 'bright',    icon: '💨', label: '加速' },
    slow:   { cls: 'blue',      icon: '❄',  label: '減速' },
    freeze: { cls: 'ice-c',     icon: '🧊', label: '冰凍' },
  };

  function statusBadges(statuses) {
    return statuses.map(s => {
      const m = STATUS_META[s.type] || { cls:'', icon:'?', label: s.type };
      return `<span class="status-badge ${m.cls}">${m.icon} ${m.label} ${s.val}</span>`;
    }).join('');
  }

  // ── Card chip HTML (for bag grid) ─────────────────────────────
  function cardChipHtml(instanceId, def, cdPct = 0) {
    const sizeLabel = ['','小','中','大'][def.size] || '';
    const ready = cdPct >= 1;
    return `
      <div class="card-chip size-${def.size} type-${def.type}"
           data-instance="${instanceId}"
           draggable="true">
        <div class="card-name">${def.name}</div>
        <div class="card-size-badge">${sizeLabel}</div>
        <div class="card-cd-bar">
          <div class="card-cd-fill ${ready?'ready':''}"
               style="width:${Math.min(100,cdPct*100)}%"></div>
        </div>
      </div>`;
  }

  // ── Gold display ──────────────────────────────────────────────
  function goldHtml(amount) {
    return `<span class="gold-display">${amount}</span>`;
  }

  // ── Tooltip (positioned) ──────────────────────────────────────
  let _tooltip = null;
  function _ensureTooltip() {
    if (!_tooltip) {
      _tooltip = document.createElement('div');
      _tooltip.id = 'card-tooltip';
      _tooltip.classList.add('hidden');
      document.body.appendChild(_tooltip);
    }
  }

  function showTooltip(def, x, y) {
    _ensureTooltip();
    const kwHtml = (def.keywords || []).map(k => {
      const descs = {
        '加速': '冷卻恢復速度 +100%',
        '充能': '立即減少當前冷卻時間',
        '減速': '冷卻恢復速度降為常態 50%',
        '燃燒': '每 0.5 秒受到等於層數的傷害，每秒層數 -1',
        '剧毒': '每秒受到等於層數的傷害，無視護盾',
        '護盾': '1 層抵擋 1 點傷害，減少 50% 燃燒',
        '治療': '恢復生命，清除治療量 5% 的剧毒和燃燒',
        '冰凍': '角色不可主動行動',
      };
      return `<div class="tt-keyword"><b>【${k}】</b>${descs[k] || ''}</div>`;
    }).join('');

    const actHtml = def.active ? `
      <div class="tt-skill">
        <div class="tt-skill-label">主動 CD: ${def.active.cd}s</div>
        ${def.active.desc}
      </div>` : '<div class="tt-skill dim">無主動技能</div>';

    const passHtml = (def.passive || []).map(p => `
      <div class="tt-skill">
        <div class="tt-skill-label">被動</div>
        ${p.desc}
      </div>`).join('');

    _tooltip.innerHTML = `
      <div class="tt-name">${def.name}<span class="tt-size">【${'小中大'[def.size-1]}型】</span></div>
      <div class="tt-lore">${def.lore || ''}</div>
      ${actHtml}${passHtml}
      ${kwHtml ? `<div class="tt-keywords">${kwHtml}</div>` : ''}
    `;
    _tooltip.classList.remove('hidden');

    // Position
    const tw = 240, th = _tooltip.offsetHeight || 200;
    let lx = x + 16, ly = y + 8;
    if (lx + tw > window.innerWidth  - 10) lx = x - tw - 8;
    if (ly + th > window.innerHeight - 10) ly = window.innerHeight - th - 10;
    _tooltip.style.left = lx + 'px';
    _tooltip.style.top  = ly + 'px';
  }

  function hideTooltip() {
    _ensureTooltip();
    _tooltip.classList.add('hidden');
  }

  return {
    showScreen, toast, openModal, closeModal,
    hpBar, statusBadges, cardChipHtml, goldHtml,
    showTooltip, hideTooltip,
  };
})();
