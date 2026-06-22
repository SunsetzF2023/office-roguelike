// ═══════════════════════════════════════
// js/core/map.js  —  map generation
// ═══════════════════════════════════════
'use strict';

window.MapEngine = (() => {

  const COLS = 7;
  const ROWS = 9;

  function generate() {
    const nodes = [];
    const edges = [];

    // Build layered graph: each row = one "depth"
    for (let r = 0; r < ROWS; r++) {
      const nodeCount = r === 0 ? 1 : (r === ROWS - 1 ? 1 : randomInt(2, 4));
      const rowNodes = [];

      for (let i = 0; i < nodeCount; i++) {
        const col = Math.round((i / (nodeCount - 1 || 1)) * (COLS - 1));
        const type = nodeType(r, ROWS);
        rowNodes.push({
          id: `${r}_${i}`,
          row: r,
          col,
          type,
          icon: typeIcon(type),
          label: typeLabel(type),
          visited: false,
          locked: r !== 0,
          x: 0, y: 0,  // set by renderer
        });
      }
      nodes.push(...rowNodes);

      // Connect to previous row
      if (r > 0) {
        const prev = nodes.filter(n => n.row === r - 1);
        for (const cur of rowNodes) {
          // Connect to nearest in prev row
          const nearest = prev.reduce((a, b) =>
            Math.abs(a.col - cur.col) < Math.abs(b.col - cur.col) ? a : b);
          edges.push({ from: nearest.id, to: cur.id });
        }
      }
    }

    nodes[0].locked   = false;
    nodes[0].visited  = true;  // start node is already "at"

    const map = { nodes, edges, currentId: nodes[0].id };
    // Unlock first row of reachable nodes
    unlockFrom(map, nodes[0].id);
    return map;
  }

  function nodeType(r, total) {
    return window.getNodeTypeForDistance(r, total - 1);
  }

  function typeIcon(t) {
    return { gold:'💰', rest:'☕', random:'❓', shop:'🛒',
             battle:'⚔', elite:'☠', boss:'👹' }[t] || '?';
  }

  function typeLabel(t) {
    return { gold:'金幣', rest:'休息', random:'事件', shop:'商店',
             battle:'戰鬥', elite:'精英', boss:'頭目' }[t] || t;
  }

  function randomInt(a, b) {
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  // Unlock nodes reachable from current
  function unlockFrom(map, nodeId) {
    const edges = map.edges.filter(e => e.from === nodeId);
    for (const e of edges) {
      const n = map.nodes.find(n => n.id === e.to);
      if (n) n.locked = false;
    }
  }

  // Mark node visited and unlock next
  function visitNode(map, nodeId) {
    const node = map.nodes.find(n => n.id === nodeId);
    if (node) {
      node.visited = true;
      node.locked  = false;
    }
    unlockFrom(map, nodeId);
    map.currentId = nodeId;
  }

  return { generate, visitNode, typeIcon, typeLabel };
})();
