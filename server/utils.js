function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function generateRoomId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ROLE_PRESETS = {
  6:  ['werewolf', 'seer', 'witch', 'villager', 'villager', 'villager'],
  8:  ['werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'villager', 'villager', 'villager'],
  9:  ['werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager', 'villager'],
  10: ['werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager', 'villager'],
  12: ['werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager', 'villager', 'villager', 'villager'],
};

module.exports = { generateId, generateRoomId, shuffle, ROLE_PRESETS };
