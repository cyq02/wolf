<template>
  <div class="lobby-container">
    <div class="lobby-card">
      <h1>🐺 狼人杀</h1>
      <p class="subtitle">经典12人局 · 在线联机</p>

      <div v-if="!state.roomId" class="lobby-form">
        <input v-model="name" placeholder="输入昵称" maxlength="12" @keyup.enter="createRoom" />
        <button class="btn-primary" @click="createRoom" :disabled="!name.trim() || !connected">创建房间</button>
        <div class="divider"><span>或</span></div>
        <input v-model="joinRoomId" placeholder="输入房间号" maxlength="6" />
        <button class="btn-secondary" @click="joinRoom" :disabled="!name.trim() || !joinRoomId.trim() || !connected">加入房间</button>
      </div>

      <div v-else class="room-panel">
        <div class="room-header">
          <span class="room-id">房间号: <strong>{{ state.roomId }}</strong></span>
          <span class="player-count">{{ Object.keys(state.players).length }}/12</span>
        </div>

        <div class="player-list">
          <div v-for="p in sortedPlayers" :key="p.id" class="player-item" :class="{ 'is-host': p.id === state.hostId, 'is-me': p.id === state.playerId }">
            <span class="seat">{{ p.seatNum }}</span>
            <span class="name">{{ p.name }}</span>
            <span v-if="p.id === state.hostId" class="badge host-badge">房主</span>
            <span v-if="p.id === state.playerId" class="badge me-badge">我</span>
            <span class="status" :class="{ ready: p.ready }">{{ p.ready ? '✓ 准备' : '等待中' }}</span>
          </div>
        </div>

        <div class="room-actions">
          <button
            v-if="state.playerId !== state.hostId"
            class="btn-secondary"
            @click="toggleReady"
          >{{ myPlayer?.ready ? '取消准备' : '准备' }}</button>
          <button
            v-if="state.playerId === state.hostId"
            class="btn-primary"
            @click="startGame"
            :disabled="!allReady || playerCount !== 12"
          >开始游戏 {{ playerCount }}/12</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, watch } from 'vue';
import { state } from '../game.js';

const send = inject('send');
const connected = inject('connected');
const view = inject('view');

const name = ref('');
const joinRoomId = ref('');

const sortedPlayers = computed(() =>
  Object.values(state.players).sort((a, b) => a.seatNum - b.seatNum)
);
const playerCount = computed(() => Object.keys(state.players).length);
const myPlayer = computed(() => state.players[state.playerId]);
const allReady = computed(() => Object.values(state.players).every(p => p.ready));

function createRoom() {
  if (!name.value.trim()) return;
  send('create_room', { name: name.value.trim() });
}

function joinRoom() {
  if (!name.value.trim() || !joinRoomId.value.trim()) return;
  send('join_room', { roomId: joinRoomId.value.trim(), name: name.value.trim() });
}

function toggleReady() {
  send('ready');
}

function startGame() {
  send('start_game');
}

watch(() => state.roomStatus, (val) => {
  if (val === 'playing') view.value = 'game';
});
</script>

<style scoped>
.lobby-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
.lobby-card { background: #16213e; border-radius: 16px; padding: 40px; width: 100%; max-width: 500px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
h1 { text-align: center; font-size: 32px; margin-bottom: 4px; }
.subtitle { text-align: center; color: #888; margin-bottom: 30px; }
.lobby-form { display: flex; flex-direction: column; gap: 12px; }
.lobby-form input { padding: 12px; font-size: 16px; }
.divider { text-align: center; color: #555; position: relative; margin: 8px 0; }
.divider::before, .divider::after { content: ''; position: absolute; top: 50%; width: 40%; height: 1px; background: #333; }
.divider::before { left: 0; }
.divider::after { right: 0; }
.room-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; font-size: 18px; }
.room-id strong { color: #e94560; font-size: 24px; letter-spacing: 4px; }
.player-count { color: #aaa; }
.player-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; max-height: 400px; overflow-y: auto; }
.player-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #1a1a2e; border-radius: 8px; border: 1px solid #2a2a4e; }
.player-item.is-me { border-color: #e94560; }
.seat { width: 24px; height: 24px; border-radius: 50%; background: #0f3460; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
.name { flex: 1; }
.badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; }
.host-badge { background: #e94560; color: #fff; }
.me-badge { background: #0f3460; color: #fff; }
.status { font-size: 13px; color: #888; }
.status.ready { color: #27ae60; }
.room-actions { display: flex; gap: 12px; justify-content: center; }
.room-actions button { padding: 12px 32px; font-size: 16px; }
</style>
