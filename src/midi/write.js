// Writing a stream back to a .mid binary. (Input Spec §2, the reverse of the load)
//
// Generation produces a note-event stream with no file behind it; this lets that
// stream be saved as a Standard MIDI File — the same format a loaded file arrived
// in. It also closes the test loop: write a known melody to bytes, parse it back,
// and the note events must survive the round trip.

const vlq = (n) => {
  const out = [n & 0x7f];
  n >>= 7;
  while (n > 0) { out.unshift((n & 0x7f) | 0x80); n >>= 7; }
  return out;
};
const u16 = (n) => [(n >> 8) & 0xff, n & 0xff];
const u32 = (n) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const ascii = (s) => [...s].map(c => c.charCodeAt(0));

// note events (ms) → Standard MIDI File, format 0 (one track). Onsets/durations are
// converted to ticks against the given tempo and PPQ.
export const writeMidi = (events, { tempo = 120, ppq = 480 } = {}) => {
  const msPerQuarter = 60000 / tempo;
  const toTick = (ms) => Math.max(0, Math.round((ms / msPerQuarter) * ppq));

  // One on-edge and one off-edge per note, in tick order. At a tie, off precedes on
  // so a re-struck pitch isn't silenced by its own predecessor's release.
  const edges = [];
  for (const e of events) {
    const start = toTick(e.onset);
    const end = Math.max(start + 1, toTick(e.onset + e.duration));
    const ch = (e.channel ?? 0) & 0x0f;
    edges.push({ tick: start, kind: 1, ch, note: e.pitch & 0x7f, vel: (e.velocity ?? 80) & 0x7f });
    edges.push({ tick: end, kind: 0, ch, note: e.pitch & 0x7f, vel: 0 });
  }
  edges.sort((a, b) => (a.tick - b.tick) || (a.kind - b.kind));

  const track = [];
  // Tempo meta at tick 0, so the file carries the same clock the stream played at.
  const us = Math.round(60000000 / tempo);
  track.push(...vlq(0), 0xff, 0x51, 0x03, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff);

  let last = 0;
  for (const e of edges) {
    track.push(...vlq(e.tick - last));
    last = e.tick;
    track.push((e.kind ? 0x90 : 0x80) | e.ch, e.note, e.vel);
  }
  track.push(...vlq(0), 0xff, 0x2f, 0x00);   // end of track

  const header = [...ascii('MThd'), ...u32(6), ...u16(0), ...u16(1), ...u16(ppq)];
  const trackChunk = [...ascii('MTrk'), ...u32(track.length), ...track];
  return Uint8Array.from([...header, ...trackChunk]);
};
