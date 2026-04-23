<template>
  <div class="game-container" :class="{ 'night-mode': state.phase === 'night' }">
    <div class="game-header">
      <div class="phase-info">
        <span class="phase-icon">{{ state.phase === 'night' ? '🌙' : '☀️' }}</span>
        <span>第{{ state.dayNum }}天 · {{ phaseLabel }}</span>
      </div>
      <div class="role-info" v-if="state.role">
        <span :class="'role-' + state.role">{{ roleLabel }}</span>
      </div>
    </div>
    <div class="game-body">
      <div class="sidebar-left">
        <PlayerList />
      </div>
      <div class="main-area">
        <ActionPanel v-if="state.step && state.step !== 'day_start'" />
        <div v-else class="waiting">
          <p v-if="state.phase === 'night' && !state.isMyTurn">夜深了，请闭眼等待...</p>
          <p v-else-if="state.step === 'day_start'">天亮了...</p>
        </div>
      </div>
      <div class="sidebar-right">
        <GameLog />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, watch } from 'vue';
import { state } from '../game.js';
import PlayerList from '../components/PlayerList.vue';
import GameLog from '../components/GameLog.vue';
import ActionPanel from '../components/ActionPanel.vue';

const view = inject('view');

const phaseLabel = computed(() => {
  if (!state.step) return '';
  const labels = {
    wolf: '狼人行动', guard: '守卫行动', seer: '预言家行动',
    witch: '女巫行动', night_resolve: '结算中',
    day_start: '天亮了', speech: '发言阶段', vote: '投票阶段',
    vote_resolve: '投票结算', hunter_trigger: '猎人开枪'
  };
  return labels[state.step] || state.step;
});

const roleLabel = computed(() => {
  const labels = { werewolf: '狼人', seer: '预言家', witch: '女巫', hunter: '猎人', guard: '守卫', villager: '村民' };
  return labels[state.role] || state.role;
});

watch(() => state.gameOver, (val) => {
  if (val) view.value = 'result';
});
</script>

<style scoped>
.game-container { height: 100vh; display: flex; flex-direction: column; transition: background 0.5s; }
.game-container.night-mode { background: #0d0d1a; }
.game-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: #16213e; border-bottom: 1px solid #2a2a4e; }
.phase-info { display: flex; align-items: center; gap: 8px; font-size: 18px; }
.phase-icon { font-size: 22px; }
.role-info { font-size: 16px; font-weight: bold; }
.role-werewolf { color: #e74c3c; }
.role-seer { color: #3498db; }
.role-witch { color: #9b59b6; }
.role-hunter { color: #e67e22; }
.role-guard { color: #2ecc71; }
.role-villager { color: #95a5a6; }
.game-body { flex: 1; display: grid; grid-template-columns: 200px 1fr 220px; gap: 12px; padding: 12px; overflow: hidden; }
.sidebar-left, .sidebar-right { overflow-y: auto; }
.main-area { display: flex; flex-direction: column; align-items: center; justify-content: center; }
.waiting { color: #888; font-size: 18px; text-align: center; }
</style>
