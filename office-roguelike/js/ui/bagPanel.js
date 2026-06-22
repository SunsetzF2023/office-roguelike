// ═══════════════════════════════════════
// js/ui/bagPanel.js  —  bag grid drag & drop
// ═══════════════════════════════════════
'use strict';

window.BagPanel = (() => {

  let _container = null;
  let _onChanged = null;
  let _dragging  = null;   // { instanceId, originCol, originRow }

  function init(containerEl, onChanged) {
    _container = containerEl;
    _onChanged  = onChanged || (() => {});
    render();
  }

  // ── Render ────────────────────────────────────────────────────
  function render() {
    if (!_container) return;
    const st  = window.State.get();
    const cols = window.State.BAG_COLS;
    const rows = window.State.BAG_ROWS;

    // Build occupancy map: cellKey -> instanceId
    const occ = {};
    for (const slot of st.bag) {
      const def = window.State.getCardDef(slot.instanceId);
      if (!def) continue;
      for (let i = 0; i < def.size; i++) {
        occ[`${slot.col + i},${slot.row}`] = slot.instanceId;
      }
    }

    // Locked cell threshold
    const unlocked = st.unlockedCells;

    let html = '<div class="bag-grid" id="bag-grid">';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellIdx = r * cols + c;
        const locked  = cellIdx >= unlocked;
        const key     = `${c},${r}`;
        const instId  = occ[key];

        // Only render card chip at its origin cell
        const slot = instId ? st.bag.find(s => s.instanceId === instId) : null;
        const isOrigin = slot && slot.col === c && slot.row === r;

        html += `<div class="bag-cell ${instId?'occupied':''} ${locked?'locked-cell':''}"
                      data-col="${c}" data-row="${r}"
                      ${locked ? 'title="格子尚未解鎖"' : ''}>`;

        if (locked) {
          html += `<div style="width:100%;height:100%;display:flex;align-items:center;
                               justify-content:center;color:var(--text-dim);font-size:10px;">🔒</div>`;
        } else if (isOrigin) {
          const def = window.State.getCardDef(instId);
          html += window.UI.cardChipHtml(instId, def);
        }

        html += '</div>';
      }
    }
    html += '</div>';

    _container.innerHTML = html;
    _bindEvents();
  }

  // ── Drag & Drop events ────────────────────────────────────────
  function _bindEvents() {
    const grid = document.getElementById('bag-grid');
    if (!grid) return;

    // Drag start on chips
    grid.querySelectorAll('.card-chip').forEach(chip => {
      chip.addEventListener('dragstart', e => {
        const instId = chip.dataset.instance;
        const slot   = window.State.get().bag.find(s => s.instanceId === instId);
        _dragging = { instanceId: instId, originCol: slot?.col, originRow: slot?.row };
        chip.classList.add('dragging');
        e.dataTransfer.setData('text/plain', instId);
      });
      chip.addEventListener('dragend', () => {
        chip.classList.remove('dragging');
        _clearDropTargets();
        _dragging = null;
      });

      // Tooltip
      chip.addEventListener('mouseenter', e => {
        const def = window.State.getCardDef(chip.dataset.instance);
        if (def) window.UI.showTooltip(def, e.clientX, e.clientY);
      });
      chip.addEventListener('mousemove', e => {
        window.UI.showTooltip(
          window.State.getCardDef(chip.dataset.instance), e.clientX, e.clientY);
      });
      chip.addEventListener('mouseleave', () => window.UI.hideTooltip());
    });

    // Cell drag-over and drop
    grid.querySelectorAll('.bag-cell:not(.locked-cell)').forEach(cell => {
      cell.addEventListener('dragover', e => {
        e.preventDefault();
        if (!_dragging) return;
        const col = +cell.dataset.col;
        const row = +cell.dataset.row;
        const canPlace = window.State.canPlaceCard(_dragging.instanceId, col, row);
        cell.classList.toggle('droptarget', canPlace);
        cell.classList.toggle('invalid',    !canPlace);
      });

      cell.addEventListener('dragleave', () => {
        cell.classList.remove('droptarget', 'invalid');
      });

      cell.addEventListener('drop', e => {
        e.preventDefault();
        const col = +cell.dataset.col;
        const row = +cell.dataset.row;
        if (_dragging && window.State.placeCard(_dragging.instanceId, col, row)) {
          render();
          _onChanged();
        }
        _clearDropTargets();
      });
    });
  }

  function _clearDropTargets() {
    document.querySelectorAll('.bag-cell').forEach(c => {
      c.classList.remove('droptarget', 'invalid');
    });
  }

  // ── Warehouse list (below bag) ────────────────────────────────
  function renderWarehouse(containerEl) {
    const st = window.State.get();
    if (!containerEl) return;

    if (st.warehouse.length === 0) {
      containerEl.innerHTML = `<div class="warehouse-grid"><span class="dim" style="font-size:11px">倉庫為空</span></div>`;
      return;
    }

    let html = '<div class="warehouse-grid">';
    for (const instId of st.warehouse) {
      const def = window.State.getCardDef(instId);
      if (!def) continue;
      html += `
        <div class="shop-card-row" style="width:100%" data-instance="${instId}">
          <div class="shop-card-preview type-${def.type}" style="font-size:18px">
            ${def.type==='poison'?'☠':def.type==='fire'?'🔥':def.type==='shield'?'🛡':
              def.type==='heal'?'💚':def.type==='speed'?'💨':def.type==='ice'?'❄':
              def.type==='buff'?'⭐':'⚡'}
          </div>
          <div class="shop-card-info">
            <div class="shop-card-name">${def.name}</div>
            <div class="shop-card-meta">
              <span class="shop-card-size-tag">${['','小','中','大'][def.size]||''}型</span>
              <span class="dim" style="font-size:10px">拖到背包使用</span>
            </div>
          </div>
        </div>`;
    }
    html += '</div>';
    containerEl.innerHTML = html;

    // Allow dragging from warehouse into bag
    containerEl.querySelectorAll('[data-instance]').forEach(row => {
      row.setAttribute('draggable', true);
      row.addEventListener('dragstart', e => {
        const instId = row.dataset.instance;
        _dragging = { instanceId: instId, fromWarehouse: true };
        e.dataTransfer.setData('text/plain', instId);
      });
      row.addEventListener('dragend', () => {
        _clearDropTargets();
        _dragging = null;
        render();
        renderWarehouse(containerEl);
      });
      row.addEventListener('mouseenter', e => {
        const def = window.State.getCardDef(row.dataset.instance);
        if (def) window.UI.showTooltip(def, e.clientX, e.clientY);
      });
      row.addEventListener('mouseleave', () => window.UI.hideTooltip());
    });
  }

  return { init, render, renderWarehouse };
})();
