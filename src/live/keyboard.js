// Reading a live keyboard. (Input Spec §3)
//
// The live keyboard produces the identical note-event stream as a file, only
// arriving in real time rather than all at once. A key press becomes a note event
// with onset = now, and it flows into the same engine input. This is the moment
// the architecture pays off: the engine reading a live performance and the engine
// reading a file are the same engine reading the same stream — so everything it
// does to a file (surprise, strain, the DEF of a key, the REC at a cadence) it
// does to a live player in real time, the cursor riding the live present.
//
// This file is the PURE core — raw note-on / note-off in, completed note events
// out — so the conversion is testable with no MIDI hardware. `webmidi.js` wires a
// real device to it; both feed the same stream.

import { createStream } from '../stream/index.js';

// A live session. Press a key (noteOn) and the onset is stamped NOW; release it
// (noteOff) and the duration is the time held. The completed event is appended to
// the stream — the same canonical event a file yields — and every subscriber is
// notified so the engine can read the freshly-arrived cursor. `onPress` fires at
// strike time (before duration is known) so the ear hears the player with no lag.
export const createLiveInput = ({ stream, now = () => Date.now(), name = 'live', onPress } = {}) => {
  const target = stream || createStream({ name, source: 'live' });
  const pending = new Map();        // pitch → { onset, velocity } held but not yet released
  const subscribers = new Set();
  const base = now();               // t=0 of this session, so onsets start near zero

  const notify = (event) => { for (const fn of subscribers) { try { fn(event, target); } catch { /* best-effort */ } } };

  const noteOn = (pitch, velocity = 80, t = now()) => {
    pending.set(pitch, { onset: t - base, velocity });
    if (typeof onPress === 'function') { try { onPress({ pitch, velocity }); } catch { /* best-effort */ } }
  };

  const noteOff = (pitch, t = now()) => {
    const held = pending.get(pitch);
    if (!held) return null;          // a release with no press — ignore (engine never sees a half-event)
    pending.delete(pitch);
    const event = { pitch, onset: held.onset, duration: Math.max(0, (t - base) - held.onset), velocity: held.velocity, channel: 0 };
    target.add(event);
    notify(event);                   // the live cursor advances; a reader can readingAt(target.toDoc(), last)
    return event;
  };

  return {
    stream: target,
    noteOn,
    noteOff,
    // Subscribe to completed notes — the real-time tap the engine reads through.
    onNote(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    get pendingCount() { return pending.size; },
  };
};
