import { computed, ref } from 'vue';
import { state } from '../game.js';

// === Helpers ===
function alivePlayers() {
  return Object.values(state.players).filter(p => p.alive);
}
function pn(pid) { return state.players[pid]?.name || '???'; }
function ps(pid) { return state.players[pid]?.seatNum || '?'; }
function tag(pid) { return `${pn(pid)}(${ps(pid)}号)`; }

// === Cross-round history (persists within session) ===
const roundHistory = ref([]);
// Each entry: { dayNum, speeches: [...], votes: {}, eliminated, deadIds: [] }

function recordRound() {
  const entry = {
    dayNum: state.dayNum,
    speeches: [...state.speeches],
    votes: { ...state.votes },
    eliminated: state.eliminated,
  };
  roundHistory.value.push(entry);
}

// === Suspect Scoring Engine ===
// Returns Map<playerId, { score, reasons[] }>
function scoreSuspects() {
  const scores = new Map();
  const alive = alivePlayers();
  const me = state.playerId;

  for (const p of alive) {
    if (p.id === me) continue;
    scores.set(p.id, { score: 0, reasons: [], info: [] });
  }

  // --- Factor 1: Silence analysis (quiet players are suspicious) ---
  for (const s of state.speeches) {
    const info = scores.get(s.playerId);
    if (!info) continue;
    if (!s.message || s.message === '过' || s.message === '（沉默不语）') {
      info.score += 1;
      info.reasons.push('发言极少，可能有所隐瞒');
    }
  }

  // --- Factor 2: Accusation network analysis ---
  // Who accused whom, and who got accused
  const accuseCount = {}; // target -> count of accusers
  const defenderOf = {};  // defender -> target they defended
  const accuserOf = {};   // accuser -> target they accused

  for (const s of state.speeches) {
    if (!s.message) continue;
    const info = scores.get(s.playerId);
    if (!info) continue;

    // 查杀
    const killMatch = s.message.match(/查杀[（(]?(\d+)/);
    if (killMatch) {
      const seat = parseInt(killMatch[1]);
      const target = alive.find(p => p.seatNum === seat);
      if (target && target.id !== me) {
        accuserOf[s.playerId] = target.id;
        accuseCount[target.id] = (accuseCount[target.id] || 0) + 1;
        // If I'm seer and I know this person is good, the accuser is suspicious
        if (state.role === 'seer' && state.seerResult) {
          if (state.seerResult.targetId === target.id && !state.seerResult.isWolf) {
            info.score += 4;
            info.reasons.push(`查杀了你验过的好人${tag(target.id)}，可能在说谎`);
          }
        }
        // If I'm seer and this person is wolf, the accuser is trustworthy
        if (state.role === 'seer' && state.seerResult?.targetId === target.id && state.seerResult.isWolf) {
          info.score -= 3;
          info.info.push(`查杀了你验过的狼人${tag(target.id)}，比较可信`);
        }
      }
    }

    // 保/担保
    const defendMatch = s.message.match(/[保担保][（(]?(\d+)/);
    if (defendMatch) {
      const seat = parseInt(defendMatch[1]);
      const target = alive.find(p => p.seatNum === seat);
      if (target) defenderOf[s.playerId] = target.id;
    }

    // 怀疑/可疑
    if (s.message.includes('怀疑') || s.message.includes('可疑')) {
      const suspectMatch = s.message.match(/[觉得]?[（(]?(\d+)号[很]?[可疑怀疑]/);
      if (!suspectMatch) {
        info.score += 0.5;
        info.reasons.push('表达了模糊的怀疑，没有明确目标');
      }
    }
  }

  // --- Factor 3: Voting coalition (players who vote together are suspicious) ---
  const votes = state.votes || {};
  const voteTarget = {}; // voter -> target
  for (const [voter, target] of Object.entries(votes)) {
    if (target) voteTarget[voter] = target;
  }

  // Find players who voted for the same target
  const targetVoters = {};
  for (const [voter, target] of Object.entries(voteTarget)) {
    targetVoters[target] = (targetVoters[target] || []);
    targetVoters[target].push(voter);
  }

  // If someone voted for me and I'm not a wolf, they're suspicious
  if (state.role !== 'werewolf' && voteTarget) {
    for (const [voter, target] of Object.entries(voteTarget)) {
      if (target === me) {
        const info = scores.get(voter);
        if (info) {
          info.score += 2;
          info.reasons.push('投了你的票');
        }
      }
    }
  }

  // Wolf teammates: if I'm wolf, other wolves' voters are not suspicious
  if (state.role === 'werewolf') {
    for (const tid of state.teammateIds) {
      const info = scores.get(tid);
      if (info) {
        info.score -= 10;
        info.info.push('你的狼队友');
      }
    }
  }

  // --- Factor 4: Cross-round voting patterns ---
  for (const round of roundHistory.value) {
    const rv = round.votes || {};
    for (const [voter, target] of Object.entries(rv)) {
      const info = scores.get(voter);
      if (!info) continue;
      // Voted for an eliminated player? Slight trust boost
      if (round.eliminated && target === round.eliminated) {
        info.score -= 0.5;
      }
    }
  }

  // --- Factor 5: Death correlation ---
  // If someone spoke against X and X died that night, X's accuser might be wolf
  for (const entry of state.log) {
    if (entry.event !== 'deaths' || !entry.data.deadIds?.length) continue;
    for (const deadId of entry.data.deadIds) {
      // Who accused this dead person? They might be wolf who directed the kill
      for (const [accuserId, targetId] of Object.entries(accuserOf)) {
        if (targetId === deadId) {
          const info = scores.get(accuserId);
          if (info) {
            info.score += 1;
            info.reasons.push(`${tag(accuserId)}曾指控已死亡的${tag(deadId)}，存在灭口嫌疑`);
          }
        }
      }
    }
  }

  // --- Factor 6: Seer knowledge integration ---
  if (state.role === 'seer' && state.seerResult) {
    const t = state.seerResult.targetId;
    const info = scores.get(t);
    if (info) {
      if (state.seerResult.isWolf) {
        info.score += 10;
        info.reasons.push(`你查验的结果：狼人！`);
      } else {
        info.score -= 10;
        info.info.push(`你查验的结果：好人`);
      }
    }
  }

  // --- Factor 7: Counter-claim detection ---
  // Multiple people claim seer? Someone is lying
  const seerClaimers = [];
  for (const s of state.speeches) {
    if (s.message && (s.message.includes('我是预言家') || s.message.includes('预言家，我查'))) {
      seerClaimers.push(s.playerId);
    }
  }
  if (seerClaimers.length > 1) {
    for (const claimer of seerClaimers) {
      const info = scores.get(claimer);
      if (!info) continue;
      if (state.role === 'seer' && claimer !== state.playerId) {
        info.score += 8;
        info.reasons.push(`假预言家！你是真预言家`);
      } else if (state.role !== 'seer') {
        info.score += 2;
        info.reasons.push('多人声称预言家，至少一人在说谎');
      }
    }
  }

  return scores;
}

// === Main Tips Generator ===
export function useAiTips() {
  const history = ref([]);

  const tips = computed(() => {
    const result = [];
    const { phase, step, role, isMyTurn, dayNum } = state;
    if (!phase || !role) return result;

    const alive = alivePlayers();
    const aliveWolf = alive.filter(p => state.teammateIds.includes(p.id)).length;
    const aliveGood = alive.length - aliveWolf;
    const scores = scoreSuspects();

    // Get top suspects
    const suspectList = [...scores.entries()]
      .filter(([, v]) => v.score > 0)
      .sort((a, b) => b[1].score - a[1].score);
    const topSuspect = suspectList[0];
    const trustedList = [...scores.entries()]
      .filter(([, v]) => v.score < -2)
      .sort((a, b) => a[1].score - b[1].score);

    // === NIGHT PHASE ===
    if (phase === 'night' && isMyTurn) {
      if (step === 'wolf' && role === 'werewolf') {
        const goodTargets = alive.filter(p => !state.teammateIds.includes(p.id));
        result.push({ icon: '🐺', text: `场上 ${aliveGood} 好人 vs ${aliveWolf} 狼人。${aliveWolf >= aliveGood ? '人数占优，稳住即可。' : '还需击杀 ' + (aliveGood - aliveWolf) + ' 个好人才能获胜。'}`, level: 'normal' });

        if (topSuspect) {
          const [, info] = topSuspect;
          if (info.info.length > 0) {
            result.push({ icon: '🎯', text: `注意：${info.info[0]}`, level: 'info' });
          }
        }

        // Wolf teammates' kill suggestions
        const wolfVotes = state.wolfVotes || {};
        for (const [voter, target] of Object.entries(wolfVotes)) {
          if (voter !== state.playerId) {
            result.push({ icon: '🐺', text: `队友${tag(voter)}建议击杀${tag(target)}`, level: 'info' });
          }
        }

        if (dayNum > 1) {
          result.push({ icon: '📋', text: generateDeathSummary(), level: 'info' });
        }
      }

      if (step === 'guard' && role === 'guard') {
        result.push({ icon: '🛡️', text: '不能连续两晚守同一人。', level: 'normal' });
        if (dayNum === 1) {
          result.push({ icon: '💡', text: '首夜建议守预言家位，狼人常首刀预言家。', level: 'info' });
        } else {
          // Try to guess who wolves will target
          if (topSuspect) {
            const [suspectId] = topSuspect;
            result.push({ icon: '🔍', text: `${tag(suspectId)}被多人关注，狼人可能不会刀TA。考虑守没人注意的关键角色。`, level: 'info' });
          }
        }
      }

      if (step === 'seer' && role === 'seer') {
        if (dayNum === 1) {
          result.push({ icon: '🔮', text: '首验建议：查发言位靠中间的人，信息量大。', level: 'info' });
        } else if (state.seerResult) {
          const prev = state.seerResult;
          if (prev.isWolf) {
            result.push({ icon: '⚡', text: `你上次验到${tag(prev.targetId)}是狼人！白天择机公布或找对跳。`, level: 'urgent' });
          } else {
            result.push({ icon: '✅', text: `上次验${tag(prev.targetId)}是好人，可以为TA担保。`, level: 'normal' });
          }
        }
        // Suggest who to check
        if (suspectList.length > 0) {
          const [sid] = suspectList[0];
          result.push({ icon: '🔍', text: `建议查验${tag(sid)}，嫌疑最高。`, level: 'info' });
        }
      }

      if (step === 'witch' && role === 'witch') {
        if (state.witchInfo?.killedId) {
          const killed = state.witchInfo.killedId;
          if (state.witchInfo.healAvailable) {
            const killedInfo = scores.get(killed);
            const isSuspicious = killedInfo && killedInfo.score > 2;
            result.push({ icon: '💊', text: `${tag(killed)}被刀了。${isSuspicious ? 'TA有嫌疑，可以不救。' : 'TA比较可信，建议救。'}`, level: 'urgent' });
          } else {
            result.push({ icon: '☠️', text: `${tag(killed)}被刀，解药已用完。`, level: 'warn' });
          }
        }
        if (state.witchInfo?.poisonAvailable && dayNum > 1 && suspectList.length > 0) {
          const [sid, sinfo] = suspectList[0];
          if (sinfo.score >= 3) {
            result.push({ icon: '☠️', text: `考虑毒${tag(sid)}：${sinfo.reasons[0]}`, level: 'warn' });
          }
        }
      }
    }

    if (phase === 'night' && !isMyTurn && !state.isSpectator) {
      if (role === 'werewolf' && step === 'wolf') {
        result.push({ icon: '🐺', text: '等待狼队友完成击杀。', level: 'normal' });
      } else {
        result.push({ icon: '🌙', text: '夜晚等待中，天亮后注意分析谁死了。', level: 'normal' });
      }
    }

    // === DAY SPEECH PHASE ===
    if (step === 'speech') {
      // Show suspect analysis to everyone
      if (suspectList.length > 0) {
        const [sid, sinfo] = suspectList[0];
        const reason = sinfo.reasons[0] || '综合分析嫌疑最高';
        result.push({ icon: '🔍', text: `嫌疑最大：${tag(sid)}（${reason}）`, level: sinfo.score >= 3 ? 'warn' : 'info' });
      }
      if (suspectList.length > 1) {
        const [, sinfo2] = suspectList[1];
        if (sinfo2.reasons.length > 0) {
          result.push({ icon: '🔍', text: `其次注意：${sinfo2.reasons[0]}`, level: 'info' });
        }
      }

      // Trusted players
      if (trustedList.length > 0) {
        const [tid] = trustedList[0];
        result.push({ icon: '✅', text: `${tag(tid)}比较可信`, level: 'normal' });
      }

      // Role-specific speech advice
      if (isMyTurn) {
        if (role === 'werewolf') {
          const accusedTeammate = suspectList.find(([id]) => state.teammateIds.includes(id));
          if (accusedTeammate) {
            result.push({ icon: '🚨', text: `狼队友${tag(accusedTeammate[0])}被怀疑了！考虑是否跳身份对跳来保护。`, level: 'urgent' });
          }
          result.push({ icon: '🎭', text: '发言建议：假装分析局势，适当怀疑好人来转移视线，但不要过于激进。', level: 'normal' });
        }
        if (role === 'seer' && state.seerResult?.isWolf) {
          const t = state.seerResult.targetId;
          result.push({ icon: '⚡', text: `你验的${tag(t)}是狼人！建议跳预言家公布。如果场上有假预言家，直接对跳。`, level: 'urgent' });
        }
        if (role === 'seer' && state.seerResult && !state.seerResult.isWolf) {
          const t = state.seerResult.targetId;
          result.push({ icon: '✅', text: `你验的${tag(t)}是好人，可以择机为TA担保来建立可信度。`, level: 'info' });
        }
        if (role === 'hunter') {
          result.push({ icon: '🔫', text: '发言可以强硬一些，狼人杀你有代价。', level: 'normal' });
        }
      }
    }

    // === VOTE PHASE ===
    if (step === 'vote') {
      if (suspectList.length > 0) {
        const [sid, sinfo] = suspectList[0];
        const reason = sinfo.reasons[0] || '综合嫌疑最高';
        result.push({ icon: '⚖️', text: `建议投${tag(sid)}：${reason}`, level: sinfo.score >= 3 ? 'urgent' : 'warn' });
      } else {
        result.push({ icon: '⚖️', text: '没有明确嫌疑人，根据发言逻辑判断。', level: 'normal' });
      }

      // Vote progress
      const votes = state.votes || {};
      const voteCount = Object.keys(votes).length;
      if (voteCount > 0) {
        const targetVoters = {};
        for (const [voter, target] of Object.entries(votes)) {
          if (target) targetVoters[target] = (targetVoters[target] || []).concat(voter);
        }
        const sorted = Object.entries(targetVoters).sort((a, b) => b[1].length - a[1].length);
        if (sorted.length > 0) {
          const [topTarget, voters] = sorted[0];
          result.push({ icon: '📊', text: `目前${tag(topTarget)}得票最多（${voters.length}票）`, level: 'info' });
        }
      }
    }

    // === HUNTER TRIGGER ===
    if (step === 'hunter_trigger' && isMyTurn) {
      if (suspectList.length > 0) {
        const [sid, sinfo] = suspectList[0];
        result.push({ icon: '🔫', text: `建议带走${tag(sid)}：${sinfo.reasons[0] || '嫌疑最高'}`, level: 'urgent' });
      } else {
        result.push({ icon: '🔫', text: '没有明确目标，选择你最怀疑的人。', level: 'urgent' });
      }
    }

    // === GAME STAGE ===
    if (role === 'werewolf' && alive.length <= 5 && aliveWolf > 0) {
      result.push({ icon: '🔥', text: `还剩${alive.length}人，狼人即将获胜！保持低调。`, level: 'urgent' });
    }

    if (state.isSpectator) {
      result.push({ icon: '👁️', text: '你正在观战。', level: 'normal' });
    }

    return result;
  });

  // Record round data when votes come in
  const watchVotes = computed(() => state.votes);
  // We track when vote phase ends (step changes away from 'vote')

  // Quick questions with data-driven answers
  const quickQuestions = computed(() => {
    const { phase, step, role } = state;
    if (!phase || !role) return [];
    const questions = [];

    if (phase === 'day' && step === 'speech') {
      questions.push({ q: '谁最可疑？', a: generateSuspectReport() });
      questions.push({ q: '我该公开身份吗？', a: generateIdentityAdvice() });
    }
    if (step === 'vote') {
      questions.push({ q: '我该投谁？', a: generateVoteAdvice() });
    }
    questions.push({ q: '分析当前局势', a: generateSituationReport() });
    questions.push({ q: '死亡记录分析', a: generateDeathAnalysis() });

    return questions;
  });

  // Free-form keyword matching
  function askFreeForm(input) {
    const q = input.trim();
    if (!q) return null;

    const handlers = [
      { keywords: ['可疑', '怀疑', '谁是狼', '嫌疑'], fn: generateSuspectReport },
      { keywords: ['投', '投票', '投谁'], fn: generateVoteAdvice },
      { keywords: ['身份', '公开', '暴露', '跳'], fn: generateIdentityAdvice },
      { keywords: ['局势', '分析', '情况'], fn: generateSituationReport },
      { keywords: ['死', '死了', '死亡', '谁死了', '谁被杀了'], fn: generateDeathAnalysis },
      { keywords: ['猎人', '开枪', '带走', '带走谁'], fn: generateHunterReport },
      { keywords: ['策略', '怎么玩', '建议'], fn: generateStrategyAdvice },
      { keywords: ['预言家'], fn: () => state.role === 'seer' ? '你是预言家。根据查验结果选择公开时机：有对跳就立刻对跳，没对跳可以先隐忍。' : '场上有预言家声称时，观察TA的查验逻辑是否自洽。假预言家的查验往往会"恰好"查到被大家怀疑的人。' },
      { keywords: ['女巫'], fn: () => state.role === 'witch' ? '你是女巫。解药优先救关键角色（预言家），毒药留给确定的狼人。不要过早暴露身份。' : '观察谁被刀后是否被救：如果某夜没人死，可能是女巫救人或守卫守人。' },
      { keywords: ['守卫'], fn: () => state.role === 'guard' ? '你是守卫。守护预言家和女巫等关键角色，注意不能连续守同一人。' : '如果某夜没人死，可能是守卫守护成功或女巫救人了。' },
      { keywords: ['票', '被投', '放逐'], fn: generateVoteHistory },
      { keywords: ['发言', '说了什么', '谁说了'], fn: generateSpeechSummary },
    ];

    for (const h of handlers) {
      if (h.keywords.some(kw => q.includes(kw))) return { q, a: h.fn() };
    }

    return { q, a: `关于"${q}"，你可以试试上方的快捷提问按钮获取具体分析。` };
  }

  return { tips, quickQuestions, history, askFreeForm };
}

// === Report Generators ===

function generateSuspectReport() {
  const scores = scoreSuspects();
  const suspectList = [...scores.entries()]
    .filter(([, v]) => v.score > 0)
    .sort((a, b) => b[1].score - a[1].score);

  if (suspectList.length === 0) {
    return state.speeches.length === 0 ? '目前还没人发言，无法分析。等大家说完再判断。' : '暂时没有明显嫌疑人，注意观察发言逻辑和投票走向。';
  }

  const parts = [];
  const top3 = suspectList.slice(0, 3);
  for (const [pid, info] of top3) {
    const reason = info.reasons[0] || '综合嫌疑';
    parts.push(`${tag(pid)}（嫌疑${info.score > 3 ? '高' : '中'}：${reason}）`);
  }
  return `嫌疑排名：${parts.join('；')}`;
}

function generateVoteAdvice() {
  const scores = scoreSuspects();
  const suspectList = [...scores.entries()]
    .filter(([, v]) => v.score > 0)
    .sort((a, b) => b[1].score - a[1].score);

  if (suspectList.length === 0) {
    return '没有明确目标。回顾发言，找逻辑不自洽或过于安静的人。平票时无人出局，集中票数很重要。';
  }

  const [pid, info] = suspectList[0];
  const reason = info.reasons.slice(0, 2).join('；');
  return `建议投${tag(pid)}，理由：${reason}。${suspectList.length > 1 ? `备选：${tag(suspectList[1][0])}。` : ''}平票无人出局，集中票很关键。`;
}

function generateIdentityAdvice() {
  const role = state.role;
  const scores = scoreSuspects();
  const suspectList = [...scores.entries()].filter(([, v]) => v.score > 0).sort((a, b) => b[1].score - a[1].score);

  if (role === 'seer') {
    if (state.seerResult?.isWolf) {
      const hasFakeSeer = state.speeches.some(s =>
        s.playerId !== state.playerId && s.message && (s.message.includes('预言家') || s.message.includes('我查'))
      );
      return hasFakeSeer
        ? '你验到了狼人，且场上有假预言家！立刻跳预言家对跳，公布查验结果。'
        : '你验到了狼人。如果好人阵营被动，建议跳预言家公布信息；如果局势还行，可以再等一轮。';
    }
    return '你的查验信息很宝贵。根据局势决定：好人被动就公开稳住局面，占优就先隐藏。';
  }
  if (role === 'werewolf') return '绝对不要暴露！假装普通好人分析局势，适当怀疑无辜的人来转移注意力。';
  if (role === 'witch') return '女巫身份有战略价值，不要过早暴露。除非需要自证清白或关键时刻一锤定音。';
  if (role === 'hunter') return '猎人可以适度强硬，因为狼人杀你有代价。但不必刻意跳身份。';
  if (role === 'guard') return '守卫身份必须隐藏！暴露后狼人可以策略绕过你的守护。';
  return '村民可以积极发言参与分析。如果有人对跳预言家，站边逻辑更通的一方。';
}

function generateSituationReport() {
  const alive = alivePlayers();
  const dead = Object.values(state.players).filter(p => !p.alive);
  const scores = scoreSuspects();
  const suspectList = [...scores.entries()].filter(([, v]) => v.score > 0).sort((a, b) => b[1].score - a[1].score);

  let wolfCount = 0;
  if (state.role === 'werewolf') {
    wolfCount = alive.filter(p => state.teammateIds.includes(p.id)).length;
  } else {
    // Estimate: assume proportional to player count
    const totalPlayers = Object.keys(state.players).length;
    wolfCount = totalPlayers >= 10 ? 3 : totalPlayers >= 8 ? 2 : 1;
    wolfCount = Math.max(0, wolfCount - dead.filter(p => state.teammateIds.includes(p.id) || (state.role !== 'werewolf' && Math.random() < 0.3)).length);
  }

  const parts = [`场上 ${alive.length} 人存活，${dead.length} 人阵亡。`];

  if (state.dayNum <= 1) {
    parts.push('游戏初期，信息有限，以观察为主。');
  } else if (state.dayNum <= 3) {
    parts.push('中期阶段，注意整合各轮线索。');
  } else {
    parts.push('后期了，每一步都很关键！');
  }

  if (suspectList.length > 0) {
    const [pid, info] = suspectList[0];
    parts.push(`当前最大嫌疑：${tag(pid)}（${info.reasons[0] || '综合分析'}）。`);
  }

  const deathLog = state.log.filter(e => e.event === 'deaths');
  if (deathLog.length > 0) {
    parts.push(`已发生 ${deathLog.length} 次死亡。`);
  }

  return parts.join('');
}

function generateDeathAnalysis() {
  const results = [];
  for (const entry of state.log) {
    if (entry.event === 'deaths' && entry.data.deadIds?.length > 0) {
      const names = entry.data.deadIds.map(id => {
        const p = state.players[id];
        const role = p?.revealedRole ? `（${roleLabelsFull[p.revealedRole] || p.revealedRole}）` : '';
        return tag(id) + role;
      }).join('、');
      const phaseLabel = entry.phase === 'night' ? `第${entry.dayNum}夜` : `第${entry.dayNum}日`;
      results.push(`${phaseLabel}：${names}死亡`);
    }
    if (entry.event === 'hunter_shoot' && entry.data.targetId) {
      const hunter = tag(entry.data.hunterId);
      const target = tag(entry.data.targetId);
      const targetRole = state.players[entry.data.targetId]?.revealedRole;
      const roleStr = targetRole ? `（${roleLabelsFull[targetRole] || targetRole}）` : '';
      results.push(`第${entry.dayNum}${entry.phase === 'night' ? '夜' : '日'}：猎人${hunter}开枪带走了${target}${roleStr}`);
    }
    if (entry.event === 'vote' && entry.data.eliminated) {
      const p = state.players[entry.data.eliminated];
      const role = p?.revealedRole ? `（${roleLabelsFull[p.revealedRole] || p.revealedRole}）` : '';
      results.push(`第${entry.dayNum}日：${tag(entry.data.eliminated)}${role}被投票放逐`);
    }
  }
  return results.length > 0 ? results.join('；') : '目前还没有人死亡。';
}

function generateHunterReport() {
  const shots = state.log.filter(e => e.event === 'hunter_shoot');
  if (shots.length === 0) return '猎人还没有开过枪。';

  const parts = [];
  for (const shot of shots) {
    if (shot.data.targetId) {
      const hunter = tag(shot.data.hunterId);
      const target = tag(shot.data.targetId);
      const targetRole = state.players[shot.data.targetId]?.revealedRole;
      const roleStr = targetRole ? `，身份是${roleLabelsFull[targetRole] || targetRole}` : '';
      parts.push(`第${shot.dayNum}${shot.phase === 'night' ? '夜' : '日'}：${hunter}开枪带走了${target}${roleStr}`);
    } else {
      parts.push(`第${shot.dayNum}${shot.phase === 'night' ? '夜' : '日'}：猎人放弃了开枪`);
    }
  }
  return parts.join('；');
}

function generateVoteHistory() {
  const votes = state.log.filter(e => e.event === 'vote');
  if (votes.length === 0) return '还没有进行过投票。';

  const parts = [];
  for (const v of votes) {
    if (v.data.eliminated) {
      const role = state.players[v.data.eliminated]?.revealedRole;
      const roleStr = role ? `（${roleLabelsFull[role] || role}）` : '';
      parts.push(`第${v.dayNum}日：${tag(v.data.eliminated)}${roleStr}被放逐`);
    } else {
      parts.push(`第${v.dayNum}日：平票，无人出局`);
    }
  }
  return parts.join('；');
}

function generateSpeechSummary() {
  if (state.speeches.length === 0) return '本轮还没有人发言。';
  return state.speeches.map(s => {
    const msg = s.message || '（沉默）';
    return `${tag(s.playerId)}：${msg}`;
  }).join('；');
}

const roleLabelsFull = { werewolf: '狼人', seer: '预言家', witch: '女巫', hunter: '猎人', guard: '守卫', villager: '村民' };

function generateStrategyAdvice() {
  const role = state.role;
  const scores = scoreSuspects();
  const suspectList = [...scores.entries()].filter(([, v]) => v.score > 0).sort((a, b) => b[1].score - a[1].score);

  const base = {
    werewolf: '伪装好人，统一投票。击杀优先级：预言家 > 女巫 > 猎人。',
    seer: '谨慎查验，择机公开。有对跳就立刻反击，没对跳可以观察一轮。',
    witch: '解药救人、毒药杀狼。关键是判断谁被刀以及谁值得救。',
    hunter: '发言强硬，死后精准开枪。你的存在本身就能震慑狼人。',
    guard: '保护关键角色，不要连续守同一人。优先守预言家。',
    villager: '积极分析发言逻辑，投票时做出正确选择。你是好人的中坚力量。',
  };

  let advice = base[role] || '认真分析局势。';
  if (suspectList.length > 0) {
    const [pid] = suspectList[0];
    advice += ` 当前重点怀疑${tag(pid)}。`;
  }
  return advice;
}

function generateDeathSummary() {
  const results = [];
  for (const entry of state.log) {
    if (entry.event === 'deaths' && entry.data.deadIds?.length > 0) {
      const names = entry.data.deadIds.map(id => {
        const p = state.players[id];
        const role = p?.revealedRole ? `(${roleLabelsFull[p.revealedRole] || p.revealedRole})` : '';
        return tag(id) + role;
      }).join('、');
      results.push(`${entry.phase === 'night' ? '夜' : '日'}：${names}`);
    }
    if (entry.event === 'hunter_shoot' && entry.data.targetId) {
      results.push(`${entry.phase === 'night' ? '夜' : '日'}：猎人带走${tag(entry.data.targetId)}`);
    }
  }
  return results.length > 0 ? `死亡记录：${results.join('；')}` : '暂无死亡。';
}
