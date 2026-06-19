// Reading MIDI files. (Input Spec §2)
//
// Turn a .mid binary (Uint8Array / ArrayBuffer / Buffer) into note events. The
// spec names midi-parser-js for the browser; we ship a small, dependency-free
// Standard MIDI File reader instead, for the same reason eoreader4 keeps its
// adapters dependency-free: it runs in the browser AND in Node, so the file path
// is genuinely testable with no GPU and no server. The browser UI may still hand
// midi-parser-js's JSON to `notesFromMidiJson` below; both routes end in the same
// note-event stream.
//
// The reader extracts note-on/note-off PAIRS into note events and reads the tempo
// map so onsets land in milliseconds — the stream's one time unit. Everything
// structural beyond that (key, phrasing, significance) is left for the engine.

const asBytes = (input) => {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer?.(input)) return new Uint8Array(input);
  if (Array.isArray(input)) return Uint8Array.from(input);
  throw new TypeError('parseMidi: expected Uint8Array, ArrayBuffer, Buffer, or byte array');
};

// A forward cursor over the bytes, big-endian — the byte order SMF is written in.
const reader = (bytes) => {
  let p = 0;
  return {
    get pos() { return p; },
    set pos(v) { p = v; },
    get done() { return p >= bytes.length; },
    u8() { return bytes[p++]; },
    u16() { const v = (bytes[p] << 8) | bytes[p + 1]; p += 2; return v; },
    u32() { const v = (bytes[p] * 0x1000000) + (bytes[p + 1] << 16) + (bytes[p + 2] << 8) + bytes[p + 3]; p += 4; return v; },
    str(n) { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(bytes[p++]); return s; },
    bytes(n) { const v = bytes.subarray(p, p + n); p += n; return v; },
    // Variable-length quantity — the delta-time and meta/sysex length encoding.
    vlq() { let v = 0, b; do { b = bytes[p++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; },
  };
};

// Walk one MTrk chunk, returning its note-on/off and tempo events in ABSOLUTE
// ticks. Running status is honored (a data byte where a status is expected reuses
// the previous status). Note-on with velocity 0 is a note-off, per the spec.
const parseTrack = (r, end) => {
  const noteEdges = [];   // { tick, type:'on'|'off', channel, note, velocity }
  const tempos = [];      // { tick, usPerQuarter }
  let tick = 0;
  let status = 0;

  while (r.pos < end) {
    tick += r.vlq();
    let b = r.u8();
    if (b & 0x80) { status = b; } else { r.pos -= 1; }   // running status: reuse last
    const hi = status & 0xf0;
    const channel = status & 0x0f;

    if (status === 0xff) {                 // meta event
      const type = r.u8();
      const len = r.vlq();
      if (type === 0x51 && len === 3) {    // set tempo (microseconds per quarter note)
        const us = (r.bytes(3)); tempos.push({ tick, usPerQuarter: (us[0] << 16) | (us[1] << 8) | us[2] });
      } else {
        r.bytes(len);                      // every other meta (track name, time sig, EOT…) is skipped
      }
    } else if (status === 0xf0 || status === 0xf7) {  // sysex
      r.bytes(r.vlq());
    } else if (hi === 0x90) {              // note on
      const note = r.u8(), velocity = r.u8();
      noteEdges.push({ tick, type: velocity > 0 ? 'on' : 'off', channel, note, velocity });
    } else if (hi === 0x80) {              // note off
      const note = r.u8(); r.u8();
      noteEdges.push({ tick, type: 'off', channel, note, velocity: 0 });
    } else if (hi === 0xa0 || hi === 0xb0 || hi === 0xe0) {
      r.u8(); r.u8();                      // 2 data bytes: aftertouch / control / pitch-bend — ignored
    } else if (hi === 0xc0 || hi === 0xd0) {
      r.u8();                              // 1 data byte: program / channel pressure — ignored
    } else {
      break;                              // unrecognized; stop this track rather than desync
    }
  }
  return { noteEdges, tempos };
};

// Pair note-on with the next matching note-off (same channel+note), FIFO so
// overlapping repeats of one pitch nest correctly. Emits notes in ticks.
const pairEdges = (edges) => {
  const pending = new Map();   // "ch:note" → [ {tick, velocity}, … ]
  const out = [];
  for (const e of edges) {
    const key = `${e.channel}:${e.note}`;
    if (e.type === 'on') {
      const q = pending.get(key) || []; q.push({ tick: e.tick, velocity: e.velocity }); pending.set(key, q);
    } else {
      const q = pending.get(key);
      if (q && q.length) {
        const start = q.shift();
        out.push({ note: e.note, channel: e.channel, startTick: start.tick, endTick: e.tick, velocity: start.velocity });
      }
    }
  }
  return out;
};

// Build a tick→ms converter from the merged tempo map and the file's PPQ. Between
// two tempo points the clock is linear; the converter sums the segments.
const tickToMsFn = (tempos, ppq) => {
  const map = [{ tick: 0, usPerQuarter: 500000 }, ...tempos].sort((a, b) => a.tick - b.tick);
  // Collapse to a clean ascending list (later entry at the same tick wins).
  const pts = [];
  for (const t of map) {
    if (pts.length && pts[pts.length - 1].tick === t.tick) pts[pts.length - 1] = t;
    else pts.push(t);
  }
  return (tick) => {
    let ms = 0;
    for (let i = 0; i < pts.length; i++) {
      const from = pts[i].tick;
      const to = (i + 1 < pts.length) ? pts[i + 1].tick : Infinity;
      if (tick <= from) break;
      const span = Math.min(tick, to) - from;
      ms += (span / ppq) * (pts[i].usPerQuarter / 1000);
      if (tick <= to) break;
    }
    return ms;
  };
};

// Parse a Standard MIDI File into a plain payload: note events (onset/duration in
// ms), the file PPQ, and the initial tempo in BPM. `createStreamFromMidi` (index)
// lifts this into a NoteStream.
export const parseMidi = (input, { name = 'midi' } = {}) => {
  const r = reader(asBytes(input));
  if (r.str(4) !== 'MThd') throw new Error('parseMidi: not a MIDI file (missing MThd)');
  r.u32();                                 // header length (always 6)
  r.u16();                                 // format 0/1/2 — handled uniformly below
  const ntracks = r.u16();
  const division = r.u16();
  // Top bit clear → ticks per quarter note. SMPTE timecode (top bit set) is rare;
  // fall back to a sane PPQ rather than mis-clock.
  const ppq = (division & 0x8000) ? 480 : (division || 480);

  const allEdges = [];
  const allTempos = [];
  for (let t = 0; t < ntracks && !r.done; t++) {
    if (r.str(4) !== 'MTrk') break;
    const len = r.u32();
    const end = r.pos + len;
    const { noteEdges, tempos } = parseTrack(r, end);
    allEdges.push(...noteEdges);
    allTempos.push(...tempos);
    r.pos = end;                           // resync to the declared chunk end
  }

  const toMs = tickToMsFn(allTempos, ppq);
  const initialUs = (allTempos.find(t => t.tick === 0) || allTempos[0] || { usPerQuarter: 500000 }).usPerQuarter;
  const tempoBPM = Math.round(60000000 / initialUs);

  const notes = pairEdges(allEdges)
    .map(n => ({
      pitch: n.note,
      onset: toMs(n.startTick),
      duration: Math.max(0, toMs(n.endTick) - toMs(n.startTick)),
      velocity: n.velocity,
      channel: n.channel,
    }))
    .sort((a, b) => (a.onset - b.onset) || (a.pitch - b.pitch));

  return { name, notes, ppq, tempo: tempoBPM };
};

// The browser may parse with midi-parser-js (per the spec) and hand us its JSON.
// This pulls the same note-on/off pairs out of that structure, so both routes end
// in one note-event stream. midi-parser-js yields { timeDivision, track:[{event:[
// { deltaTime, type, channel, data:[note,velocity] }]}] } with type 9 = note-on,
// 8 = note-off, 255/81 = tempo meta.
export const notesFromMidiJson = (mid, { name = 'midi' } = {}) => {
  const ppq = mid.timeDivision || 480;
  const edges = [], tempos = [];
  for (const track of mid.track || []) {
    let tick = 0;
    for (const ev of track.event || []) {
      tick += ev.deltaTime || 0;
      if (ev.type === 9) edges.push({ tick, type: (ev.data?.[1] > 0) ? 'on' : 'off', channel: ev.channel || 0, note: ev.data?.[0], velocity: ev.data?.[1] || 0 });
      else if (ev.type === 8) edges.push({ tick, type: 'off', channel: ev.channel || 0, note: ev.data?.[0], velocity: 0 });
      else if (ev.type === 255 && ev.metaType === 81) {
        const d = ev.data; const us = Array.isArray(d) ? ((d[0] << 16) | (d[1] << 8) | d[2]) : Number(d);
        if (Number.isFinite(us)) tempos.push({ tick, usPerQuarter: us });
      }
    }
  }
  const toMs = tickToMsFn(tempos, ppq);
  const initialUs = (tempos[0] || { usPerQuarter: 500000 }).usPerQuarter;
  const notes = pairEdges(edges.sort((a, b) => a.tick - b.tick)).map(n => ({
    pitch: n.note, onset: toMs(n.startTick), duration: Math.max(0, toMs(n.endTick) - toMs(n.startTick)),
    velocity: n.velocity, channel: n.channel,
  })).sort((a, b) => (a.onset - b.onset) || (a.pitch - b.pitch));
  return { name, notes, ppq, tempo: Math.round(60000000 / initialUs) };
};
