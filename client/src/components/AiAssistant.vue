<template>
  <div class="ai-assistant">
    <Transition name="panel">
      <div v-if="expanded" class="ai-panel">
        <div class="ai-header">
          <span class="ai-title">🧠 策略助手</span>
          <button class="ai-close" @click="expanded = false">✕</button>
        </div>
        <div class="ai-body" ref="panelBody">
          <div v-for="(tip, i) in tips" :key="'tip-'+i" class="ai-tip" :class="'tip-'+tip.level">
            <span class="tip-icon">{{ tip.icon }}</span>
            <span class="tip-text">{{ tip.text }}</span>
          </div>
          <div v-if="tips.length === 0" class="ai-empty">暂无建议，等待局势变化...</div>

          <div v-if="history.length > 0" class="ai-history">
            <button class="history-toggle" @click="showHistory = !showHistory">
              {{ showHistory ? '收起历史' : `历史建议 (${history.length})` }}
            </button>
            <Transition name="collapse">
              <div v-if="showHistory" class="history-list">
                <div v-for="(tip, i) in history" :key="'h-'+i" class="ai-tip tip-old" :class="'tip-'+tip.level">
                  <span class="tip-icon">{{ tip.icon }}</span>
                  <span class="tip-text">{{ tip.text }}</span>
                </div>
              </div>
            </Transition>
          </div>

          <div v-if="quickQuestions.length > 0" class="ai-questions">
            <div class="q-title">快捷提问</div>
            <button v-for="(item, i) in quickQuestions" :key="'q-'+i" class="q-btn" @click="askQuestion(item)">
              {{ item.q }}
            </button>
          </div>

          <div class="ai-input-area">
            <form @submit.prevent="askFree" class="ai-input-form">
              <input v-model="freeInput" placeholder="输入关键词提问..." class="ai-input" />
              <button type="submit" class="ai-send" :disabled="!freeInput.trim()">问</button>
            </form>
          </div>

          <div v-for="(msg, i) in chatHistory" :key="'msg-'+i" class="ai-chat-msg">
            <div v-if="msg.q" class="chat-q">{{ msg.q }}</div>
            <div class="chat-a">{{ msg.a }}</div>
          </div>
        </div>
      </div>
    </Transition>
    <button class="ai-fab" @click="expanded = !expanded" :class="{ hasTips: urgentCount > 0 }">
      {{ expanded ? '✕' : '🧠' }}
      <span v-if="!expanded && urgentCount > 0" class="fab-badge">{{ urgentCount }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useAiTips } from '../composables/useAiTips';

const { tips, quickQuestions, history, askFreeForm } = useAiTips();
const expanded = ref(false);
const chatHistory = ref([]);
const panelBody = ref(null);
const showHistory = ref(false);
const freeInput = ref('');

const urgentCount = computed(() => tips.value.filter(t => t.level === 'urgent').length);

watch(tips, () => {
  if (expanded.value) scrollToBottom();
}, { deep: true });

function askQuestion(item) {
  chatHistory.value.push({ q: item.q, a: item.a });
  nextTick(scrollToBottom);
}

function askFree() {
  const q = freeInput.value.trim();
  if (!q) return;
  const result = askFreeForm(q);
  if (result) {
    chatHistory.value.push({ q: result.q, a: result.a });
    freeInput.value = '';
    nextTick(scrollToBottom);
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (panelBody.value) panelBody.value.scrollTop = panelBody.value.scrollHeight;
  });
}
</script>

<style scoped>
.ai-assistant {
  position: fixed; bottom: 20px; right: 20px; z-index: 50;
  display: flex; flex-direction: column; align-items: flex-end; gap: 10px;
}

.ai-fab {
  width: 44px; height: 44px; border-radius: 50%;
  background: rgba(18, 14, 35, 0.9); border: 1px solid rgba(212, 168, 75, 0.25);
  color: #d4a84b; font-size: 20px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.3s; position: relative;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}
.ai-fab:hover { border-color: rgba(212, 168, 75, 0.5); transform: scale(1.08); }
.ai-fab.hasTips { border-color: rgba(200, 60, 60, 0.5); animation: fabUrgent 1.5s ease-in-out infinite; }

.fab-badge {
  position: absolute; top: -4px; right: -4px;
  width: 18px; height: 18px; border-radius: 50%;
  background: #c04040; color: #fff; font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}

@keyframes fabUrgent {
  0%, 100% { box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4); }
  50% { box-shadow: 0 4px 20px rgba(200, 60, 60, 0.3); }
}

.ai-panel {
  width: 340px; max-height: 480px;
  background: rgba(14, 11, 28, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(212, 168, 75, 0.12);
  border-radius: 4px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  display: flex; flex-direction: column; overflow: hidden;
}

.ai-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(212, 168, 75, 0.08);
}
.ai-title { font-size: 13px; color: #d4a84b; letter-spacing: 1px; font-weight: 600; }
.ai-close {
  background: none; border: none; color: #5a5070; font-size: 14px;
  cursor: pointer; padding: 2px 6px; border-radius: 2px;
}
.ai-close:hover { color: #c8c0d8; }

.ai-body {
  flex: 1; overflow-y: auto; padding: 12px;
  display: flex; flex-direction: column; gap: 8px;
}

/* Tip levels */
.ai-tip {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 8px 10px; border-radius: 3px;
  background: rgba(25, 20, 45, 0.5);
  border-left: 2px solid rgba(80, 70, 120, 0.15);
  animation: fadeIn 0.3s ease;
}
.tip-urgent {
  background: rgba(60, 15, 15, 0.4);
  border-left-color: #c04040;
}
.tip-warn {
  background: rgba(60, 40, 10, 0.3);
  border-left-color: #c09040;
}
.tip-info {
  background: rgba(20, 30, 50, 0.4);
  border-left-color: #4080c0;
}
.tip-normal {
  border-left-color: rgba(80, 70, 120, 0.15);
}
.tip-old { opacity: 0.5; }
.tip-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
.tip-text { font-size: 12px; color: #c0b8d0; line-height: 1.6; }
.tip-urgent .tip-text { color: #e0a0a0; }
.tip-warn .tip-text { color: #d0c090; }
.tip-info .tip-text { color: #90b0d0; }

.ai-empty { text-align: center; color: #4a4460; font-size: 12px; padding: 20px; letter-spacing: 1px; }

/* History */
.ai-history { margin-top: 2px; }
.history-toggle {
  background: none; border: 1px solid rgba(80, 70, 120, 0.1);
  border-radius: 2px; color: #5a5070; font-size: 10px; font-family: inherit;
  padding: 3px 8px; cursor: pointer; transition: all 0.2s;
  letter-spacing: 1px;
}
.history-toggle:hover { color: #8a80a0; border-color: rgba(80, 70, 120, 0.2); }
.history-list { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; max-height: 150px; overflow-y: auto; }

.collapse-enter-active { transition: all 0.2s ease; }
.collapse-leave-active { transition: all 0.15s ease; }
.collapse-enter-from, .collapse-leave-to { opacity: 0; max-height: 0; }

/* Questions */
.ai-questions { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
.q-title { font-size: 10px; color: #4a4460; letter-spacing: 2px; margin-bottom: 2px; }
.q-btn {
  text-align: left; padding: 6px 10px; font-size: 11px; font-family: inherit;
  background: rgba(212, 168, 75, 0.04); border: 1px solid rgba(212, 168, 75, 0.1);
  border-radius: 2px; color: #b0a060; cursor: pointer; transition: all 0.2s;
}
.q-btn:hover { background: rgba(212, 168, 75, 0.08); border-color: rgba(212, 168, 75, 0.2); color: #d4a84b; }

/* Free-form input */
.ai-input-area { margin-top: 4px; }
.ai-input-form { display: flex; gap: 4px; }
.ai-input {
  flex: 1; padding: 6px 10px; font-size: 11px; font-family: inherit;
  background: rgba(25, 20, 45, 0.5); border: 1px solid rgba(80, 70, 120, 0.12);
  border-radius: 2px; color: #c0b8d0; outline: none; transition: border-color 0.2s;
}
.ai-input::placeholder { color: #4a4460; }
.ai-input:focus { border-color: rgba(212, 168, 75, 0.25); }
.ai-send {
  padding: 6px 12px; font-size: 11px; font-family: inherit;
  background: rgba(212, 168, 75, 0.08); border: 1px solid rgba(212, 168, 75, 0.15);
  border-radius: 2px; color: #d4a84b; cursor: pointer; transition: all 0.2s;
}
.ai-send:hover:not(:disabled) { background: rgba(212, 168, 75, 0.15); }
.ai-send:disabled { opacity: 0.3; cursor: default; }

/* Chat */
.chat-q {
  font-size: 11px; color: #d4a84b; padding: 6px 10px;
  background: rgba(212, 168, 75, 0.06); border-radius: 2px;
  border: 1px solid rgba(212, 168, 75, 0.1);
}
.chat-a {
  font-size: 12px; color: #c0b8d0; padding: 8px 10px; line-height: 1.6;
  background: rgba(25, 20, 45, 0.5); border-radius: 2px;
  border: 1px solid rgba(80, 70, 120, 0.08);
}

.panel-enter-active { transition: all 0.3s ease; }
.panel-leave-active { transition: all 0.2s ease; }
.panel-enter-from { opacity: 0; transform: translateY(20px) scale(0.95); }
.panel-leave-to { opacity: 0; transform: translateY(10px) scale(0.95); }
</style>
