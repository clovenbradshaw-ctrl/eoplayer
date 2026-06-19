// Continuation — the reader keeps going. (Input Spec §3, §5; the point of the fork.)
//
// This is where reading and generating turn out to be one faculty pointed two ways.
// The reading engine is a PREDICTOR: at every cursor it builds a prior over what
// note comes next and measures its surprise when the next note lands. Run that
// forward with no input and the predictor IS a generator — emit the prediction,
// then predict again from it. So "play three notes and it plays the fourth" and
// "load a file, cut it off, let the generation take over" are the same operation:
//   read a PREFIX → recover its frame (key, register, tempo) → keep going in that
//   frame → append onto the SAME stream.
// What you played and what it wrote are one stream; the seam is marked for the eye
// (meta.seam) and inaudible to the ear.

import { rng, makeArc } from './arc.js';
import { realizeArc } from './realize.js';
import { accumulateByControl } from './count.js';
import { createStream, byReadingLine } from '../stream/index.js';
import { estimateKey } from '../library/index.js';
import { readingAt } from '../engine/index.js';

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Pick the octave that puts the key's tonic nearest the last pitch — so the
// continuation comes out in the same hand you were playing in, not an octave away.
const octaveNearest = (tonic, pitch) => {
  let best = 4, bd = Infinity;
  for (let o = 1; o <= 7; o++) { const d = Math.abs((12 * (o + 1) + tonic) - pitch); if (d < bd) { bd = d; best = o; } }
  return best;
};

// What the reader literally predicts comes next at the end of the prefix — the
// ranked pitch classes by γ-mass. Surfaced for the status line so the connection
// between reading and generating is visible, not just asserted.
export const predictedNext = (prefix) => {
  try {
    const doc = prefix.toDoc();
    if (!doc.sequence.length) return null;
    return readingAt(doc, doc.sequence.length - 1).predicted;   // { op:'REC', figures:[…] }
  } catch { return null; }
};

// continueStream(prefix, opts):
//   opts.noteCount / opts.soft   add ~N notes, finishing the phrase (default)
//   opts.arcCount                add N tension-release arcs
//   opts.untilResolved           add one arc, to the next cadence
//   opts.seed                    override the (otherwise prefix-derived) seed
// Returns { stream, meta }. stream is prefix + continuation as ONE source:'generated'
// stream; meta.seam is the index where yours ends and the machine's begins.
export const continueStream = (prefix, opts = {}) => {
  const pref = [...prefix.events].sort(byReadingLine);
  if (!pref.length) throw new Error('continueStream: nothing to continue from — play or load some notes first.');

  // --- The frame the engine reads out of the prefix. -----------------------------
  const key = estimateKey(pref);                       // tonic + mode (Krumhansl–Schmuckler)
  const { tonic, mode } = key;
  const last = pref[pref.length - 1];
  const endOnset = pref.reduce((m, e) => Math.max(m, e.onset + e.duration), 0);
  const octave = octaveNearest(tonic, last.pitch);

  // Tempo: how fast you actually played (median gap between onsets), else the
  // stream's tempo — so the continuation keeps your pace. Clamped to a sane band.
  const onsets = [...new Set(pref.map(e => Math.round(e.onset)))].sort((a, b) => a - b);
  const iois = [];
  for (let i = 1; i < onsets.length; i++) { const d = onsets[i] - onsets[i - 1]; if (d > 0) iois.push(d); }
  const beatMs = Math.max(150, Math.min(900, Math.round(iois.length ? median(iois) : 60000 / (prefix.tempo || 120))));

  // --- Generate the continuation in that frame, starting after the prefix. --------
  const r = rng(opts.seed ?? (((last.pitch * 31 + pref.length) >>> 0) || 1));
  let onset = endOnset + Math.round(beatMs * 0.5);     // one half-beat of breath at the seam
  const produceArc = () => {
    const arc = makeArc(r, { minLen: opts.minLen, maxLen: opts.maxLen });
    const { events, endOnset: eo } = realizeArc(arc, { tonic, octave, mode, startOnset: onset, beatMs });
    onset = eo;
    return { events, endOnset: eo, arc };
  };

  let control;
  if (opts.arcCount != null) control = { type: 'arcCount', n: opts.arcCount };
  else if (opts.untilResolved) control = { type: 'untilResolved' };
  else control = { type: 'noteCount', n: opts.noteCount ?? 8, soft: opts.soft !== false };

  const { events: cont, arcs, endedOn } = accumulateByControl(produceArc, control);

  // --- One stream: prefix + continuation, with the seam recorded. -----------------
  const events = [...pref, ...cont];
  const stream = createStream({
    name: opts.name || `${prefix.name} → continued`,
    events,
    tempo: prefix.tempo || Math.round(60000 / beatMs),
    source: 'generated',
  });

  return {
    stream,
    meta: {
      key: key.name, tonic, mode,
      seam: pref.length,            // events[0..seam) are yours; [seam..] are the machine's
      seamOnset: endOnset,
      primedNotes: pref.length,
      addedNotes: cont.length,
      predicted: predictedNext(prefix),
      beatMs, octave, endedOn, arcs: arcs.length, notes: events.length,
    },
  };
};
