// A Web Audio backend — the always-available ear. (Input Spec §2)
//
// midicube/soundfont give richer timbres but need a soundfont fetched over the
// network; a plain oscillator needs nothing and always works, so it is the reliable
// floor under the soundfont player. Browser-only: constructed lazily by the UI when
// the user first hits play (an AudioContext may only start from a gesture).

const midiToHz = (pitch) => 440 * Math.pow(2, (pitch - 69) / 12);

export const createWebAudioBackend = ({ wave = 'triangle', gain = 0.18 } = {}) => {
  if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') {
    throw new Error('Web Audio is unavailable here (browser only).');
  }
  const Ctx = typeof AudioContext !== 'undefined' ? AudioContext : webkitAudioContext;
  const ctx = new Ctx();
  let t0 = ctx.currentTime;
  const live = new Set();   // active oscillators, so stop() can silence everything

  return {
    kind: 'webaudio',
    start() { t0 = ctx.currentTime + 0.05; if (ctx.state === 'suspended') ctx.resume(); },
    schedule({ pitch, velocity = 80, startMs = 0, durationMs = 300 }) {
      const start = t0 + startMs / 1000;
      const end = start + Math.max(0.05, durationMs / 1000);
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = midiToHz(pitch);
      const peak = gain * (velocity / 127);
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(peak, start + 0.01);   // a soft attack
      env.gain.exponentialRampToValueAtTime(0.0001, end);     // and decay — not a square click
      osc.connect(env).connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
      live.add(osc);
      osc.onended = () => live.delete(osc);
    },
    stop() { for (const o of live) { try { o.stop(); } catch { /* already stopped */ } } live.clear(); },
  };
};
