// ═══════════════════════════════════════
// js/ui/screenMap.js
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
            <span class="stat-val" id="map-hp">${st.hp}</span>
            <span class="dim">/ ${st.maxHp}</span>
          </div>
          <div style="flex:1;max-width:160px">
            ${window.UI.hpBar(st.hp, st.maxHp)}
          </div>
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

        <div id="map-canvas-wrap">
          <canvas id="map-canvas"></canvas>
        </div>
      </div>

      <div id="map-sidebar">
        <div class="panel">
          <div class="panel-title">背包</div>
          <div id="map-bag-container"></div>
        </div>
        <div class="panel">
          <div class="panel-title">倉庫</div>
          <div id="map-warehouse-container"></div>
        </div>
      </div>
    `;

    // Render bag
    window.BagPanel.init(
      document.getElementById('map-bag-container'),
      () => window.BagPanel.renderWarehouse(document.getElementById('map-warehouse-container'))
    );
    window.BagPanel.renderWarehouse(document.getElementById('map-warehouse-container'));

    // Draw map
    _drawMap(st.map);
  }

  function _drawMap(map) {
    if (!map) return;
    const canvas = document.getElementById('map-canvas');
    if (!canvas) return;
    const wrap   = document.getElementById('map-canvas-wrap');
    const W      = wrap.clientWidth  || 500;
    const H      = wrap.clientHeight || 600;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const rows = [...new Set(map.nodes.map(n => n.row))].sort((a,b)=>a-b);
    const totalRows = rows.length;
    const rowH = H / (totalRows + 1);
    const nodeR = 20;

    // Assign pixel positions
    for (const r of rows) {
      const rowNodes = map.nodes.filter(n => n.row === r).sort((a,b) => a.col - b.col);
      const cols = rowNodes.length;
      rowNodes.forEach((n, i) => {
        n.x = W * (i + 1) / (cols + 1);
        n.y = H - (r + 1) * rowH;
      });
    }

    // Draw edges
    ctx.lineWidth = 1;
    for (const edge of map.edges) {
      const from = map.nodes.find(n => n.id === edge.from);
      const to   = map.nodes.find(n => n.id === edge.to);
      if (!from || !to) continue;
      ctx.strokeStyle = '#1e3a1e';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }

    // Draw nodes
    for (const node of map.nodes) {
      if (node.locked && !node.visited) {
        ctx.globalAlpha = 0.2;
      } else if (node.visited) {
        ctx.globalAlpha = 0.45;
      } else {
        ctx.globalAlpha = 1;
      }

      // Glow for current
      if (node.id === map.currentId) {
        ctx.shadowColor = '#4caf50';
        ctx.shadowBlur  = 16;
      } else {
        ctx.shadowBlur = 0;
      }

      const color = {
        gold:'#ffb300', rest:'#29b6f6', random:'#ab47bc',
        shop:'#4caf50', battle:'#e53935', elite:'#ff7043', boss:'#f44336'
      }[node.type] || '#558b57';

      ctx.fillStyle = '#0d140d';
      ctx.strokeStyle = color;
      ctx.lineWidth = node.id === map.currentId ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Icon
      ctx.globalAlpha = node.locked ? 0.2 : 1;
      ctx.font = '16px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 0;
      ctx.fillText(node.icon, node.x, node.y);

      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 0;
    }

    // Click handler
    canvas.onclick = e => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      for (const node of map.nodes) {
        if (node.locked) continue;
        if (node.visited) continue;
        // Check edges reachable from current
        const reachable = map.edges.some(
          edge => edge.from === map.currentId && edge.to === node.id
        ) || node.id === map.currentId;
        if (!reachable) continue;
        const dx = mx - node.x, dy = my - node.y;
        if (dx*dx + dy*dy <= nodeR*nodeR) {
          window.Game.visitNode(node);
          return;
        }
      }
    };
  }

  return { render };
})();
