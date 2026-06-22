// ═══════════════════════════════════════
// js/ui/screenTitle.js
// ═══════════════════════════════════════
'use strict';

window.ScreenTitle = (() => {

  function render() {
    const el = document.getElementById('screen-title');
    el.innerHTML = `
      <div id="title-logo">
        職場煉獄<br>
        <span style="font-size:28px;color:var(--text-dim);letter-spacing:0.3em">
          OFFICE ROGUELIKE
        </span>
      </div>
      <div id="title-sub">
        卡牌 · 背包 · 異步對戰 · 職場生存
      </div>
      <div class="title-btn-group">
        <button class="btn primary" id="btn-newgame" style="font-size:16px;padding:10px 40px;letter-spacing:0.1em">
          [ 新 局 開 始 ]
        </button>
        <button class="btn" id="btn-howto" style="font-size:12px">
          如何遊玩
        </button>
      </div>
      <div style="font-size:10px;color:var(--text-dim);letter-spacing:0.1em">
        v0.1 · 職場倖存者聯盟出品
      </div>
    `;

    document.getElementById('btn-newgame').addEventListener('click', () => {
      window.Game.startNewRun();
    });

    document.getElementById('btn-howto').addEventListener('click', () => {
      window.UI.openModal(`
        <div class="panel-title">📖 遊玩說明</div>
        <div style="font-size:12px;line-height:2;color:var(--text)">
          <b class="bright">【背包系統】</b><br>
          你有一個 2×6 的背包格子（隨等級解鎖）。<br>
          小型卡佔 1 格，中型佔橫向 2 格，大型佔橫向 3 格。<br>
          將卡牌拖入格子即可上陣，相鄰卡牌之間可互相觸發效果。<br><br>
          <b class="bright">【戰鬥】</b><br>
          戰鬥全自動進行，卡牌CD到了自動發動技能。<br>
          雙方初始血量各 1500。打完敵人血量歸零即勝。<br><br>
          <b class="bright">【地圖】</b><br>
          點擊未鎖定節點推進地圖。<br>
          ⚔ 普通戰鬥 · ☠ 精英 · 👹 頭目 · 🛒 商店 · ❓ 隨機事件<br><br>
          <b class="bright">【詞條】</b><br>
          燃燒：每0.5秒受到層數傷害，每秒層數-1<br>
          剧毒：每秒受到層數傷害，無視護盾<br>
          護盾：抵擋傷害（燃燒效果減半）<br>
          加速：冷卻恢復速度×2 · 減速：冷卻速度×0.5<br>
          冰凍：無法發動主動技能
        </div>
        <div style="text-align:center;margin-top:16px">
          <button class="btn primary" onclick="window.UI.closeModal()">明白了</button>
        </div>
      `);
    });
  }

  return { render };
})();
