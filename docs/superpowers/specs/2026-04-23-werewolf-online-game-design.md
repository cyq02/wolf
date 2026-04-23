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

### 状态与步骤枚举

```
phase: "night" | "day"

// 夜晚步骤（按顺序）
night steps: "wolf" → "guard" → "seer" → "witch" → "night_resolve"

// 白天步骤（按顺序）
day steps: "day_start" → "speech" → "vote" → "vote_resolve"
```

### 完整流程

```
LOBBY → ROLE_ASSIGN →
  [循环]
    NIGHT → wolf → guard → seer → witch → night_resolve
    → [检查胜负] →
    DAY → day_start → speech → vote → vote_resolve
    → [猎人触发?] → [检查胜负] →
  [胜负已定] → GAME_OVER
```

### 夜晚阶段（按顺序执行）

**1. 狼人行动 (wolf)**
- 所有存活狼人共同选择击杀目标
- 狼人之间可以看到彼此的投票
- 每个狼人发送 `night_action { action: "wolf_kill", targetId }`
- 取多数票；平票或全部不同时随机选择；仅剩1狼时直接决定
- 超时 30 秒未投票的狼人视为弃权，已投票的狼人决定结果
- 所有狼人弃权则无人被杀

**2. 守卫行动 (guard)**
- 选择守护一名玩家（不能连续两晚守同一人）
- 发送 `night_action { action: "guard", targetId }`
- 可以选择不守（不发送操作或发送空 targetId）
- 超时 20 秒未操作视为不守

**3. 预言家行动 (seer)**
- 选择查验一名玩家
- 发送 `night_action { action: "seer_check", targetId }`
- 服务端返回查验结果（好人/狼人）仅给预言家本人
- 超时 20 秒未操作视为放弃查验

**4. 女巫行动 (witch)**
- 女巫被告知本晚被狼人杀死的玩家 ID（如果有人被杀）
- 女巫不知道是谁杀的，也不知道守卫/其他角色的行动
- 发送 `night_action { action: "witch", healTarget, poisonTarget }`
  - healTarget: 被杀者 ID 或 null
  - poisonTarget: 要毒杀的玩家 ID 或 null
- 解药和毒药各只能使用一次，用完后不可再用
- 超时 30 秒未操作视为不使用任何药水

### 夜晚结算算法 (night_resolve)

按以下逻辑确定最终死亡名单：

```
1. wolfTarget = 狼人选中的目标（可能为 null，即无人被杀）
2. savedByGuard = (guardTarget === wolfTarget) 且 guardTarget !== null
3. savedByWitch = witchHealTarget === wolfTarget 且解药未用过

4. if savedByGuard AND savedByWitch:
     // 同守：守卫和女巫同时保护同一人，双救变双死，该玩家仍然死亡
     wolfTarget 死亡
   else if savedByGuard OR savedByWitch:
     // 单守：被救活，该玩家不死
     wolfTarget 存活
   else:
     wolfTarget 死亡

5. witchPoisonTarget（如果女巫用了毒药）→ 毒杀目标死亡（无法被守卫或解药挽救）

6. 最终死亡名单 = [被狼人杀死且未被救的] + [被女巫毒杀的]
```

**关键规则：**
- 守卫和女巫同时救同一人 → 玩家仍然死亡（同守双死规则）
- 毒药无法被任何方式挽救
- 女巫不能在同一晚同时使用解药和毒药（标准规则）

### 夜晚死亡后的猎人触发

夜晚结算后，如果猎人在死亡名单中：
1. 进入 `hunter_trigger` 步骤
2. 猎人收到 `hunter_trigger` 事件，可选择开枪带走一人
3. 发送 `hunter_shoot { targetId }` 或放弃（超时 15 秒视为放弃）
4. 猎人开枪导致的死亡也触发胜负检查
5. 注意：猎人被女巫毒杀时不能开枪（标准规则）

### 白天阶段

**1. 公布昨夜结果 (day_start)**
- 公布昨晚死亡的玩家列表（只公布谁死了，不公布死因和角色）
- 死亡玩家的角色不向其他玩家揭示（仅游戏结束时揭示）
- 如果是第一个夜晚后，直接进入发言阶段

**2. 发言阶段 (speech)**
- 发言顺序：按座位号从小到大，仅存活玩家发言
- 跳过已死亡的玩家
- 每人发言限时 60 秒，超时自动结束发言
- 玩家可以选择跳过（发送空消息）
- 服务端控制发言顺序，只有轮到的玩家可以发言
- 发言消息广播给房间内所有人（包括观战的死亡玩家）

**3. 投票阶段 (vote)**
- 所有存活玩家同时投票，限时 30 秒
- 每人投一票，选择要放逐的玩家
- 可以弃票（不发送投票或发送 targetId = null）
- 超时未投票视为弃票
- 得票最多的玩家被放逐出局
- 平票（多人同票且为最高票）则无人出局
- 所有人的投票结果公开

**4. 投票结算后猎人触发**
- 如果被投票出局的玩家是猎人，进入 `hunter_trigger`
- 猎人可选择开枪带走一人
- 发送 `hunter_shoot { targetId }` 或放弃（超时 15 秒视为放弃）

### 胜负判定

每次有人死亡后立即检查：
- 所有狼人被淘汰 → 好人阵营胜利
- 好人存活数量 ≤ 狼人存活数量 → 狼人阵营胜利
- 否则继续游戏

## 通信协议

### 消息格式

```json
{
  "type": "action",
  "action": "动作名",
  "payload": {},
  "roomId": "string",
  "playerId": "string"
}
```

`type` 固定为 `"action"`（客户端→服务端）或 `"event"`（服务端→客户端）或 `"error"`。

### 房间号格式

房间号为 6 位数字（如 `384721`），便于口头传达。

### 客户端 → 服务端

| 动作 | 说明 | payload |
|------|------|---------|
| `create_room` | 创建房间 | `{ name }` |
| `join_room` | 加入房间 | `{ roomId, name }` |
| `ready` | 切换准备状态 | `{}` |
| `start_game` | 房主开始游戏（需12人全部准备） | `{}` |
| `reconnect` | 断线重连 | `{ playerId, roomId }` |
| `night_action` | 夜晚角色行动 | `{ action: "wolf_kill"\|"guard"\|"seer_check"\|"witch", targetId?, healTarget?, poisonTarget? }` |
| `speech` | 发言消息 | `{ message }` |
| `skip_speech` | 跳过发言 | `{}` |
| `vote` | 投票 | `{ targetId }` 或 `{ targetId: null }` 弃票 |
| `hunter_shoot` | 猎人开枪 | `{ targetId }` 或 `{ targetId: null }` 放弃 |

### 服务端 → 客户端

| 动作 | 说明 | 接收者 |
|------|------|--------|
| `room_created` | 房间创建成功，返回房间号和 playerId | 请求者 |
| `room_joined` | 加入房间成功，返回 playerId 和当前房间信息 | 请求者 |
| `room_info` | 房间完整信息（玩家列表、状态） | 房间内所有人 |
| `player_joined` | 玩家加入通知 | 房间内所有人 |
| `player_left` | 玩家离开通知 | 房间内所有人 |
| `error` | 错误消息 | 请求者 |
| `game_started` | 游戏开始 | 房间内所有人 |
| `your_role` | 角色分配 + 阵营信息 + 狼人同伴ID（如果是狼人） | 仅对应玩家 |
| `phase_change` | 阶段变化通知（进入夜晚/白天，第几天） | 房间内所有人 |
| `your_turn` | 轮到你行动（夜晚操作/发言/投票/猎人开枪） | 仅当前行动玩家 |
| `wolf_vote_info` | 其他狼人的投票情况（实时） | 所有存活狼人 |
| `seer_result` | 查验结果 `{ targetId, isWolf }` | 仅预言家 |
| `witch_info` | 被杀者信息 `{ killedId }` | 仅女巫 |
| `speech_message` | 发言消息广播 `{ playerId, name, message }` | 房间内所有人 |
| `speech_end` | 发言阶段结束 | 房间内所有人 |
| `vote_result` | 投票结果 `{ votes: { voterId: targetId }, eliminated: id\|null }` | 房间内所有人 |
| `death_announce` | 死亡公告 `{ deadIds: [...] }` | 房间内所有人 |
| `hunter_trigger` | 猎人触发技能 | 仅猎人 |
| `game_over` | 游戏结束 `{ winner: "wolf"\|"villager", players: [{ id, name, role, alive }] }` | 房间内所有人 |
| `player_disconnect` | 玩家断线通知 | 房间内所有人 |
| `player_reconnect` | 玩家重连成功通知 | 房间内所有人 |

### 信息过滤规则

服务端发送 `phase_change` 等全局事件时，根据玩家角色过滤信息：
- 狼人：能看到其他狼人身份（通过 `your_role` 事件中的 teammateIds）
- 预言家：只能看到自己的查验结果
- 女巫：只知道被杀者 ID，不知道凶手、不知道守卫行动
- 守卫：知道自己守护的对象
- 死亡玩家：只能观战，看到公开信息（发言、投票结果、死亡公告），不能看到任何角色私密信息
- 所有玩家只能看到自己的角色和公开信息

### 断线与重连

- 玩家 playerId 存储在浏览器 localStorage 中
- 断线后服务端保留玩家状态 120 秒
- 玩家可通过 `reconnect { playerId, roomId }` 重连
- 重连成功后服务端推送当前完整游戏状态（过滤后的）
- 超过 120 秒未重连：
  - 如果在 LOBBY 阶段：玩家被移出房间
  - 如果游戏进行中：玩家角色保持存活但行动自动跳过（视为弃权/不操作），不自动死亡
  - 如果是房主断线：转移房主给最早加入的存活玩家

## 前端 UI

### 页面视图

**1. 大厅页面 (LobbyView)**
- 输入昵称 + 创建房间 / 输入房间号加入
- 房间内显示玩家列表（头像+昵称+准备状态）
- 房主有"开始游戏"按钮，12人全部准备才能开始
- 房间最多12人，不支持旁观

**2. 游戏主界面 (GameView)**
- 顶部：当前阶段指示器（夜晚/白天 第N天）+ 当前步骤 + 倒计时
- 左侧：玩家列表（12人），显示存活/死亡状态，自己标记明显
- 中央主交互区：
  - 夜晚：根据角色显示对应操作面板
    - 狼人：选择目标 + 看到其他狼人投票
    - 预言家：选择查验目标 + 显示查验结果
    - 女巫：显示被杀者 + 解药/毒药按钮 + 选择目标
    - 守卫：选择守护目标
    - 村民：显示"夜晚，请等待..."
  - 白天发言：聊天框，仅轮到自己时可输入，其他人只读
  - 投票：点击存活玩家头像投票 + 弃票按钮
- 右侧：游戏日志（公开事件记录：死亡公告、投票结果、阶段变化）
- 非自己回合时显示等待提示

**3. 结算页面 (ResultView)**
- 显示胜负阵营（好人胜利 / 狼人胜利）
- 揭示所有玩家身份和角色（配对角色图标和颜色）
- 本局关键事件回顾（时间线：第几天谁被杀、谁被投票出局等）

### 视觉风格

暗色主题，营造夜晚氛围。角色用不同颜色/图标区分。死亡玩家头像灰显+划线。夜晚阶段屏幕暗化，白天阶段正常亮度。

## 项目结构

```
werewolf-game/
├── server/
│   ├── index.js              # 入口，HTTP 静态文件 + WebSocket 服务器
│   ├── RoomManager.js        # 房间创建/加入/销毁/重连
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
│   │   │   └── useWebSocket.js  # WebSocket 连接管理 + 断线重连
│   │   └── game.js              # 游戏消息处理/状态映射
│   └── vite.config.js
└── package.json
```

## 核心数据模型

```js
// 房间
Room {
  id: string,               // 6位数字房间号
  hostId: string,
  players: { [playerId]: Player },  // 用普通对象，不用 Map，方便序列化
  game: GameState | null,
  status: "waiting" | "playing" | "finished",
  disconnectedAt: { [playerId]: timestamp }  // 断线时间记录
}

// 玩家
Player {
  id: string,
  name: string,
  role: string | null,      // "werewolf"|"seer"|"witch"|"hunter"|"guard"|"villager" 或 null
  seatNum: number,          // 座位号 1-12
  alive: boolean,
  ready: boolean,
  connected: boolean        // 是否在线
}

// 游戏状态
GameState {
  phase: "night" | "day",
  dayNum: number,           // 第几天（从1开始）
  step: string,             // 当前步骤：wolf|guard|seer|witch|night_resolve|day_start|speech|vote|vote_resolve|hunter_trigger
  nightActions: {
    wolfVotes: { [playerId]: targetId },  // 每个狼人的投票
    wolfTarget: string | null,            // 最终狼人目标（结算后）
    guardTarget: string | null,
    witchHealTarget: string | null,
    witchPoisonTarget: string | null,
    seerTarget: string | null,
    seerResult: boolean | null            // 查验结果：true=狼人
  },
  votes: { [voterId]: targetId | null },  // 投票记录
  witchHealUsed: boolean,
  witchPoisonUsed: boolean,
  lastGuardTarget: string | null,         // 上一晚守卫目标
  currentSpeakerIndex: number,            // 当前发言人索引
  speeches: Array<{ playerId, message, order }>,  // order = seatNum
  deadThisNight: string[],                // 本晚死亡玩家ID列表
  hunterPending: boolean,                 // 猎人是否等待开枪
  log: Array<{ dayNum, phase, event, data }>
}
```

## 技术决策

- **无数据库**: 房间状态全部在内存中，适合轻量派对游戏场景，服务器重启数据丢失
- **无用户系统**: 不需要注册/登录，每次输入昵称即可加入
- **ws 库**: 选择最轻量的 WebSocket 实现，不引入 Socket.io 等重量级库
- **单进程**: 不考虑分布式部署，单进程足够支撑数十个房间同时游戏
- **普通对象代替 Map**: 数据模型使用 JS 普通对象 `{}` 而非 `Map`，避免 JSON 序列化问题
- **玩家 ID 存 localStorage**: 支持断线重连，玩家 ID 持久化在浏览器端
