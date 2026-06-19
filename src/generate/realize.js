// The realizer — arcs to notes. (Input Spec §5, §6)
//
// The structural arc (scale degrees + tension) is voiced into actual note events in
// a key: a degree becomes a pitch on the scale, tension becomes loudness, the
// cadence note is held longer. This is the SURFACE layer — the voicing the spec
// says a learned grammar would teach. Here it is a plain, deterministic voicing, so
// the generated output is a real note-event stream playable through the same path.

import { noteName } from '../stream/index.js';

// Diatonic scales as semitone offsets from the tonic. Natural minor for the minor
// mode (the leading tone arrives via the cadence's degree −1 → 0 motion).
export const SCALES = Object.freeze({
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
});

// Scale degree (0 = tonic, 7 = octave, −1 = leading tone) → MIDI pitch in the key.
export const degreeToPitch = (degree, { tonic = 0, octave = 4, mode = 'major' } = {}) => {
  const scale = SCALES[mode] || SCALES.major;
  const idx = ((degree % 7) + 7) % 7;
  const oct = Math.floor(degree / 7);
  return 12 * (octave + 1) + tonic + scale[idx] + 12 * oct;   // MIDI: octave 4, tonic 0 → 60 (C4)
};

// Voice one arc into note events, starting at `startOnset` (ms). Returns the events
// and the onset where the next arc begins.
export const realizeArc = (arc, { tonic = 0, octave = 4, mode = 'major', startOnset = 0, beatMs = 420 } = {}) => {
  const events = [];
  let onset = startOnset;
  arc.steps.forEach((step, i) => {
    const pitch = degreeToPitch(step.degree, { tonic, octave, mode });
    const isCadence = step.cadence || i === arc.steps.length - 1;
    const duration = Math.round((isCadence ? beatMs * 2 : beatMs) * 0.92);   // small gap between notes
    const velocity = 64 + Math.round(step.tension * 55);                     // tension → loudness, 64..119
    events.push({ pitch, onset: Math.round(onset), duration, velocity, channel: 0, note: noteName(pitch) });
    onset += isCadence ? beatMs * 2 : beatMs;
  });
  return { events, endOnset: onset };
};
