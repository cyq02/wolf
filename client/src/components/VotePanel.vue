<template>
  <div class="vote-panel">
    <div class="vote-header">
      <span class="vote-icon">⚖️</span>
      <div>
        <h3>审判投票</h3>
        <p class="vote-sub">票决放逐之人</p>
      </div>
    </div>
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
        <span class="target-name">{{ p.name }}</span>
      </button>
    </div>
    <div class="vote-actions">
      <span v-if="!voted" class="vote-progress">已投票 {{ voteCount }} / {{ totalVoters }} 人</span>
      <button class="btn-primary" @click="submitVote" :disabled="voted || !selected">投票</button>
      <button class="btn-secondary" @click="abstain" :disabled="voted">弃权</button>
    </div>
    <div v-if="state.votes && Object.keys(state.votes).length > 0" class="vote-result">
      <div class="result-title">投票揭晓</div>
      <div v-for="(target, voter) in state.votes" :key="voter" class="vote-record">
        <span class="voter">{{ getPlayerName(voter) }}</span>
        <span class="arrow">→</span>
        <span :class="target ? 'target-name' : 'abstain'">{{ target ? getPlayerName(target) : '弃权' }}</span>
      </div>
      <div v-if="state.eliminated" class="result-verdict guilty">
        {{ getPlayerName(state.eliminated) }} 被放逐
      </div>
      <div v-else-if="Object.keys(state.votes).length > 0" class="result-verdict innocent">
        平票，无人出局
      </div>
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

const voteCount = computed(() => Object.keys(state.votes || {}).length);
const totalVoters = computed(() => Object.values(state.players).filter(p => p.alive).length);

function getPlayerName(pid) { return state.players[pid]?.name || '???'; }
function submitVote() { if (!selected.value) return; send('vote', { targetId: selected.value }); voted.value = true; }
function abstain() { send('vote', { targetId: null }); voted.value = true; }
</script>

<style scoped>
.vote-panel { width: 100%; max-width: 540px; animation: slideUp 0.4s ease; }
.vote-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.vote-icon { font-size: 32px; }
.vote-header h3 { font-size: 17px; font-weight: 700; color: #d4a84b; letter-spacing: 2px; }
.vote-sub { font-size: 11px; color: #4a4460; margin-top: 2px; letter-spacing: 1px; }

.vote-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 16px; }
.vote-target {
  padding: 9px 6px;
  background: rgba(20, 16, 38, 0.5);
  border: 1px solid rgba(80, 70, 120, 0.1);
  border-radius: 2px; color: #a098b0; font-size: 12px; font-family: inherit;
  display: flex; align-items: center; gap: 6px; transition: all 0.2s;
}
.vote-target:hover:not(:disabled) { border-color: rgba(212, 168, 75, 0.3); color: #d4a84b; }
.vote-target.selected { border-color: rgba(212, 168, 75, 0.4); background: rgba(212, 168, 75, 0.06); color: #d4a84b; }
.seat {
  width: 20px; height: 20px; border-radius: 2px;
  background: rgba(25, 20, 45, 0.5); border: 1px solid rgba(80, 70, 120, 0.12);
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: #6a6080; flex-shrink: 0;
}
.target-name { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.vote-actions { display: flex; gap: 8px; justify-content: center; margin-bottom: 16px; align-items: center; }
.vote-progress { font-size: 12px; color: #6a6080; letter-spacing: 1px; margin-right: 6px; }

.vote-result {
  background: rgba(14, 11, 28, 0.4);
  border: 1px solid rgba(80, 70, 120, 0.06);
  border-radius: 2px; padding: 14px;
}
.result-title { font-size: 11px; color: #4a4460; letter-spacing: 3px; margin-bottom: 10px; font-weight: 600; }
.vote-record { font-size: 12px; padding: 3px 0; display: flex; align-items: center; gap: 5px; }
.voter { color: #a098b0; }
.arrow { color: #3a3450; }
.target-name { color: #d4a84b; }
.abstain { color: #4a4460; font-style: italic; }

.result-verdict { margin-top: 10px; padding: 10px; border-radius: 2px; text-align: center; font-size: 13px; letter-spacing: 2px; font-weight: 600; }
.result-verdict.guilty { background: rgba(140, 30, 30, 0.08); color: #c04040; border: 1px solid rgba(140, 30, 30, 0.15); }
.result-verdict.innocent { background: rgba(25, 20, 45, 0.3); color: #5a5070; }
</style>
