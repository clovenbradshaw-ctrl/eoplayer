// The soundfont backend — the spec's named ear. (Input Spec §2)
//
// midicube (an ES6-maintained fork of MIDI.js) plays notes from soundfonts, so you
// can hear what was loaded and what the engine generates with a real instrument
// timbre. It is output only — kept separate from the engine, consuming the same
// note-event stream the engine reads, so loaded files and generated output play
// through the identical path. Browser-only and network-dependent (the soundfont is
// fetched and cached separately from the persisted library), so it falls back to
// the always-available Web Audio backend if midicube or its soundfont can't load.

import { createWebAudioBackend } from './webaudio.js';

const MIDICUBE_URL = 'https://cdn.jsdelivr.net/npm/midicube@0.7/+esm';

export const createSoundfontBackend = async ({ instrument = 'acoustic_grand_piano' } = {}) => {
  try {
    const mod = await import(/* @vite-ignore */ MIDICUBE_URL);
    const MIDI = mod.default || mod;
    await new Promise((resolve, reject) => {
      MIDI.loadPlugin({
        instrument,
        onsuccess: resolve,
        onerror: reject,
      });
    });
    let t0 = 0;
    const timers = [];
    return {
      kind: 'soundfont',
      start() { t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now()); },
      schedule({ pitch, velocity = 80, channel = 0, startMs = 0, durationMs = 300 }) {
        const on = setTimeout(() => MIDI.noteOn(channel, pitch, velocity, 0), startMs);
        const off = setTimeout(() => MIDI.noteOff(channel, pitch, 0), startMs + durationMs);
        timers.push(on, off);
        void t0;
      },
      stop() { while (timers.length) clearTimeout(timers.pop()); for (let n = 0; n < 128; n++) MIDI.noteOff(0, n, 0); },
    };
  } catch {
    // No midicube, no network, or a soundfont that won't load — the ear still works.
    return createWebAudioBackend();
  }
};
