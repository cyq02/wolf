<template>
  <div class="game-log-panel">
    <div class="panel-title">编年录</div>
    <div class="panel-ornament"></div>
    <div class="log-entries" ref="logContainer">
      <div v-for="(entry, i) in state.log" :key="i" class="log-entry" :class="'event-' + entry.event" v-show="entry.event !== 'phase_change'">
        <span class="log-icon">{{ eventIcon(entry.event) }}</span>
        <span class="log-day">D{{ entry.dayNum }}</span>
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

function eventIcon(event) {
  const icons = { night_start: '🌙', day_start: '☀️', deaths: '💀', vote: '⚖️', hunter_shoot: '🔫', phase_change: '' };
  return icons[event] || '·';
}

function formatEvent(entry) {
  switch (entry.event) {
    case 'night_start': return '夜幕降临';
    case 'day_start': return '天光大亮';
    case 'deaths': return entry.data.deadIds.length > 0 ? `${entry.data.deadIds.length}人殒命` : '平安之夜';
    case 'vote': return entry.data.eliminated ? '审判放逐' : '无人出局';
    case 'hunter_shoot': return '猎人遗言';
    case 'phase_change': return '';
    default: return entry.event;
  }
}
</script>

<style scoped>
.game-log-panel {
  background: rgba(16, 12, 30, 0.6);
  backdrop-filter: blur(8px);
  border-radius: 2px; padding: 14px;
  height: 100%; overflow-y: auto;
  border: 1px solid rgba(212, 168, 75, 0.06);
}
.panel-title {
  font-size: 11px; color: #5a5070;
  text-transform: uppercase; letter-spacing: 4px;
  margin-bottom: 4px; font-weight: 600;
}
.panel-ornament {
  height: 1px; margin-bottom: 10px;
  background: linear-gradient(90deg, rgba(212, 168, 75, 0.15), transparent);
}
.log-entries { display: flex; flex-direction: column; gap: 2px; }
.log-entry { font-size: 11px; color: #5a5070; display: flex; align-items: center; gap: 5px; padding: 2px 0; }
.log-icon { font-size: 10px; flex-shrink: 0; }
.log-day { color: #d4a84b; min-width: 22px; font-weight: 700; font-size: 10px; }
.log-phase { color: #3a3450; min-width: 14px; font-size: 10px; }
.log-event { color: #7a7090; }
.event-deaths .log-event { color: #c04040; }
.event-vote .log-event { color: #c09040; }
.event-night_start .log-event { color: #6a60a0; }
.event-day_start .log-event { color: #c0a840; }
.event-hunter_shoot .log-event { color: #c08040; }
</style>
