import { ref } from 'vue';

export function useWebSocket() {
  const connected = ref(false);
  function send(action, payload = {}) {
    // placeholder - will be implemented in Task 2
  }
  return { send, connected };
}
