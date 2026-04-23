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
  nightAction: null,
  seerResult: null,
  witchInfo: null,
  wolfVotes: {},
  speeches: [],
  votes: {},
  eliminated: null,
  deadIds: [],
  log: [],
  gameOver: null,
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
