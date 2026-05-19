<template>
  <div class="result-container">
    <div class="result-scene">
      <div class="stars"></div>
    </div>
    <div class="result-card">
      <div class="card-ornament top"></div>
      <div class="winner-section" :class="winnerClass">
        <span class="winner-icon">{{ state.gameOver?.winner === 'wolf' ? '🐺' : '☀️' }}</span>
        <h1>{{ state.gameOver?.winner === 'wolf' ? '狼人胜利' : '好人胜利' }}</h1>
        <p class="winner-sub">{{ state.gameOver?.winner === 'wolf' ? '黑暗吞噬了村庄...' : '光明驱散了暗夜！' }}</p>
        <div v-if="state.gameOver?.mvp" class="mvp-badge">
          <span class="mvp-crown">👑</span> MVP · {{ state.gameOver.mvp.name }}
        </div>
      </div>
      <div class="divider-line"></div>
      <div v-if="timeline.length > 0" class="timeline">
        <div class="timeline-title">本局回顾</div>
        <div v-for="(item, i) in timeline" :key="i" class="timeline-item">
          <span class="tl-dot" :class="item.type"></span>
          <span class="tl-text">{{ item.text }}</span>
        </div>
      </div>
      <div v-if="timeline.length > 0" class="divider-line" style="margin-top: 16px"></div>
      <div class="players-reveal">
        <div v-for="p in sortedPlayers" :key="p.id" class="reveal-card" :class="{ 'is-dead': !p.alive }">
          <span class="avatar" v-html="renderAvatar(p)"></span>
          <span class="name">{{ p.name }}</span>
          <span :class="'role-tag role-' + p.role">{{ roleLabels[p.role] || p.role }}</span>
          <span class="status" :class="p.alive ? 'alive' : 'dead'">{{ p.alive ? '存活' : '阵亡' }}</span>
        </div>
      </div>
      <button class="btn-secondary back-btn" @click="backToLobby">返回大厅</button>
      <div class="card-ornament bottom"></div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue';
import { state, resetState } from '../game.js';

const view = inject('view');

const sortedPlayers = computed(() => {
  if (!state.gameOver?.players) return [];
  return Object.values(state.gameOver.players).sort((a, b) => a.seatNum - b.seatNum);
});

const winnerClass = computed(() => state.gameOver?.winner === 'wolf' ? 'wolf-win' : 'good-win');
const roleLabels = { werewolf: '狼人', seer: '预言家', witch: '女巫', hunter: '猎人', guard: '守卫', villager: '村民' };

function backToLobby() { resetState(); view.value = 'lobby'; }

function renderAvatar(p) {
  if (!p.avatar) return p.seatNum;
  if (p.avatar.startsWith('http')) return `<img src="${p.avatar}" style="width:26px;height:26px;border-radius:2px" />`;
  return p.avatar;
}

const timeline = computed(() => {
  return state.log
    .filter(e => e.event !== 'phase_change' && e.event !== 'day_start' && e.event !== 'night_start')
    .map(e => {
      const phase = e.phase === 'night' ? '夜' : '日';
      switch (e.event) {
        case 'deaths':
          return { text: `第${e.dayNum}${phase} · ${e.data.deadIds.length > 0 ? e.data.deadIds.length + '人殒命' : '平安之夜'}`, type: 'death' };
        case 'vote':
          return { text: `第${e.dayNum}${phase} · ${e.data.eliminated ? '有人被放逐' : '无人出局'}`, type: 'vote' };
        case 'hunter_shoot':
          return { text: `第${e.dayNum}${phase} · 猎人开枪`, type: 'hunter' };
        default:
          return null;
      }
    })
    .filter(Boolean);
});
</script>

<style scoped>
.result-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; position: relative; }
.result-scene { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.stars {
  position: absolute; inset: 0;
  background-image:
    radial-gradient(1px 1px at 15% 25%, rgba(200, 190, 170, 0.3), transparent),
    radial-gradient(1px 1px at 35% 50%, rgba(200, 190, 170, 0.2), transparent),
    radial-gradient(1px 1px at 55% 18%, rgba(200, 190, 170, 0.35), transparent),
    radial-gradient(1px 1px at 75% 65%, rgba(200, 190, 170, 0.2), transparent),
    radial-gradient(1px 1px at 90% 30%, rgba(200, 190, 170, 0.25), transparent);
}

.result-card {
  position: relative; z-index: 1;
  background: rgba(18, 14, 35, 0.92);
  backdrop-filter: blur(16px);
  border-radius: 2px; padding: 40px 36px; width: 100%; max-width: 500px;
  border: 1px solid rgba(212, 168, 75, 0.1);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.6s ease;
}
.card-ornament { position: absolute; left: 20px; right: 20px; height: 2px; background: linear-gradient(90deg, transparent, rgba(212, 168, 75, 0.2), transparent); }
.card-ornament.top { top: 12px; }
.card-ornament.bottom { bottom: 12px; }

.winner-section { text-align: center; margin-bottom: 20px; }
.winner-icon { font-size: 52px; display: block; margin-bottom: 8px; }
.winner-section h1 { font-size: 26px; font-weight: 700; letter-spacing: 6px; }
.wolf-win h1 { color: #c04040; }
.good-win h1 { color: #d4a84b; }
.winner-sub { color: #5a5070; margin-top: 4px; font-size: 13px; letter-spacing: 2px; }
.mvp-badge {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 10px; padding: 4px 14px; border-radius: 2px;
  background: rgba(212, 168, 75, 0.08); border: 1px solid rgba(212, 168, 75, 0.2);
  color: #d4a84b; font-size: 13px; letter-spacing: 1px;
}
.mvp-crown { font-size: 16px; }

.divider-line { height: 1px; margin: 0 30px 20px; background: linear-gradient(90deg, transparent, rgba(212, 168, 75, 0.12), transparent); }

.players-reveal { display: flex; flex-direction: column; gap: 4px; margin-bottom: 24px; }
.reveal-card {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-radius: 1px;
  background: rgba(25, 20, 45, 0.3);
  border: 1px solid rgba(80, 70, 120, 0.06);
}
.reveal-card.is-dead { opacity: 0.3; }
.reveal-card.is-dead .name { text-decoration: line-through; }
.seat {
  width: 24px; height: 24px; border-radius: 2px;
  background: rgba(25, 20, 45, 0.5); border: 1px solid rgba(80, 70, 120, 0.12);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #6a6080;
}
.avatar {
  width: 28px; height: 28px; border-radius: 2px;
  background: rgba(25, 20, 45, 0.5); border: 1px solid rgba(80, 70, 120, 0.12);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; flex-shrink: 0; overflow: hidden;
}
.name { flex: 1; font-size: 13px; }
.role-tag { font-size: 11px; padding: 2px 8px; border-radius: 1px; font-weight: 600; letter-spacing: 0.5px; }
.role-werewolf { background: rgba(140, 30, 30, 0.1); color: #c04040; border: 1px solid rgba(140, 30, 30, 0.2); }
.role-seer { background: rgba(50, 80, 140, 0.1); color: #5090c0; border: 1px solid rgba(50, 80, 140, 0.2); }
.role-witch { background: rgba(100, 50, 130, 0.1); color: #9060b0; border: 1px solid rgba(100, 50, 130, 0.2); }
.role-hunter { background: rgba(140, 80, 30, 0.1); color: #c08040; border: 1px solid rgba(140, 80, 30, 0.2); }
.role-guard { background: rgba(30, 100, 50, 0.1); color: #40a060; border: 1px solid rgba(30, 100, 50, 0.2); }
.role-villager { background: rgba(60, 55, 75, 0.15); color: #908898; border: 1px solid rgba(60, 55, 75, 0.15); }
.status { font-size: 10px; padding: 1px 6px; border-radius: 1px; letter-spacing: 0.5px; }
.status.alive { color: #50a060; background: rgba(40, 100, 60, 0.06); }
.status.dead { color: #5a5070; background: rgba(60, 55, 75, 0.1); }
.back-btn { display: block; margin: 0 auto; padding: 10px 32px; font-size: 14px; }

/* Timeline */
.timeline { margin-bottom: 8px; }
.timeline-title { font-size: 11px; color: #5a5070; letter-spacing: 3px; margin-bottom: 8px; font-weight: 600; }
.timeline-item { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 12px; color: #8a8098; }
.tl-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.tl-dot.death { background: #c04040; }
.tl-dot.vote { background: #d4a84b; }
.tl-dot.hunter { background: #c08040; }
</style>
