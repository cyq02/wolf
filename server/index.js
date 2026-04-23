const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { RoomManager } = require('./RoomManager');

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

const rooms = {};
const playerConnections = {};
const roomManager = new RoomManager(rooms, playerConnections);

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

function handleDisconnect(ws) {
  roomManager.handleDisconnect(ws);
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
