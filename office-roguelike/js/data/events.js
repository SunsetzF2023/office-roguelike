// ═══════════════════════════════════════
// js/data/events.js  —  map random events
// ═══════════════════════════════════════
'use strict';

// Event types: gold | shop | battle | elite | boss | rest | random
// random events have choices array

window.EVENTS = [

  // ── GOLD EVENTS ──
  {
    id: 'paycheck',
    type: 'gold',
    name: '發薪日',
    icon: '💰',
    desc: '這個月終於準時發薪了。',
    effect: { gold: 5 },
  },
  {
    id: 'bonus',
    type: 'gold',
    name: '績效獎金',
    icon: '📊',
    desc: 'KPI達標，老闆破例發了獎金。',
    effect: { gold: 8 },
  },
  {
    id: 'reimbursement',
    type: 'gold',
    name: '報銷通過',
    icon: '🧾',
    desc: '拖了三個月的差旅費終於核銷了。',
    effect: { gold: 3 },
  },

  // ── REST EVENTS ──
  {
    id: 'coffee_break',
    type: 'rest',
    name: '茶水間小憩',
    icon: '☕',
    desc: '在茶水間喝了杯咖啡，恢復精神。',
    effect: { healPct: 0.15 },
  },
  {
    id: 'sick_day',
    type: 'rest',
    name: '請病假',
    icon: '🏥',
    desc: '難得批了一天病假，好好休息。',
    effect: { healPct: 0.25 },
  },

  // ── RANDOM EVENTS ──
  {
    id: 'mandatory_overtime',
    type: 'random',
    name: '強制加班通知',
    icon: '📧',
    desc: '老闆說週末要加班，但給了一點補償……',
    choices: [
      { text: '接受加班（獲得 6 金幣，損失 5% 最大HP）',
        effect: { gold: 6, maxHpPct: -0.05 } },
      { text: '委婉拒絕（無效果）',
        effect: {} },
    ],
  },
  {
    id: 'dumpster_fire',
    type: 'random',
    name: '線上事故',
    icon: '🔥',
    desc: '生產環境掛了，你是唯一能修的人。',
    choices: [
      { text: '加急修復（損失 100 HP，獲得 8 金幣）',
        effect: { hpFlat: -100, gold: 8 } },
      { text: '甩鍋給同事（損失 50 HP）',
        effect: { hpFlat: -50 } },
    ],
  },
  {
    id: 'team_building',
    type: 'random',
    name: '團建活動',
    icon: '🎳',
    desc: '強制性的歡樂時光。',
    choices: [
      { text: '積極參與（恢復 10% HP）',
        effect: { healPct: 0.10 } },
      { text: '摸魚躲過（獲得 2 金幣）',
        effect: { gold: 2 } },
    ],
  },
  {
    id: 'office_politics',
    type: 'random',
    name: '辦公室政治',
    icon: '🗳️',
    desc: '部門間的派系鬥爭波及到你。',
    choices: [
      { text: '站隊A派（隨機獲得 1 張免費卡牌）',
        effect: { freeCard: true } },
      { text: '明哲保身（無效果）',
        effect: {} },
    ],
  },
  {
    id: 'headhunter',
    type: 'random',
    name: '獵頭來電',
    icon: '📱',
    desc: '有人給你更好的機會……',
    choices: [
      { text: '接受邀約（獲得 12 金幣，損失 200 HP）',
        effect: { gold: 12, hpFlat: -200 } },
      { text: '婉拒（恢復 5% HP）',
        effect: { healPct: 0.05 } },
    ],
  },
  {
    id: 'company_stock',
    type: 'random',
    name: '公司期權',
    icon: '📈',
    desc: '期權到期，漲還是跌？',
    choices: [
      { text: '立即兌現（獲得 10 金幣）',
        effect: { gold: 10 } },
      { text: '繼續持有（50%機率獲得15金幣，50%機率損失5金幣）',
        effect: { gamble: { win: { gold: 15 }, lose: { gold: -5 } } } },
    ],
  },

];

// Map node types and their weights per distance
// distance 0-2: mostly gold/rest  3-5: battle  6-8: elite  9: boss
window.MAP_NODE_TYPES = ['gold','rest','random','shop','battle','elite','boss'];

window.getNodeTypeForDistance = (d, total) => {
  const t = d / total;
  if (t < 0.15) return 'gold';
  if (t < 0.25) return Math.random() < 0.5 ? 'rest' : 'shop';
  if (t > 0.92) return 'boss';
  if (t > 0.70) return Math.random() < 0.4 ? 'elite' : 'battle';
  const roll = Math.random();
  if (roll < 0.40) return 'battle';
  if (roll < 0.55) return 'shop';
  if (roll < 0.65) return 'gold';
  if (roll < 0.75) return 'rest';
  return 'random';
};
