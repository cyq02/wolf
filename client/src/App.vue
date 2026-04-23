<template>
  <LobbyView v-if="view === 'lobby'" />
  <GameView v-else-if="view === 'game'" />
  <ResultView v-else-if="view === 'result'" />
</template>

<script setup>
import { provide, ref } from 'vue';
import LobbyView from './views/LobbyView.vue';
import GameView from './views/GameView.vue';
import ResultView from './views/ResultView.vue';
import { useWebSocket } from './composables/useWebSocket.js';

const view = ref('lobby');
const { send, connected } = useWebSocket();

provide('send', send);
provide('connected', connected);
provide('view', view);
</script>
