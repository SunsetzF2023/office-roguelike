// ═══════════════════════════════════════
// js/ui/screenCardPack.js  —  开局抽卡动画
// ═══════════════════════════════════════
'use strict';

window.ScreenCardPack = (() => {

  const PACK_SIZE = 5;

  // 只抽小型卡 (size=1)，按cost权重
  function _drawCards() {
    const pool = window.CARDS.filter(c => c.size === 1 && c.cost <= 4);
    const result = [];
    // 保证至少一张直伤卡
    const dmgPool = pool.filter(c => c.active && ['damage','damage_scaling',
      'damage_if_speed','damage_plus_burn_pct','burn','poison',
      'shield_self_plus_damage','heal_plus_damage'].includes(c.active.effect));
    if (dmgPool.length) {
      result.push(dmgPool[Math.floor(Math.random() * dmgPool.length)]);
    }
    // 剩余随机抽
    const remaining = pool.filter(c => !result.find(r => r.id === c.id));
    while (result.length < PACK_SIZE && remaining.length) {
      const idx = Math.floor(Math.random() * remaining.length);
      result.push(remaining.splice(idx, 1)[0]);
    }
    return result.slice(0, PACK_SIZE);
  }

  const TYPE_ICONS = {
    poison:'☠', fire:'🔥', shield:'🛡', heal:'💚',
    speed:'💨', ice:'❄',  buff:'⭐',   damage:'⚡'
  };
  const TYPE_COLORS = {
    poison:'#8bc34a', fire:'#ff7043', shield:'#90caf9',
    heal:'#66bb6a',   speed:'#76d275', ice:'#80deea',
    buff:'#ab47bc',   damage:'#ffb300'
  };

  function render(onDone) {
    const el = document.getElementById('screen-cardpack');
    el.style.display = '';

    const drawnCards = _drawCards();

    el.innerHTML = `
      <style>
        #pack-wrap {
          width:100%; height:100%;
          display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          gap:32px;
          background: radial-gradient(ellipse at center, #0d1f0d 0%, #050a05 100%);
        }

        #pack-title {
          font-family: var(--font-display);
          font-size: 36px;
          color: var(--green-bright);
          letter-spacing: 0.15em;
          text-shadow: 0 0 20px var(--green), 0 0 40px var(--green-dim);
          animation: flicker 0.1s linear 3;
        }

        #pack-subtitle {
          font-size: 12px;
          color: var(--text-dim);
          letter-spacing: 0.2em;
          margin-top: -20px;
        }

        #cards-row {
          display: flex;
          gap: 20px;
          align-items: center;
          justify-content: center;
        }

        .pack-card-wrap {
          perspective: 800px;
          width: 120px;
          height: 180px;
        }

        .pack-card {
          width: 120px;
          height: 180px;
          position: relative;
          transform-style: preserve-3d;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          transform: rotateY(180deg); /* start face-down */
        }

        .pack-card.flipped {
          transform: rotateY(0deg);
        }

        .pack-card-front,
        .pack-card-back {
          position: absolute;
          inset: 0;
          border-radius: 8px;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border);
        }

        .pack-card-back {
          background: linear-gradient(135deg, #0d1a0d, #1a2e1a);
          border-color: var(--green-dim);
          transform: rotateY(180deg);
          font-family: var(--font-display);
          font-size: 48px;
          box-shadow: 0 0 20px rgba(76,175,80,0.15), inset 0 0 40px rgba(0,0,0,0.5);
        }
        .pack-card-back::before {
          content: '';
          position: absolute;
          inset: 6px;
          border: 1px solid var(--green-dim);
          border-radius: 4px;
          opacity: 0.5;
        }

        .pack-card-front {
          background: var(--bg-card);
          flex-direction: column;
          justify-content: flex-start;
          padding: 10px 8px 8px;
          gap: 6px;
          box-shadow: 0 0 16px rgba(76,175,80,0.2);
        }

        .pack-card-front .card-icon {
          font-size: 32px;
          margin-bottom: 2px;
        }
        .pack-card-front .card-name {
          font-size: 11px;
          color: var(--green-bright);
          text-align: center;
          font-family: var(--font-mono);
          line-height: 1.3;
        }
        .pack-card-front .card-lore {
          font-size: 9px;
          color: var(--text-dim);
          text-align: center;
          line-height: 1.4;
          font-style: italic;
        }
        .pack-card-front .card-desc {
          font-size: 9px;
          color: var(--text);
          text-align: center;
          line-height: 1.4;
          margin-top: 2px;
          padding: 4px 4px;
          background: rgba(0,0,0,0.3);
          border-radius: 3px;
          width: 100%;
          box-sizing: border-box;
        }
        .pack-card-front .card-cost {
          position: absolute;
          top: 6px; right: 8px;
          font-size: 10px;
          color: var(--amber);
        }
        .pack-card-front .card-type-bar {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 4px;
          border-radius: 8px 0 0 8px;
        }

        .pack-card.revealed {
          animation: card-glow 0.5s ease-out;
        }
        @keyframes card-glow {
          0%   { box-shadow: 0 0 40px var(--green), 0 0 80px var(--green-dim); }
          100% { box-shadow: none; }
        }

        #pack-hint {
          font-size: 12px;
          color: var(--text-dim);
          letter-spacing: 0.1em;
          animation: blink 1.2s step-end infinite;
        }

        #pack-confirm {
          display: none;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        #pack-confirm.visible { display: flex; }

        #pack-cards-summary {
          font-size: 11px;
          color: var(--text-dim);
          text-align: center;
        }

        .particle {
          position: fixed;
          pointer-events: none;
          border-radius: 50%;
          animation: particle-fly 0.8s ease-out forwards;
        }
        @keyframes particle-fly {
          0%   { opacity:1; transform: translate(0,0) scale(1); }
          100% { opacity:0; transform: translate(var(--tx), var(--ty)) scale(0); }
        }
      </style>

      <div id="pack-wrap">
        <div id="pack-title">✦ 新人禮包 ✦</div>
        <div id="pack-subtitle">STARTER CARD PACK · 5 CARDS</div>

        <div id="cards-row">
          ${drawnCards.map((card, i) => `
            <div class="pack-card-wrap">
              <div class="pack-card" data-idx="${i}" data-cardid="${card.id}">
                <div class="pack-card-back">🂠</div>
                <div class="pack-card-front" style="border-color:${TYPE_COLORS[card.type]||'var(--green-dim)'}">
                  <div class="card-type-bar" style="background:${TYPE_COLORS[card.type]||'var(--green-dim)'}"></div>
                  <div class="card-cost">¥${card.cost}</div>
                  <div class="card-icon">${TYPE_ICONS[card.type]||'⚡'}</div>
                  <div class="card-name">${card.name}</div>
                  <div class="card-lore">${card.lore||''}</div>
                  <div class="card-desc">${card.active ? card.active.desc : '被動卡'}${card.passive&&card.passive.length?'<br><span style="color:var(--text-dim)">被：'+card.passive[0].desc+'</span>':''}</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <div id="pack-hint">點擊卡牌翻開</div>

        <div id="pack-confirm">
          <div id="pack-cards-summary"></div>
          <button class="btn primary" id="btn-pack-confirm" style="font-size:15px;padding:10px 40px;letter-spacing:0.1em">
            [ 收下並開始冒險 ]
          </button>
        </div>
      </div>
    `;

    // State
    let revealed = 0;
    const cards = el.querySelectorAll('.pack-card');
    const totalCards = drawnCards;

    // Click each card to flip
    cards.forEach((card, i) => {
      card.addEventListener('click', () => {
        if (card.classList.contains('flipped')) return;
        card.classList.add('flipped');
        revealed++;

        // Particle burst
        setTimeout(() => _spawnParticles(card, TYPE_COLORS[totalCards[i].type]), 300);

        // Show confirm after all revealed
        if (revealed === PACK_SIZE) {
          setTimeout(() => {
            document.getElementById('pack-hint').style.display = 'none';
            const confirm = document.getElementById('pack-confirm');
            confirm.classList.add('visible');
            document.getElementById('pack-cards-summary').innerHTML =
              `獲得 ${PACK_SIZE} 張卡牌：<br>` +
              totalCards.map(c => `<span style="color:${TYPE_COLORS[c.type]||'var(--green)'}">${c.name}</span>`).join(' · ');
          }, 400);
        } else {
          // Auto-flip hint update
          document.getElementById('pack-hint').textContent =
            `還有 ${PACK_SIZE - revealed} 張 · 繼續點擊翻開`;
        }
      });
    });

    // Auto-flip all after 5s (in case player doesn't click)
    const autoFlip = setTimeout(() => {
      cards.forEach(c => { if (!c.classList.contains('flipped')) c.click(); });
    }, 5000);

    // Confirm button
    setTimeout(() => {
      const btn = document.getElementById('btn-pack-confirm');
      if (btn) {
        btn.addEventListener('click', () => {
          clearTimeout(autoFlip);
          // Add all drawn cards to warehouse
          for (const card of totalCards) {
            const instId = window.State.createInstance(card.id);
            window.State.addToWarehouse(instId);
          }
          // Flash out
          const wrap = document.getElementById('pack-wrap');
          if (wrap) {
            wrap.style.transition = 'opacity 0.4s';
            wrap.style.opacity = '0';
          }
          setTimeout(onDone, 420);
        });
      }
    }, 100);
  }

  function _spawnParticles(cardEl, color) {
    const rect = cardEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const count = 16;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      const angle = (i / count) * Math.PI * 2;
      const dist = 40 + Math.random() * 60;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      const size = 3 + Math.random() * 4;
      p.className = 'particle';
      p.style.cssText = `
        left:${cx}px; top:${cy}px;
        width:${size}px; height:${size}px;
        background:${color||'#4caf50'};
        box-shadow: 0 0 4px ${color||'#4caf50'};
        --tx:${tx}px; --ty:${ty}px;
        animation-duration:${0.5 + Math.random()*0.4}s;
        animation-delay:${Math.random()*0.1}s;
      `;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }
  }

  return { render };
})();
