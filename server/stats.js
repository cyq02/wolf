const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, '..', 'data', 'stats.json');

function ensureStatsFile() {
  const dir = path.dirname(STATS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STATS_FILE)) fs.writeFileSync(STATS_FILE, JSON.stringify({ matches: [], playerStats: {} }));
}

function loadStats() {
  ensureStatsFile();
  try {
    return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
  } catch { return { matches: [], playerStats: {} }; }
}

function saveMatch(matchData) {
  const stats = loadStats();
  stats.matches.push(matchData);
  if (stats.matches.length > 100) stats.matches = stats.matches.slice(-100);

  for (const player of matchData.players) {
    if (player.isBot) continue;
    if (!stats.playerStats[player.name]) {
      stats.playerStats[player.name] = { gamesPlayed: 0, wins: 0, mvpCount: 0 };
    }
    stats.playerStats[player.name].gamesPlayed++;
    const playerWon = (matchData.winner === 'wolf' && player.role === 'werewolf') ||
                      (matchData.winner !== 'wolf' && player.role !== 'werewolf');
    if (playerWon) stats.playerStats[player.name].wins++;
    if (player.isMvp) stats.playerStats[player.name].mvpCount++;
  }

  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

function getPlayerStats(name) {
  const stats = loadStats();
  return stats.playerStats[name] || null;
}

function getTopStats(limit = 10) {
  const stats = loadStats();
  return Object.entries(stats.playerStats)
    .map(([name, s]) => ({ name, ...s, winRate: s.gamesPlayed > 0 ? (s.wins / s.gamesPlayed * 100).toFixed(1) : '0' }))
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
    .slice(0, limit);
}

module.exports = { saveMatch, getPlayerStats, getTopStats };
