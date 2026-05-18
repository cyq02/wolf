# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Run both server and client concurrently (dev mode)
npm run dev

# Server only (port 3000)
npm run dev:server

# Client only (port 5180, proxies /ws to server)
npm run dev:client

# Production build (client only, outputs to client/dist)
npm run build

# Start production server (serves client/dist statically)
npm start
```

There are no tests or linting configured.

## Architecture

**Werewolf (狼人杀) web game** — real-time multiplayer with server-authoritative state.

### Server (`server/`)
- **`index.js`** — HTTP server (serves static files from `client/dist` in production) + WebSocket server at `/ws`. Routes JSON messages to RoomManager via action switch.
- **`RoomManager.js`** — Room lifecycle: create, join, ready, disconnect, reconnect. Holds `rooms{}` and `playerConnections{}` maps. Manages player state and delegates game flow to GameStateMachine.
- **`GameStateMachine.js`** — Core game engine. Phase-based state machine driving the full game loop: night phases (wolf→guard→seer→witch) → day phases (speech→vote) → resolution. Handles bot auto-actions, timeouts, win conditions, hunter trigger.
- **`utils.js`** — Shared constants (role configs, timeouts).

### Client (`client/src/`)
- **`game.js`** — Single `reactive()` state object shared across all components. The source of truth for client-side state. Includes `resetState()` for returning to lobby.
- **`composables/useWebSocket.js`** — WebSocket connection singleton. Sends actions (`{type, action, payload, playerId, roomId}`), receives events that mutate `state` directly via `handleMessage` switch.
- **`App.vue`** — Root component, provides `send` function and `view` ref via inject/provide pattern.
- **Views**: `LobbyView.vue` → `GameView.vue` → `ResultView.vue` — switched via `view` ref.
- **Components**: `PlayerList.vue`, `ChatBox.vue`, `VotePanel.vue`, `GameLog.vue`, `ActionPanel.vue` — composed inside GameView's three-column grid.

### Key patterns
- **No build step for server** — plain Node.js, uses `require()`.
- **No Vue Router** — view switching is manual via a `view` reactive ref with inject/provide.
- **No Vuex/Pinia** — `game.js` exports a single `reactive()` object; components import and read/mutate directly.
- **WebSocket message format**: `{type: 'action'|'event', action: string, payload: object, playerId: string, roomId: string}`.
- **Test mode**: Client sends `testMode: true` with `start_game`. Server fills empty seats with bot players (`isBot` flag) that auto-act with randomized delays.

### Solo testing
Start the dev server, open browser, create a room with any name, check the "单人测试" checkbox, and start. Bots fill all empty seats and auto-play all roles.

## UI Theme

Gothic dark fantasy aesthetic inspired by NetEase Werewolf (langrensha.163.com):
- Deep dark backgrounds (#0a0a18), gold accents (#d4a84b), serif font (Noto Serif SC)
- CSS-only atmospheric effects: moon, stars (radial-gradient), fog, twinkle animations
- SVG ring countdown timer, phase transition overlays, death announcement banners
- Scoped styles in each `.vue` file; global base styles in `client/src/styles.css`
