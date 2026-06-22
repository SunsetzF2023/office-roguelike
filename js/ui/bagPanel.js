// ═══════════════════════════════════════
// js/ui/bagPanel.js  —  bag grid (mouse-based drag, no HTML5 DnD)
// ═══════════════════════════════════════
'use strict';

window.BagPanel = (() => {

  let _bagContainer  = null;
  let _wareContainer = null;
  let _onChanged     = null;

  // Drag state
  let _drag = null;
  // {
  //   instanceId, fromWarehouse,
  //   ghost (DOM el), ghostOffX, ghostOffY,
  //   originCol, originRow
  // }

  // ── Public API ────────────────────────────────────────────────
  function init(bagContainerEl, onChanged) {
    _bagContainer = bagContainerEl;
    _onChanged    = onChanged || (() => {});
    render();
  }

  function renderWarehouse(wareContainerEl) {
    _wareContainer = wareContainerEl;
    _renderWarehouseInner();
  }

  // ── Render bag grid ───────────────────────────────────────────
  function render() {
    if (!_bagContainer) return;
    const st   = window.State.get();
    const COLS = window.State.BAG_COLS;
    const ROWS = window.State.BAG_ROWS;

    // Occupancy map
    const occ = {};
    for (const slot of st.bag) {
      const def = window.State.getCardDef(slot.instanceId);
      if (!def) continue;
      for (let i = 0; i < def.size; i++) {
        occ[`${slot.col + i},${slot.row}`] = slot.instanceId;
      }
    }

    const CELL = 52, GAP = 4;

    let html = `<div id="bag-grid" style="
      display:grid;
      grid-template-columns:repeat(${COLS},${CELL}px);
      grid-template-rows:repeat(${ROWS},${CELL}px);
      gap:${GAP}px;
      padding:8px;
      background:var(--bg-panel);
      border:1px solid var(--border);
      border-radius:3px;
      width:fit-content;
      position:relative;
      user-select:none;
    ">`;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx    = r * COLS + c;
        const locked = idx >= st.unlockedCells;
        const key    = `${c},${r}`;
        const instId = occ[key];
        const slot   = instId ? st.bag.find(s => s.instanceId === instId) : null;
        const isOrigin = slot && slot.col === c && slot.row === r;

        html += `<div class="bag-cell${locked?' locked-cell':''}"
                      data-col="${c}" data-row="${r}"
                      style="width:${CELL}px;height:${CELL}px;
                             background:var(--bg);
                             border:1px solid var(--border);
                             border-radius:3px;position:relative;">`;

        if (locked) {
          html += `<div style="width:100%;height:100%;display:flex;align-items:center;
                               justify-content:center;color:var(--text-dim);font-size:14px;">🔒</div>`;
        } else if (isOrigin) {
          const def = window.State.getCardDef(instId);
          const w   = CELL * def.size + GAP * (def.size - 1);
          const typeColors = {
            poison:'#8bc34a',fire:'#ff7043',shield:'#90caf9',
            heal:'#66bb6a',speed:'#76d275',ice:'#80deea',
            buff:'#ab47bc',damage:'#ffb300'
          };
          const col = typeColors[def.type] || '#558b57';
          html += `<div class="bag-chip"
                        data-instance="${instId}"
                        style="
                          position:absolute;top:0;left:0;
                          width:${w}px;height:${CELL}px;
                          background:var(--bg-card);
                          border:1px solid var(--green-dim);
                          border-left:3px solid ${col};
                          border-radius:3px;
                          cursor:grab;
                          z-index:2;
                          display:flex;flex-direction:column;
                          justify-content:space-between;
                          padding:4px 6px;
                          box-sizing:border-box;
                        ">
                    <div style="font-size:9px;color:var(--text-label);
                                white-space:nowrap;overflow:hidden;
                                text-overflow:ellipsis;padding-left:3px">
                      ${def.name}
                    </div>
                    <div style="font-size:8px;color:var(--text-dim);align-self:flex-end">
                      ${'小中大'[def.size-1]}型
                    </div>
                  </div>`;
        }
        html += '</div>';
      }
    }
    html += '</div>';

    _bagContainer.innerHTML = html;
    _bindBagEvents();
  }

  // ── Bind mouse events on bag ──────────────────────────────────
  function _bindBagEvents() {
    const grid = document.getElementById('bag-grid');
    if (!grid) return;

    // Tooltip
    grid.addEventListener('mouseover', e => {
      const chip = e.target.closest('.bag-chip');
      if (!chip) return;
      const def = window.State.getCardDef(chip.dataset.instance);
      if (def) window.UI.showTooltip(def, e.clientX, e.clientY);
    });
    grid.addEventListener('mousemove', e => {
      const chip = e.target.closest('.bag-chip');
      if (chip) {
        const def = window.State.getCardDef(chip.dataset.instance);
        if (def) window.UI.showTooltip(def, e.clientX, e.clientY);
      } else {
        window.UI.hideTooltip();
      }
    });
    grid.addEventListener('mouseleave', () => window.UI.hideTooltip());

    // Mousedown on chip = start drag
    grid.addEventListener('mousedown', e => {
      const chip = e.target.closest('.bag-chip');
      if (!chip) return;
      e.preventDefault();
      const instId = chip.dataset.instance;
      const slot   = window.State.get().bag.find(s => s.instanceId === instId);
      if (!slot) return;

      const rect = chip.getBoundingClientRect();
      _startDrag(instId, false, e.clientX - rect.left, e.clientY - rect.top,
                 slot.col, slot.row, chip);
    });
  }

  // ── Render warehouse ──────────────────────────────────────────
  function _renderWarehouseInner() {
    if (!_wareContainer) return;
    const st = window.State.get();

    if (st.warehouse.length === 0) {
      _wareContainer.innerHTML =
        `<div style="padding:8px;color:var(--text-dim);font-size:11px">倉庫為空</div>`;
      return;
    }

    const typeIcons = {
      poison:'☠',fire:'🔥',shield:'🛡',heal:'💚',
      speed:'💨',ice:'❄',buff:'⭐',damage:'⚡'
    };

    let html = '<div style="display:flex;flex-direction:column;gap:6px">';
    for (const instId of st.warehouse) {
      const def = window.State.getCardDef(instId);
      if (!def) continue;
      html += `
        <div class="ware-chip" data-instance="${instId}" style="
          display:flex;align-items:center;gap:8px;
          padding:6px 10px;
          background:var(--bg-panel);
          border:1px solid var(--border);
          border-radius:3px;
          cursor:grab;
        ">
          <div style="font-size:18px;flex-shrink:0">${typeIcons[def.type]||'⚡'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;color:var(--green-bright);
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${def.name}
            </div>
            <div style="font-size:10px;color:var(--text-dim)">
              ${'小中大'[def.size-1]||''}型
              ${def.active ? ` · CD ${def.active.cd}s` : ' · 純被動'}
            </div>
          </div>
          <div style="font-size:10px;color:var(--text-dim)">拖入背包</div>
        </div>`;
    }
    html += '</div>';
    _wareContainer.innerHTML = html;

    // Bind mousedown on warehouse chips
    _wareContainer.querySelectorAll('.ware-chip').forEach(chip => {
      chip.addEventListener('mousedown', e => {
        e.preventDefault();
        const instId = chip.dataset.instance;
        const rect   = chip.getBoundingClientRect();
        _startDrag(instId, true, e.clientX - rect.left, e.clientY - rect.top, null, null, chip);
      });
      chip.addEventListener('mouseover', e => {
        const def = window.State.getCardDef(chip.dataset.instance);
        if (def) window.UI.showTooltip(def, e.clientX, e.clientY);
      });
      chip.addEventListener('mousemove', e => {
        const def = window.State.getCardDef(chip.dataset.instance);
        if (def) window.UI.showTooltip(def, e.clientX, e.clientY);
      });
      chip.addEventListener('mouseleave', () => window.UI.hideTooltip());
    });
  }

  // ── Drag logic ────────────────────────────────────────────────
  function _startDrag(instanceId, fromWarehouse, offX, offY, originCol, originRow, sourceEl) {
    window.UI.hideTooltip();

    const def  = window.State.getCardDef(instanceId);
    if (!def) return;

    const CELL = 52, GAP = 4;
    const w    = CELL * def.size + GAP * (def.size - 1);

    // Create ghost
    const ghost = document.createElement('div');
    ghost.style.cssText = `
      position:fixed;
      width:${w}px;height:${CELL}px;
      background:var(--bg-card);
      border:1px solid var(--green);
      border-radius:3px;
      opacity:0.85;
      pointer-events:none;
      z-index:9000;
      display:flex;align-items:center;justify-content:center;
      font-size:11px;color:var(--green-bright);
      padding:4px 8px;box-sizing:border-box;
      white-space:nowrap;overflow:hidden;
    `;
    ghost.textContent = def.name;
    document.body.appendChild(ghost);

    _drag = { instanceId, fromWarehouse, ghost, offX, offY, originCol, originRow };

    // Hide source
    if (sourceEl) sourceEl.style.opacity = '0.3';
    _drag.sourceEl = sourceEl;

    // Global mouse move / up
    document.addEventListener('mousemove', _onMouseMove);
    document.addEventListener('mouseup',   _onMouseUp);
  }

  function _onMouseMove(e) {
    if (!_drag) return;
    const { ghost, offX, offY } = _drag;
    ghost.style.left = (e.clientX - offX) + 'px';
    ghost.style.top  = (e.clientY - offY) + 'px';

    // Highlight target cell
    _clearHighlights();
    const cell = _cellUnderCursor(e.clientX, e.clientY);
    if (cell) {
      const col = +cell.dataset.col;
      const row = +cell.dataset.row;
      const ok  = window.State.canPlaceCard(_drag.instanceId, col, row);
      _highlightCells(col, row, window.State.getCardDef(_drag.instanceId).size, ok);
    }
  }

  function _onMouseUp(e) {
    if (!_drag) return;
    document.removeEventListener('mousemove', _onMouseMove);
    document.removeEventListener('mouseup',   _onMouseUp);

    _clearHighlights();
    _drag.ghost.remove();

    const cell = _cellUnderCursor(e.clientX, e.clientY);
    if (cell) {
      const col = +cell.dataset.col;
      const row = +cell.dataset.row;
      if (window.State.placeCard(_drag.instanceId, col, row)) {
        // success
      } else if (_drag.sourceEl) {
        _drag.sourceEl.style.opacity = '';
      }
    } else {
      // Dropped outside grid — put back in warehouse if from bag
      if (!_drag.fromWarehouse) {
        window.State.addToWarehouse(_drag.instanceId);
      }
      if (_drag.sourceEl) _drag.sourceEl.style.opacity = '';
    }

    _drag = null;
    render();
    if (_wareContainer) _renderWarehouseInner();
    _onChanged();
  }

  function _cellUnderCursor(cx, cy) {
    const grid = document.getElementById('bag-grid');
    if (!grid) return null;
    // Temporarily hide ghost
    const cells = grid.querySelectorAll('.bag-cell');
    for (const cell of cells) {
      const r = cell.getBoundingClientRect();
      if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
        if (cell.classList.contains('locked-cell')) return null;
        return cell;
      }
    }
    return null;
  }

  function _highlightCells(col, row, size, ok) {
    const grid = document.getElementById('bag-grid');
    if (!grid) return;
    for (let i = 0; i < size; i++) {
      const cell = grid.querySelector(`[data-col="${col+i}"][data-row="${row}"]`);
      if (cell) {
        cell.style.background = ok ? 'var(--bg-select)' : 'rgba(229,57,53,0.12)';
        cell.style.borderColor = ok ? 'var(--green)' : 'var(--red)';
      }
    }
  }

  function _clearHighlights() {
    const grid = document.getElementById('bag-grid');
    if (!grid) return;
    grid.querySelectorAll('.bag-cell').forEach(cell => {
      cell.style.background = '';
      cell.style.borderColor = '';
    });
  }

  return { init, render, renderWarehouse };
})();
