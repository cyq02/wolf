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
    const pids = Object.keys(this.players);
    const roles = shuffle(ROLE_CONFIG);
    for (let i = 0; i < pids.length; i++) {
      this.players[pids[i]].role = roles[i];
    }

    this._broadcast('game_started', {});

    for (const [pid, p] of Object.entries(this.players)) {
      const teammateIds = p.role === 'werewolf'
        ? Object.entries(this.players).filter(([id, pl]) => pl.role === 'werewolf' && id !== pid).map(([id]) => id)
        : [];
      this._send(pid, 'your_role', { role: p.role, teammateIds });
    }

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

  _startWolfPhase() {
    const wolves = this._aliveByRole('werewolf');
    const targets = this._alivePlayers().filter(p => p.role !== 'werewolf').map(p => ({ id: p.id, name: p.name, seatNum: p.seatNum }));
    for (const w of wolves) {
      if (w.connected) {
        this._send(w.id, 'your_turn', { action: 'wolf_kill', timeLeft: 30, targets });
      }
    }
    this._setTimeout(() => this._resolveWolf(), NIGHT_TIMEOUT.wolf);
  }

  _resolveWolf() {
    const gs = this.gs;
    const votes = gs.nightActions.wolfVotes;

    if (Object.keys(votes).length === 0) {
      gs.nightActions.wolfTarget = null;
    } else {
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
    const wolfTarget = gs.nightActions.wolfTarget;

    if (wolfTarget) {
      const savedByGuard = gs.nightActions.guardTarget === wolfTarget;
      const savedByWitch = gs.nightActions.witchHealTarget === wolfTarget;

      if (savedByGuard && savedByWitch) {
        dead.push({ id: wolfTarget, cause: 'wolf' });
      } else if (savedByGuard || savedByWitch) {
        // saved
      } else {
        dead.push({ id: wolfTarget, cause: 'wolf' });
      }
    }

    if (gs.nightActions.witchPoisonTarget) {
      const poisoned = gs.nightActions.witchPoisonTarget;
      if (!dead.find(d => d.id === poisoned)) {
        dead.push({ id: poisoned, cause: 'poison' });
      }
    }

    for (const d of dead) {
      this.players[d.id].alive = false;
      gs.deadThisNight.push(d.id);
    }

    if (gs.nightActions.witchHealTarget) gs.witchHealUsed = true;
    if (gs.nightActions.witchPoisonTarget) gs.witchPoisonUsed = true;
    gs.lastGuardTarget = gs.nightActions.guardTarget;

    this._broadcast('death_announce', { deadIds: dead.map(d => d.id) });
    gs.log.push({ dayNum: gs.dayNum, phase: 'night', event: 'deaths', data: { deadIds: dead.map(d => d.id) } });

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
    this.gs.hunterPending = false;
    this._afterNightResolve();
  }

  _afterNightResolve() {
    const winner = this._checkWin();
    if (winner) { this._endGame(winner); return; }
    this._startDay();
  }

  _startDay() {
    const gs = this.gs;
    gs.phase = 'day';
    gs.step = 'day_start';
    gs.speeches = [];
    gs.log.push({ dayNum: gs.dayNum, phase: 'day', event: 'day_start', data: {} });

    this._broadcast('phase_change', { phase: 'day', dayNum: gs.dayNum, step: 'day_start' });

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

    while (gs.currentSpeakerIndex < alive.length) {
      const speaker = alive[gs.currentSpeakerIndex];
      if (speaker.alive) {
        this._send(speaker.id, 'your_turn', { action: 'speech', timeLeft: 60 });
        this._setTimeout(() => {
          this._broadcast('speech_message', { playerId: speaker.id, name: speaker.name, message: '' });
          gs.speeches.push({ playerId: speaker.id, message: '', order: speaker.seatNum });
          gs.currentSpeakerIndex++;
          this._nextSpeaker();
        }, SPEECH_TIMEOUT);
        return;
      }
      gs.currentSpeakerIndex++;
    }

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
    }

    this._broadcast('vote_result', { votes: gs.votes, eliminated });
    gs.log.push({ dayNum: gs.dayNum, phase: 'day', event: 'vote', data: { votes: gs.votes, eliminated } });

    if (eliminated) {
      this.players[eliminated].alive = false;
      this._broadcast('death_announce', { deadIds: [eliminated] });

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
    this.gs.dayNum++;
    this._startNight();
  }

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
        const wolves = this._aliveByRole('werewolf');
        for (const w of wolves) {
          this._send(w.id, 'wolf_vote_info', { votes: gs.nightActions.wolfVotes });
        }
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

    const winner = this._checkWin();
    if (winner) { this._endGame(winner); return; }

    if (gs.phase === 'night') {
      this._afterNightResolve();
    } else {
      this._afterVoteResolve();
    }
  }

  sendCurrentState(playerId) {
    const gs = this.gs;
    if (!gs) return;
    const player = this.players[playerId];
    if (!player) return;

    const teammateIds = player.role === 'werewolf'
      ? Object.entries(this.players).filter(([id, p]) => p.role === 'werewolf' && id !== playerId).map(([id]) => id)
      : [];
    this._send(playerId, 'your_role', { role: player.role, teammateIds });

    this._send(playerId, 'phase_change', { phase: gs.phase, dayNum: gs.dayNum, step: gs.step });

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
