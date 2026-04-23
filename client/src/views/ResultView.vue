<template>
  <div class="result-container">
    <div class="result-card">
      <h1 class="winner-title" :class="winnerClass">
        {{ state.gameOver?.winner === 'wolf' ? '🐺 狼人胜利' : '👨‍🌾 好人胜利' }}
      </h1>
      <div class="players-reveal">
        <div v-for="p in sortedPlayers" :key="p.id" class="reveal-item" :class="{ 'is-dead': !p.alive }">
          <span class="seat">{{ p.seatNum }}</span>
          <span class="name">{{ p.name }}</span>
          <span :class="'role-tag role-' + p.role">{{ roleLabels[p.role] || p.role }}</span>
          <span v-if="!p.alive" class="dead-tag">死亡</span>
          <span v-else class="alive-tag">存活</span>
        </div>
      </div>
      <button class="btn-secondary" @click="backToLobby">返回大厅</button>
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

const winnerClass = computed(() => state.gameOver?.winner === 'wolf' ? 'wolf-win' : 'villager-win');

const roleLabels = { werewolf: '狼人', seer: '预言家', witch: '女巫', hunter: '猎人', guard: '守卫', villager: '村民' };

function backToLobby() {
  resetState();
  view.value = 'lobby';
}
</script>

<style scoped>
.result-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
.result-card { background: #16213e; border-radius: 16px; padding: 40px; width: 100%; max-width: 550px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
.winner-title { text-align: center; font-size: 32px; margin-bottom: 24px; }
.wolf-win { color: #e74c3c; }
.villager-win { color: #3498db; }
.players-reveal { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
.reveal-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #1a1a2e; border-radius: 8px; }
.reveal-item.is-dead { opacity: 0.5; }
.seat { width: 24px; height: 24px; border-radius: 50%; background: #0f3460; display: flex; align-items: center; justify-content: center; font-size: 12px; }
.name { flex: 1; }
.role-tag { font-size: 13px; padding: 2px 8px; border-radius: 4px; font-weight: bold; }
.role-werewolf { background: #5c1a1a; color: #e74c3c; }
.role-seer { background: #1a2a5c; color: #3498db; }
.role-witch { background: #3a1a5c; color: #9b59b6; }
.role-hunter { background: #5c3a1a; color: #e67e22; }
.role-guard { background: #1a5c2a; color: #2ecc71; }
.role-villager { background: #333; color: #95a5a6; }
.dead-tag { font-size: 12px; color: #c0392b; }
.alive-tag { font-size: 12px; color: #27ae60; }
button { display: block; margin: 0 auto; padding: 12px 32px; font-size: 16px; }
</style>
