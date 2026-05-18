<template>
  <div class="lobby-container">
    <div class="lobby-scene">
      <div class="moon"></div>
      <div class="stars"></div>
      <div class="fog"></div>
    </div>
    <div class="lobby-card">
      <div class="card-ornament top"></div>
      <div class="logo">
        <span class="logo-icon">🐺</span>
        <h1>狼 人 杀</h1>
        <p class="subtitle">— {{ playerCountLabel }} —</p>
      </div>
      <div class="divider-line"></div>

      <div v-if="!state.roomId" class="lobby-form">
        <div class="form-group">
          <label>称谓</label>
          <input v-model="name" placeholder="输入你的名号" maxlength="12" @keyup.enter="createRoom" />
        </div>
        <div class="form-group">
          <label>头像</label>
          <div class="avatar-picker">
            <div
              v-for="icon in PRESET_AVATARS" :key="icon"
              class="avatar-option" :class="{ selected: selectedAvatar === icon }"
              @click="selectedAvatar = icon"
            >{{ icon }}</div>
            <div class="avatar-option auto-option" :class="{ selected: !selectedAvatar }" @click="selectedAvatar = ''">
              <img v-if="name.trim()" :src="autoAvatarUrl" class="auto-avatar" />
              <span v-else>?</span>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>人数配置</label>
          <div class="config-row">
            <button v-for="c in CONFIG_OPTIONS" :key="c.count"
              class="config-btn" :class="{ selected: selectedPlayerCount === c.count }"
              @click="selectedPlayerCount = c.count"
              :title="c.desc"
            >{{ c.count }}人</button>
          </div>
          <div class="config-desc">{{ configDescription }}</div>
        </div>
        <div class="form-group">
          <label>房间密码（可选）</label>
          <input v-model="roomPassword" placeholder="留空则无密码" maxlength="12" type="password" />
        </div>
        <button class="btn-primary" @click="createRoom" :disabled="!name.trim() || !connected">建立房间</button>
        <div class="or-divider"><span>或</span></div>
        <div class="form-group">
          <label>房间号</label>
          <input v-model="joinRoomId" placeholder="输入六位房号" maxlength="6" />
        </div>
        <div class="form-group">
          <label>房间密码（如有）</label>
          <input v-model="joinPassword" placeholder="无密码可留空" maxlength="12" type="password" />
        </div>
        <div v-if="state.joinError" class="error-msg">{{ state.joinError }}</div>
        <button class="btn-secondary" @click="joinRoom" :disabled="!name.trim() || !joinRoomId.trim() || !connected">加入房间</button>
        <div v-if="state.stats.playerStat" class="stats-section">
          <div class="stats-title">个人战绩</div>
          <div class="stats-row">
            <span>场次 <strong>{{ state.stats.playerStat.gamesPlayed }}</strong></span>
            <span>胜率 <strong>{{ state.stats.playerStat.gamesPlayed > 0 ? (state.stats.playerStat.wins / state.stats.playerStat.gamesPlayed * 100).toFixed(0) : 0 }}%</strong></span>
            <span>MVP <strong>{{ state.stats.playerStat.mvpCount }}</strong></span>
          </div>
        </div>
      </div>

      <div v-else class="room-panel">
        <div class="room-header">
          <div class="room-id-box">
            <span class="label">房间号</span>
            <strong>{{ state.roomId }}</strong>
          </div>
          <div class="player-counter">
            <span class="count-num">{{ Object.keys(state.players).length }}</span><span class="count-max">/{{ state.playerCount }}</span>
          </div>
        </div>

        <div class="player-list">
          <div v-for="p in sortedPlayers" :key="p.id" class="player-card" :class="{ 'is-host': p.id === state.hostId, 'is-me': p.id === state.playerId }">
            <span class="avatar" v-html="renderAvatar(p)"></span>
            <span class="seat-num">{{ p.seatNum }}</span>
            <span class="name">{{ p.name }}<span v-if="p.isBot" class="bot-mark">BOT</span></span>
            <span v-if="p.id === state.hostId" class="tag host">房主</span>
            <span v-if="p.id === state.playerId" class="tag me">我</span>
            <span class="ready-status" :class="{ ready: p.ready }">
              <span class="dot"></span>
              {{ p.ready ? '就绪' : '等待' }}
            </span>
          </div>
        </div>

        <div class="room-actions">
          <button v-if="state.playerId !== state.hostId" class="btn-secondary" @click="toggleReady">
            {{ myPlayer?.ready ? '取消准备' : '准备' }}
          </button>
          <button v-if="state.playerId === state.hostId" class="btn-primary" @click="startGame"
            :disabled="!allReady || playerCount !== state.playerCount">
            开始游戏 {{ playerCount }}/{{ state.playerCount }}
          </button>
          <button v-if="state.playerId === state.hostId && (!allReady || playerCount !== state.playerCount)"
            class="btn-test" @click="startTest">
            单人测试
          </button>
        </div>
      </div>
      <div class="card-ornament bottom"></div>
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
const joinPassword = ref('');
const roomPassword = ref('');
const selectedAvatar = ref('');
const selectedPlayerCount = ref(12);

const PRESET_AVATARS = ['🐺','🌙','⚔️','🛡️','🔮','🧪','🏹','🎭','🗡️','🏰','💀','👑'];

const CONFIG_OPTIONS = [
  { count: 6, desc: '1狼人 · 1预言家 · 1女巫 · 3村民' },
  { count: 8, desc: '2狼人 · 1预言家 · 1女巫 · 1猎人 · 3村民' },
  { count: 9, desc: '2狼人 · 1预言家 · 1女巫 · 1猎人 · 1守卫 · 3村民' },
  { count: 10, desc: '3狼人 · 1预言家 · 1女巫 · 1猎人 · 1守卫 · 3村民' },
  { count: 12, desc: '3狼人 · 1预言家 · 1女巫 · 1猎人 · 1守卫 · 5村民' },
];

const autoAvatarUrl = computed(() =>
  `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name.value.trim())}`
);

const resolvedAvatar = computed(() =>
  selectedAvatar.value || (name.value.trim() ? autoAvatarUrl.value : '')
);

const sortedPlayers = computed(() =>
  Object.values(state.players).sort((a, b) => a.seatNum - b.seatNum)
);
const playerCount = computed(() => Object.keys(state.players).length);
const myPlayer = computed(() => state.players[state.playerId]);
const allReady = computed(() => Object.values(state.players).every(p => p.ready));

const playerCountLabel = computed(() => {
  const m = { 6: '经典六人局', 8: '经典八人局', 9: '经典九人局', 10: '经典十人局', 12: '经典十二人局' };
  return m[selectedPlayerCount.value] || `${selectedPlayerCount.value}人局`;
});

const configDescription = computed(() => {
  const opt = CONFIG_OPTIONS.find(c => c.count === selectedPlayerCount.value);
  return opt ? opt.desc : '';
});

function createRoom() {
  if (!name.value.trim()) return;
  state.joinError = null;
  send('create_room', { name: name.value.trim(), avatar: resolvedAvatar.value, password: roomPassword.value.trim() || undefined });
}

function joinRoom() {
  if (!name.value.trim() || !joinRoomId.value.trim()) return;
  state.joinError = null;
  send('join_room', { roomId: joinRoomId.value.trim(), name: name.value.trim(), avatar: resolvedAvatar.value, password: joinPassword.value.trim() || undefined });
}

function toggleReady() { send('ready'); }
function startGame() { send('start_game', { playerCount: state.playerCount }); }

function renderAvatar(p) {
  if (!p.avatar) return p.seatNum;
  if (p.avatar.startsWith('http')) return `<img src="${p.avatar}" class="avatar-img" />`;
  return p.avatar;
}

function startTest() {
  state.joinError = null;
  if (!myPlayer.value?.ready) {
    send('ready');
    setTimeout(() => send('start_game', { testMode: true, playerCount: selectedPlayerCount.value }), 300);
  } else {
    send('start_game', { testMode: true, playerCount: selectedPlayerCount.value });
  }
}

watch(() => state.roomStatus, (val) => {
  if (val === 'playing') view.value = 'game';
});

watch(() => state.roomId, (val) => {
  if (val) state.joinError = null;
});

watch(name, (val) => {
  if (val.trim()) send('get_stats', { name: val.trim() });
});
</script>

<style scoped>
.lobby-container {
  display: flex; justify-content: center; align-items: center;
  min-height: 100vh; padding: 20px; position: relative;
}

/* Scene background */
.lobby-scene { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
.moon {
  position: absolute; top: 8%; right: 12%; width: 80px; height: 80px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #f5f0e0, #d8d0b8);
  box-shadow: 0 0 40px rgba(210, 200, 170, 0.15), 0 0 80px rgba(210, 200, 170, 0.08);
  animation: moonGlow 4s ease-in-out infinite;
}
.stars {
  position: absolute; inset: 0;
  background-image:
    radial-gradient(1px 1px at 10% 20%, rgba(200, 190, 170, 0.4), transparent),
    radial-gradient(1px 1px at 25% 45%, rgba(200, 190, 170, 0.3), transparent),
    radial-gradient(1px 1px at 40% 15%, rgba(200, 190, 170, 0.5), transparent),
    radial-gradient(1px 1px at 55% 70%, rgba(200, 190, 170, 0.2), transparent),
    radial-gradient(1px 1px at 70% 35%, rgba(200, 190, 170, 0.4), transparent),
    radial-gradient(1px 1px at 85% 60%, rgba(200, 190, 170, 0.3), transparent),
    radial-gradient(1px 1px at 15% 80%, rgba(200, 190, 170, 0.2), transparent),
    radial-gradient(1px 1px at 90% 15%, rgba(200, 190, 170, 0.35), transparent),
    radial-gradient(1px 1px at 60% 85%, rgba(200, 190, 170, 0.25), transparent),
    radial-gradient(1.5px 1.5px at 35% 55%, rgba(220, 210, 190, 0.5), transparent);
}
.fog {
  position: absolute; bottom: 0; left: 0; right: 0; height: 30%;
  background: linear-gradient(to top, rgba(15, 12, 28, 0.6), transparent);
}

/* Card */
.lobby-card {
  position: relative; z-index: 1;
  background: rgba(18, 14, 35, 0.92);
  backdrop-filter: blur(16px);
  border-radius: 2px; padding: 40px 36px; width: 100%; max-width: 440px;
  border: 1px solid rgba(212, 168, 75, 0.12);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(80, 60, 120, 0.05);
  animation: slideUp 0.6s ease;
}

/* Gold ornaments */
.card-ornament {
  position: absolute; left: 20px; right: 20px; height: 2px;
  background: linear-gradient(90deg, transparent, rgba(212, 168, 75, 0.25), transparent);
}
.card-ornament.top { top: 12px; }
.card-ornament.bottom { bottom: 12px; }

/* Logo */
.logo { text-align: center; margin-bottom: 24px; }
.logo-icon { font-size: 42px; display: block; margin-bottom: 10px; animation: float 3s ease-in-out infinite; }
h1 {
  font-size: 32px; letter-spacing: 14px;
  background: linear-gradient(180deg, #d4a84b, #a07828);
  background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.subtitle { color: #5a5070; margin-top: 6px; font-size: 13px; letter-spacing: 4px; }
.divider-line {
  height: 1px; margin: 0 30px 28px;
  background: linear-gradient(90deg, transparent, rgba(212, 168, 75, 0.15), transparent);
}

/* Form */
.lobby-form { display: flex; flex-direction: column; gap: 14px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 12px; color: #5a5070; letter-spacing: 2px; }
.lobby-form input { padding: 12px 14px; }
.or-divider { text-align: center; color: #3a3450; font-size: 12px; margin: 4px 0; letter-spacing: 3px; }

/* Avatar picker */
.avatar-picker { display: flex; flex-wrap: wrap; gap: 6px; }
.avatar-option {
  width: 34px; height: 34px; border-radius: 2px;
  background: rgba(25, 20, 45, 0.5); border: 1px solid rgba(80, 70, 120, 0.1);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; cursor: pointer; transition: all 0.2s;
}
.avatar-option:hover { border-color: rgba(212, 168, 75, 0.3); }
.avatar-option.selected { border-color: rgba(212, 168, 75, 0.5); background: rgba(212, 168, 75, 0.06); box-shadow: 0 0 6px rgba(212, 168, 75, 0.15); }
.auto-option { overflow: hidden; }
.auto-avatar { width: 28px; height: 28px; border-radius: 2px; }
.auto-option span { color: #4a4460; font-size: 14px; }

/* Room panel */
.room-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; }
.room-id-box .label { display: block; font-size: 11px; color: #5a5070; letter-spacing: 2px; margin-bottom: 2px; }
.room-id-box strong { font-size: 30px; color: #d4a84b; letter-spacing: 8px; }
.player-counter { font-size: 14px; color: #7a7090; }
.count-num { font-size: 24px; color: #c8c0d8; font-weight: 700; }
.count-max { font-size: 13px; color: #4a4460; }

/* Player list */
.player-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 24px; max-height: 360px; overflow-y: auto; }
.player-card {
  display: flex; align-items: center; gap: 10px; padding: 8px 12px;
  background: rgba(25, 20, 45, 0.4); border-radius: 2px;
  border: 1px solid rgba(80, 70, 120, 0.08); font-size: 13px;
  transition: all 0.2s;
}
.player-card.is-me { border-color: rgba(212, 168, 75, 0.2); background: rgba(212, 168, 75, 0.03); }
.player-card.is-host { border-color: rgba(140, 120, 180, 0.15); }

.seat {
  width: 24px; height: 24px; border-radius: 2px;
  background: rgba(30, 25, 55, 0.6); border: 1px solid rgba(80, 70, 120, 0.15);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #7a7090;
}
.avatar {
  width: 28px; height: 28px; border-radius: 2px;
  background: rgba(25, 20, 45, 0.5); border: 1px solid rgba(80, 70, 120, 0.12);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; flex-shrink: 0; overflow: hidden;
}
.avatar :deep(.avatar-img) { width: 26px; height: 26px; border-radius: 2px; }
.seat-num {
  width: 18px; height: 18px; border-radius: 2px;
  background: rgba(30, 25, 55, 0.5); display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700; color: #5a5070;
}
.name { flex: 1; }
.bot-mark { font-size: 9px; color: #4a4460; margin-left: 4px; letter-spacing: 1px; }
.tag { font-size: 9px; padding: 1px 6px; border-radius: 1px; letter-spacing: 1px; font-weight: 600; }
.tag.host { background: rgba(212, 168, 75, 0.1); color: #d4a84b; border: 1px solid rgba(212, 168, 75, 0.2); }
.tag.me { background: rgba(100, 80, 160, 0.1); color: #9080c0; border: 1px solid rgba(100, 80, 160, 0.2); }

.ready-status { font-size: 11px; color: #4a4460; display: flex; align-items: center; gap: 5px; }
.dot { width: 5px; height: 5px; border-radius: 50%; background: #3a3450; transition: all 0.3s; }
.ready-status.ready { color: #6aaa6a; }
.ready-status.ready .dot { background: #6aaa6a; box-shadow: 0 0 4px rgba(106, 170, 106, 0.4); }

/* Actions */
.room-actions { display: flex; gap: 10px; justify-content: center; }
.room-actions button { padding: 10px 24px; font-size: 14px; }
.btn-test {
  background: transparent; color: #5a5070;
  border: 1px solid rgba(100, 80, 160, 0.15);
}
.btn-test:hover:not(:disabled) {
  color: #d4a84b; border-color: rgba(212, 168, 75, 0.3);
  background: rgba(212, 168, 75, 0.03);
}

/* Config buttons */
.config-row { display: flex; gap: 6px; flex-wrap: wrap; }
.config-btn {
  padding: 6px 12px; font-size: 12px; font-family: inherit;
  background: rgba(25, 20, 45, 0.5); border: 1px solid rgba(80, 70, 120, 0.1);
  border-radius: 2px; color: #7a7090; cursor: pointer; transition: all 0.2s;
  letter-spacing: 0.5px;
}
.config-btn:hover { border-color: rgba(212, 168, 75, 0.3); color: #d4a84b; }
.config-btn.selected { border-color: rgba(212, 168, 75, 0.5); background: rgba(212, 168, 75, 0.06); color: #d4a84b; }
.config-desc { font-size: 11px; color: #4a4460; margin-top: 4px; letter-spacing: 0.5px; }

/* Error message */
.error-msg {
  font-size: 12px; color: #c04040; text-align: center; padding: 6px 0;
  background: rgba(140, 30, 30, 0.06); border-radius: 2px;
}

/* Stats */
.stats-section { margin-top: 14px; }
.stats-title { font-size: 10px; color: #4a4460; letter-spacing: 2px; margin-bottom: 6px; }
.stats-row {
  display: flex; justify-content: space-around; padding: 8px;
  background: rgba(25, 20, 45, 0.4); border-radius: 2px;
  border: 1px solid rgba(80, 70, 120, 0.08);
}
.stats-row span { font-size: 11px; color: #6a6080; }
.stats-row strong { color: #d4a84b; }
</style>
