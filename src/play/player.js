// The player — one player for every stream. (Input Spec §1, §7)
//
// Three stages, one stream between them: the parser produces the stream, the engine
// reads the stream, the player sounds the stream. A generated melody is just a
// stream with no file behind it, played through this same player — which is why
// playback of a loaded file and playback of a composition are the same code. The
// player is backend-agnostic: a recording sink under Node, a soundfont or Web Audio
// backend in the browser. It only ever sees the stream.

import { byReadingLine } from '../stream/index.js';

export const createPlayer = ({ backend } = {}) => {
  if (!backend) throw new Error('createPlayer: a backend is required (sink / webaudio / soundfont)');
  let playing = null;

  return {
    kind: backend.kind,

    // Sound a stream. Every note is scheduled relative to the stream's own onsets,
    // so the timing the player hears is the timing the stream carries — whether it
    // came from a file, a live take, or the generator. `at` offsets the whole stream.
    play(stream, { at = 0 } = {}) {
      const events = [...stream.events].sort(byReadingLine);
      backend.start?.();
      for (const e of events) {
        backend.schedule({
          pitch: e.pitch,
          velocity: e.velocity,
          channel: e.channel ?? 0,
          startMs: Math.max(0, e.onset - at),
          durationMs: e.duration,
        });
      }
      playing = stream;
      return {
        stream,
        notes: events.length,
        durationMs: stream.durationMs,
        stop: () => { backend.stop?.(); playing = null; },
      };
    },

    stop() { backend.stop?.(); playing = null; },
    get playing() { return playing; },
  };
};
