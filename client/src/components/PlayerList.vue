<template>
  <div class="player-list-panel">
    <div class="panel-title">在场之人</div>
    <div class="panel-ornament"></div>
    <div class="players">
      <div
        v-for="p in sortedPlayers"
        :key="p.id"
        class="player-card"
        :class="{
          'is-me': p.id === state.playerId,
          'is-dead': !p.alive,
          'is-wolf': state.teammateIds.includes(p.id),
          'is-speaking': state.currentSpeakerId === p.id,
          'is-disconnected': !p.connected
        }"
      >
        <span class="avatar" v-html="renderAvatar(p)"></span>
        <span class="name">{{ p.name }}</span>
        <span v-if="state.teammateIds.includes(p.id)" class="tag wolf">狼</span>
        <span v-if="!p.alive" class="tag dead">阵亡·观战</span>
        <span v-if="!p.connected && p.alive" class="tag dc">断线</span>
        <span v-if="p.id === state.playerId" class="tag me">我</span>
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

function renderAvatar(p) {
  if (!p.avatar) return p.seatNum;
  if (p.avatar.startsWith('http')) return `<img src="${p.avatar}" style="width:22px;height:22px;border-radius:2px" />`;
  return p.avatar;
}
</script>

<style scoped>
.player-list-panel {
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
.players { display: flex; flex-direction: column; gap: 3px; }
.player-card {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; border-radius: 1px;
  background: rgba(25, 20, 45, 0.3);
  border: 1px solid transparent;
  font-size: 12px; transition: all 0.2s;
}
.player-card.is-me { border-color: rgba(212, 168, 75, 0.15); background: rgba(212, 168, 75, 0.03); }
.player-card.is-dead { opacity: 0.5; }
.player-card.is-dead .name { text-decoration: line-through; }
.player-card.is-wolf { background: rgba(140, 30, 30, 0.08); border-color: rgba(140, 30, 30, 0.15); }
.player-card.is-speaking { background: rgba(212, 168, 75, 0.05); border-color: rgba(212, 168, 75, 0.15); animation: glow 2s ease-in-out infinite; }

.seat {
  width: 20px; height: 20px; border-radius: 2px;
  background: rgba(25, 20, 45, 0.5); border: 1px solid rgba(80, 70, 120, 0.12);
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: #6a6080; flex-shrink: 0;
}
.avatar {
  width: 24px; height: 24px; border-radius: 2px;
  background: rgba(25, 20, 45, 0.5); border: 1px solid rgba(80, 70, 120, 0.12);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; flex-shrink: 0; overflow: hidden;
}
.name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tag { font-size: 9px; padding: 0px 5px; border-radius: 1px; font-weight: 600; letter-spacing: 0.5px; flex-shrink: 0; }
.tag.wolf { background: rgba(140, 30, 30, 0.15); color: #c04040; border: 1px solid rgba(140, 30, 30, 0.25); }
.tag.dead { background: rgba(60, 55, 75, 0.2); color: #5a5070; }
.tag.dc { background: rgba(80, 70, 100, 0.15); color: #6a6080; }
.tag.me { background: rgba(80, 70, 140, 0.15); color: #9080c0; border: 1px solid rgba(80, 70, 140, 0.25); }
</style>
