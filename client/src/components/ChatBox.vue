<template>
  <div class="chat-box">
    <div class="chat-header">
      <span class="chat-title">📝 白昼辩论</span>
      <span v-if="state.isMyTurn" class="my-turn-hint">轮到你发言</span>
    </div>
    <div class="messages" ref="msgContainer">
      <div
        v-for="s in state.speeches"
        :key="s.playerId + s.order"
        class="message"
        :class="{ 'is-me': s.playerId === state.playerId, 'is-skip': !s.message }"
      >
        <div class="msg-bubble">
          <span class="msg-avatar" v-html="getAvatar(s.playerId)"></span>
          <span class="msg-name">{{ getPlayerName(s.playerId) }}</span>
          <span class="msg-text">{{ s.message || '（沉默不语）' }}</span>
        </div>
      </div>
      <div v-if="state.speeches.length === 0" class="no-msg">无人发言</div>
    </div>
    <div v-if="state.isMyTurn && state.step === 'speech'" class="chat-input">
      <input v-model="msg" placeholder="说些什么..." maxlength="500" @keyup.enter="sendSpeech" />
      <button class="btn-primary" @click="sendSpeech" :disabled="!msg.trim()">发言</button>
      <button class="btn-secondary" @click="skipSpeech">沉默</button>
    </div>
    <div v-if="state.isMyTurn && state.step === 'speech'" class="phrase-bar">
      <div class="phrase-title">快捷发言</div>
      <div class="phrase-list">
        <button v-for="(phrase, i) in PHRASE_PACKS" :key="i" class="phrase-btn"
          @click="handlePhrase(phrase)">
          {{ phrase.needsTarget ? phrase.text.replace('{target}', '?') : phrase.text }}
        </button>
      </div>
      <div v-if="showTargetPicker" class="target-picker">
        <button v-for="p in aliveTargets" :key="p.id" class="target-pick-btn"
          @click="selectTarget(p)">
          {{ p.seatNum }}号 {{ p.name }}
        </button>
        <button class="target-pick-btn cancel" @click="showTargetPicker = false">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, inject } from 'vue';
import { state } from '../game.js';

const send = inject('send');
const msgContainer = ref(null);
const msg = ref('');
const showTargetPicker = ref(false);
const pendingPhrase = ref(null);

const PHRASE_PACKS = [
  { text: '我是好人，大家相信我', needsTarget: false },
  { text: '我查杀{target}号', needsTarget: true },
  { text: '我保{target}号', needsTarget: true },
  { text: '我觉得{target}号可疑', needsTarget: true },
  { text: '我没什么信息', needsTarget: false },
  { text: '大家冷静分析', needsTarget: false },
  { text: '同意刚才的观点', needsTarget: false },
  { text: '过', needsTarget: false },
];

const aliveTargets = computed(() =>
  Object.values(state.players).filter(p => p.alive && p.id !== state.playerId).sort((a, b) => a.seatNum - b.seatNum)
);

function getPlayerName(pid) { return state.players[pid]?.name || '???'; }
function getAvatar(pid) {
  const p = state.players[pid];
  if (!p?.avatar) return '<span style="color:#5a5070">·</span>';
  if (p.avatar.startsWith('http')) return `<img src="${p.avatar}" style="width:18px;height:18px;border-radius:2px" />`;
  return p.avatar;
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

function skipSpeech() { send('skip_speech'); }

function handlePhrase(phrase) {
  if (phrase.needsTarget) {
    pendingPhrase.value = phrase;
    showTargetPicker.value = true;
  } else {
    send('speech', { message: phrase.text });
  }
}

function selectTarget(p) {
  if (pendingPhrase.value) {
    const message = pendingPhrase.value.text.replace('{target}', `${p.seatNum}号(${p.name})`);
    send('speech', { message });
  }
  showTargetPicker.value = false;
  pendingPhrase.value = null;
}
</script>

<style scoped>
.chat-box { display: flex; flex-direction: column; height: 100%; width: 100%; }
.chat-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 12px; margin-bottom: 6px;
}
.chat-title { font-size: 13px; color: #5a5070; letter-spacing: 2px; }
.my-turn-hint {
  font-size: 11px; padding: 2px 10px; border-radius: 1px;
  background: rgba(212, 168, 75, 0.08); color: #d4a84b;
  border: 1px solid rgba(212, 168, 75, 0.15);
  animation: pulse 1.5s ease-in-out infinite; letter-spacing: 1px;
}

.messages {
  flex: 1; overflow-y: auto; padding: 10px;
  display: flex; flex-direction: column; gap: 6px;
  background: rgba(10, 8, 22, 0.7);
  border-radius: 2px; border: 1px solid rgba(80, 70, 120, 0.08);
}
.message { animation: fadeIn 0.3s ease; }
.msg-bubble { padding: 8px 12px; border-radius: 2px; background: rgba(25, 20, 45, 0.5); display: flex; align-items: flex-start; gap: 8px; }
.is-me .msg-bubble { background: rgba(212, 168, 75, 0.06); border: 1px solid rgba(212, 168, 75, 0.1); }
.is-skip .msg-bubble { opacity: 0.35; }
.msg-avatar { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; overflow: hidden; margin-top: 1px; }
.msg-name { color: #e0c870; font-weight: 700; font-size: 13px; white-space: nowrap; }
.msg-text { color: #d8d0e0; font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
.no-msg { text-align: center; color: #5a5070; padding: 40px; font-size: 14px; letter-spacing: 2px; }

.chat-input { display: flex; gap: 6px; margin-top: 8px; }
.chat-input input { flex: 1; }
.chat-input button { padding: 8px 14px; white-space: nowrap; }

/* Phrase bar */
.phrase-bar { margin-top: 8px; }
.phrase-title { font-size: 10px; color: #4a4460; letter-spacing: 2px; margin-bottom: 4px; }
.phrase-list { display: flex; flex-wrap: wrap; gap: 4px; }
.phrase-btn {
  padding: 4px 10px; font-size: 11px; font-family: inherit;
  background: rgba(25, 20, 45, 0.5); border: 1px solid rgba(80, 70, 120, 0.1);
  border-radius: 2px; color: #8a8098; cursor: pointer; transition: all 0.2s;
  white-space: nowrap;
}
.phrase-btn:hover { border-color: rgba(212, 168, 75, 0.3); color: #d4a84b; }

.target-picker {
  display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;
  padding: 8px; background: rgba(14, 11, 28, 0.5); border-radius: 2px;
  border: 1px solid rgba(80, 70, 120, 0.08);
}
.target-pick-btn {
  padding: 4px 10px; font-size: 11px; font-family: inherit;
  background: rgba(25, 20, 45, 0.5); border: 1px solid rgba(212, 168, 75, 0.15);
  border-radius: 2px; color: #c8c0d8; cursor: pointer; transition: all 0.2s;
}
.target-pick-btn:hover { border-color: rgba(212, 168, 75, 0.4); color: #d4a84b; }
.target-pick-btn.cancel { color: #5a5070; border-color: rgba(80, 70, 120, 0.1); }
</style>
