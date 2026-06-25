// ═══════════════════════════════════════
// js/data/enemies.js  —  all enemies have direct damage cards
// ═══════════════════════════════════════
'use strict';

window.ENEMIES = [

  // ── TIER 1 ───────────────────────────────────────────────────
  {
    id: 'angry_intern_team',
    name: 'Angry Intern Squad',
    desc: '三個實習生，一肚子火氣。',
    tier: 1,
    bag: [
      { cardId: 'intern_punch',    col: 1, row: 0 },
      { cardId: 'staple_gun',      col: 2, row: 0 },
      { cardId: 'intern_punch',    col: 4, row: 0 },
    ],
  },
  {
    id: 'overtime_squad',
    name: 'Overtime Squad',
    desc: '連續加班，輸出穩定。',
    tier: 1,
    bag: [
      { cardId: 'coffee_addict',   col: 0, row: 0 },
      { cardId: 'asst_engineer',   col: 1, row: 0 },
      { cardId: 'angry_email',     col: 2, row: 0 },
      { cardId: 'coffee_addict',   col: 4, row: 0 },
    ],
  },
  {
    id: 'startup_chaos',
    name: 'Startup Chaos',
    desc: '快速迭代，快速打人。',
    tier: 1,
    bag: [
      { cardId: 'deadline_dash',   col: 0, row: 0 },
      { cardId: 'intern_punch',    col: 1, row: 0 },
      { cardId: 'staple_gun',      col: 3, row: 0 },
      { cardId: 'angry_email',     col: 4, row: 0 },
    ],
  },

  // ── TIER 2 ───────────────────────────────────────────────────
  {
    id: 'consulting_killers',
    name: 'Consulting Killers',
    desc: '方法論一流，輸出更一流。',
    tier: 2,
    bag: [
      { cardId: 'performance_review', col: 0, row: 0 },
      { cardId: 'scrum_master',       col: 2, row: 0 },
      { cardId: 'cold_call',          col: 4, row: 0 },
      { cardId: 'coffee_addict',      col: 5, row: 0 },
      { cardId: 'angry_email',        col: 2, row: 1 },
      { cardId: 'deadline_dash',      col: 4, row: 1 },
    ],
  },
  {
    id: 'toxic_pm_team',
    name: 'Toxic PM Team',
    desc: '毒性滿滿，直傷更不缺。',
    tier: 2,
    bag: [
      { cardId: 'card_C',            col: 0, row: 0 },
      { cardId: 'asst_engineer',     col: 2, row: 0 },
      { cardId: 'mandatory_meeting', col: 3, row: 0 },
      { cardId: 'card_D',            col: 5, row: 0 },
      { cardId: 'cold_call',         col: 1, row: 1 },
      { cardId: 'staple_gun',        col: 3, row: 1 },
    ],
  },
  {
    id: 'fire_department',
    name: 'Fire Department',
    desc: '不救火，只點火。',
    tier: 2,
    bag: [
      { cardId: 'card_H',        col: 0, row: 0 },
      { cardId: 'smoke_break',   col: 1, row: 0 },
      { cardId: 'card_F',        col: 2, row: 0 },
      { cardId: 'overtime_dev',  col: 3, row: 0 },
      { cardId: 'angry_email',   col: 5, row: 0 },
      { cardId: 'deadline_dash', col: 1, row: 1 },
      { cardId: 'intern_punch',  col: 3, row: 1 },
    ],
  },

  // ── TIER 3 / ELITE ────────────────────────────────────────────
  {
    id: 'kpi_enforcers',
    name: 'KPI Enforcement Division',
    desc: 'KPI沒達標？直接攻擊。',
    tier: 3,
    bag: [
      { cardId: 'kpi_enforcer',       col: 0, row: 0 },
      { cardId: 'performance_review', col: 2, row: 0 },
      { cardId: 'layoff_notice',      col: 4, row: 0 },
      { cardId: 'cold_call',          col: 5, row: 0 },
      { cardId: 'scrum_master',       col: 0, row: 1 },
      { cardId: 'angry_email',        col: 2, row: 1 },
      { cardId: 'crunch_time',        col: 4, row: 1 },
    ],
  },
  {
    id: 'board_of_directors',
    name: 'Board of Directors',
    desc: '他們不懂業務，但能決定你生死。',
    tier: 3,
    bag: [
      { cardId: 'micromanager',       col: 0, row: 0 },
      { cardId: 'audit',              col: 3, row: 0 },
      { cardId: 'mandatory_meeting',  col: 5, row: 0 },
      { cardId: 'cold_hr',            col: 0, row: 1 },
      { cardId: 'card_K',             col: 2, row: 1 },
      { cardId: 'power_point',        col: 4, row: 1 },
    ],
  },

  // ── BOSS ─────────────────────────────────────────────────────
  {
    id: 'the_system',
    name: 'The System Itself',
    desc: '制度永遠在，但今天你來挑戰它。',
    tier: 3,
    isBoss: true,
    bag: [
      { cardId: 'ceo_rage',           col: 0, row: 0 },
      { cardId: 'hostile_takeover',   col: 3, row: 0 },
      { cardId: 'layoff_notice',      col: 4, row: 1 },
      { cardId: 'kpi_enforcer',       col: 0, row: 1 },
      { cardId: 'power_point',        col: 2, row: 1 },
      { cardId: 'cold_hr',            col: 5, row: 0 },
    ],
  },
];

window.getEnemiesByTier = tier => window.ENEMIES.filter(e => e.tier === tier && !e.isBoss);
window.getBoss = () => window.ENEMIES.find(e => e.isBoss);
