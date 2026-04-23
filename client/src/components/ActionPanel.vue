<template>
  <div class="action-panel">
    <!-- Night actions -->
    <template v-if="state.phase === 'night'">
      <!-- Wolf -->
      <div v-if="state.step === 'wolf' && state.role === 'werewolf'" class="action-section">
        <h3>🐺 选择击杀目标</h3>
        <div class="target-grid">
          <button v-for="p in wolfTargets" :key="p.id" class="target-btn" :class="{ selected: selectedTarget === p.id }" @click="selectedTarget = p.id" :disabled="acted">
            <span class="seat">{{ p.seatNum }}</span> {{ p.name }}
          </button>
        </div>
        <div v-if="Object.keys(state.wolfVotes).length > 0" class="wolf-votes">
          <p>狼人投票:</p>
          <span v-for="(target, voter) in state.wolfVotes" :key="voter">
            {{ getPlayerName(voter) }}→{{ getPlayerName(target) }}
          </span>
        </div>
        <button class="btn-primary" @click="wolfKill" :disabled="acted || !selectedTarget">确认击杀</button>
      </div>

      <!-- Guard -->
      <div v-else-if="state.step === 'guard' && state.role === 'guard'" class="action-section">
        <h3>🛡️ 选择守护目标</h3>
        <div class="target-grid">
          <button v-for="p in guardTargets" :key="p.id" class="target-btn" :class="{ selected: selectedTarget === p.id }" @click="selectedTarget = p.id" :disabled="acted">
            <span class="seat">{{ p.seatNum }}</span> {{ p.name }}
          </button>
        </div>
        <button class="btn-primary" @click="guardAction" :disabled="acted || !selectedTarget">确认守护</button>
        <button class="btn-secondary" @click="guardSkip" :disabled="acted">本轮不守</button>
      </div>

      <!-- Seer -->
      <div v-else-if="state.step === 'seer' && state.role === 'seer'" class="action-section">
        <h3>🔍 选择查验目标</h3>
        <div v-if="state.seerResult" class="seer-result">
          查验结果: {{ state.seerResult.isWolf ? '🐺 狼人' : '👤 好人' }}
        </div>
        <div v-else class="target-grid">
          <button v-for="p in seerTargets" :key="p.id" class="target-btn" :class="{ selected: selectedTarget === p.id }" @click="selectedTarget = p.id" :disabled="acted">
            <span class="seat">{{ p.seatNum }}</span> {{ p.name }}
          </button>
        </div>
        <button v-if="!state.seerResult" class="btn-primary" @click="seerCheck" :disabled="acted || !selectedTarget">确认查验</button>
      </div>

      <!-- Witch -->
      <div v-else-if="state.step === 'witch' && state.role === 'witch'" class="action-section">
        <h3>🧪 女巫行动</h3>
        <div v-if="state.witchInfo?.killedId" class="witch-killed">
          今晚 <strong>{{ getPlayerName(state.witchInfo.killedId) }}</strong> 被杀了
        </div>
        <div v-else class="witch-killed">今晚无人被杀</div>
        <div class="witch-actions">
          <button v-if="state.witchInfo?.healAvailable && state.witchInfo?.killedId" class="btn-primary" @click="witchHeal" :disabled="acted">
            💊 使用解药救人
          </button>
          <div v-if="state.witchInfo?.poisonAvailable && !witchHealed" class="poison-section">
            <p>选择毒杀目标:</p>
            <div class="target-grid">
              <button v-for="p in witchTargets" :key="p.id" class="target-btn" :class="{ selected: poisonTarget === p.id }" @click="poisonTarget = p.id">
                <span class="seat">{{ p.seatNum }}</span> {{ p.name }}
              </button>
            </div>
            <button class="btn-danger" @click="witchPoison" :disabled="!poisonTarget">☠️ 使用毒药</button>
          </div>
          <button class="btn-secondary" @click="witchSkip" :disabled="acted">不使用药水</button>
        </div>
      </div>

      <!-- Hunter night trigger -->
      <div v-else-if="state.step === 'hunter_trigger' && state.nightAction === 'hunter_shoot'" class="action-section">
        <h3>🔫 猎人技能</h3>
        <p>你已死亡，可以选择开枪带走一人</p>
        <div class="target-grid">
          <button v-for="p in hunterTargets" :key="p.id" class="target-btn" :class="{ selected: selectedTarget === p.id }" @click="selectedTarget = p.id">
            <span class="seat">{{ p.seatNum }}</span> {{ p.name }}
          </button>
        </div>
        <button class="btn-danger" @click="hunterShoot" :disabled="!selectedTarget">开枪</button>
        <button class="btn-secondary" @click="hunterSkip">放弃</button>
      </div>

      <!-- Waiting -->
      <div v-else class="action-section waiting">
        <p>夜深了，请闭眼等待...</p>
      </div>
    </template>

    <!-- Day actions -->
    <template v-else-if="state.phase === 'day'">
      <ChatBox v-if="state.step === 'speech'" />
      <VotePanel v-if="state.step === 'vote'" />
      <div v-if="state.step === 'hunter_trigger' && state.nightAction === 'hunter_shoot'" class="action-section">
        <h3>🔫 猎人技能 — 选择开枪目标</h3>
        <div class="target-grid">
          <button v-for="p in hunterTargets" :key="p.id" class="target-btn" :class="{ selected: selectedTarget === p.id }" @click="selectedTarget = p.id">
            <span class="seat">{{ p.seatNum }}</span> {{ p.name }}
          </button>
        </div>
        <button class="btn-danger" @click="hunterShoot" :disabled="!selectedTarget">开枪</button>
        <button class="btn-secondary" @click="hunterSkip">放弃</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject } from 'vue';
import { state } from '../game.js';
import ChatBox from './ChatBox.vue';
import VotePanel from './VotePanel.vue';

const send = inject('send');
const selectedTarget = ref(null);
const poisonTarget = ref(null);
const acted = ref(false);
const witchHealed = ref(false);

watch(() => state.step, () => {
  selectedTarget.value = null;
  poisonTarget.value = null;
  acted.value = false;
  witchHealed.value = false;
});

const alivePlayers = computed(() =>
  Object.values(state.players).filter(p => p.alive).sort((a, b) => a.seatNum - b.seatNum)
);

const wolfTargets = computed(() => alivePlayers.value.filter(p => !state.teammateIds.includes(p.id) && p.id !== state.playerId));
const guardTargets = computed(() => alivePlayers.value);
const seerTargets = computed(() => alivePlayers.value.filter(p => p.id !== state.playerId));
const witchTargets = computed(() => alivePlayers.value.filter(p => p.id !== state.playerId));
const hunterTargets = computed(() => alivePlayers.value);

function getPlayerName(pid) { return state.players[pid]?.name || '???'; }

function wolfKill() {
  send('night_action', { action: 'wolf_kill', targetId: selectedTarget.value });
  acted.value = true;
}

function guardAction() {
  send('night_action', { action: 'guard', targetId: selectedTarget.value });
  acted.value = true;
}

function guardSkip() {
  send('night_action', { action: 'guard', targetId: null });
  acted.value = true;
}

function seerCheck() {
  send('night_action', { action: 'seer_check', targetId: selectedTarget.value });
  acted.value = true;
}

function witchHeal() {
  send('night_action', { action: 'witch', healTarget: state.witchInfo.killedId, poisonTarget: null });
  acted.value = true;
  witchHealed.value = true;
}

function witchPoison() {
  send('night_action', { action: 'witch', healTarget: null, poisonTarget: poisonTarget.value });
  acted.value = true;
}

function witchSkip() {
  send('night_action', { action: 'witch', healTarget: null, poisonTarget: null });
  acted.value = true;
}

function hunterShoot() {
  send('hunter_shoot', { targetId: selectedTarget.value });
}

function hunterSkip() {
  send('hunter_shoot', { targetId: null });
}
</script>

<style scoped>
.action-panel { width: 100%; height: 100%; display: flex; flex-direction: column; }
.action-section { max-width: 600px; width: 100%; margin: 0 auto; }
h3 { text-align: center; margin-bottom: 16px; }
.target-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
.target-btn { padding: 10px; background: #1a1a2e; border: 2px solid #2a2a4e; border-radius: 8px; color: #e0e0e0; font-size: 14px; display: flex; align-items: center; gap: 6px; }
.target-btn:hover:not(:disabled) { border-color: #e94560; }
.target-btn.selected { border-color: #e94560; background: #2d1a2e; }
.seat { width: 20px; height: 20px; border-radius: 50%; background: #0f3460; display: flex; align-items: center; justify-content: center; font-size: 11px; }
.wolf-votes { background: #1a1a2e; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; font-size: 13px; }
.wolf-votes span { display: inline-block; margin-right: 10px; color: #e74c3c; }
.seer-result { background: #1a1a2e; border-radius: 8px; padding: 16px; text-align: center; font-size: 20px; font-weight: bold; }
.witch-killed { background: #1a1a2e; border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 12px; }
.witch-actions { display: flex; flex-direction: column; gap: 10px; align-items: center; }
.poison-section { width: 100%; text-align: center; }
.poison-section p { margin-bottom: 8px; color: #aaa; }
.waiting { text-align: center; color: #888; font-size: 18px; padding: 40px; }
</style>
