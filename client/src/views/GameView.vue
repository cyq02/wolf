<template>
  <div class="game-container" :class="{ 'night-mode': state.phase === 'night', 'day-mode': state.phase === 'day' }">
    <div class="game-scene">
      <div class="moon" :class="{ hidden: state.phase === 'day' }"></div>
      <div class="stars" :class="{ hidden: state.phase === 'day' }"></div>
      <div class="fog"></div>
    </div>

    <!-- Phase transition overlay -->
    <Transition name="banner">
      <div v-if="showBanner" class="phase-banner" :class="bannerType">
        <span class="banner-icon">{{ bannerIcon }}</span>
        <span class="banner-text">{{ bannerText }}</span>
      </div>
    </Transition>

    <!-- Death announce overlay -->
    <Transition name="banner">
      <div v-if="showDeath" class="death-banner">
        <div class="death-icon">💀</div>
        <div class="death-text">
          <template v-if="deathNames.length > 0">
            <div v-for="info in deathNames" :key="info.id" class="death-entry">
              <span class="death-name">{{ info.name }}</span>
              <span v-if="info.role" class="death-role" :class="'role-' + info.role">{{ info.roleLabel }}</span>
            </div>
            <span class="death-label">已殒命</span>
          </template>
          <template v-else>
            <span class="peace-label">平安之夜，无人殒命</span>
          </template>
        </div>
      </div>
    </Transition>

    <!-- Spectator banner -->
    <div v-if="state.isSpectator" class="spectator-banner">
      <span>👻 你已阵亡 · 观战模式</span>
    </div>

    <div class="game-header">
      <div class="phase-info">
        <span class="phase-icon">{{ state.phase === 'night' ? '🌙' : '☀️' }}</span>
        <div class="phase-text">
          <span class="phase-day">{{ state.phase === 'night' ? '第' + state.dayNum + '夜' : '第' + state.dayNum + '日' }}</span>
          <span class="phase-label">{{ phaseLabel }}</span>
        </div>
      </div>
      <div class="header-right">
        <div v-if="state.isMyTurn && state.timeLeft > 0" class="timer" :class="{ urgent: state.timeLeft <= 10 }">
          <svg class="timer-ring" viewBox="0 0 36 36">
            <circle class="timer-bg" cx="18" cy="18" r="16" />
            <circle class="timer-fg" cx="18" cy="18" r="16" :stroke-dasharray="timerDash" />
          </svg>
          <span class="timer-num">{{ state.timeLeft }}</span>
        </div>
        <div class="role-badge" :class="'role-' + state.role" v-if="state.role">
          <span class="role-icon">{{ roleIcons[state.role] }}</span>
          {{ roleLabel }}
        </div>
        <button class="audio-toggle" @click="toggleAudio" :title="audioEnabled ? '静音' : '开启音效'">
          {{ audioEnabled ? '🔊' : '🔇' }}
        </button>
      </div>
    </div>
    <div class="game-body">
      <div class="sidebar-left">
        <PlayerList />
      </div>
      <div class="main-area">
        <div v-if="state.isSpectator && state.step && !['speech', 'vote', 'night_resolve', 'hunter_trigger'].includes(state.step) && state.phase === 'night'" class="spectator-view">
          <div class="spectator-icon">👁️</div>
          <p>你正在观战，可以看到所有公开信息</p>
          <p class="spectator-sub">{{ spectatorStepLabel }}</p>
        </div>
        <ActionPanel v-else-if="state.step && state.step !== 'day_start' && !showBanner" :key="state.step" />
        <div v-else-if="state.phase === 'night' && showWaiting" class="waiting">
          <div class="waiting-icon">🌙</div>
          <p>夜深了，请闭眼...</p>
        </div>
      </div>
      <div class="sidebar-right">
        <GameLog />
      </div>
    </div>
    <RoleGuide :role="state.role" />
    <AiAssistant />
  </div>
</template>

<script setup>
import { ref, computed, watch, inject, onBeforeUnmount } from 'vue';
import { state } from '../game.js';
import PlayerList from '../components/PlayerList.vue';
import GameLog from '../components/GameLog.vue';
import ActionPanel from '../components/ActionPanel.vue';
import RoleGuide from '../components/RoleGuide.vue';
import AiAssistant from '../components/AiAssistant.vue';
import { useAudio } from '../composables/useAudio';

const { audioEnabled, toggleAudio, sfx, startNightAmbient, stopNightAmbient, startDayAmbient, stopDayAmbient, stopAll } = useAudio();

const view = inject('view');

const phaseLabel = computed(() => {
  if (!state.step) return '';
  const labels = {
    wolf: '狼人觉醒', guard: '守卫守望', seer: '预言家占卜',
    witch: '女巫抉择', night_resolve: '命运揭晓',
    day_start: '天亮了', speech: '白昼辩论', vote: '审判投票',
    vote_resolve: '审判结算', hunter_trigger: '猎人遗言'
  };
  return labels[state.step] || state.step;
});

const roleLabel = computed(() => {
  const labels = { werewolf: '狼人', seer: '预言家', witch: '女巫', hunter: '猎人', guard: '守卫', villager: '村民' };
  return labels[state.role] || state.role;
});

const roleIcons = { werewolf: '🐺', seer: '🔮', witch: '🧪', hunter: '🔫', guard: '🛡️', villager: '👤' };

const spectatorStepLabel = computed(() => {
  const labels = { wolf: '狼人正在行动...', guard: '守卫正在守望...', seer: '预言家正在查验...', witch: '女巫正在抉择...', night_resolve: '命运揭晓中...' };
  return labels[state.step] || '等待中...';
});

// Countdown timer
const timerDash = computed(() => {
  const max = 60;
  const pct = Math.max(0, state.timeLeft / max);
  const circ = 2 * Math.PI * 16;
  return `${circ * pct} ${circ * (1 - pct)}`;
});

let timerInterval = null;
watch(() => state.isMyTurn, (val) => {
  if (timerInterval) clearInterval(timerInterval);
  if (val && state.timeLeft > 0) {
    timerInterval = setInterval(() => {
      if (state.timeLeft > 0) {
        state.timeLeft--;
        if (state.timeLeft > 0 && state.timeLeft <= 10) sfx.countdownTick();
      }
    }, 1000);
  }
});
onBeforeUnmount(() => { if (timerInterval) clearInterval(timerInterval); stopAll(); });

// Phase transition banner
const showBanner = ref(false);
const showWaiting = ref(false);
const bannerText = ref('');
const bannerIcon = ref('');
const bannerType = ref('');
let bannerTimeout = null;

watch(() => state.step, (step) => {
  if (bannerTimeout) clearTimeout(bannerTimeout);
  showWaiting.value = false;
  const banners = {
    wolf: { text: '夜幕降临', icon: '🌙', type: 'night' },
    day_start: { text: '天亮了', icon: '☀️', type: 'day' },
    speech: { text: '白昼辩论', icon: '📜', type: 'day' },
    vote: { text: '审判时刻', icon: '⚖️', type: 'day' },
  };
  const b = banners[step];
  if (b) {
    showDeath.value = false;
    sfx.phaseWhoosh();
    bannerText.value = b.text;
    bannerIcon.value = b.icon;
    bannerType.value = b.type;
    showBanner.value = true;
    bannerTimeout = setTimeout(() => {
      showBanner.value = false;
      showWaiting.value = true;
    }, 2200);
  } else {
    showBanner.value = false;
    showWaiting.value = true;
  }
});

// Death announcement
const showDeath = ref(false);
const deathNames = ref([]);
let deathTimeout = null;

const roleLabels = { werewolf: '狼人', seer: '预言家', witch: '女巫', hunter: '猎人', guard: '守卫', villager: '村民' };

watch(() => state.deadIds, (ids) => {
  if (!ids || ids.length === 0) return;
  if (deathTimeout) clearTimeout(deathTimeout);
  showBanner.value = false;
  if (bannerTimeout) clearTimeout(bannerTimeout);
  deathNames.value = ids.map(id => {
    const p = state.players[id];
    return {
      id,
      name: p?.name || '???',
      role: p?.revealedRole || null,
      roleLabel: p?.revealedRole ? roleLabels[p.revealedRole] : null,
    };
  });
  sfx.deathAnnounce();
  showDeath.value = true;
  deathTimeout = setTimeout(() => { showDeath.value = false; }, 3500);
});

// Ambient audio + game over
watch(() => state.phase, (phase) => {
  if (phase === 'night') { stopDayAmbient(); startNightAmbient(); }
  else if (phase === 'day') { stopNightAmbient(); startDayAmbient(); }
});

watch(() => state.gameOver, (val) => {
  if (val) { sfx.gameEnd(); stopAll(); view.value = 'result'; }
});
</script>

<style scoped>
.game-container {
  height: 100vh; display: flex; flex-direction: column;
  position: relative; overflow: hidden;
  transition: background 1.2s ease;
  background: #0e0b1e;
}
.game-container.night-mode { background: #060410; }
.game-container.day-mode { background: #14102a; }

/* Scene */
.game-scene { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
.moon {
  position: absolute; top: 2%; left: 40%; width: 50px; height: 50px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #e8e0d0, #c8c0a8);
  box-shadow: 0 0 20px rgba(200, 190, 160, 0.08);
  animation: moonGlow 4s ease-in-out infinite;
  transition: opacity 1.2s ease;
}
.moon.hidden { opacity: 0; }

.stars {
  position: absolute; inset: 0; transition: opacity 1.2s ease;
  background-image:
    radial-gradient(1px 1px at 8% 18%, rgba(200, 190, 170, 0.3), transparent),
    radial-gradient(1px 1px at 22% 42%, rgba(200, 190, 170, 0.2), transparent),
    radial-gradient(1px 1px at 38% 12%, rgba(200, 190, 170, 0.4), transparent),
    radial-gradient(1px 1px at 52% 68%, rgba(200, 190, 170, 0.15), transparent),
    radial-gradient(1px 1px at 68% 32%, rgba(200, 190, 170, 0.3), transparent),
    radial-gradient(1px 1px at 82% 58%, rgba(200, 190, 170, 0.2), transparent),
    radial-gradient(1px 1px at 12% 78%, rgba(200, 190, 170, 0.15), transparent),
    radial-gradient(1px 1px at 92% 22%, rgba(200, 190, 170, 0.25), transparent);
  animation: twinkle 3s ease-in-out infinite alternate;
}
.stars.hidden { opacity: 0; }

.fog { position: absolute; bottom: 0; left: 0; right: 0; height: 25%; background: linear-gradient(to top, rgba(12, 10, 24, 0.4), transparent); }

/* Phase banner overlay */
.phase-banner {
  position: fixed; inset: 0; z-index: 100;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; pointer-events: none;
}
.phase-banner.night { background: rgba(4, 3, 12, 0.7); }
.phase-banner.day { background: rgba(20, 16, 42, 0.5); }
.banner-icon { font-size: 56px; }
.banner-text { font-size: 28px; font-weight: 700; letter-spacing: 8px; color: #d4a84b; }
.phase-banner.night .banner-text { color: #8a8ac0; }

.banner-enter-active { transition: all 0.4s ease; }
.banner-leave-active { transition: all 0.6s ease; }
.banner-enter-from { opacity: 0; transform: scale(0.9); }
.banner-leave-to { opacity: 0; transform: scale(1.05); }

/* Death banner */
.death-banner {
  position: fixed; inset: 0; z-index: 110;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; pointer-events: none;
  background: rgba(40, 8, 8, 0.5);
}
.death-icon { font-size: 48px; }
.death-text { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center; }
.death-name { font-size: 20px; color: #e04040; font-weight: 700; letter-spacing: 2px; }
.death-entry { display: flex; align-items: center; gap: 8px; }
.death-role { font-size: 12px; padding: 2px 8px; border-radius: 2px; font-weight: 600; letter-spacing: 1px; }
.death-role.role-werewolf { background: rgba(140, 30, 30, 0.2); color: #e06060; }
.death-role.role-seer { background: rgba(50, 80, 140, 0.2); color: #60a0d0; }
.death-role.role-witch { background: rgba(100, 50, 130, 0.2); color: #b070d0; }
.death-role.role-hunter { background: rgba(140, 80, 30, 0.2); color: #d09050; }
.death-role.role-guard { background: rgba(30, 100, 50, 0.2); color: #50c070; }
.death-role.role-villager { background: rgba(80, 70, 100, 0.2); color: #a098b0; }
.death-label { font-size: 16px; color: #a06060; letter-spacing: 3px; }
.peace-label { font-size: 18px; color: #6a8a6a; letter-spacing: 4px; }

.death-banner.banner-enter-active { transition: all 0.3s ease; }
.death-banner.banner-leave-active { transition: all 0.8s ease; }
.death-banner.banner-enter-from { opacity: 0; }
.death-banner.banner-leave-to { opacity: 0; }

/* Header */
.game-header {
  position: relative; z-index: 1;
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 24px;
  background: rgba(18, 14, 32, 0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(212, 168, 75, 0.08);
}
.phase-info { display: flex; align-items: center; gap: 12px; }
.phase-icon { font-size: 24px; }
.phase-text { display: flex; flex-direction: column; }
.phase-day { font-size: 14px; font-weight: 700; color: #d4a84b; letter-spacing: 2px; }
.phase-label { font-size: 11px; color: #6a6080; margin-top: 2px; letter-spacing: 1px; }

.header-right { display: flex; align-items: center; gap: 14px; }

/* Timer */
.timer {
  position: relative; width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
}
.timer-ring { position: absolute; inset: 0; width: 36px; height: 36px; transform: rotate(-90deg); }
.timer-bg { fill: none; stroke: rgba(80, 70, 120, 0.15); stroke-width: 2.5; }
.timer-fg { fill: none; stroke: #d4a84b; stroke-width: 2.5; stroke-linecap: round; transition: stroke-dasharray 1s linear; }
.timer.urgent .timer-fg { stroke: #c04040; }
.timer-num { font-size: 13px; font-weight: 700; color: #d4a84b; z-index: 1; }
.timer.urgent .timer-num { color: #c04040; }

.role-badge {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 12px; border-radius: 2px;
  font-size: 13px; font-weight: 600; letter-spacing: 1px;
  background: rgba(20, 16, 38, 0.5);
  border: 1px solid rgba(80, 70, 120, 0.15);
}
.role-icon { font-size: 15px; }
.role-werewolf { color: #c04040; border-color: rgba(192, 64, 64, 0.25); }
.role-seer { color: #5090c0; border-color: rgba(80, 144, 192, 0.25); }
.role-witch { color: #9060b0; border-color: rgba(144, 96, 176, 0.25); }
.role-hunter { color: #c08040; border-color: rgba(192, 128, 64, 0.25); }
.role-guard { color: #40a060; border-color: rgba(64, 160, 96, 0.25); }
.role-villager { color: #908898; border-color: rgba(144, 136, 152, 0.15); }

.audio-toggle {
  background: none; border: 1px solid rgba(80, 70, 120, 0.15);
  border-radius: 2px; padding: 4px 8px; cursor: pointer;
  font-size: 14px; transition: all 0.2s;
}
.audio-toggle:hover { border-color: rgba(212, 168, 75, 0.3); }

.game-body {
  position: relative; z-index: 1;
  flex: 1; display: grid;
  grid-template-columns: 200px 1fr 220px;
  gap: 10px; padding: 10px; overflow: hidden;
}
.sidebar-left, .sidebar-right { overflow-y: auto; }
.main-area {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  overflow-y: auto;
}

.waiting { text-align: center; animation: fadeIn 0.6s; }
.waiting-icon { font-size: 44px; margin-bottom: 16px; animation: float 3s ease-in-out infinite; }
.waiting p { color: #4a4460; font-size: 15px; letter-spacing: 3px; }

/* Spectator */
.spectator-banner {
  position: relative; z-index: 1;
  text-align: center; padding: 5px;
  background: rgba(80, 40, 100, 0.2);
  border-bottom: 1px solid rgba(140, 80, 180, 0.15);
  color: #9080b0; font-size: 12px; letter-spacing: 2px;
}
.spectator-view { text-align: center; animation: fadeIn 0.6s; }
.spectator-icon { font-size: 44px; margin-bottom: 16px; animation: float 3s ease-in-out infinite; filter: brightness(1.2); }
.spectator-view p { color: #a098b8; font-size: 15px; letter-spacing: 3px; }
.spectator-sub { color: #8078a0 !important; font-size: 12px !important; letter-spacing: 1px !important; margin-top: 8px; }

@keyframes twinkle { 0% { opacity: 0.6; } 100% { opacity: 1; } }
</style>
