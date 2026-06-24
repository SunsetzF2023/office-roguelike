// ═══════════════════════════════════════
// js/ui/screenMap.js  —  linear step map
// ═══════════════════════════════════════
'use strict';

window.ScreenMap = (() => {

  function render() {
    const el = document.getElementById('screen-map');
    const st = window.State.get();

    el.innerHTML = `
      <div id="map-area">
        <div id="player-statbar">
          <div class="stat-item">
            <span class="stat-label">HP</span>
            <span class="stat-val">${st.hp}</span>
            <span class="dim"> / ${st.maxHp}</span>
          </div>
          <div style="flex:1;max-width:160px">${window.UI.hpBar(st.hp, st.maxHp)}</div>
          <div class="stat-item">
            <span class="stat-label">Gold</span>
            ${window.UI.goldHtml(st.gold)}
          </div>
          <div class="stat-item">
            <span class="stat-label">Lv</span>
            <span class="stat-val">${st.level}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">格子</span>
            <span class="stat-val">${st.unlockedCells}/12</span>
          </div>
        </div>

        <div id="map-canvas-wrap" style="flex:1;overflow-y:auto;
             background:var(--bg-panel);border:1px solid var(--border);
             border-radius:3px;padding:16px;">
          <div id="map-steps"></div>
        </div>
      </div>

      <div id="map-sidebar">
        <div class="panel">
          <div class="panel-title">背包</div>
          <div id="map-bag-container"></div>
        </div>
        <div class="panel" style="flex:1;overflow-y:auto">
          <div class="panel-title">倉庫</div>
          <div id="map-warehouse-container"></div>
        </div>
      </div>
    `;

    window.BagPanel.init(
      document.getElementById('map-bag-container'),
      () => window.BagPanel.renderWarehouse(document.getElementById('map-warehouse-container'))
    );
    window.BagPanel.renderWarehouse(document.getElementById('map-warehouse-container'));

    _renderSteps(st.map);
  }

  function _renderSteps(map) {
    const wrap = document.getElementById('map-steps');
    if (!wrap || !map) return;

    // Group nodes by step
    const maxStep = Math.max(...map.nodes.map(n => n.step));
    let html = '<div style="display:flex;flex-direction:column;gap:0;align-items:center;">';

    for (let s = maxStep; s >= 0; s--) {
      const stepNodes = map.nodes.filter(n => n.step === s).sort((a,b)=>a.posInStep-b.posInStep);

      // Connector line (except last)
      if (s < maxStep) {
        html += `<div style="width:2px;height:20px;background:var(--border);margin:0 auto;"></div>`;
      }

      // Node row
      const isBattle = stepNodes[0] && ['battle','elite','boss'].includes(stepNodes[0].type);

      html += `<div style="display:flex;gap:16px;align-items:center;justify-content:center;
                            padding:4px 0;" data-step="${s}">`;

      for (const node of stepNodes) {
        const available = !node.locked && !node.visited && !node.skipped;
        const isCurrent = node.id === map.currentId;
        const isVisited = node.visited;
        const isSkipped = node.skipped;

        const typeColors = {
          gold:'#ffb300', rest:'#29b6f6', random:'#ab47bc',
          shop:'#4caf50', battle:'#e53935', elite:'#ff7043', boss:'#f44336'
        };
        const color = typeColors[node.type] || '#558b57';

        let borderStyle = `2px solid ${color}`;
        let opacity = '1';
        let cursor  = 'default';
        let glow    = '';
        let textColor = '#fff';

        if (isVisited) {
          opacity = '0.4';
          borderStyle = `2px solid ${color}`;
        } else if (isSkipped) {
          opacity = '0.2';
        } else if (available) {
          cursor = 'pointer';
          glow = `box-shadow:0 0 12px ${color}55, 0 0 24px ${color}22;`;
          borderStyle = `2px solid ${color}`;
        } else {
          opacity = '0.25';
        }

        if (isCurrent) {
          glow = `box-shadow:0 0 16px var(--green), 0 0 32px var(--green-dim);`;
          borderStyle = `2px solid var(--green-bright)`;
        }

        html += `
          <div class="map-node-btn" data-nodeid="${node.id}"
               style="
                 width:64px;height:64px;
                 border-radius:50%;
                 border:${borderStyle};
                 background:var(--bg-panel);
                 display:flex;flex-direction:column;
                 align-items:center;justify-content:center;
                 gap:2px;
                 opacity:${opacity};
                 cursor:${cursor};
                 transition:all 0.2s;
                 position:relative;
                 ${glow}
               ">
            <div style="font-size:22px;line-height:1">${node.icon}</div>
            <div style="font-size:9px;color:${textColor};opacity:0.8;letter-spacing:0.05em">
              ${node.label}
            </div>
            ${isVisited ? `<div style="position:absolute;top:2px;right:4px;font-size:9px;color:var(--green)">✓</div>` : ''}
            ${available ? `<div style="position:absolute;bottom:-18px;font-size:9px;
                                       color:${color};white-space:nowrap">點擊選擇</div>` : ''}
          </div>`;
      }
      html += '</div>';
    }
    html += '</div>';
    wrap.innerHTML = html;

    // Scroll to current step
    const available = map.nodes.filter(n => !n.locked && !n.visited && !n.skipped);
    if (available.length > 0) {
      const step = available[0].step;
      const stepEl = wrap.querySelector(`[data-step="${step}"]`);
      if (stepEl) setTimeout(() => stepEl.scrollIntoView({ behavior:'smooth', block:'center' }), 100);
    }

    // Bind clicks
    wrap.querySelectorAll('.map-node-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const nodeId = btn.dataset.nodeid;
        const node   = map.nodes.find(n => n.id === nodeId);
        if (!node) return;
        if (node.locked || node.visited || node.skipped) return;

        // Must be available (unlocked)
        const avail = window.MapEngine.getAvailableNodes(map);
        if (!avail.find(n => n.id === nodeId)) {
          window.UI.toast('請先完成當前步驟', 'warn');
          return;
        }
        window.Game.visitNode(node);
      });
    });
  }

  return { render };
})();
