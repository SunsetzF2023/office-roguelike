// ═══════════════════════════════════════
// js/data/enemies.js  —  enemy definitions
// ═══════════════════════════════════════
'use strict';

// Each enemy has a bag layout: array of {cardId, col, row}
// col 0-5, row 0-1 (same 2x6 grid as player)
window.ENEMIES = [

  {
    id: 'startup_team',
    name: 'Startup Team',
    desc: '快速迭代，快速崩潰。',
    tier: 1,
    bag: [
      { cardId: 'card_D', col: 0, row: 0 },
      { cardId: 'card_A', col: 1, row: 0 },
      { cardId: 'asst_engineer', col: 3, row: 0 },
    ],
  },

  {
    id: 'consulting_firm',
    name: 'Consulting Firm',
    desc: '方法論一流，落地為零。',
    tier: 1,
    bag: [
      { cardId: 'card_J', col: 0, row: 0 },
      { cardId: 'card_E', col: 1, row: 0 },
      { cardId: 'card_A', col: 2, row: 0 },
      { cardId: 'it_support', col: 4, row: 0 },
    ],
  },

  {
    id: 'legacy_dept',
    name: 'Legacy Department',
    desc: 'COBOL運行三十年，無人敢動。',
    tier: 2,
    bag: [
      { cardId: 'card_G', col: 0, row: 0 },
      { cardId: 'card_B', col: 2, row: 0 },
      { cardId: 'card_I', col: 4, row: 0 },
      { cardId: 'card_J', col: 5, row: 0 },
    ],
  },

  {
    id: 'toxic_scrum',
    name: 'Toxic Scrum Team',
    desc: '站會開了三小時，沒有任何結論。',
    tier: 2,
    bag: [
      { cardId: 'card_C', col: 0, row: 0 },
      { cardId: 'card_D', col: 2, row: 0 },
      { cardId: 'card_E', col: 3, row: 0 },
      { cardId: 'whistleblower', col: 4, row: 0 },
      { cardId: 'card_D', col: 5, row: 0 },
    ],
  },

  {
    id: 'fire_department',
    name: 'Fire Department (IT)',
    desc: '只會救火，不會防火。',
    tier: 2,
    bag: [
      { cardId: 'card_F', col: 0, row: 0 },
      { cardId: 'smoke_break', col: 1, row: 0 },
      { cardId: 'card_H', col: 2, row: 0 },
      { cardId: 'card_F', col: 3, row: 0 },
      { cardId: 'overtime_dev', col: 4, row: 0 },
    ],
  },

  {
    id: 'board_of_directors',
    name: 'Board of Directors',
    desc: '他們不懂業務，但能決定你的命運。',
    tier: 3,
    bag: [
      { cardId: 'micromanager', col: 0, row: 0 },
      { cardId: 'cfo', col: 3, row: 0 },
      { cardId: 'cold_hr', col: 0, row: 1 },
      { cardId: 'card_K', col: 2, row: 1 },
    ],
  },

  {
    id: 'final_boss',
    name: 'The System Itself',
    desc: '你以為打倒了老闆，但制度永遠在。',
    tier: 3,
    isBoss: true,
    bag: [
      { cardId: 'micromanager', col: 0, row: 0 },
      { cardId: 'card_C', col: 3, row: 0 },
      { cardId: 'card_K', col: 0, row: 1 },
      { cardId: 'cfo', col: 2, row: 1 },
      { cardId: 'cold_hr', col: 5, row: 1 },
    ],
  },

];

// Get enemies by tier
window.getEnemiesByTier = tier => window.ENEMIES.filter(e => e.tier === tier && !e.isBoss);
window.getBoss = () => window.ENEMIES.find(e => e.isBoss);
