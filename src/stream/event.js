// The unit. (eocomposer Input Spec §1)
//
// Input is a stream of tonal events, ordered in time, each event a note with
// pitch, onset, duration, velocity. That is the unit. Everything in the fork
// converts a source into this one shape, and once it is in this shape the engine
// reads it the same whether it came from a file on disk or a key pressed a second
// ago. A MIDI file is this stream recorded; a live keyboard is this stream
// arriving in real time; the generator is this stream produced in reverse.
//
//   note event = { pitch (MIDI 0..127), onset, duration, velocity, channel }
//
// onset/duration are in MILLISECONDS once a stream is built (the file adapter
// converts ticks→ms with the tempo map; the live adapter stamps onset = now).
// Holding one time unit past the adapters means the engine, the player, and the
// library never ask where the stream came from.

export const PC_NAME = Object.freeze(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);

// MIDI pitch → pitch class index 0..11 (C=0). The mod that makes every C "the same
// note" — the octave equivalence the engine then re-discovers from sightings.
export const pitchClass = (pitch) => ((Math.round(pitch) % 12) + 12) % 12;

// MIDI pitch → a readable name like "C4" (MIDI 60 = C4, the common convention).
export const noteName = (pitch) => {
  const p = Math.round(pitch);
  return `${PC_NAME[pitchClass(p)]}${Math.floor(p / 12) - 1}`;
};

// The signed melodic step between two pitches, named by arithmetic on the two
// numbers and nothing else — never a theory-laden interval name. "rep" is a held
// or repeated pitch (no motion); the engine reads it as a non-event on the line.
export const interval = (a, b) => {
  const d = Math.round(b) - Math.round(a);
  return d === 0 ? 'rep' : (d > 0 ? `up${d}` : `down${-d}`);
};

const clampInt = (x, lo, hi, dflt) => {
  const n = Math.round(Number(x));
  if (!Number.isFinite(n)) return dflt;
  return n < lo ? lo : n > hi ? hi : n;
};

const nonNegative = (x, dflt) => {
  const n = Number(x);
  return Number.isFinite(n) && n >= 0 ? n : dflt;
};

// Normalize any loose partial into a canonical note event. Adapters produce these;
// the rest of the fork only ever sees the canonical shape. Pitch and velocity are
// clamped to the MIDI 0..127 range; onset/duration are coerced to non-negative
// numbers (milliseconds); channel defaults to 0.
export const noteEvent = (partial = {}) => Object.freeze({
  pitch:    clampInt(partial.pitch, 0, 127, 60),
  onset:    nonNegative(partial.onset, 0),
  duration: nonNegative(partial.duration, 0),
  velocity: clampInt(partial.velocity ?? 80, 0, 127, 80),
  channel:  clampInt(partial.channel ?? 0, 0, 15, 0),
});

export const isNoteEvent = (e) =>
  !!e && Number.isFinite(e.pitch) && Number.isFinite(e.onset) &&
  Number.isFinite(e.duration) && Number.isFinite(e.velocity);

// The reading order: a stream is read in time. Sort by onset, then by pitch so a
// chord (notes sharing an onset) reads low→high deterministically — same stream,
// same reading line, every time.
export const byReadingLine = (a, b) => (a.onset - b.onset) || (a.pitch - b.pitch);
