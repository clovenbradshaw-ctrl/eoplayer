// The stream — an ordered sequence of note events, the thing the operator engine
// reads. (Input Spec §1, §7)
//
// This is the one internal representation. The file adapter, the live adapter, and
// the generator all produce a stream; the engine reads a stream; the player sounds
// a stream. Three stages, one stream between them. A generated melody is just a
// stream with no file behind it, played through the same player, which is why
// playback of a loaded file and playback of a composition are the same code.
//
// `toDoc()` is the seam to the engine. It folds the note events into the exact
// INS/CON event log eoreader4's reading reads — one INS per note (the pitch class
// is the recurring entity, so every C is "the same note", the way every "Gregor"
// tokenizes to one entity), one CON bonding each note to the one before it along
// the reading line, labelled by the bare interval. Nothing here says which note is
// the tonic or where the phrases fall; that is left for the engine to EXTRACT.

import { createLog, projectGraph } from '../engine/index.js';
import { noteEvent, byReadingLine, pitchClass, noteName, interval, PC_NAME } from './event.js';

let nextStreamId = 1;

export const createStream = ({ name, events = [], tempo = 120, ppq = 480, source = 'unknown' } = {}) => {
  const id = nextStreamId++;
  // Normalize and order on the way in. The stream is the invariant; everything
  // downstream trusts it is canonical and time-ordered.
  let notes = events.map(noteEvent).sort(byReadingLine);

  const api = {
    id,
    name: name || `stream-${id}`,
    source,            // 'file' | 'live' | 'generated' — provenance only; the engine ignores it
    tempo,             // BPM, from the file header or a default; informs playback and tempo features
    ppq,               // ticks per quarter note (file-native resolution; ms is the stream's unit)

    get events() { return notes; },
    get length() { return notes.length; },

    // A live stream grows one key-press at a time. Appended events are re-sorted so
    // the reading line stays honest even if onsets arrive slightly out of order.
    add(ev) {
      notes = [...notes, noteEvent(ev)].sort(byReadingLine);
      return api;
    },

    // Total sounding length in milliseconds: the last note's release.
    get durationMs() {
      let end = 0;
      for (const n of notes) end = Math.max(end, n.onset + n.duration);
      return end;
    },

    // The lowest and highest pitch present — the stream's register.
    get range() {
      if (!notes.length) return null;
      let lo = 127, hi = 0;
      for (const n of notes) { if (n.pitch < lo) lo = n.pitch; if (n.pitch > hi) hi = n.pitch; }
      return { lo, hi, span: hi - lo };
    },

    clone(overrides = {}) {
      return createStream({ name: api.name, events: notes, tempo: api.tempo, ppq: api.ppq, source: api.source, ...overrides });
    },

    // The seam to the engine. Fold the note-event stream into the { log, units,
    // sentences, sequence, projectGraph } doc shape the reading reads — the same
    // shape eoreader4's text/image/frequency adapters produce. The engine that
    // reads a novel now reads this, with no idea it is music.
    toDoc() {
      const log = createLog({ docId: api.name });
      const units = [], sentences = [], sequence = [], mentions = new Map();
      let prev = null;
      notes.forEach((n, idx) => {
        const pc = pitchClass(n.pitch);
        const pcName = PC_NAME[pc];
        const eid = pcName;                 // the pitch class is the recurring entity

        log.append({ op: 'INS', id: eid, label: pcName, sentIdx: idx });
        mentions.set(eid, [...(mentions.get(eid) || []), idx]);

        // The reading line: bond this note to the one before it, labelled by the
        // interval the two pitch numbers imply. Same pitch class twice is a held
        // note, not a step — no self-edge (matches the music adapter).
        if (prev && prev.id !== eid) {
          log.append({ op: 'CON', src: prev.id, tgt: eid, via: interval(prev.pitch, n.pitch), sentIdx: idx });
        }

        units.push(`${noteName(n.pitch)} (t=${Math.round(n.onset)}ms)`);
        sentences.push(pcName);
        sequence.push({ note: noteName(n.pitch), pitch: n.pitch, pc, id: eid, unitIdx: idx, onset: n.onset, duration: n.duration, velocity: n.velocity });
        prev = { id: eid, pitch: n.pitch };
      });

      return {
        docId: api.name, modality: 'music',
        units, sentences, sequence, mentions, log,
        projectGraph: (frame = {}) => projectGraph(log, frame),
      };
    },
  };

  return api;
};

// Convenience: a stream straight from an array of loose note partials.
export const streamOf = (events, meta = {}) => createStream({ ...meta, events });

export const isStream = (x) => !!x && typeof x.toDoc === 'function' && Array.isArray(x.events);
