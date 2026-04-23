# 在线狼人杀游戏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个经典 12 人狼人杀在线联机游戏，支持房间创建、角色分配、夜晚行动、白天讨论投票、猎人技能、断线重连等完整功能。

**Architecture:** Node.js 服务端维护权威游戏状态机，通过 WebSocket 与 Vue 3 前端通信。所有游戏逻辑在服务端执行，客户端只做 UI 展示。信息按角色过滤后推送。

**Tech Stack:** Node.js 18, `ws` (WebSocket), Vue 3, Vite, 原生 CSS (暗色主题)

**Spec:** `docs/superpowers/specs/2026-04-23-werewolf-online-game-design.md`

---

## File Structure

```
werewolf-game/
├── package.json                    # 依赖：ws, vite, vue
├── server/
│   ├── index.js                    # HTTP + WSS 服务器入口，消息路由
│   ├── utils.js                    # generateId(), generateRoomId(), shuffle()
│   ├── RoomManager.js              # 房间 CRUD，玩家管理，断线/重连
│   └── GameStateMachine.js         # 核心状态机 + 夜晚结算 + 胜负判定
├── client/
│   ├── index.html
│   ├── package.json                # 前端独立依赖：vue, vite, @vitejs/plugin-vue
│   ├── vite.config.js
│   └── src/
│       ├── main.js                 # Vue app 创建
│       ├── App.vue                 # 根组件，视图切换
│       ├── styles.css              # 全局暗色主题样式
│       ├── game.js                 # 游戏状态 store + 消息处理
│       ├── composables/
│       │   └── useWebSocket.js     # WS 连接、断线重连、消息发送
│       ├── views/
│       │   ├── LobbyView.vue       # 大厅：创建/加入房间，玩家列表
│       │   ├── GameView.vue        # 游戏主界面：布局 + 阶段切换
│       │   └── ResultView.vue      # 结算：胜负 + 角色揭示
│       └── components/
│           ├── PlayerList.vue      # 玩家列表（左侧栏）
│           ├── ActionPanel.vue     # 角色操作面板（中央）
│           ├── ChatBox.vue         # 聊天/发言框
│           ├── VotePanel.vue       # 投票面板
│           └── GameLog.vue         # 游戏日志（右侧栏）
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `server/index.js`
- Create: `server/utils.js`
- Create: `client/index.html`
- Create: `client/package.json`
- Create: `client/vite.config.js`
- Create: `client/src/main.js`
- Create: `client/src/App.vue`
- Create: `client/src/styles.css`

- [ ] **Step 1: Initialize project root with package.json**

```json
{
  "name": "werewolf-game",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "node server/index.js",
    "dev:client": "cd client && npx vite --host",
    "build": "cd client && npx vite build",
    "start": "node server/index.js"
  },
  "dependencies": {
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

Run: `cd ~/werewolf-game && npm install`

- [ ] **Step 2: Create server entry point**

`server/index.js` — HTTP server serving static files from `client/dist` (production) + WebSocket server on the same port. Message parsing and routing stub.

```js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const distPath = path.join(__dirname, '..', 'client', 'dist');
  let filePath = path.join(distPath, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

const rooms = {}; // roomId -> Room
const playerConnections = {}; // playerId -> { ws, roomId }

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      handleMessage(ws, msg);
    } catch (e) {
      sendError(ws, 'Invalid message format');
    }
  });
  ws.on('close', () => {
    handleDisconnect(ws);
  });
});

function send(ws, action, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'event', action, payload }));
  }
}

function sendError(ws, message) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'error', action: 'error', payload: { message } }));
  }
}

function handleMessage(ws, msg) {
  // TODO: route by msg.action
}

function handleDisconnect(ws) {
  // TODO: handle player disconnect
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

- [ ] **Step 3: Create server utils**

`server/utils.js`:

```js
function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function generateRoomId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = { generateId, generateRoomId, shuffle };
```

- [ ] **Step 4: Create client scaffolding**

`client/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>狼人杀</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

`client/package.json`:

```json
{
  "name": "werewolf-client",
  "private": true,
  "scripts": {
    "dev": "vite --host",
    "build": "vite build"
  },
  "dependencies": {
    "vue": "^3.4.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

`client/vite.config.js`:

```js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  }
});
```

`client/src/main.js`:

```js
import { createApp } from 'vue';
import App from './App.vue';
import './styles.css';

createApp(App).mount('#app');
```

`client/src/App.vue` — simple view switcher based on game state:

```vue
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
```

- [ ] **Step 5: Create base dark theme CSS**

`client/src/styles.css`:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Microsoft YaHei', sans-serif; background: #1a1a2e; color: #e0e0e0; min-height: 100vh; }
button { cursor: pointer; padding: 8px 16px; border: none; border-radius: 6px; font-size: 14px; transition: all 0.2s; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
input { padding: 8px 12px; border: 1px solid #333; border-radius: 6px; background: #16213e; color: #e0e0e0; font-size: 14px; }
input:focus { outline: none; border-color: #e94560; }
.btn-primary { background: #e94560; color: #fff; }
.btn-primary:hover:not(:disabled) { background: #c73651; }
.btn-secondary { background: #0f3460; color: #e0e0e0; }
.btn-secondary:hover:not(:disabled) { background: #1a4a8a; }
.btn-danger { background: #c0392b; color: #fff; }
.player-dead { opacity: 0.4; text-decoration: line-through; }
.night-mode { background: #0d0d1a; }
```

- [ ] **Step 6: Create placeholder view files**

Create minimal placeholder files for LobbyView, GameView, ResultView so the app compiles.

`client/src/views/LobbyView.vue`:

```vue
<template>
  <div class="lobby"><h1>狼人杀 - 大厅</h1><p>加载中...</p></div>
</template>
```

`client/src/views/GameView.vue`:

```vue
<template>
  <div class="game"><h1>游戏界面</h1><p>等待开始...</p></div>
</template>
```

`client/src/views/ResultView.vue`:

```vue
<template>
  <div class="result"><h1>游戏结束</h1></div>
</template>
```

- [ ] **Step 7: Install dependencies and verify**

Run: `cd ~/werewolf-game && npm install && cd client && npm install`

- [ ] **Step 8: Commit scaffolding**

```bash
cd ~/werewolf-game
git add -A
git commit -m "feat: project scaffolding - server + client skeleton"
```

---

## Task 2: WebSocket Composable + Message Router

**Files:**
- Create: `client/src/composables/useWebSocket.js`
- Create: `client/src/game.js`
- Modify: `server/index.js` (add message routing)

- [ ] **Step 1: Create game state store**

`client/src/game.js` — reactive game state shared across components:

```js
import { reactive } from 'vue';

export const state = reactive({
  playerId: localStorage.getItem('werewolf_playerId') || null,
  roomId: null,
  hostId: null,
  roomStatus: null,
  players: {},
  role: null,
  teammateIds: [],
  phase: null,
  dayNum: 0,
  step: null,
  isMyTurn: false,
  currentSpeakerId: null,
  nightAction: null,       // 当前夜晚操作提示
  seerResult: null,        // { targetId, isWolf }
  witchInfo: null,         // { killedId }
  wolfVotes: {},           // 狼人同伴投票情况
  speeches: [],
  votes: {},
  eliminated: null,
  deadIds: [],
  log: [],
  gameOver: null,          // { winner, players }
  timeLeft: 0,
  connected: false,
});

export function resetState() {
  state.playerId = null;
  state.roomId = null;
  state.hostId = null;
  state.roomStatus = null;
  state.players = {};
  state.role = null;
  state.teammateIds = [];
  state.phase = null;
  state.dayNum = 0;
  state.step = null;
  state.isMyTurn = false;
  state.currentSpeakerId = null;
  state.nightAction = null;
  state.seerResult = null;
  state.witchInfo = null;
  state.wolfVotes = {};
  state.speeches = [];
  state.votes = {};
  state.eliminated = null;
  state.deadIds = [];
  state.log = [];
  state.gameOver = null;
  state.timeLeft = 0;
  localStorage.removeItem('werewolf_playerId');
}
```

- [ ] **Step 2: Create useWebSocket composable**

`client/src/composables/useWebSocket.js`:

```js
import { ref } from 'vue';
import { state, resetState } from '../game.js';

let ws = null;
let reconnectTimer = null;

export function useWebSocket() {
  const connected = ref(false);

  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}/ws`);

    ws.onopen = () => {
      connected.value = true;
      // If we have saved IDs, try reconnect
      if (state.playerId && state.roomId && state.roomStatus === 'playing') {
        send('reconnect', { playerId: state.playerId, roomId: state.roomId });
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    ws.onclose = () => {
      connected.value = false;
      // Auto reconnect after 3 seconds
      reconnectTimer = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  function send(action, payload = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'action',
        action,
        payload,
        playerId: state.playerId,
        roomId: state.roomId
      }));
    }
  }

  function handleMessage(msg) {
    if (msg.type === 'error') {
      alert(msg.payload.message);
      return;
    }

    const { action, payload } = msg;

    switch (action) {
      case 'room_created':
      case 'room_joined':
        state.playerId = payload.playerId;
        state.roomId = payload.roomId;
        state.roomStatus = 'waiting';
        localStorage.setItem('werewolf_playerId', payload.playerId);
        break;
      case 'room_info':
        state.players = payload.players;
        state.roomStatus = payload.status;
        state.hostId = payload.hostId;
        if (payload.roomId) state.roomId = payload.roomId;
        break;
      case 'player_joined':
      case 'player_left':
      case 'player_disconnect':
      case 'player_reconnect':
        // Will get updated room_info
        break;
      case 'game_started':
        state.roomStatus = 'playing';
        break;
      case 'your_role':
        state.role = payload.role;
        state.teammateIds = payload.teammateIds || [];
        break;
      case 'phase_change':
        state.phase = payload.phase;
        state.dayNum = payload.dayNum;
        state.step = payload.step;
        state.isMyTurn = false;
        state.log.push({ dayNum: payload.dayNum, phase: payload.phase, event: 'phase_change' });
        break;
      case 'your_turn':
        state.isMyTurn = true;
        state.timeLeft = payload.timeLeft || 0;
        state.nightAction = payload.action || null;
        break;
      case 'wolf_vote_info':
        state.wolfVotes = payload.votes;
        break;
      case 'seer_result':
        state.seerResult = payload;
        break;
      case 'witch_info':
        state.witchInfo = payload;
        break;
      case 'speech_message':
        state.speeches.push(payload);
        break;
      case 'speech_end':
        break;
      case 'vote_result':
        state.votes = payload.votes;
        state.eliminated = payload.eliminated;
        break;
      case 'death_announce':
        state.deadIds = payload.deadIds;
        // Mark players as dead
        for (const id of payload.deadIds) {
          if (state.players[id]) state.players[id].alive = false;
        }
        break;
      case 'hunter_trigger':
        state.isMyTurn = true;
        state.nightAction = 'hunter_shoot';
        state.timeLeft = payload.timeLeft || 15;
        break;
      case 'game_over':
        state.gameOver = payload;
        state.roomStatus = 'finished';
        break;
    }
  }

  function disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) ws.close();
    resetState();
  }

  // Auto-connect on first use
  if (!ws) connect();

  return { send, connected, disconnect };
}
```

- [ ] **Step 3: Add message routing to server**

Update `server/index.js` — add the `handleMessage` function with routing. Import `RoomManager`:

```js
// Add at top of server/index.js, after requires:
const { RoomManager } = require('./RoomManager');
const roomManager = new RoomManager(rooms, playerConnections);

function handleMessage(ws, msg) {
  const { action, payload } = msg;

  switch (action) {
    case 'create_room':
      roomManager.createRoom(ws, payload.name);
      break;
    case 'join_room':
      roomManager.joinRoom(ws, payload.roomId, payload.name);
      break;
    case 'ready':
      roomManager.toggleReady(ws, msg.playerId);
      break;
    case 'start_game':
      roomManager.startGame(ws, msg.playerId, msg.roomId);
      break;
    case 'reconnect':
      roomManager.reconnect(ws, payload.playerId, payload.roomId);
      break;
    case 'night_action':
      roomManager.nightAction(ws, msg.playerId, msg.roomId, payload);
      break;
    case 'speech':
      roomManager.speech(ws, msg.playerId, msg.roomId, payload);
      break;
    case 'skip_speech':
      roomManager.skipSpeech(ws, msg.playerId, msg.roomId);
      break;
    case 'vote':
      roomManager.vote(ws, msg.playerId, msg.roomId, payload);
      break;
    case 'hunter_shoot':
      roomManager.hunterShoot(ws, msg.playerId, msg.roomId, payload);
      break;
    default:
      sendError(ws, `Unknown action: ${action}`);
  }
}
```

- [ ] **Step 4: Verify server starts without errors**

Run: `cd ~/werewolf-game && node -e "require('./server/index.js')" &; sleep 1; kill %1`
Expected: No import errors

- [ ] **Step 5: Commit**

```bash
cd ~/werewolf-game
git add -A
git commit -m "feat: WebSocket composable, game state store, message router"
```

---

## Task 3: RoomManager — Room & Player Management

**Files:**
- Create: `server/RoomManager.js`

- [ ] **Step 1: Implement RoomManager**

`server/RoomManager.js` — handles room lifecycle, player join/leave, ready toggle, disconnect/reconnect:

```js
const { generateId, generateRoomId } = require('./utils');
const { GameStateMachine } = require('./GameStateMachine');

class RoomManager {
  constructor(rooms, playerConnections) {
    this.rooms = rooms;
    this.pc = playerConnections;
  }

  _getPlayerId(ws) {
    for (const [pid, conn] of Object.entries(this.pc)) {
      if (conn.ws === ws) return pid;
    }
    return null;
  }

  _broadcast(roomId, action, payload, filter = null) {
    const room = this.rooms[roomId];
    if (!room) return;
    for (const [pid, player] of Object.entries(room.players)) {
      if (filter && !filter(pid, player)) continue;
      const conn = this.pc[pid];
      if (conn && conn.ws.readyState === 1) {
        const filteredPayload = filter ? payload : payload;
        conn.ws.send(JSON.stringify({ type: 'event', action, payload: filteredPayload }));
      }
    }
  }

  _sendRoomInfo(roomId) {
    const room = this.rooms[roomId];
    if (!room) return;
    const players = {};
    for (const [pid, p] of Object.entries(room.players)) {
      players[pid] = { id: p.id, name: p.name, seatNum: p.seatNum, alive: p.alive, ready: p.ready, connected: p.connected };
    }
    this._broadcast(roomId, 'room_info', { players, status: room.status, hostId: room.hostId, roomId: room.id });
  }

  createRoom(ws, name) {
    const playerId = generateId();
    const roomId = generateRoomId();
    // Ensure unique room ID
    while (this.rooms[roomId]) { roomId = generateRoomId(); }

    this.pc[playerId] = { ws, roomId };

    this.rooms[roomId] = {
      id: roomId,
      hostId: playerId,
      players: {
        [playerId]: { id: playerId, name, role: null, seatNum: 1, alive: true, ready: false, connected: true }
      },
      game: null,
      status: 'waiting',
      disconnectedAt: {}
    };

    ws.send(JSON.stringify({ type: 'event', action: 'room_created', payload: { playerId, roomId } }));
    this._sendRoomInfo(roomId);
  }

  joinRoom(ws, roomId, name) {
    const room = this.rooms[roomId];
    if (!room) { ws.send(JSON.stringify({ type: 'error', action: 'error', payload: { message: '房间不存在' } })); return; }
    if (room.status !== 'waiting') { ws.send(JSON.stringify({ type: 'error', action: 'error', payload: { message: '游戏已开始' } })); return; }
    if (Object.keys(room.players).length >= 12) { ws.send(JSON.stringify({ type: 'error', action: 'error', payload: { message: '房间已满' } })); return; }

    const playerId = generateId();
    const seatNum = Object.keys(room.players).length + 1;
    this.pc[playerId] = { ws, roomId };
    room.players[playerId] = { id: playerId, name, role: null, seatNum, alive: true, ready: false, connected: true };

    ws.send(JSON.stringify({ type: 'event', action: 'room_joined', payload: { playerId, roomId } }));
    this._sendRoomInfo(roomId);
  }

  toggleReady(ws, playerId) {
    const pid = playerId || this._getPlayerId(ws);
    const conn = this.pc[pid];
    if (!conn) return;
    const room = this.rooms[conn.roomId];
    if (!room || !room.players[pid]) return;
    room.players[pid].ready = !room.players[pid].ready;
    this._sendRoomInfo(room.id);
  }

  startGame(ws, playerId, roomId) {
    const room = this.rooms[roomId];
    if (!room || room.hostId !== playerId) {
      ws.send(JSON.stringify({ type: 'error', action: 'error', payload: { message: '只有房主可以开始游戏' } }));
      return;
    }
    const playerList = Object.values(room.players);
    if (playerList.length !== 12) {
      ws.send(JSON.stringify({ type: 'error', action: 'error', payload: { message: '需要12名玩家' } }));
      return;
    }
    if (!playerList.every(p => p.ready)) {
      ws.send(JSON.stringify({ type: 'error', action: 'error', payload: { message: '所有玩家必须准备' } }));
      return;
    }

    room.status = 'playing';
    const fsm = new GameStateMachine(room, this);
    room.game = fsm;
    fsm.start();
  }

  reconnect(ws, playerId, roomId) {
    const room = this.rooms[roomId];
    if (!room || !room.players[playerId]) {
      ws.send(JSON.stringify({ type: 'error', action: 'error', payload: { message: '重连失败' } }));
      return;
    }
    const oldConn = this.pc[playerId];
    if (oldConn && oldConn.ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'error', action: 'error', payload: { message: '账号已在线' } }));
      return;
    }
    this.pc[playerId] = { ws, roomId };
    room.players[playerId].connected = true;
    delete room.disconnectedAt[playerId];
    this._broadcast(roomId, 'player_reconnect', { playerId });
    this._sendRoomInfo(roomId);

    // Send current game state to reconnecting player
    if (room.game) {
      room.game.sendCurrentState(playerId);
    }
  }

  // Called from index.js handleDisconnect
  handleDisconnect(ws) {
    const pid = this._getPlayerId(ws);
    if (!pid) return;
    const conn = this.pc[pid];
    if (!conn) return;
    const room = this.rooms[conn.roomId];
    if (!room) { delete this.pc[pid]; return; }

    room.players[pid].connected = false;
    room.disconnectedAt[pid] = Date.now();

    if (room.status === 'waiting') {
      delete room.players[pid];
      delete this.pc[pid];
      if (Object.keys(room.players).length === 0) {
        delete this.rooms[room.id];
      } else {
        if (room.hostId === pid) {
          room.hostId = Object.keys(room.players)[0];
        }
        this._sendRoomInfo(room.id);
      }
    } else {
      // Game in progress - keep player, broadcast disconnect
      this._broadcast(room.id, 'player_disconnect', { playerId: pid });
      // Set 120s timeout to remove from room
      setTimeout(() => {
        if (room.disconnectedAt[pid]) {
          delete room.disconnectedAt[pid];
          // Player stays in game but actions auto-skip
          // Host transfer if needed
          if (room.hostId === pid) {
            const alivePlayers = Object.entries(room.players).filter(([, p]) => p.alive && p.connected);
            if (alivePlayers.length > 0) room.hostId = alivePlayers[0][0];
          }
        }
      }, 120000);
    }
  }

  // Game action delegates
  nightAction(ws, playerId, roomId, payload) {
    const room = this.rooms[roomId];
    if (room && room.game) room.game.handleAction(playerId, 'night_action', payload);
  }

  speech(ws, playerId, roomId, payload) {
    const room = this.rooms[roomId];
    if (room && room.game) room.game.handleAction(playerId, 'speech', payload);
  }

  skipSpeech(ws, playerId, roomId) {
    const room = this.rooms[roomId];
    if (room && room.game) room.game.handleAction(playerId, 'skip_speech', {});
  }

  vote(ws, playerId, roomId, payload) {
    const room = this.rooms[roomId];
    if (room && room.game) room.game.handleAction(playerId, 'vote', payload);
  }

  hunterShoot(ws, playerId, roomId, payload) {
    const room = this.rooms[roomId];
    if (room && room.game) room.game.handleAction(playerId, 'hunter_shoot', payload);
  }
}

module.exports = { RoomManager };
```

- [ ] **Step 2: Update server/index.js handleDisconnect**

Replace the empty `handleDisconnect` in `server/index.js`:

```js
function handleDisconnect(ws) {
  roomManager.handleDisconnect(ws);
}
```

- [ ] **Step 3: Verify no syntax errors**

Run: `cd ~/werewolf-game && node -c server/RoomManager.js`
Expected: No syntax errors

- [ ] **Step 4: Commit**

```bash
cd ~/werewolf-game
git add -A
git commit -m "feat: RoomManager - room lifecycle, player join/leave, disconnect/reconnect"
```

---

## Task 4: GameStateMachine — Core Game Engine

This is the largest task. The state machine handles all game flow.

**Files:**
- Create: `server/GameStateMachine.js`

- [ ] **Step 1: Implement GameStateMachine**

`server/GameStateMachine.js`:

```js
const { shuffle } = require('./utils');

const ROLE_CONFIG = [
  'werewolf', 'werewolf', 'werewolf',
  'seer', 'witch', 'hunter', 'guard',
  'villager', 'villager', 'villager', 'villager', 'villager'
];

const NIGHT_TIMEOUT = { wolf: 30000, guard: 20000, seer: 20000, witch: 30000 };
const SPEECH_TIMEOUT = 60000;
const VOTE_TIMEOUT = 30000;
const HUNTER_TIMEOUT = 15000;

class GameStateMachine {
  constructor(room, roomManager) {
    this.room = room;
    this.rm = roomManager;
    this.timers = [];
  }

  get players() { return this.room.players; }
  get gs() { return this.room.game; }

  _send(pid, action, payload) {
    const conn = this.rm.pc[pid];
    if (conn && conn.ws.readyState === 1) {
      conn.ws.send(JSON.stringify({ type: 'event', action, payload }));
    }
  }

  _broadcast(action, payload) {
    this.rm._broadcast(this.room.id, action, payload);
  }

  _clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  _setTimeout(fn, ms) {
    const t = setTimeout(fn, ms);
    this.timers.push(t);
    return t;
  }

  _alivePlayers() {
    return Object.values(this.players).filter(p => p.alive);
  }

  _aliveByRole(role) {
    return Object.values(this.players).filter(p => p.alive && p.role === role);
  }

  _checkWin() {
    const alive = this._alivePlayers();
    const wolves = alive.filter(p => p.role === 'werewolf');
    const villagers = alive.filter(p => p.role !== 'werewolf');
    if (wolves.length === 0) return 'villager';
    if (villagers.length <= wolves.length) return 'wolf';
    return null;
  }

  _endGame(winner) {
    this._clearTimers();
    this.room.status = 'finished';
    const players = {};
    for (const [pid, p] of Object.entries(this.players)) {
      players[pid] = { id: p.id, name: p.name, role: p.role, alive: p.alive, seatNum: p.seatNum };
    }
    this._broadcast('game_over', { winner, players });
  }

  start() {
    // Assign roles
    const pids = Object.keys(this.players);
    const roles = shuffle(ROLE_CONFIG);
    for (let i = 0; i < pids.length; i++) {
      this.players[pids[i]].role = roles[i];
    }

    this._broadcast('game_started', {});

    // Send each player their role privately
    for (const [pid, p] of Object.entries(this.players)) {
      const teammateIds = p.role === 'werewolf'
        ? Object.entries(this.players).filter(([id, pl]) => pl.role === 'werewolf' && id !== pid).map(([id]) => id)
        : [];
      this._send(pid, 'your_role', { role: p.role, teammateIds });
    }

    // Initialize game state
    this.room.game = {
      phase: 'night',
      dayNum: 1,
      step: 'wolf',
      nightActions: {
        wolfVotes: {},
        wolfTarget: null,
        guardTarget: null,
        witchHealTarget: null,
        witchPoisonTarget: null,
        seerTarget: null,
        seerResult: null
      },
      votes: {},
      witchHealUsed: false,
      witchPoisonUsed: false,
      lastGuardTarget: null,
      currentSpeakerIndex: 0,
      speeches: [],
      deadThisNight: [],
      hunterPending: false,
      log: []
    };

    // Start first night
    this._startNight();
  }

  _startNight() {
    const gs = this.gs;
    gs.phase = 'night';
    gs.step = 'wolf';
    gs.nightActions = {
      wolfVotes: {}, wolfTarget: null, guardTarget: null,
      witchHealTarget: null, witchPoisonTarget: null,
      seerTarget: null, seerResult: null
    };
    gs.deadThisNight = [];
    gs.log.push({ dayNum: gs.dayNum, phase: 'night', event: 'night_start', data: {} });

    this._broadcast('phase_change', { phase: 'night', dayNum: gs.dayNum, step: 'wolf' });
    this._startWolfPhase();
  }

  // --- Night phases ---

  _startWolfPhase() {
    const wolves = this._aliveByRole('werewolf');
    for (const w of wolves) {
      if (w.connected) {
        this._send(w.id, 'your_turn', { action: 'wolf_kill', timeLeft: 30, targets: this._alivePlayers().filter(p => p.role !== 'werewolf').map(p => ({ id: p.id, name: p.name, seatNum: p.seatNum })) });
      }
    }
    this._setTimeout(() => this._resolveWolf(), NIGHT_TIMEOUT.wolf);
  }

  _resolveWolf() {
    const gs = this.gs;
    const votes = gs.nightActions.wolfVotes;
    const wolfPids = this._aliveByRole('werewolf').map(w => w.id);

    if (Object.keys(votes).length === 0) {
      gs.nightActions.wolfTarget = null;
    } else {
      // Count votes
      const counts = {};
      for (const target of Object.values(votes)) {
        counts[target] = (counts[target] || 0) + 1;
      }
      const maxVotes = Math.max(...Object.values(counts));
      const topTargets = Object.entries(counts).filter(([, c]) => c === maxVotes).map(([id]) => id);
      gs.nightActions.wolfTarget = topTargets[Math.floor(Math.random() * topTargets.length)];
    }

    gs.step = 'guard';
    this._broadcast('phase_change', { phase: 'night', dayNum: gs.dayNum, step: 'guard' });
    this._startGuardPhase();
  }

  _startGuardPhase() {
    const guards = this._aliveByRole('guard');
    if (guards.length === 0) { this._resolveGuard(); return; }
    const guard = guards[0];
    if (!guard.connected) { this._resolveGuard(); return; }
    const targets = this._alivePlayers().filter(p => p.id !== this.gs.lastGuardTarget).map(p => ({ id: p.id, name: p.name, seatNum: p.seatNum }));
    this._send(guard.id, 'your_turn', { action: 'guard', timeLeft: 20, targets });
    this._setTimeout(() => this._resolveGuard(), NIGHT_TIMEOUT.guard);
  }

  _resolveGuard() {
    this.gs.step = 'seer';
    this._broadcast('phase_change', { phase: 'night', dayNum: this.gs.dayNum, step: 'seer' });
    this._startSeerPhase();
  }

  _startSeerPhase() {
    const seers = this._aliveByRole('seer');
    if (seers.length === 0) { this._resolveSeer(); return; }
    const seer = seers[0];
    if (!seer.connected) { this._resolveSeer(); return; }
    const targets = this._alivePlayers().filter(p => p.id !== seer.id).map(p => ({ id: p.id, name: p.name, seatNum: p.seatNum }));
    this._send(seer.id, 'your_turn', { action: 'seer_check', timeLeft: 20, targets });
    this._setTimeout(() => this._resolveSeer(), NIGHT_TIMEOUT.seer);
  }

  _resolveSeer() {
    const gs = this.gs;
    // Process seer result
    if (gs.nightActions.seerTarget) {
      const target = this.players[gs.nightActions.seerTarget];
      if (target) {
        gs.nightActions.seerResult = target.role === 'werewolf';
        const seers = this._aliveByRole('seer');
        if (seers.length > 0) {
          this._send(seers[0].id, 'seer_result', { targetId: gs.nightActions.seerTarget, isWolf: gs.nightActions.seerResult });
        }
      }
    }

    gs.step = 'witch';
    this._broadcast('phase_change', { phase: 'night', dayNum: gs.dayNum, step: 'witch' });
    this._startWitchPhase();
  }

  _startWitchPhase() {
    const witches = this._aliveByRole('witch');
    if (witches.length === 0) { this._resolveWitch(); return; }
    const witch = witches[0];
    if (!witch.connected) { this._resolveWitch(); return; }

    const gs = this.gs;
    const info = { killedId: gs.nightActions.wolfTarget, healAvailable: !gs.witchHealUsed, poisonAvailable: !gs.witchPoisonUsed };
    this._send(witch.id, 'witch_info', info);

    const targets = this._alivePlayers().filter(p => p.id !== witch.id).map(p => ({ id: p.id, name: p.name, seatNum: p.seatNum }));
    this._send(witch.id, 'your_turn', { action: 'witch', timeLeft: 30, targets, healAvailable: info.healAvailable, poisonAvailable: info.poisonAvailable });
    this._setTimeout(() => this._resolveWitch(), NIGHT_TIMEOUT.witch);
  }

  _resolveWitch() {
    this._nightResolve();
  }

  _nightResolve() {
    const gs = this.gs;
    const dead = [];
    let wolfTarget = gs.nightActions.wolfTarget;

    if (wolfTarget) {
      const savedByGuard = gs.nightActions.guardTarget === wolfTarget;
      const savedByWitch = gs.nightActions.witchHealTarget === wolfTarget;

      if (savedByGuard && savedByWitch) {
        // 同守双死 - both saved, player still dies
        dead.push({ id: wolfTarget, cause: 'wolf' });
      } else if (savedByGuard || savedByWitch) {
        // Saved by one protection
      } else {
        dead.push({ id: wolfTarget, cause: 'wolf' });
      }
    }

    // Witch poison
    if (gs.nightActions.witchPoisonTarget) {
      const poisoned = gs.nightActions.witchPoisonTarget;
      if (!dead.find(d => d.id === poisoned)) {
        dead.push({ id: poisoned, cause: 'poison' });
      }
    }

    // Apply deaths
    for (const d of dead) {
      this.players[d.id].alive = false;
      gs.deadThisNight.push(d.id);
    }

    // Update witch usage
    if (gs.nightActions.witchHealTarget) gs.witchHealUsed = true;
    if (gs.nightActions.witchPoisonTarget) gs.witchPoisonUsed = true;
    gs.lastGuardTarget = gs.nightActions.guardTarget;

    // Announce deaths
    this._broadcast('death_announce', { deadIds: dead.map(d => d.id) });
    gs.log.push({ dayNum: gs.dayNum, phase: 'night', event: 'deaths', data: { deadIds: dead.map(d => d.id) } });

    // Check hunter trigger
    const hunterDead = dead.find(d => this.players[d.id].role === 'hunter');
    if (hunterDead && hunterDead.cause !== 'poison') {
      gs.hunterPending = true;
      gs.step = 'hunter_trigger';
      this._broadcast('phase_change', { phase: 'night', dayNum: gs.dayNum, step: 'hunter_trigger' });
      this._send(hunterDead.id, 'hunter_trigger', { timeLeft: 15, targets: this._alivePlayers().map(p => ({ id: p.id, name: p.name, seatNum: p.seatNum })) });
      this._setTimeout(() => this._resolveHunter(), HUNTER_TIMEOUT);
      return;
    }

    this._afterNightResolve();
  }

  _resolveHunter() {
    // Hunter didn't shoot or timed out
    this.gs.hunterPending = false;
    this._afterNightResolve();
  }

  _afterNightResolve() {
    const winner = this._checkWin();
    if (winner) { this._endGame(winner); return; }

    // Transition to day
    this._startDay();
  }

  // --- Day phases ---

  _startDay() {
    const gs = this.gs;
    gs.phase = 'day';
    gs.step = 'day_start';
    gs.speeches = [];
    gs.log.push({ dayNum: gs.dayNum, phase: 'day', event: 'day_start', data: {} });

    this._broadcast('phase_change', { phase: 'day', dayNum: gs.dayNum, step: 'day_start' });

    // Short pause then start speeches
    this._setTimeout(() => {
      gs.step = 'speech';
      gs.currentSpeakerIndex = 0;
      this._broadcast('phase_change', { phase: 'day', dayNum: gs.dayNum, step: 'speech' });
      this._nextSpeaker();
    }, 3000);
  }

  _nextSpeaker() {
    const gs = this.gs;
    const alive = this._alivePlayers().sort((a, b) => a.seatNum - b.seatNum);

    // Find next alive player starting from currentSpeakerIndex
    while (gs.currentSpeakerIndex < alive.length) {
      const speaker = alive[gs.currentSpeakerIndex];
      if (speaker.alive) {
        this._send(speaker.id, 'your_turn', { action: 'speech', timeLeft: 60 });
        this._setTimeout(() => {
          // Auto-skip after timeout
          this._broadcast('speech_message', { playerId: speaker.id, name: speaker.name, message: '' });
          gs.speeches.push({ playerId: speaker.id, message: '', order: speaker.seatNum });
          gs.currentSpeakerIndex++;
          this._nextSpeaker();
        }, SPEECH_TIMEOUT);
        return;
      }
      gs.currentSpeakerIndex++;
    }

    // All speakers done
    this._broadcast('speech_end', {});
    this._startVote();
  }

  _startVote() {
    const gs = this.gs;
    gs.step = 'vote';
    gs.votes = {};

    this._broadcast('phase_change', { phase: 'day', dayNum: gs.dayNum, step: 'vote' });

    const alive = this._alivePlayers();
    const targets = alive.map(p => ({ id: p.id, name: p.name, seatNum: p.seatNum }));
    for (const p of alive) {
      if (p.connected) {
        this._send(p.id, 'your_turn', { action: 'vote', timeLeft: 30, targets });
      }
    }
    this._setTimeout(() => this._resolveVote(), VOTE_TIMEOUT);
  }

  _resolveVote() {
    const gs = this.gs;
    gs.step = 'vote_resolve';

    // Count votes
    const counts = {};
    for (const [voter, target] of Object.entries(gs.votes)) {
      if (target) counts[target] = (counts[target] || 0) + 1;
    }

    let eliminated = null;
    if (Object.keys(counts).length > 0) {
      const maxVotes = Math.max(...Object.values(counts));
      const topTargets = Object.entries(counts).filter(([, c]) => c === maxVotes).map(([id]) => id);
      if (topTargets.length === 1) {
        eliminated = topTargets[0];
      }
      // Tie = nobody eliminated
    }

    this._broadcast('vote_result', { votes: gs.votes, eliminated });
    gs.log.push({ dayNum: gs.dayNum, phase: 'day', event: 'vote', data: { votes: gs.votes, eliminated } });

    if (eliminated) {
      this.players[eliminated].alive = false;
      this._broadcast('death_announce', { deadIds: [eliminated] });

      // Check hunter
      if (this.players[eliminated].role === 'hunter') {
        gs.hunterPending = true;
        gs.step = 'hunter_trigger';
        this._broadcast('phase_change', { phase: 'day', dayNum: gs.dayNum, step: 'hunter_trigger' });
        this._send(eliminated, 'hunter_trigger', { timeLeft: 15, targets: this._alivePlayers().map(p => ({ id: p.id, name: p.name, seatNum: p.seatNum })) });
        this._setTimeout(() => this._resolveHunterVote(), HUNTER_TIMEOUT);
        return;
      }
    }

    this._afterVoteResolve();
  }

  _resolveHunterVote() {
    this.gs.hunterPending = false;
    this._afterVoteResolve();
  }

  _afterVoteResolve() {
    const winner = this._checkWin();
    if (winner) { this._endGame(winner); return; }

    // Next night
    this.gs.dayNum++;
    this._startNight();
  }

  // --- Action handler ---

  handleAction(playerId, actionType, payload) {
    const gs = this.gs;
    if (!gs) return;

    const player = this.players[playerId];
    if (!player) return;
    if (!player.alive && actionType !== 'hunter_shoot') return;

    switch (actionType) {
      case 'night_action':
        this._handleNightAction(playerId, payload);
        break;
      case 'speech':
        this._handleSpeech(playerId, payload);
        break;
      case 'skip_speech':
        this._handleSkipSpeech(playerId);
        break;
      case 'vote':
        this._handleVote(playerId, payload);
        break;
      case 'hunter_shoot':
        this._handleHunterShoot(playerId, payload);
        break;
    }
  }

  _handleNightAction(playerId, payload) {
    const gs = this.gs;
    const player = this.players[playerId];

    switch (payload.action) {
      case 'wolf_kill':
        if (player.role !== 'werewolf' || gs.step !== 'wolf') return;
        gs.nightActions.wolfVotes[playerId] = payload.targetId;
        // Broadcast vote info to other wolves
        const wolves = this._aliveByRole('werewolf');
        for (const w of wolves) {
          this._send(w.id, 'wolf_vote_info', { votes: gs.nightActions.wolfVotes });
        }
        // Check if all wolves voted
        if (Object.keys(gs.nightActions.wolfVotes).length === wolves.length) {
          this._clearTimers();
          this._resolveWolf();
        }
        break;

      case 'guard':
        if (player.role !== 'guard' || gs.step !== 'guard') return;
        gs.nightActions.guardTarget = payload.targetId || null;
        this._clearTimers();
        this._resolveGuard();
        break;

      case 'seer_check':
        if (player.role !== 'seer' || gs.step !== 'seer') return;
        gs.nightActions.seerTarget = payload.targetId || null;
        this._clearTimers();
        this._resolveSeer();
        break;

      case 'witch':
        if (player.role !== 'witch' || gs.step !== 'witch') return;
        // Mutually exclusive: can only use heal OR poison, not both
        if (payload.healTarget && !gs.witchHealUsed) {
          gs.nightActions.witchHealTarget = payload.healTarget;
          gs.nightActions.witchPoisonTarget = null;
        } else if (payload.poisonTarget && !gs.witchPoisonUsed) {
          gs.nightActions.witchPoisonTarget = payload.poisonTarget;
          gs.nightActions.witchHealTarget = null;
        }
        this._clearTimers();
        this._resolveWitch();
        break;
    }
  }

  _handleSpeech(playerId, payload) {
    const gs = this.gs;
    if (gs.step !== 'speech') return;
    const alive = this._alivePlayers().sort((a, b) => a.seatNum - b.seatNum);
    const currentSpeaker = alive[gs.currentSpeakerIndex];
    if (!currentSpeaker || currentSpeaker.id !== playerId) return;

    this._clearTimers();
    this._broadcast('speech_message', { playerId, name: this.players[playerId].name, message: payload.message || '' });
    gs.speeches.push({ playerId, message: payload.message || '', order: currentSpeaker.seatNum });
    gs.currentSpeakerIndex++;
    this._nextSpeaker();
  }

  _handleSkipSpeech(playerId) {
    this._handleSpeech(playerId, { message: '' });
  }

  _handleVote(playerId, payload) {
    const gs = this.gs;
    if (gs.step !== 'vote') return;
    gs.votes[playerId] = payload.targetId || null;

    // Check if all alive players voted
    const aliveCount = this._alivePlayers().length;
    if (Object.keys(gs.votes).length >= aliveCount) {
      this._clearTimers();
      this._resolveVote();
    }
  }

  _handleHunterShoot(playerId, payload) {
    const gs = this.gs;
    if (!gs.hunterPending) return;
    if (this.players[playerId].role !== 'hunter') return;

    gs.hunterPending = false;
    this._clearTimers();

    const targetId = payload.targetId;
    if (targetId && this.players[targetId] && this.players[targetId].alive) {
      this.players[targetId].alive = false;
      this._broadcast('death_announce', { deadIds: [targetId] });
      gs.log.push({ dayNum: gs.dayNum, phase: gs.phase, event: 'hunter_shoot', data: { hunterId: playerId, targetId } });
    }

    // Continue game flow based on where hunter was triggered
    const winner = this._checkWin();
    if (winner) { this._endGame(winner); return; }

    if (gs.phase === 'night') {
      this._afterNightResolve();
    } else {
      this._afterVoteResolve();
    }
  }

  // Send current state to reconnecting player
  sendCurrentState(playerId) {
    const gs = this.gs;
    if (!gs) return;
    const player = this.players[playerId];
    if (!player) return;

    // Re-send role
    const teammateIds = player.role === 'werewolf'
      ? Object.entries(this.players).filter(([id, p]) => p.role === 'werewolf' && id !== playerId).map(([id]) => id)
      : [];
    this._send(playerId, 'your_role', { role: player.role, teammateIds });

    // Send current phase
    this._send(playerId, 'phase_change', { phase: gs.phase, dayNum: gs.dayNum, step: gs.step });

    // If it's their turn, re-notify
    if (gs.step === 'wolf' && player.role === 'werewolf' && player.alive) {
      this._send(playerId, 'your_turn', { action: 'wolf_kill', timeLeft: 15, targets: this._alivePlayers().filter(p => p.role !== 'werewolf').map(p => ({ id: p.id, name: p.name, seatNum: p.seatNum })) });
      this._send(playerId, 'wolf_vote_info', { votes: gs.nightActions.wolfVotes });
    } else if (gs.step === 'guard' && player.role === 'guard' && player.alive) {
      this._send(playerId, 'your_turn', { action: 'guard', timeLeft: 15, targets: this._alivePlayers().filter(p => p.id !== gs.lastGuardTarget).map(p => ({ id: p.id, name: p.name, seatNum: p.seatNum })) });
    } else if (gs.step === 'seer' && player.role === 'seer' && player.alive) {
      this._send(playerId, 'your_turn', { action: 'seer_check', timeLeft: 15, targets: this._alivePlayers().filter(p => p.id !== playerId).map(p => ({ id: p.id, name: p.name, seatNum: p.seatNum })) });
    } else if (gs.step === 'witch' && player.role === 'witch' && player.alive) {
      this._send(playerId, 'witch_info', { killedId: gs.nightActions.wolfTarget, healAvailable: !gs.witchHealUsed, poisonAvailable: !gs.witchPoisonUsed });
      this._send(playerId, 'your_turn', { action: 'witch', timeLeft: 15, targets: this._alivePlayers().filter(p => p.id !== playerId).map(p => ({ id: p.id, name: p.name, seatNum: p.seatNum })) });
    }
  }
}

module.exports = { GameStateMachine };
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd ~/werewolf-game && node -c server/GameStateMachine.js`
Expected: No syntax errors

- [ ] **Step 3: Commit**

```bash
cd ~/werewolf-game
git add -A
git commit -m "feat: GameStateMachine - complete game flow with night resolution, voting, hunter"
```

---

## Task 5: Lobby UI

**Files:**
- Modify: `client/src/views/LobbyView.vue`

- [ ] **Step 1: Implement LobbyView**

`client/src/views/LobbyView.vue` — complete lobby with create/join room and player list:

```vue
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
          <div v-for="p in sortedPlayers" :key="p.id" class="player-item" :class="{ 'is-host': p.id === hostId, 'is-me': p.id === state.playerId }">
            <span class="seat">{{ p.seatNum }}</span>
            <span class="name">{{ p.name }}</span>
            <span v-if="p.id === hostId" class="badge host-badge">房主</span>
            <span v-if="p.id === state.playerId" class="badge me-badge">我</span>
            <span class="status" :class="{ ready: p.ready }">{{ p.ready ? '✓ 准备' : '等待中' }}</span>
          </div>
        </div>

        <div class="room-actions">
          <button
            v-if="state.playerId !== hostId"
            class="btn-secondary"
            @click="toggleReady"
          >{{ myPlayer?.ready ? '取消准备' : '准备' }}</button>
          <button
            v-if="state.playerId === hostId"
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
import { ref, computed, inject } from 'vue';
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
const hostId = computed(() => state.hostId);
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

// Watch for game start to switch view
import { watch } from 'vue';
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
```

- [ ] **Step 2: Verify client builds**

Run: `cd ~/werewolf-game/client && npx vite build 2>&1 | head -20`
Expected: Build succeeds (or only warnings about unused vars)

- [ ] **Step 3: Commit**

```bash
cd ~/werewolf-game
git add -A
git commit -m "feat: LobbyView - create/join room, player list, ready toggle"
```

---

## Task 6: Game UI — Layout & Player List

**Files:**
- Modify: `client/src/views/GameView.vue`
- Create: `client/src/components/PlayerList.vue`
- Create: `client/src/components/GameLog.vue`

- [ ] **Step 1: Implement PlayerList component**

`client/src/components/PlayerList.vue`:

```vue
<template>
  <div class="player-list-panel">
    <h3>玩家列表</h3>
    <div class="players">
      <div
        v-for="p in sortedPlayers"
        :key="p.id"
        class="player-item"
        :class="{
          'is-me': p.id === state.playerId,
          'is-dead': !p.alive,
          'is-wolf-teammate': teammateIds.includes(p.id),
          'is-disconnected': !p.connected
        }"
      >
        <span class="seat">{{ p.seatNum }}</span>
        <span class="name">{{ p.name }}</span>
        <span v-if="teammateIds.includes(p.id)" class="role-tag wolf-tag">狼</span>
        <span v-if="!p.alive" class="dead-tag">死亡</span>
        <span v-if="!p.connected" class="dc-tag">断线</span>
        <span v-if="p.id === state.playerId" class="me-tag">我</span>
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
const teammateIds = computed(() => state.teammateIds);
</script>

<style scoped>
.player-list-panel { background: #16213e; border-radius: 12px; padding: 16px; height: 100%; overflow-y: auto; }
h3 { margin-bottom: 12px; font-size: 16px; color: #aaa; }
.players { display: flex; flex-direction: column; gap: 6px; }
.player-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; background: #1a1a2e; font-size: 14px; }
.player-item.is-me { border: 1px solid #e94560; }
.player-item.is-dead { opacity: 0.35; text-decoration: line-through; }
.player-item.is-wolf-teammate { background: #2d1f3d; }
.seat { width: 22px; height: 22px; border-radius: 50%; background: #0f3460; display: flex; align-items: center; justify-content: center; font-size: 11px; }
.name { flex: 1; }
.role-tag, .dead-tag, .dc-tag, .me-tag { font-size: 11px; padding: 1px 5px; border-radius: 3px; }
.wolf-tag { background: #c0392b; color: #fff; }
.dead-tag { background: #555; color: #ccc; }
.dc-tag { background: #7f8c8d; color: #fff; }
.me-tag { background: #0f3460; color: #fff; }
</style>
```

- [ ] **Step 2: Implement GameLog component**

`client/src/components/GameLog.vue`:

```vue
<template>
  <div class="game-log-panel">
    <h3>游戏日志</h3>
    <div class="log-entries" ref="logContainer">
      <div v-for="(entry, i) in state.log" :key="i" class="log-entry">
        <span class="log-day">第{{ entry.dayNum }}天</span>
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

function formatEvent(entry) {
  switch (entry.event) {
    case 'night_start': return '夜幕降临';
    case 'day_start': return '天亮了';
    case 'deaths': return entry.data.deadIds.length > 0 ? `${entry.data.deadIds.length}人倒下` : '平安夜';
    case 'vote': return entry.data.eliminated ? '有人被放逐' : '无人出局';
    case 'hunter_shoot': return '猎人开枪';
    case 'phase_change': return '';
    default: return entry.event;
  }
}
</script>

<style scoped>
.game-log-panel { background: #16213e; border-radius: 12px; padding: 16px; height: 100%; overflow-y: auto; }
h3 { margin-bottom: 12px; font-size: 16px; color: #aaa; }
.log-entries { display: flex; flex-direction: column; gap: 4px; }
.log-entry { font-size: 13px; color: #bbb; display: flex; gap: 6px; }
.log-day { color: #e94560; min-width: 42px; }
.log-phase { color: #888; min-width: 20px; }
.log-event { color: #ccc; }
</style>
```

- [ ] **Step 3: Implement GameView layout**

`client/src/views/GameView.vue`:

```vue
<template>
  <div class="game-container" :class="{ 'night-mode': state.phase === 'night' }">
    <div class="game-header">
      <div class="phase-info">
        <span class="phase-icon">{{ state.phase === 'night' ? '🌙' : '☀️' }}</span>
        <span>第{{ state.dayNum }}天 · {{ phaseLabel }}</span>
      </div>
      <div class="role-info" v-if="state.role">
        <span :class="'role-' + state.role">{{ roleLabel }}</span>
      </div>
    </div>
    <div class="game-body">
      <div class="sidebar-left">
        <PlayerList />
      </div>
      <div class="main-area">
        <ActionPanel v-if="state.step && state.step !== 'day_start'" />
        <div v-else class="waiting">
          <p v-if="state.phase === 'night' && !state.isMyTurn">夜深了，请闭眼等待...</p>
          <p v-else-if="state.step === 'day_start'">天亮了...</p>
        </div>
      </div>
      <div class="sidebar-right">
        <GameLog />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, watch } from 'vue';
import { state } from '../game.js';
import PlayerList from '../components/PlayerList.vue';
import GameLog from '../components/GameLog.vue';
import ActionPanel from '../components/ActionPanel.vue';

const view = inject('view');

const phaseLabel = computed(() => {
  if (!state.step) return '';
  const labels = {
    wolf: '狼人行动', guard: '守卫行动', seer: '预言家行动',
    witch: '女巫行动', night_resolve: '结算中',
    day_start: '天亮了', speech: '发言阶段', vote: '投票阶段',
    vote_resolve: '投票结算', hunter_trigger: '猎人开枪'
  };
  return labels[state.step] || state.step;
});

const roleLabel = computed(() => {
  const labels = { werewolf: '狼人', seer: '预言家', witch: '女巫', hunter: '猎人', guard: '守卫', villager: '村民' };
  return labels[state.role] || state.role;
});

watch(() => state.gameOver, (val) => {
  if (val) view.value = 'result';
});
</script>

<style scoped>
.game-container { height: 100vh; display: flex; flex-direction: column; transition: background 0.5s; }
.game-container.night-mode { background: #0d0d1a; }
.game-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: #16213e; border-bottom: 1px solid #2a2a4e; }
.phase-info { display: flex; align-items: center; gap: 8px; font-size: 18px; }
.phase-icon { font-size: 22px; }
.role-info { font-size: 16px; font-weight: bold; }
.role-werewolf { color: #e74c3c; }
.role-seer { color: #3498db; }
.role-witch { color: #9b59b6; }
.role-hunter { color: #e67e22; }
.role-guard { color: #2ecc71; }
.role-villager { color: #95a5a6; }
.game-body { flex: 1; display: grid; grid-template-columns: 200px 1fr 220px; gap: 12px; padding: 12px; overflow: hidden; }
.sidebar-left, .sidebar-right { overflow-y: auto; }
.main-area { display: flex; flex-direction: column; align-items: center; justify-content: center; }
.waiting { color: #888; font-size: 18px; text-align: center; }
</style>
```

- [ ] **Step 4: Commit**

```bash
cd ~/werewolf-game
git add -A
git commit -m "feat: GameView layout, PlayerList, GameLog components"
```

---

## Task 7: ActionPanel — Night Actions, Chat, Vote

**Files:**
- Modify: `client/src/components/ActionPanel.vue`
- Create: `client/src/components/ChatBox.vue`
- Create: `client/src/components/VotePanel.vue`

- [ ] **Step 1: Implement ChatBox component**

`client/src/components/ChatBox.vue`:

```vue
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
```

- [ ] **Step 2: Implement VotePanel component**

`client/src/components/VotePanel.vue`:

```vue
<template>
  <div class="vote-panel">
    <h3>投票 — 选择要放逐的玩家</h3>
    <div class="vote-grid">
      <button
        v-for="p in alivePlayers"
        :key="p.id"
        class="vote-target"
        :class="{ selected: selected === p.id }"
        @click="selected = p.id"
        :disabled="voted"
      >
        <span class="seat">{{ p.seatNum }}</span>
        {{ p.name }}
      </button>
    </div>
    <div class="vote-actions">
      <button class="btn-primary" @click="submitVote" :disabled="voted || !selected">投票</button>
      <button class="btn-secondary" @click="abstain" :disabled="voted">弃票</button>
    </div>
    <div v-if="state.votes && Object.keys(state.votes).length > 0" class="vote-result">
      <h4>投票结果</h4>
      <div v-for="(target, voter) in state.votes" :key="voter" class="vote-record">
        {{ getPlayerName(voter) }} → {{ target ? getPlayerName(target) : '弃票' }}
      </div>
      <p v-if="state.eliminated" class="eliminated">{{ getPlayerName(state.eliminated) }} 被放逐</p>
      <p v-else-if="Object.keys(state.votes).length > 0" class="no-eliminate">平票，无人出局</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue';
import { state } from '../game.js';

const send = inject('send');
const selected = ref(null);
const voted = ref(false);

const alivePlayers = computed(() =>
  Object.values(state.players).filter(p => p.alive && p.id !== state.playerId).sort((a, b) => a.seatNum - b.seatNum)
);

function getPlayerName(pid) {
  return state.players[pid]?.name || '???';
}

function submitVote() {
  if (!selected.value) return;
  send('vote', { targetId: selected.value });
  voted.value = true;
}

function abstain() {
  send('vote', { targetId: null });
  voted.value = true;
}
</script>

<style scoped>
.vote-panel { width: 100%; max-width: 600px; }
h3 { text-align: center; margin-bottom: 16px; }
.vote-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
.vote-target { padding: 10px; background: #1a1a2e; border: 2px solid #2a2a4e; border-radius: 8px; color: #e0e0e0; font-size: 14px; display: flex; align-items: center; gap: 6px; }
.vote-target:hover:not(:disabled) { border-color: #e94560; }
.vote-target.selected { border-color: #e94560; background: #2d1a2e; }
.seat { width: 20px; height: 20px; border-radius: 50%; background: #0f3460; display: flex; align-items: center; justify-content: center; font-size: 11px; }
.vote-actions { display: flex; gap: 12px; justify-content: center; margin-bottom: 16px; }
.vote-result { background: #1a1a2e; border-radius: 8px; padding: 12px; }
h4 { margin-bottom: 8px; color: #aaa; }
.vote-record { font-size: 13px; padding: 2px 0; }
.eliminated { color: #e94560; font-weight: bold; margin-top: 8px; }
.no-eliminate { color: #888; margin-top: 8px; }
</style>
```

- [ ] **Step 3: Implement ActionPanel — the central action hub**

`client/src/components/ActionPanel.vue`:

```vue
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

// Reset on phase/step change
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
const guardTargets = computed(() => alivePlayers.value); // server handles lastGuardTarget filter
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
```

- [ ] **Step 4: Commit**

```bash
cd ~/werewolf-game
git add -A
git commit -m "feat: ActionPanel, ChatBox, VotePanel - all game interaction UI"
```

---

## Task 8: ResultView — Game Over Screen

**Files:**
- Modify: `client/src/views/ResultView.vue`

- [ ] **Step 1: Implement ResultView**

`client/src/views/ResultView.vue`:

```vue
<template>
  <div class="result-container">
    <div class="result-card">
      <h1 class="winner-title" :class="winnerClass">
        {{ state.gameOver?.winner === 'wolf' ? '🐺 狼人胜利' : '👨‍🌾 好人胜利' }}
      </h1>
      <div class="players-reveal">
        <div v-for="p in sortedPlayers" :key="p.id" class="reveal-item" :class="{ 'is-dead': !p.alive }">
          <span class="seat">{{ p.seatNum }}</span>
          <span class="name">{{ p.name }}</span>
          <span :class="'role-tag role-' + p.role">{{ roleLabels[p.role] || p.role }}</span>
          <span v-if="!p.alive" class="dead-tag">死亡</span>
          <span v-else class="alive-tag">存活</span>
        </div>
      </div>
      <button class="btn-secondary" @click="backToLobby">返回大厅</button>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue';
import { state, resetState } from '../game.js';

const view = inject('view');
const send = inject('send');

const sortedPlayers = computed(() => {
  if (!state.gameOver?.players) return [];
  return Object.values(state.gameOver.players).sort((a, b) => a.seatNum - b.seatNum);
});

const winnerClass = computed(() => state.gameOver?.winner === 'wolf' ? 'wolf-win' : 'villager-win');

const roleLabels = { werewolf: '狼人', seer: '预言家', witch: '女巫', hunter: '猎人', guard: '守卫', villager: '村民' };

function backToLobby() {
  resetState();
  view.value = 'lobby';
}
</script>

<style scoped>
.result-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
.result-card { background: #16213e; border-radius: 16px; padding: 40px; width: 100%; max-width: 550px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
.winner-title { text-align: center; font-size: 32px; margin-bottom: 24px; }
.wolf-win { color: #e74c3c; }
.villager-win { color: #3498db; }
.players-reveal { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
.reveal-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #1a1a2e; border-radius: 8px; }
.reveal-item.is-dead { opacity: 0.5; }
.seat { width: 24px; height: 24px; border-radius: 50%; background: #0f3460; display: flex; align-items: center; justify-content: center; font-size: 12px; }
.name { flex: 1; }
.role-tag { font-size: 13px; padding: 2px 8px; border-radius: 4px; font-weight: bold; }
.role-werewolf { background: #5c1a1a; color: #e74c3c; }
.role-seer { background: #1a2a5c; color: #3498db; }
.role-witch { background: #3a1a5c; color: #9b59b6; }
.role-hunter { background: #5c3a1a; color: #e67e22; }
.role-guard { background: #1a5c2a; color: #2ecc71; }
.role-villager { background: #333; color: #95a5a6; }
.dead-tag { font-size: 12px; color: #c0392b; }
.alive-tag { font-size: 12px; color: #27ae60; }
button { display: block; margin: 0 auto; padding: 12px 32px; font-size: 16px; }
</style>
```

- [ ] **Step 2: Commit**

```bash
cd ~/werewolf-game
git add -A
git commit -m "feat: ResultView - game over screen with role reveal"
```

---

## Task 9: Integration & Fixup

**Files:**
- Modify: `server/index.js` (WebSocket path, CORS)
- Modify: `client/vite.config.js` (dev proxy)
- Modify: `client/src/composables/useWebSocket.js` (fix WS URL)

- [ ] **Step 1: Fix WebSocket URL in useWebSocket.js**

The client needs to connect to the correct WebSocket URL. In dev mode, Vite proxies `/ws` to the server. In production, same origin.

Update `client/src/composables/useWebSocket.js` — change the `connect` function:

```js
  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = location.host;
    ws = new WebSocket(`${protocol}//${host}/ws`);
    // ... rest stays the same
  }
```

- [ ] **Step 2: Update server to handle /ws path**

Update `server/index.js` — change WebSocket upgrade path:

```js
const wss = new WebSocketServer({ server, path: '/ws' });
```

- [ ] **Step 3: Build client and test full flow**

Run:
```bash
cd ~/werewolf-game/client && npx vite build
cd ~/werewolf-game && node server/index.js &
sleep 2
curl -s http://localhost:3000/ | head -5
kill %1
```

Expected: HTML response from built client

- [ ] **Step 4: Commit**

```bash
cd ~/werewolf-game
git add -A
git commit -m "fix: WebSocket path, dev proxy, integration fixes"
```

---

## Task 10: Polish & Final Testing

**Files:**
- Various minor fixes across components

- [ ] **Step 1: Test full game flow with 2 browser tabs**

Manual test checklist:
1. Open 12 browser tabs to `http://localhost:5173`
2. Tab 1: Create room, note room ID
3. Other tabs: Join room with same room ID
4. All players click "准备"
5. Tab 1 (host): Click "开始游戏"
6. Verify: All tabs show game view with their role
7. Night phase: Wolf selects target, guard guards, seer checks, witch acts
8. Day phase: Players speak in order, then vote
9. Game continues until win condition met
10. Result screen shows all roles

- [ ] **Step 2: Fix any issues found during testing**

Address bugs discovered in manual testing.

- [ ] **Step 3: Final commit**

```bash
cd ~/werewolf-game
git add -A
git commit -m "feat: polish and integration testing fixes"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Project scaffolding | package.json, server/index.js, client/ |
| 2 | WebSocket + message router | useWebSocket.js, game.js, server/index.js |
| 3 | RoomManager | server/RoomManager.js |
| 4 | GameStateMachine | server/GameStateMachine.js |
| 5 | Lobby UI | LobbyView.vue |
| 6 | Game layout | GameView.vue, PlayerList.vue, GameLog.vue |
| 7 | Action panels | ActionPanel.vue, ChatBox.vue, VotePanel.vue |
| 8 | Result screen | ResultView.vue |
| 9 | Integration fixup | WebSocket paths, dev proxy |
| 10 | Polish & test | Bug fixes |
