<template>
  <div class="action-panel">
    <div v-if="state.isSpectator && state.phase === 'night' && state.step !== 'hunter_trigger'" class="spectator-hint">
      <span class="hint-icon">👁️</span>
      <p>你已阵亡，正在观战中</p>
      <p class="hint-sub">{{ spectatorNightLabel }}</p>
    </div>
    <template v-else-if="state.phase === 'night'">
      <!-- Wolf -->
      <div v-if="state.step === 'wolf' && state.role === 'werewolf'" class="action-section">
        <div class="action-header">
          <span class="action-icon">🐺</span>
          <div>
            <h3>选择猎杀目标</h3>
            <p class="action-sub">暗夜中，狼群低嚎</p>
          </div>
        </div>
        <div class="target-grid">
          <button v-for="p in wolfTargets" :key="p.id" class="target-btn" :class="{ selected: selectedTarget === p.id }" @click="selectedTarget = p.id" :disabled="acted">
            <span class="seat">{{ p.seatNum }}</span>
            <span class="target-name">{{ p.name }}</span>
          </button>
        </div>
        <div v-if="Object.keys(state.wolfVotes).length > 0" class="wolf-votes">
          <span v-for="(target, voter) in state.wolfVotes" :key="voter" class="vote-chip">
            {{ getPlayerName(voter) }} → {{ getPlayerName(target) }}
          </span>
        </div>
        <button class="btn-primary action-confirm" @click="wolfKill" :disabled="acted || !selectedTarget">确认击杀</button>
      </div>

      <!-- Guard -->
      <div v-else-if="state.step === 'guard' && state.role === 'guard'" class="action-section">
        <div class="action-header">
          <span class="action-icon">🛡️</span>
          <div>
            <h3>选择守护之人</h3>
            <p class="action-sub">守卫的盾，守护至黎明</p>
          </div>
        </div>
        <div class="target-grid">
          <button v-for="p in guardTargets" :key="p.id" class="target-btn" :class="{ selected: selectedTarget === p.id }" @click="selectedTarget = p.id" :disabled="acted">
            <span class="seat">{{ p.seatNum }}</span>
            <span class="target-name">{{ p.name }}</span>
          </button>
        </div>
        <div class="action-btns">
          <button class="btn-primary" @click="guardAction" :disabled="acted || !selectedTarget">确认守护</button>
          <button class="btn-secondary" @click="guardSkip" :disabled="acted">本轮不守</button>
        </div>
      </div>

      <!-- Seer -->
      <div v-else-if="state.step === 'seer' && state.role === 'seer'" class="action-section">
        <div class="action-header">
          <span class="action-icon">🔮</span>
          <div>
            <h3>占卜查验</h3>
            <p class="action-sub">水晶球映照真相</p>
          </div>
        </div>
        <div v-if="state.seerResult" class="seer-result" :class="state.seerResult.isWolf ? 'is-wolf' : 'is-good'">
          <span class="result-icon">{{ state.seerResult.isWolf ? '🐺' : '👤' }}</span>
          <span>{{ state.seerResult.isWolf ? '狼人' : '好人' }}</span>
        </div>
        <template v-else>
          <div class="target-grid">
            <button v-for="p in seerTargets" :key="p.id" class="target-btn" :class="{ selected: selectedTarget === p.id }" @click="selectedTarget = p.id" :disabled="acted">
              <span class="seat">{{ p.seatNum }}</span>
              <span class="target-name">{{ p.name }}</span>
            </button>
          </div>
          <button class="btn-primary action-confirm" @click="seerCheck" :disabled="acted || !selectedTarget">确认查验</button>
        </template>
      </div>

      <!-- Witch -->
      <div v-else-if="state.step === 'witch' && state.role === 'witch'" class="action-section">
        <div class="action-header">
          <span class="action-icon">🧪</span>
          <div>
            <h3>女巫的抉择</h3>
            <p class="action-sub">生死之药，一念之间</p>
          </div>
        </div>
        <div class="witch-status">
          <template v-if="state.witchInfo?.killedId">
            今夜 <strong>{{ getPlayerName(state.witchInfo.killedId) }}</strong> 遭难
          </template>
          <template v-else>今夜无人遭难</template>
        </div>
        <div class="witch-actions">
          <button v-if="state.witchInfo?.healAvailable && state.witchInfo?.killedId" class="btn-heal" @click="witchHeal" :disabled="acted">
            💊 使用解药
          </button>
          <div v-if="state.witchInfo?.poisonAvailable && !witchHealed" class="poison-section">
            <p class="poison-label">选择施毒目标</p>
            <div class="target-grid">
              <button v-for="p in witchTargets" :key="p.id" class="target-btn" :class="{ selected: poisonTarget === p.id }" @click="poisonTarget = p.id">
                <span class="seat">{{ p.seatNum }}</span>
                <span class="target-name">{{ p.name }}</span>
              </button>
            </div>
            <button class="btn-danger" @click="witchPoison" :disabled="!poisonTarget">☠️ 施放毒药</button>
          </div>
          <button class="btn-secondary" @click="witchSkip" :disabled="acted">不施药</button>
        </div>
      </div>

      <!-- Hunter night trigger -->
      <div v-else-if="state.step === 'hunter_trigger' && state.nightAction === 'hunter_shoot'" class="action-section">
        <div class="action-header">
          <span class="action-icon">🔫</span>
          <div>
            <h3>猎人遗言</h3>
            <p class="action-sub">你可以选择带走一人</p>
          </div>
        </div>
        <div class="target-grid">
          <button v-for="p in hunterTargets" :key="p.id" class="target-btn" :class="{ selected: selectedTarget === p.id }" @click="selectedTarget = p.id">
            <span class="seat">{{ p.seatNum }}</span>
            <span class="target-name">{{ p.name }}</span>
          </button>
        </div>
        <div class="action-btns">
          <button class="btn-danger" @click="hunterShoot" :disabled="!selectedTarget">开枪</button>
          <button class="btn-secondary" @click="hunterSkip">放弃</button>
        </div>
      </div>

      <!-- Waiting -->
      <div v-else class="action-section waiting">
        <div class="waiting-moon">🌙</div>
        <p>夜深了，请闭眼等待...</p>
      </div>
    </template>

    <!-- Day actions -->
    <template v-else-if="state.phase === 'day'">
      <ChatBox v-if="state.step === 'speech'" />
      <VotePanel v-if="state.step === 'vote'" />
      <div v-if="state.step === 'hunter_trigger' && state.nightAction === 'hunter_shoot'" class="action-section">
        <div class="action-header">
          <span class="action-icon">🔫</span>
          <div><h3>猎人遗言</h3><p class="action-sub">选择开枪目标</p></div>
        </div>
        <div class="target-grid">
          <button v-for="p in hunterTargets" :key="p.id" class="target-btn" :class="{ selected: selectedTarget === p.id }" @click="selectedTarget = p.id">
            <span class="seat">{{ p.seatNum }}</span>
            <span class="target-name">{{ p.name }}</span>
          </button>
        </div>
        <div class="action-btns">
          <button class="btn-danger" @click="hunterShoot" :disabled="!selectedTarget">开枪</button>
          <button class="btn-secondary" @click="hunterSkip">放弃</button>
        </div>
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

const spectatorNightLabel = computed(() => {
  const labels = { wolf: '狼人正在行动...', guard: '守卫正在守望...', seer: '预言家正在查验...', witch: '女巫正在抉择...', night_resolve: '命运揭晓中...' };
  return labels[state.step] || '夜晚进行中...';
});

function getPlayerName(pid) { return state.players[pid]?.name || '???'; }

function wolfKill() { send('night_action', { action: 'wolf_kill', targetId: selectedTarget.value }); acted.value = true; }
function guardAction() { send('night_action', { action: 'guard', targetId: selectedTarget.value }); acted.value = true; }
function guardSkip() { send('night_action', { action: 'guard', targetId: null }); acted.value = true; }
function seerCheck() { send('night_action', { action: 'seer_check', targetId: selectedTarget.value }); acted.value = true; }
function witchHeal() { send('night_action', { action: 'witch', healTarget: state.witchInfo.killedId, poisonTarget: null }); acted.value = true; witchHealed.value = true; }
function witchPoison() { send('night_action', { action: 'witch', healTarget: null, poisonTarget: poisonTarget.value }); acted.value = true; }
function witchSkip() { send('night_action', { action: 'witch', healTarget: null, poisonTarget: null }); acted.value = true; }
function hunterShoot() { send('hunter_shoot', { targetId: selectedTarget.value }); }
function hunterSkip() { send('hunter_shoot', { targetId: null }); }
</script>

<style scoped>
.action-panel { width: 100%; height: 100%; display: flex; flex-direction: column; animation: fadeIn 0.4s ease; }
.action-section { max-width: 540px; width: 100%; margin: 0 auto; animation: slideUp 0.4s ease; }

.action-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.action-icon { font-size: 32px; }
.action-header h3 { font-size: 17px; font-weight: 700; color: #d4a84b; letter-spacing: 2px; }
.action-sub { font-size: 11px; color: #4a4460; margin-top: 2px; letter-spacing: 1px; }

.target-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 16px; }
.target-btn {
  padding: 9px 6px;
  background: rgba(20, 16, 38, 0.5);
  border: 1px solid rgba(80, 70, 120, 0.1);
  border-radius: 2px; color: #a098b0; font-size: 12px; font-family: inherit;
  display: flex; align-items: center; gap: 6px; transition: all 0.2s;
}
.target-btn:hover:not(:disabled) { border-color: rgba(212, 168, 75, 0.3); color: #d4a84b; }
.target-btn.selected { border-color: rgba(212, 168, 75, 0.4); background: rgba(212, 168, 75, 0.06); color: #d4a84b; }
.seat {
  width: 20px; height: 20px; border-radius: 2px;
  background: rgba(25, 20, 45, 0.5); border: 1px solid rgba(80, 70, 120, 0.12);
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: #6a6080; flex-shrink: 0;
}
.target-name { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.wolf-votes { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; justify-content: center; }
.vote-chip { font-size: 11px; padding: 3px 10px; border-radius: 1px; background: rgba(140, 30, 30, 0.1); color: #c04040; border: 1px solid rgba(140, 30, 30, 0.15); }

.seer-result {
  text-align: center; padding: 24px; border-radius: 2px;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  font-size: 20px; font-weight: 700; letter-spacing: 2px; margin-bottom: 16px;
}
.seer-result.is-wolf { background: rgba(140, 30, 30, 0.08); color: #c04040; border: 1px solid rgba(140, 30, 30, 0.2); }
.seer-result.is-good { background: rgba(40, 100, 60, 0.08); color: #50a060; border: 1px solid rgba(40, 100, 60, 0.2); }
.result-icon { font-size: 24px; }

.witch-status {
  text-align: center; padding: 14px; border-radius: 2px; margin-bottom: 14px;
  background: rgba(20, 16, 38, 0.4); color: #7a7090; font-size: 13px;
  border: 1px solid rgba(80, 70, 120, 0.08);
}
.witch-status strong { color: #c04040; }
.witch-actions { display: flex; flex-direction: column; gap: 8px; align-items: center; }
.btn-heal {
  background: linear-gradient(135deg, #2a6040, #1a4030);
  color: #a0d0b0; border: 1px solid rgba(40, 160, 96, 0.2);
  padding: 10px 24px; border-radius: 2px; font-size: 13px; font-family: inherit;
  box-shadow: 0 4px 12px rgba(40, 100, 60, 0.15); letter-spacing: 1px;
}
.btn-heal:hover:not(:disabled) { box-shadow: 0 6px 18px rgba(40, 100, 60, 0.25); }
.poison-section { width: 100%; text-align: center; }
.poison-label { color: #5a5070; margin-bottom: 8px; font-size: 12px; letter-spacing: 1px; }

.action-confirm { display: block; margin: 0 auto; min-width: 150px; }
.action-btns { display: flex; gap: 8px; justify-content: center; }

.waiting { text-align: center; padding: 60px 20px; animation: fadeIn 0.6s; }
.waiting-moon { font-size: 40px; margin-bottom: 14px; animation: float 3s ease-in-out infinite; }
.waiting p { color: #3a3450; font-size: 14px; letter-spacing: 3px; }

.spectator-hint { text-align: center; padding: 60px 20px; animation: fadeIn 0.6s; }
.hint-icon { font-size: 40px; display: block; margin-bottom: 14px; filter: brightness(1.2); }
.spectator-hint p { color: #a098b8; font-size: 14px; letter-spacing: 3px; }
.hint-sub { font-size: 11px !important; color: #8078a0 !important; letter-spacing: 1px !important; margin-top: 8px; }
</style>
