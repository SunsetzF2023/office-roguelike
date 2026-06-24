// ═══════════════════════════════════════
// js/core/map.js  —  linear map with choices per step
// ═══════════════════════════════════════
'use strict';

window.MapEngine = (() => {

  // Map structure:
  // A series of "steps". Each step has 2-3 node choices (player picks one).
  // After picking, that step is done and next step unlocks.
  // Pattern: [event/shop/gold choice] → battle → [event/shop/gold choice] → battle → ... → boss

  const STEP_PATTERN = [
    // step 0: pick a non-combat node (starting choices)
    { choices: 2, pool: ['gold','gold','rest','shop','random'] },
    // step 1: battle
    { choices: 1, pool: ['battle'] },
    // step 2: pick
    { choices: 2, pool: ['gold','rest','shop','random','random'] },
    // step 3: battle
    { choices: 1, pool: ['battle'] },
    // step 4: pick
    { choices: 3, pool: ['shop','shop','random','rest','gold'] },
    // step 5: elite battle
    { choices: 1, pool: ['elite'] },
    // step 6: pick
    { choices: 2, pool: ['shop','random','rest','gold'] },
    // step 7: battle
    { choices: 1, pool: ['battle'] },
    // step 8: pick
    { choices: 3, pool: ['shop','random','rest','gold','gold'] },
    // step 9: elite
    { choices: 1, pool: ['elite'] },
    // step 10: pick
    { choices: 2, pool: ['shop','rest','random'] },
    // step 11: boss
    { choices: 1, pool: ['boss'] },
  ];

  function generate() {
    const nodes = [];
    const edges = [];
    let idCounter = 0;

    for (let stepIdx = 0; stepIdx < STEP_PATTERN.length; stepIdx++) {
      const step = STEP_PATTERN[stepIdx];
      const count = step.choices;
      const stepNodes = [];

      for (let i = 0; i < count; i++) {
        // Pick random type from pool
        const pool = step.pool;
        const type = pool[Math.floor(Math.random() * pool.length)];
        const node = {
          id: `${stepIdx}_${i}`,
          step: stepIdx,
          posInStep: i,
          totalInStep: count,
          type,
          icon: typeIcon(type),
          label: typeLabel(type),
          visited: false,
          locked: stepIdx !== 0,  // only step 0 is unlocked at start
        };
        nodes.push(node);
        stepNodes.push(node);
        idCounter++;
      }

      // Connect previous step's chosen node → all nodes in this step
      // (edges are created dynamically when a node is chosen; here we just
      //  pre-create edges from every node in prev step to every node in this step)
      if (stepIdx > 0) {
        const prevStep = nodes.filter(n => n.step === stepIdx - 1);
        for (const prev of prevStep) {
          for (const cur of stepNodes) {
            edges.push({ from: prev.id, to: cur.id });
          }
        }
      }
    }

    return {
      nodes,
      edges,
      currentStep: -1,  // -1 = not started, player picks from step 0
      currentId: null,
    };
  }

  function typeIcon(t) {
    return { gold:'💰', rest:'☕', random:'❓', shop:'🛒',
             battle:'⚔', elite:'☠', boss:'👹' }[t] || '?';
  }

  function typeLabel(t) {
    return { gold:'金幣', rest:'休息', random:'事件', shop:'商店',
             battle:'戰鬥', elite:'精英', boss:'頭目' }[t] || t;
  }

  // Call when player clicks a node
  function visitNode(map, nodeId) {
    const node = map.nodes.find(n => n.id === nodeId);
    if (!node) return;

    node.visited  = true;
    map.currentId   = nodeId;
    map.currentStep = node.step;

    // Lock all other nodes in same step (you can only pick one)
    map.nodes
      .filter(n => n.step === node.step && n.id !== nodeId)
      .forEach(n => { n.locked = true; n.skipped = true; });

    // Unlock next step
    const nextStepNodes = map.nodes.filter(n => n.step === node.step + 1);
    nextStepNodes.forEach(n => { n.locked = false; });
  }

  // Get nodes available to click (unlocked, not visited, not skipped)
  function getAvailableNodes(map) {
    return map.nodes.filter(n => !n.locked && !n.visited && !n.skipped);
  }

  return { generate, visitNode, getAvailableNodes, typeIcon, typeLabel };
})();
