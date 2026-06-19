// Generation — the same stream produced in reverse. (Input Spec §5, §6, §7)
//
//   engine (arcs) → realizer (notes) → note-event stream → soundfont → ear
//                                ↘ stop at noteCount / arcCount / cadence
//
// One entry point. Pick a key (or derive it from a library selection's features —
// the spec's "learn the surface grammar of this style by reading the files tagged
// with it"), pick a control, and out comes a note-event stream with no file behind
// it, played through the same player as a loaded file. The key is the only "learned
// surface" input here; the structure (where to build tension) is the arc's own.

import { rng, makeArc } from './arc.js';
import { realizeArc } from './realize.js';
import { accumulateByControl } from './count.js';
import { createStream, PC_NAME } from '../stream/index.js';

const FLAT_TO_SHARP = { DB: 'C#', EB: 'D#', GB: 'F#', AB: 'G#', BB: 'A#', CB: 'B', FB: 'E' };

const tonicToPc = (t) => {
  if (typeof t === 'number') return ((Math.round(t) % 12) + 12) % 12;
  const m = /^([A-Ga-g])([#b]?)/.exec(String(t).trim());
  if (!m) return 0;
  let name = m[1].toUpperCase() + (m[2] || '');
  if (name.endsWith('b')) name = FLAT_TO_SHARP[name.toUpperCase()] || name[0].toUpperCase();
  const i = PC_NAME.indexOf(name);
  return i >= 0 ? i : 0;
};

// Accept "C major", "Eb minor", { tonic:'C', mode:'major' }, { tonic:2, mode:'minor' },
// or a library features object ({ tonic:'D', mode:'minor', key:'D minor' }).
export const parseKey = (key) => {
  let tonic = 0, mode = 'major';
  if (key && typeof key === 'object') {
    mode = key.mode === 'minor' ? 'minor' : 'major';
    tonic = tonicToPc(key.tonic ?? key.tonicName ?? key.key ?? 0);
    if (typeof (key.key) === 'string' && key.tonic == null && key.tonicName == null) {
      tonic = tonicToPc(key.key);
      if (/min/i.test(key.key)) mode = 'minor';
    }
  } else if (typeof key === 'string') {
    tonic = tonicToPc(key);
    if (/\bmin/i.test(key) || /\bm\b/.test(key)) mode = 'minor';
  }
  return { tonic, mode, name: `${PC_NAME[tonic]} ${mode}` };
};

// generate(opts):
//   { key, seed, octave, beatMs }                       — the voicing
//   one of:
//     { noteCount: N, soft }   N notes (soft=true finishes the phrase; default)
//     { arcCount: N }          N tension-release cycles
//     { untilResolved: true }  to the next full cadence
// Returns { stream, meta }. The stream is source:'generated' and reads/plays through
// the identical path as a loaded file.
export const generate = (opts = {}) => {
  const { key = 'C major', seed = 1, octave = 4, beatMs = 420, soft = true, minLen, maxLen, name } = opts;
  const { tonic, mode, name: keyName } = parseKey(key);
  const r = rng(seed);

  let onset = 0;
  const produceArc = () => {
    const arc = makeArc(r, { minLen, maxLen });
    const { events, endOnset } = realizeArc(arc, { tonic, octave, mode, startOnset: onset, beatMs });
    onset = endOnset;
    return { events, endOnset, arc };
  };

  let control;
  if (opts.arcCount != null) control = { type: 'arcCount', n: opts.arcCount };
  else if (opts.untilResolved) control = { type: 'untilResolved' };
  else control = { type: 'noteCount', n: opts.noteCount ?? 8, soft };

  const { events, arcs, endedOn, requested, notes } = accumulateByControl(produceArc, control);
  const stream = createStream({
    name: name || `composition · ${keyName}`,
    events,
    tempo: Math.round(60000 / beatMs),
    source: 'generated',
  });

  return {
    stream,
    meta: {
      key: keyName, tonic, mode, seed,
      control: control.type, requested, soft: control.type === 'noteCount' ? soft : undefined,
      endedOn,                       // 'arc' | 'cadence' | 'hard'
      arcs: arcs.length,
      notes,
    },
  };
};
