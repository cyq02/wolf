<template>
  <div class="vote-panel">
    <h3>投票 — 选择要放逐的玩家</h3>
    <div class="vote-grid">
      <button
        v-for="p in alivePlayers"
        :key="p.id"
        class="vote-target"
        :class="{ selected: selected === p.id }"
        @click="selected = p.id"
        :disabled="voted"
      >
        <span class="seat">{{ p.seatNum }}</span>
        {{ p.name }}
      </button>
    </div>
    <div class="vote-actions">
      <button class="btn-primary" @click="submitVote" :disabled="voted || !selected">投票</button>
      <button class="btn-secondary" @click="abstain" :disabled="voted">弃票</button>
    </div>
    <div v-if="state.votes && Object.keys(state.votes).length > 0" class="vote-result">
      <h4>投票结果</h4>
      <div v-for="(target, voter) in state.votes" :key="voter" class="vote-record">
        {{ getPlayerName(voter) }} → {{ target ? getPlayerName(target) : '弃票' }}
      </div>
      <p v-if="state.eliminated" class="eliminated">{{ getPlayerName(state.eliminated) }} 被放逐</p>
      <p v-else-if="Object.keys(state.votes).length > 0" class="no-eliminate">平票，无人出局</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue';
import { state } from '../game.js';

const send = inject('send');
const selected = ref(null);
const voted = ref(false);

const alivePlayers = computed(() =>
  Object.values(state.players).filter(p => p.alive && p.id !== state.playerId).sort((a, b) => a.seatNum - b.seatNum)
);

function getPlayerName(pid) {
  return state.players[pid]?.name || '???';
}

function submitVote() {
  if (!selected.value) return;
  send('vote', { targetId: selected.value });
  voted.value = true;
}

function abstain() {
  send('vote', { targetId: null });
  voted.value = true;
}
</script>

<style scoped>
.vote-panel { width: 100%; max-width: 600px; }
h3 { text-align: center; margin-bottom: 16px; }
.vote-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
.vote-target { padding: 10px; background: #1a1a2e; border: 2px solid #2a2a4e; border-radius: 8px; color: #e0e0e0; font-size: 14px; display: flex; align-items: center; gap: 6px; }
.vote-target:hover:not(:disabled) { border-color: #e94560; }
.vote-target.selected { border-color: #e94560; background: #2d1a2e; }
.seat { width: 20px; height: 20px; border-radius: 50%; background: #0f3460; display: flex; align-items: center; justify-content: center; font-size: 11px; }
.vote-actions { display: flex; gap: 12px; justify-content: center; margin-bottom: 16px; }
.vote-result { background: #1a1a2e; border-radius: 8px; padding: 12px; }
h4 { margin-bottom: 8px; color: #aaa; }
.vote-record { font-size: 13px; padding: 2px 0; }
.eliminated { color: #e94560; font-weight: bold; margin-top: 8px; }
.no-eliminate { color: #888; margin-top: 8px; }
</style>
