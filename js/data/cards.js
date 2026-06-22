// ═══════════════════════════════════════
// js/data/cards.js  —  card definitions
// ═══════════════════════════════════════
'use strict';

// size: 1=small, 2=medium, 3=large
// type: primary tag for colour stripe
// active.cd: seconds
// active.hits: times the skill fires per activation (base 1, modified by attackCount)
// passive: array of passive effect descriptors (processed by battle engine)

window.CARDS = [

  // ── YOUR DESIGNED CARDS ──────────────────────────────────────

  {
    id: 'it_support',
    name: 'IT Support Officer',
    size: 2,
    cost: 3,
    type: 'speed',
    lore: '普普通通的辦公室職員，職場中的炮灰。',
    active: {
      cd: 5,
      desc: '對相鄰角色施加【加速】狀態 2 秒。',
      effect: 'speed_adjacent',
      value: 2,
    },
    passive: [
      { trigger: 'ally_activate', effect: 'self_charge', value: 1,
        desc: '我方角色每釋放一次技能，此伙伴立即獲得 1 秒充能。' }
    ],
    keywords: ['加速','充能'],
  },

  {
    id: 'asst_engineer',
    name: 'Assistant System Engineer',
    size: 1,
    cost: 2,
    type: 'damage',
    lore: '普普通通的辦公室職員，職場中的炮灰。',
    active: {
      cd: 6,
      desc: '對敵人造成 20 點傷害。',
      effect: 'damage',
      value: 20,
    },
    passive: [
      { trigger: 'ally_speed', effect: 'self_damage_up', value: 10,
        desc: '其他角色獲得加速狀態時，此角色傷害 +10（本次戰鬥累計）。' }
    ],
    keywords: ['加速'],
  },

  {
    id: 'card_A',
    name: 'Office Assistant',
    size: 2,
    cost: 2,
    type: 'speed',
    lore: '誰都需要她，沒人記得她的名字。',
    active: {
      cd: 5,
      desc: '給我方 2 個隨機角色施加【加速】狀態 2 秒。',
      effect: 'speed_random_allies',
      value: 2, count: 2,
    },
    passive: [],
    keywords: ['加速'],
  },

  {
    id: 'card_B',
    name: 'Veteran Contractor',
    size: 2,
    cost: 2,
    type: 'damage',
    lore: '合同已續簽第十七次，但永遠不會轉正。',
    active: {
      cd: 7,
      desc: '對敵人造成 10 點傷害。每次戰鬥結束後，傷害永久 +30。',
      effect: 'damage_scaling',
      value: 10, perBattle: 30,
    },
    passive: [],
    keywords: [],
  },

  {
    id: 'card_C',
    name: 'Toxic Project Manager',
    size: 2,
    cost: 5,
    type: 'poison',
    lore: '微笑著遞來一份改了三十六版的需求文檔。',
    active: {
      cd: 9,
      desc: '對敵人釋放 5 層【剧毒】。',
      effect: 'poison',
      value: 5,
    },
    passive: [
      { trigger: 'static', effect: 'attack_count_per_ally_type', typeTag: 'poison',
        desc: '我方每存在一個剧毒角色（含剧毒技能），此角色攻擊次數 +1。' }
    ],
    keywords: ['剧毒'],
  },

  {
    id: 'card_D',
    name: 'Gossip Intern',
    size: 1,
    cost: 1,
    type: 'poison',
    lore: '雖然只是實習生，但能量不可小覷。',
    active: {
      cd: 3,
      desc: '對敵人釋放 2 層【剧毒】。',
      effect: 'poison',
      value: 2,
    },
    passive: [],
    keywords: ['剧毒'],
  },

  {
    id: 'card_E',
    name: 'Passive-Aggressive Colleague',
    size: 1,
    cost: 1,
    type: 'poison',
    lore: '笑裡藏刀，CC郵件永遠抄送老闆。',
    active: {
      cd: 7,
      desc: '對敵人釋放 3 層【剧毒】。',
      effect: 'poison',
      value: 3,
    },
    passive: [
      { trigger: 'adjacent_activate', effect: 'self_speed', value: 1,
        desc: '相鄰角色激活時，該角色獲得【加速】狀態 1 秒。' }
    ],
    keywords: ['剧毒','加速'],
  },

  {
    id: 'card_F',
    name: 'Burnout Developer',
    size: 1,
    cost: 1,
    type: 'fire',
    lore: '每天工作16小時，眼神裡沒有光。',
    active: {
      cd: 8,
      desc: '對敵人釋放 1 層【燃燒】。',
      effect: 'burn',
      value: 1,
    },
    passive: [
      { trigger: 'static', effect: 'attack_count_per_adjacent_type', typeTag: 'fire',
        desc: '每相鄰一個燃燒角色（含燃燒技能），此角色攻擊次數 +1。' }
    ],
    keywords: ['燃燒'],
  },

  {
    id: 'card_G',
    name: 'Senior Mentor',
    size: 2,
    cost: 4,
    type: 'buff',
    lore: '什麼都懂，什麼都不做，但就是讓你變強。',
    active: null,
    passive: [
      { trigger: 'static', effect: 'adjacent_attack_count_up', value: 1,
        desc: '相鄰角色的攻擊次數 +1。' },
      { trigger: 'static', effect: 'adjacent_cd_reduction', value: 0.10,
        desc: '相鄰角色的主動冷卻時間上限 -10%。' }
    ],
    keywords: [],
  },

  {
    id: 'card_H',
    name: 'Arson Accountant',
    size: 1,
    cost: 6,
    type: 'fire',
    lore: '審計報告永遠準時，但他不保證辦公室還在。',
    active: {
      cd: 4,
      desc: '對敵人造成 10 點傷害，並釋放等於傷害 20% 的燃燒層數（2 層）。',
      effect: 'damage_plus_burn_pct',
      value: 10, burnPct: 0.20,
    },
    passive: [],
    keywords: ['燃燒'],
  },

  {
    id: 'card_I',
    name: 'Compliance Officer',
    size: 1,
    cost: 2,
    type: 'shield',
    lore: '規則就是護盾，規則就是武器。',
    active: {
      cd: 6,
      desc: '每有 1 個上陣的角色，獲得 10 點護盾。',
      effect: 'shield_per_ally',
      value: 10,
    },
    passive: [],
    keywords: ['護盾'],
  },

  {
    id: 'card_J',
    name: 'Union Representative',
    size: 1,
    cost: 1,
    type: 'shield',
    lore: '你的權益，他來保護。',
    active: {
      cd: 5,
      desc: '獲得 10 點護盾。',
      effect: 'shield_self',
      value: 10,
    },
    passive: [
      { trigger: 'ally_activate', effect: 'self_charge', value: 1,
        desc: '其他角色主動激活時，此角色立即獲得 1 秒充能。' }
    ],
    keywords: ['護盾','充能'],
  },

  {
    id: 'card_K',
    name: 'Corporate Lawyer',
    size: 2,
    cost: 4,
    type: 'speed',
    lore: '加速我方，減速敵人，賬單另計。',
    active: {
      cd: 6,
      desc: '給我方 1 個角色施加【加速】2 秒；給敵方 1 個角色施加【減速】2 秒。',
      effect: 'speed_one_slow_one',
      speedVal: 2, slowVal: 2,
    },
    passive: [
      { trigger: 'static', effect: 'attack_count_per_enemy_pairs',
        desc: '敵方每上陣 2 個角色，此角色攻擊次數 +1。' }
    ],
    keywords: ['加速','減速'],
  },

  // ── AI-SUPPLEMENTED CARDS ─────────────────────────────────────

  {
    id: 'cold_hr',
    name: 'Cold HR Specialist',
    size: 2,
    cost: 3,
    type: 'ice',
    lore: '拒絕你的人資，笑容比冰還冷。',
    active: {
      cd: 8,
      desc: '對敵方 1 個角色施加【冰凍】狀態 2 秒。',
      effect: 'freeze',
      value: 2,
    },
    passive: [],
    keywords: ['冰凍'],
  },

  {
    id: 'wellness_coach',
    name: 'Wellness Coach',
    size: 1,
    cost: 2,
    type: 'heal',
    lore: '提供免費瑜伽課，無法抵消加班傷害。',
    active: {
      cd: 7,
      desc: '為我方血量最低的角色恢復 30 點生命值（實為玩家HP）。',
      effect: 'heal_player',
      value: 30,
    },
    passive: [],
    keywords: ['治療'],
  },

  {
    id: 'smoke_break',
    name: 'Chain Smoker QA',
    size: 1,
    cost: 1,
    type: 'fire',
    lore: '每個bug都是他發現的，每支煙都是他點的。',
    active: {
      cd: 5,
      desc: '對敵人釋放 2 層【燃燒】。',
      effect: 'burn',
      value: 2,
    },
    passive: [
      { trigger: 'self_activate', effect: 'self_speed', value: 1,
        desc: '自身激活時，獲得 1 秒充能。' }
    ],
    keywords: ['燃燒','充能'],
  },

  {
    id: 'micromanager',
    name: 'Micromanager Boss',
    size: 3,
    cost: 8,
    type: 'buff',
    lore: '事必躬親，萬事皆管，效率負增長。',
    active: {
      cd: 10,
      desc: '給我方所有角色施加【加速】2 秒，攻擊次數本回合 +1。',
      effect: 'speed_all_allies_plus_hits',
      value: 2,
    },
    passive: [
      { trigger: 'static', effect: 'adjacent_cd_reduction', value: 0.15,
        desc: '相鄰角色主動冷卻時間 -15%。' }
    ],
    keywords: ['加速'],
  },

  {
    id: 'overtime_dev',
    name: 'Overtime Developer',
    size: 2,
    cost: 3,
    type: 'damage',
    lore: '已連續加班三十天，傷害係數不降反升。',
    active: {
      cd: 6,
      desc: '對敵人造成 15 點傷害。若玩家當前HP低於50%，傷害翻倍。',
      effect: 'damage_hp_scaling',
      value: 15,
    },
    passive: [],
    keywords: [],
  },

  {
    id: 'whistleblower',
    name: 'Whistleblower',
    size: 1,
    cost: 3,
    type: 'poison',
    lore: '舉報信已發出，HR正在路上。',
    active: {
      cd: 5,
      desc: '對敵方全體釋放 1 層【剧毒】。',
      effect: 'poison_all',
      value: 1,
    },
    passive: [],
    keywords: ['剧毒'],
  },

  {
    id: 'cfo',
    name: 'CFO (Cost Cutter)',
    size: 3,
    cost: 7,
    type: 'shield',
    lore: '預算削減50%，護盾依然堅不可摧。',
    active: {
      cd: 8,
      desc: '給我方所有角色施加 20 層護盾。',
      effect: 'shield_all',
      value: 20,
    },
    passive: [
      { trigger: 'static', effect: 'adjacent_attack_count_up', value: 1,
        desc: '相鄰角色攻擊次數 +1。' }
    ],
    keywords: ['護盾'],
  },

];

// Helper: get card definition by id
window.getCard = id => window.CARDS.find(c => c.id === id) || null;

// Starting deck pool (cheap cards for initial shop)
window.STARTER_POOL = ['it_support','asst_engineer','card_A','card_D','card_E',
  'card_F','card_I','card_J','smoke_break','wellness_coach'];
