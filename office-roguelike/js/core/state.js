// ═══════════════════════════════════════
// js/core/state.js  —  global game state
// ═══════════════════════════════════════
'use strict';

window.State = (() => {

  const INITIAL_HP = 1500;
  const BAG_COLS   = 6;
  const BAG_ROWS   = 2;

  // ── Blank run state ──────────────────────────────────────────
  function freshRun() {
    return {
      // Player
      hp: INITIAL_HP,
      maxHp: INITIAL_HP,
      gold: 8,
      level: 1,
      eventsCompleted: 0,
      unlockedCells: 2,   // start with 2 cells unlocked

      // Bag: array of placed cards
      // { instanceId, cardId, col, row }  (col 0-5, row 0-1)
      bag: [],

      // Warehouse (stash, not in battle)
      warehouse: [],   // array of instanceIds

      // Card instance registry: instanceId -> { cardId, scalingData }
      instances: {},

      // Map
      map: null,
      currentNode: null,

      // Meta
      battleCount: 0,
      wins: 0,
      losses: 0,
      run: 0,
    };
  }

  let _state = freshRun();
  let _instanceCounter = 0;

  // ── Instance helpers ─────────────────────────────────────────
  function createInstance(cardId) {
    const id = `inst_${++_instanceCounter}`;
    _state.instances[id] = {
      instanceId: id,
      cardId,
      // Scaling values (e.g. card_B damage accumulation)
      damageBonus: 0,
    };
    return id;
  }

  function getInstance(instanceId) {
    return _state.instances[instanceId] || null;
  }

  function getCardDef(instanceId) {
    const inst = getInstance(instanceId);
    return inst ? window.getCard(inst.cardId) : null;
  }

  // ── Bag helpers ──────────────────────────────────────────────
  function bagOccupied() {
    // Returns set of "col,row" strings that are occupied
    const occ = new Set();
    for (const slot of _state.bag) {
      const def = getCardDef(slot.instanceId);
      if (!def) continue;
      for (let i = 0; i < def.size; i++) {
        occ.add(`${slot.col + i},${slot.row}`);
      }
    }
    return occ;
  }

  function canPlaceCard(instanceId, col, row) {
    const def = getCardDef(instanceId);
    if (!def) return false;
    if (row < 0 || row >= BAG_ROWS) return false;
    if (col < 0 || col + def.size - 1 >= BAG_COLS) return false;

    // Check unlocked cells
    for (let i = 0; i < def.size; i++) {
      const cellIdx = row * BAG_COLS + (col + i);
      if (cellIdx >= _state.unlockedCells) return false;
    }

    const occ = bagOccupied();
    for (let i = 0; i < def.size; i++) {
      if (occ.has(`${col + i},${row}`)) return false;
    }
    return true;
  }

  function placeCard(instanceId, col, row) {
    if (!canPlaceCard(instanceId, col, row)) return false;
    // Remove from bag if already there
    removeFromBag(instanceId);
    // Remove from warehouse if there
    _state.warehouse = _state.warehouse.filter(id => id !== instanceId);
    _state.bag.push({ instanceId, col, row });
    return true;
  }

  function removeFromBag(instanceId) {
    _state.bag = _state.bag.filter(s => s.instanceId !== instanceId);
  }

  function addToWarehouse(instanceId) {
    removeFromBag(instanceId);
    if (!_state.warehouse.includes(instanceId)) {
      _state.warehouse.push(instanceId);
    }
  }

  // ── Adjacent helpers ─────────────────────────────────────────
  function getAdjacentSlots(col, row, size) {
    // Returns all bag slots whose cells touch any cell of (col..col+size-1, row)
    const adjacent = [];
    for (const slot of _state.bag) {
      const def = getCardDef(slot.instanceId);
      if (!def) continue;
      let touches = false;
      // cells of this slot
      for (let a = 0; a < def.size && !touches; a++) {
        const sc = slot.col + a;
        const sr = slot.row;
        // cells of query card
        for (let b = 0; b < size && !touches; b++) {
          const qc = col + b;
          const qr = row;
          const dc = Math.abs(sc - qc);
          const dr = Math.abs(sr - qr);
          if ((dc === 1 && dr === 0) || (dc === 0 && dr === 1)) {
            touches = true;
          }
        }
      }
      if (touches) adjacent.push(slot);
    }
    return adjacent;
  }

  function getAdjacentSlotsOf(instanceId) {
    const slot = _state.bag.find(s => s.instanceId === instanceId);
    if (!slot) return [];
    const def = getCardDef(instanceId);
    return getAdjacentSlots(slot.col, slot.row, def.size)
      .filter(s => s.instanceId !== instanceId);
  }

  // ── HP helpers ───────────────────────────────────────────────
  function healPlayer(amount) {
    _state.hp = Math.min(_state.maxHp, _state.hp + amount);
  }

  function damagePlayer(amount) {
    _state.hp = Math.max(0, _state.hp - amount);
  }

  function isAlive() {
    return _state.hp > 0;
  }

  // ── Level / unlock ───────────────────────────────────────────
  const EVENTS_PER_LEVEL = 3;
  const MAX_CELLS = BAG_COLS * BAG_ROWS; // 12

  // Unlock thresholds: unlockedCells grows with level
  const UNLOCK_TABLE = [2,3,4,5,6,7,8,9,10,11,12];

  function onEventCompleted() {
    _state.eventsCompleted++;
    const newLevel = Math.floor(_state.eventsCompleted / EVENTS_PER_LEVEL) + 1;
    if (newLevel > _state.level) {
      _state.level = newLevel;
      const idx = Math.min(newLevel - 1, UNLOCK_TABLE.length - 1);
      _state.unlockedCells = UNLOCK_TABLE[idx];
      return true; // leveled up
    }
    return false;
  }

  // ── Gold ─────────────────────────────────────────────────────
  function spendGold(amount) {
    if (_state.gold < amount) return false;
    _state.gold -= amount;
    return true;
  }

  function gainGold(amount) {
    _state.gold += amount;
  }

  // ── Expose ───────────────────────────────────────────────────
  return {
    get: () => _state,
    reset: () => { _state = freshRun(); _instanceCounter = 0; },

    BAG_COLS, BAG_ROWS, MAX_CELLS,

    createInstance,
    getInstance,
    getCardDef,

    bagOccupied,
    canPlaceCard,
    placeCard,
    removeFromBag,
    addToWarehouse,

    getAdjacentSlotsOf,

    healPlayer,
    damagePlayer,
    isAlive,

    onEventCompleted,
    spendGold,
    gainGold,
  };
})();
