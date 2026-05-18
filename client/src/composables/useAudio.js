import { ref } from 'vue';

const audioEnabled = ref(true);
let audioCtx = null;

function ctx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, dur, type = 'sine', vol = 0.3) {
  if (!audioEnabled.value) return;
  const c = ctx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  gain.gain.setValueAtTime(vol, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + dur);
}

function sweep(startF, endF, dur, type = 'sine', vol = 0.15) {
  if (!audioEnabled.value) return;
  const c = ctx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startF, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(endF, c.currentTime + dur);
  gain.gain.setValueAtTime(vol, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + dur);
}

const sfx = {
  countdownTick: () => playTone(800, 0.08, 'square', 0.1),
  deathAnnounce: () => { playTone(200, 0.5, 'sawtooth', 0.15); setTimeout(() => playTone(150, 0.8, 'sawtooth', 0.1), 300); },
  voteResult: () => playTone(440, 0.15, 'triangle', 0.15),
  phaseWhoosh: () => sweep(200, 800, 0.35, 'sine', 0.12),
  hunterShot: () => { playTone(100, 0.3, 'sawtooth', 0.2); playTone(80, 0.4, 'square', 0.15); },
  gameEnd: () => { playTone(523, 0.2, 'triangle', 0.15); setTimeout(() => playTone(659, 0.2, 'triangle', 0.15), 200); setTimeout(() => playTone(784, 0.4, 'triangle', 0.15), 400); },
};

let nightOsc = null;
let nightGain = null;
let dayOsc = null;
let dayGain = null;

function startNightAmbient() {
  if (!audioEnabled.value || nightOsc) return;
  const c = ctx();
  nightOsc = c.createOscillator();
  nightGain = c.createGain();
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  nightOsc.type = 'sine';
  nightOsc.frequency.setValueAtTime(82, c.currentTime);
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(0.3, c.currentTime);
  lfoGain.gain.setValueAtTime(8, c.currentTime);
  lfo.connect(lfoGain);
  lfoGain.connect(nightOsc.frequency);
  nightGain.gain.setValueAtTime(0.03, c.currentTime);
  nightOsc.connect(nightGain);
  nightGain.connect(c.destination);
  nightOsc.start();
  lfo.start();
}

function stopNightAmbient() {
  if (nightOsc) { nightOsc.stop(); nightOsc = null; nightGain = null; }
}

function startDayAmbient() {
  if (!audioEnabled.value || dayOsc) return;
  const c = ctx();
  dayOsc = c.createOscillator();
  dayGain = c.createGain();
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  dayOsc.type = 'triangle';
  dayOsc.frequency.setValueAtTime(220, c.currentTime);
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(0.2, c.currentTime);
  lfoGain.gain.setValueAtTime(12, c.currentTime);
  lfo.connect(lfoGain);
  lfoGain.connect(dayOsc.frequency);
  dayGain.gain.setValueAtTime(0.02, c.currentTime);
  dayOsc.connect(dayGain);
  dayGain.connect(c.destination);
  dayOsc.start();
  lfo.start();
}

function stopDayAmbient() {
  if (dayOsc) { dayOsc.stop(); dayOsc = null; dayGain = null; }
}

function stopAll() {
  stopNightAmbient();
  stopDayAmbient();
}

export function useAudio() {
  return {
    audioEnabled,
    toggleAudio: () => { audioEnabled.value = !audioEnabled.value; if (!audioEnabled.value) stopAll(); },
    sfx,
    startNightAmbient,
    stopNightAmbient,
    startDayAmbient,
    stopDayAmbient,
    stopAll,
  };
}
