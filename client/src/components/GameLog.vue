<template>
  <div class="game-log-panel">
    <h3>游戏日志</h3>
    <div class="log-entries" ref="logContainer">
      <div v-for="(entry, i) in state.log" :key="i" class="log-entry">
        <span class="log-day">第{{ entry.dayNum }}天</span>
        <span class="log-phase">{{ entry.phase === 'night' ? '夜' : '日' }}</span>
        <span class="log-event">{{ formatEvent(entry) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { state } from '../game.js';

const logContainer = ref(null);

watch(() => state.log.length, async () => {
  await nextTick();
  if (logContainer.value) logContainer.value.scrollTop = logContainer.value.scrollHeight;
});

function formatEvent(entry) {
  switch (entry.event) {
    case 'night_start': return '夜幕降临';
    case 'day_start': return '天亮了';
    case 'deaths': return entry.data.deadIds.length > 0 ? `${entry.data.deadIds.length}人倒下` : '平安夜';
    case 'vote': return entry.data.eliminated ? '有人被放逐' : '无人出局';
    case 'hunter_shoot': return '猎人开枪';
    case 'phase_change': return '';
    default: return entry.event;
  }
}
</script>

<style scoped>
.game-log-panel { background: #16213e; border-radius: 12px; padding: 16px; height: 100%; overflow-y: auto; }
h3 { margin-bottom: 12px; font-size: 16px; color: #aaa; }
.log-entries { display: flex; flex-direction: column; gap: 4px; }
.log-entry { font-size: 13px; color: #bbb; display: flex; gap: 6px; }
.log-day { color: #e94560; min-width: 42px; }
.log-phase { color: #888; min-width: 20px; }
.log-event { color: #ccc; }
</style>
