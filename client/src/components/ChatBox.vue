<template>
  <div class="chat-box">
    <div class="messages" ref="msgContainer">
      <div v-for="s in state.speeches" :key="s.playerId + s.order" class="message" :class="{ 'is-me': s.playerId === state.playerId }">
        <span class="msg-name">{{ getPlayerName(s.playerId) }}:</span>
        <span class="msg-text">{{ s.message || '(跳过发言)' }}</span>
      </div>
    </div>
    <div v-if="state.isMyTurn && state.step === 'speech'" class="chat-input">
      <input v-model="msg" placeholder="输入发言..." maxlength="500" @keyup.enter="sendSpeech" />
      <button class="btn-primary" @click="sendSpeech" :disabled="!msg.trim()">发送</button>
      <button class="btn-secondary" @click="skipSpeech">跳过</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, inject } from 'vue';
import { state } from '../game.js';

const send = inject('send');
const msgContainer = ref(null);
const msg = ref('');

function getPlayerName(pid) {
  return state.players[pid]?.name || '???';
}

watch(() => state.speeches.length, async () => {
  await nextTick();
  if (msgContainer.value) msgContainer.value.scrollTop = msgContainer.value.scrollHeight;
});

function sendSpeech() {
  if (!msg.value.trim()) return;
  send('speech', { message: msg.value.trim() });
  msg.value = '';
}

function skipSpeech() {
  send('skip_speech');
}
</script>

<style scoped>
.chat-box { display: flex; flex-direction: column; height: 100%; width: 100%; }
.messages { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 6px; background: #1a1a2e; border-radius: 8px; }
.message { font-size: 14px; padding: 4px 8px; border-radius: 4px; }
.message.is-me { background: #1a2a4e; }
.msg-name { color: #e94560; margin-right: 6px; font-weight: bold; }
.msg-text { color: #ddd; }
.chat-input { display: flex; gap: 8px; margin-top: 8px; }
.chat-input input { flex: 1; padding: 10px; }
</style>
