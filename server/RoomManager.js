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
        conn.ws.send(JSON.stringify({ type: 'event', action, payload }));
      }
    }
  }

  _sendRoomInfo(roomId) {
    const room = this.rooms[roomId];
    if (!room) return;
    const players = {};
    for (const [pid, p] of Object.entries(room.players)) {
      players[pid] = { id: p.id, name: p.name, avatar: p.avatar, seatNum: p.seatNum, alive: p.alive, ready: p.ready, connected: p.connected, isBot: p.isBot || false };
    }
    this._broadcast(roomId, 'room_info', { players, status: room.status, hostId: room.hostId, roomId: room.id, playerCount: room.playerCount, hasPassword: !!room.password });
  }

  createRoom(ws, name, avatar, password) {
    const playerId = generateId();
    let roomId = generateRoomId();
    while (this.rooms[roomId]) { roomId = generateRoomId(); }

    this.pc[playerId] = { ws, roomId };

    this.rooms[roomId] = {
      id: roomId,
      hostId: playerId,
      players: {
        [playerId]: { id: playerId, name, avatar, role: null, seatNum: 1, alive: true, ready: false, connected: true }
      },
      game: null,
      status: 'waiting',
      disconnectedAt: {},
      password: password || null,
      playerCount: 12
    };

    ws.send(JSON.stringify({ type: 'event', action: 'room_created', payload: { playerId, roomId } }));
    this._sendRoomInfo(roomId);
  }

  joinRoom(ws, roomId, name, avatar, password) {
    const room = this.rooms[roomId];
    if (!room) { ws.send(JSON.stringify({ type: 'error', action: 'error', payload: { message: '房间不存在' } })); return; }
    if (room.status !== 'waiting') { ws.send(JSON.stringify({ type: 'error', action: 'error', payload: { message: '游戏已开始' } })); return; }
    if (room.password && room.password !== password) { ws.send(JSON.stringify({ type: 'error', action: 'error', payload: { message: '房间密码错误' } })); return; }
    if (Object.keys(room.players).length >= room.playerCount) { ws.send(JSON.stringify({ type: 'error', action: 'error', payload: { message: '房间已满' } })); return; }

    const playerId = generateId();
    const seatNum = Object.keys(room.players).length + 1;
    this.pc[playerId] = { ws, roomId };
    room.players[playerId] = { id: playerId, name, avatar, role: null, seatNum, alive: true, ready: false, connected: true };

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

  startGame(ws, playerId, roomId, testMode = false, playerCount) {
    const room = this.rooms[roomId];
    if (!room || room.hostId !== playerId) {
      ws.send(JSON.stringify({ type: 'error', action: 'error', payload: { message: '只有房主可以开始游戏' } }));
      return;
    }

    const validCounts = [6, 8, 9, 10, 12];
    if (playerCount && validCounts.includes(playerCount)) {
      room.playerCount = playerCount;
    }

    const playerList = Object.values(room.players);

    if (testMode) {
      const BOT_NAMES = ['影', '风', '雷', '雾', '霜', '月', '星', '雪', '云', '电', '雨'];
      const BOT_AVATARS = ['🐺','🌙','⚔️','🛡️','🔮','🧪','🏹','🎭','🗡️','🏰','💀'];
      let botIdx = 0;
      while (Object.keys(room.players).length < room.playerCount) {
        const botId = 'bot_' + generateId();
        const seatNum = Object.keys(room.players).length + 1;
        room.players[botId] = {
          id: botId, name: BOT_NAMES[botIdx] || `机器人${botIdx + 1}`, avatar: BOT_AVATARS[botIdx] || '❓',
          role: null, seatNum, alive: true, ready: true, connected: true, isBot: true
        };
        botIdx++;
      }
      this._sendRoomInfo(roomId);
    } else {
      if (playerList.length !== room.playerCount) {
        ws.send(JSON.stringify({ type: 'error', action: 'error', payload: { message: `需要${room.playerCount}名玩家` } }));
        return;
      }
      if (!playerList.every(p => p.ready)) {
        ws.send(JSON.stringify({ type: 'error', action: 'error', payload: { message: '所有玩家必须准备' } }));
        return;
      }
    }

    room.status = 'playing';
    const fsm = new GameStateMachine(room, this, room.playerCount);
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

    if (room.game) {
      room.game.sendCurrentState(playerId);
    }
  }

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
      this._broadcast(room.id, 'player_disconnect', { playerId: pid });
      setTimeout(() => {
        if (room.disconnectedAt[pid]) {
          delete room.disconnectedAt[pid];
          if (room.hostId === pid) {
            const alivePlayers = Object.entries(room.players).filter(([, p]) => p.alive && p.connected);
            if (alivePlayers.length > 0) room.hostId = alivePlayers[0][0];
          }
        }
      }, 120000);
    }
  }

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
