# 在线狼人杀游戏 - 设计文档

## 概述

一个基于 Web 的经典 12 人狼人杀在线联机游戏。使用 Node.js + WebSocket 构建服务端权威状态机，Vue 3 构建前端 UI。采用房间制，玩家输入昵称创建或加入房间开始游戏。

## 技术栈

- **后端**: Node.js 18 + `ws` 库（WebSocket）
- **前端**: Vue 3 + Vite
- **通信**: WebSocket JSON 消息
- **数据**: 纯内存，无数据库

## 架构：服务端权威状态机

所有游戏逻辑在服务端执行，客户端只做 UI 展示和操作发送。每个玩家收到的信息经过过滤——只能看到自己该看到的内容。

```
[Vue 3 前端] ←──WebSocket──→ [Node.js 服务端] ←──WebSocket──→ [Vue 3 前端]
                                    │
                              [游戏状态机]
                              [房间管理器]
                              [玩家管理]
```

## 游戏配置（12人标准局）

| 角色 | 数量 | 能力 |
|------|------|------|
| 狼人 | 3 | 夜晚选择击杀一名玩家，狼人互相认识 |
| 预言家 | 1 | 夜晚查验一名玩家身份（好人/狼人） |
| 女巫 | 1 | 一瓶解药（救人）、一瓶毒药（杀人），各用一次 |
| 猎人 | 1 | 被杀或被投票出局时可开枪带走一人 |
| 守卫 | 1 | 夜晚守护一名玩家，不能连续两晚守同一人 |
| 村民 | 3 | 无特殊技能，白天参与讨论投票 |

## 游戏流程状态机

```
LOBBY → ROLE_ASSIGN →
  [循环] → NIGHT_START → WOLF_TURN → SEER_TURN → WITCH_TURN → GUARD_TURN → NIGHT_RESOLVE →
          DAY_START → SPEECH → VOTE → VOTE_RESOLVE →
  [判断胜负] → GAME_OVER
```

### 夜晚阶段（按顺序执行）

1. **狼人行动**: 所有狼人共同选择击杀目标（取多数票，平票随机）
2. **守卫行动**: 选择守护一名玩家（不能连续两晚守同一人）
3. **预言家行动**: 选择查验一名玩家
4. **女巫行动**: 得知被杀者信息，选择是否用解药/毒药

### 白天阶段

1. **公布昨夜结果**: 谁死了（不公布死因）
2. **发言阶段**: 存活玩家按顺序发言，每人限时
3. **投票阶段**: 所有存活玩家同时投票选择放逐对象
4. **投票结算**: 得票最多者出局（平票则无人出局）
5. **猎人技能**: 若猎人被投票出局，可选择开枪

### 胜负判定

- 所有狼人被淘汰 → 好人阵营胜利
- 好人存活数量 ≤ 狼人存活数量 → 狼人阵营胜利

每次有人死亡后（夜晚结算后、投票结算后）都检查胜负。

## 通信协议

### 消息格式

```json
{
  "type": "action | event | error",
  "action": "动作名",
  "payload": {},
  "roomId": "string",
  "playerId": "string"
}
```

### 客户端 → 服务端

| 动作 | 说明 | payload |
|------|------|---------|
| `create_room` | 创建房间 | `{ name }` |
| `join_room` | 加入房间 | `{ roomId, name }` |
| `ready` | 准备/取消准备 | `{}` |
| `start_game` | 房主开始游戏 | `{}` |
| `night_action` | 夜晚角色行动 | `{ action, targetId }` |
| `speech` | 发言消息 | `{ message }` |
| `vote` | 投票 | `{ targetId }` |
| `hunter_shoot` | 猎人开枪 | `{ targetId }` |

### 服务端 → 客户端

| 动作 | 说明 | 接收者 |
|------|------|--------|
| `room_created` | 房间创建成功 | 请求者 |
| `room_joined` | 加入房间成功 | 请求者 |
| `player_joined` | 玩家加入通知 | 房间内所有人 |
| `player_left` | 玩家离开通知 | 房间内所有人 |
| `game_started` | 游戏开始 | 房间内所有人 |
| `your_role` | 角色分配（私密） | 仅对应玩家 |
| `game_state` | 游戏状态更新（过滤后） | 房间内所有人（按角色过滤） |
| `night_result` | 天亮结果公布 | 房间内所有人 |
| `speech_message` | 发言消息广播 | 房间内所有人 |
| `vote_result` | 投票结果 | 房间内所有人 |
| `hunter_trigger` | 猎人触发技能 | 仅猎人 |
| `game_over` | 游戏结束 | 房间内所有人 |
| `error` | 错误消息 | 请求者 |

### 信息过滤规则

- 狼人能看到其他狼人身份
- 预言家只能看到自己的查验结果
- 女巫只知道被杀者，不知道凶手
- 守卫知道自己守护的对象
- 死亡玩家只能观战，不能看到私密信息
- 每个玩家只能看到自己的角色和公开信息

## 前端 UI

### 页面视图

**1. 大厅页面 (LobbyView)**
- 输入昵称 + 创建房间 / 输入房间号加入
- 房间内显示玩家列表（头像+昵称+准备状态）
- 房主有"开始游戏"按钮，12人齐全才能开始

**2. 游戏主界面 (GameView)**
- 顶部：当前阶段指示器（夜晚/白天 第N天）+ 倒计时
- 左侧：玩家列表，显示存活/死亡状态，自己标记明显
- 中央主交互区：
  - 夜晚：根据角色显示对应操作面板（狼人选人、预言家查验、女巫用药等）
  - 白天发言：聊天框，按顺序发言
  - 投票：点击玩家头像投票
- 右侧：游戏日志（公开事件记录）

**3. 结算页面 (ResultView)**
- 显示胜负阵营
- 揭示所有玩家身份和角色
- 本局关键事件回顾

### 视觉风格

暗色主题，营造夜晚氛围。角色用不同颜色/图标区分。死亡玩家头像灰显+划线。

## 项目结构

```
werewolf-game/
├── server/
│   ├── index.js              # 入口，WebSocket 服务器 + HTTP 静态文件
│   ├── RoomManager.js        # 房间创建/加入/销毁
│   ├── GameStateMachine.js   # 核心状态机，驱动游戏流程
│   ├── roles/
│   │   ├── Werewolf.js       # 狼人行动逻辑
│   │   ├── Seer.js           # 预言家行动逻辑
│   │   ├── Witch.js          # 女巫行动逻辑
│   │   ├── Hunter.js         # 猎人行动逻辑
│   │   ├── Guard.js          # 守卫行动逻辑
│   │   └── Villager.js       # 村民（无特殊逻辑）
│   └── utils.js              # 工具函数（ID生成、洗牌等）
├── client/
│   ├── index.html
│   ├── src/
│   │   ├── App.vue           # 根组件
│   │   ├── main.js
│   │   ├── views/
│   │   │   ├── LobbyView.vue    # 大厅
│   │   │   ├── GameView.vue     # 游戏主界面
│   │   │   └── ResultView.vue   # 结算
│   │   ├── components/
│   │   │   ├── PlayerList.vue   # 玩家列表
│   │   │   ├── ActionPanel.vue  # 角色操作面板
│   │   │   ├── ChatBox.vue      # 聊天/发言框
│   │   │   └── VotePanel.vue    # 投票面板
│   │   ├── composables/
│   │   │   └── useWebSocket.js  # WebSocket 连接管理
│   │   └── game.js              # 游戏消息处理/状态映射
│   └── vite.config.js
└── package.json
```

## 核心数据模型

```js
// 房间
Room {
  id: string,
  hostId: string,
  players: Map<string, Player>,
  game: GameState | null,
  status: "waiting" | "playing" | "finished"
}

// 玩家
Player {
  id: string,
  name: string,
  role: Role | null,       // 游戏开始前为 null
  alive: boolean,
  ready: boolean,
  ws: WebSocket            // 连接引用
}

// 游戏状态
GameState {
  phase: "night" | "day",
  dayNum: number,
  step: string,
  nightActions: {
    wolfTarget: string | null,
    guardTarget: string | null,
    witchSave: boolean,
    witchPoison: string | null,
    seerTarget: string | null
  },
  votes: Map<string, string>,
  witchHealUsed: boolean,
  witchPoisonUsed: boolean,
  lastGuardTarget: string | null,
  speeches: Array<{ playerId, message, order }>,
  log: Array<{ event, data, timestamp }>
}
```

## 技术决策

- **无数据库**: 房间状态全部在内存中，适合轻量派对游戏场景，服务器重启数据丢失
- **无用户系统**: 不需要注册/登录，每次输入昵称即可加入
- **ws 库**: 选择最轻量的 WebSocket 实现，不引入 Socket.io 等重量级库
- **单进程**: 不考虑分布式部署，单进程足够支撑数十个房间同时游戏
