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

  if (!ws) connect();

  return { send, connected, disconnect };
}
