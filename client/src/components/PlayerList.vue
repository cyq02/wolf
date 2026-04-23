<template>
  <div class="player-list-panel">
    <h3>玩家列表</h3>
    <div class="players">
      <div
        v-for="p in sortedPlayers"
        :key="p.id"
        class="player-item"
        :class="{
          'is-me': p.id === state.playerId,
          'is-dead': !p.alive,
          'is-wolf-teammate': state.teammateIds.includes(p.id),
          'is-disconnected': !p.connected
        }"
      >
        <span class="seat">{{ p.seatNum }}</span>
        <span class="name">{{ p.name }}</span>
        <span v-if="state.teammateIds.includes(p.id)" class="role-tag wolf-tag">狼</span>
        <span v-if="!p.alive" class="dead-tag">死亡</span>
        <span v-if="!p.connected" class="dc-tag">断线</span>
        <span v-if="p.id === state.playerId" class="me-tag">我</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { state } from '../game.js';

const sortedPlayers = computed(() =>
  Object.values(state.players).sort((a, b) => a.seatNum - b.seatNum)
);
</script>

<style scoped>
.player-list-panel { background: #16213e; border-radius: 12px; padding: 16px; height: 100%; overflow-y: auto; }
h3 { margin-bottom: 12px; font-size: 16px; color: #aaa; }
.players { display: flex; flex-direction: column; gap: 6px; }
.player-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; background: #1a1a2e; font-size: 14px; }
.player-item.is-me { border: 1px solid #e94560; }
.player-item.is-dead { opacity: 0.35; text-decoration: line-through; }
.player-item.is-wolf-teammate { background: #2d1f3d; }
.seat { width: 22px; height: 22px; border-radius: 50%; background: #0f3460; display: flex; align-items: center; justify-content: center; font-size: 11px; }
.name { flex: 1; }
.role-tag, .dead-tag, .dc-tag, .me-tag { font-size: 11px; padding: 1px 5px; border-radius: 3px; }
.wolf-tag { background: #c0392b; color: #fff; }
.dead-tag { background: #555; color: #ccc; }
.dc-tag { background: #7f8c8d; color: #fff; }
.me-tag { background: #0f3460; color: #fff; }
</style>
