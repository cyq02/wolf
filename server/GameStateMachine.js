class GameStateMachine {
  constructor(room, roomManager) {
    this.room = room;
    this.rm = roomManager;
  }

  start() {
    // Will be implemented in Task 4
  }

  handleAction(playerId, actionType, payload) {
    // Will be implemented in Task 4
  }

  sendCurrentState(playerId) {
    // Will be implemented in Task 4
  }
}

module.exports = { GameStateMachine };
