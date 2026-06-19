// Features computed on load — cheaply, so the library is taggable without a human
// listening to each file. (Input Spec §4)
//
// Estimated key (from a pitch-class histogram), tempo (from the file header or
// inter-onset intervals), note density, pitch range, length, and a rough mode
// (major/minor from the third). These are arithmetic over the event stream — no
// model — and they are what let you tag and filter a large set without opening
// each one. Note the division of labour the spec insists on: features here teach
// how to VOICE (the surface); the engine's strain dynamics are where the structure
// lives. This module touches only the surface.

import { PC_NAME } from '../stream/index.js';

// Krumhansl–Schmuckler key profiles — the standard tonal-hierarchy weights. The
// key whose rotated profile best correlates with the heard pitch-class histogram
// is the estimate; major vs minor falls out of which profile fit better.
const KS_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KS_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const pearson = (a, b) => {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const xa = a[i] - ma, xb = b[i] - mb; num += xa * xb; da += xa * xa; db += xb * xb; }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
};

const rotate = (profile, k) => profile.map((_, i) => profile[(i - k + 12) % 12]);

// Pitch-class histogram, weighted by sounding duration (a long tonic counts more
// than a passing sixteenth). Falls back to note counts when durations are absent.
export const pitchClassHistogram = (events) => {
  const h = new Array(12).fill(0);
  let anyDuration = false;
  for (const e of events) {
    const w = e.duration > 0 ? e.duration : 0;
    if (w > 0) anyDuration = true;
    h[((e.pitch % 12) + 12) % 12] += w;
  }
  if (!anyDuration) { h.fill(0); for (const e of events) h[((e.pitch % 12) + 12) % 12] += 1; }
  return h;
};

export const estimateKey = (events) => {
  if (!events.length) return { tonic: 0, tonicName: 'C', mode: 'major', name: 'C major', correlation: 0 };
  const hist = pitchClassHistogram(events);
  let best = { tonic: 0, mode: 'major', correlation: -Infinity };
  for (let k = 0; k < 12; k++) {
    const cMaj = pearson(hist, rotate(KS_MAJOR, k));
    const cMin = pearson(hist, rotate(KS_MINOR, k));
    if (cMaj > best.correlation) best = { tonic: k, mode: 'major', correlation: cMaj };
    if (cMin > best.correlation) best = { tonic: k, mode: 'minor', correlation: cMin };
  }
  // Cross-check the mode against the bare third above the chosen tonic — a minor
  // third (3 semitones) heavier than the major third (4) says minor, the spec's
  // "rough mode from the third". Reported alongside, not overriding, the KS fit.
  const thirdMode = hist[(best.tonic + 3) % 12] > hist[(best.tonic + 4) % 12] ? 'minor' : 'major';
  return {
    tonic: best.tonic,
    tonicName: PC_NAME[best.tonic],
    mode: best.mode,
    name: `${PC_NAME[best.tonic]} ${best.mode}`,
    correlation: round(best.correlation),
    thirdMode,
  };
};

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Tempo: trust the file header if the stream carried one; otherwise estimate from
// the typical gap between successive onsets (a rough beat), clamped to a sane band.
export const estimateTempo = (events, headerTempo) => {
  if (headerTempo && headerTempo >= 20 && headerTempo <= 400) return { bpm: Math.round(headerTempo), source: 'header' };
  const onsets = [...new Set(events.map(e => Math.round(e.onset)))].sort((a, b) => a - b);
  const iois = [];
  for (let i = 1; i < onsets.length; i++) { const d = onsets[i] - onsets[i - 1]; if (d > 0) iois.push(d); }
  if (!iois.length) return { bpm: 120, source: 'default' };
  const beat = median(iois);
  const bpm = Math.max(40, Math.min(240, Math.round(60000 / beat)));
  return { bpm, source: 'inter-onset' };
};

// The whole feature record — one cheap pass, enough to tag and retrieve.
export const computeFeatures = (stream) => {
  const events = stream.events;
  const durationMs = stream.durationMs;
  const seconds = durationMs / 1000;
  const range = stream.range || { lo: 0, hi: 0, span: 0 };
  const key = estimateKey(events);
  const tempo = estimateTempo(events, stream.tempo);
  const density = seconds > 0 ? round(events.length / seconds) : 0;   // notes per second
  return {
    noteCount: events.length,
    durationMs: Math.round(durationMs),
    seconds: round(seconds),
    key: key.name,
    tonic: key.tonicName,
    mode: key.mode,
    keyCorrelation: key.correlation,
    tempo: tempo.bpm,
    tempoSource: tempo.source,
    density,
    range,                                  // { lo, hi, span } in MIDI numbers
    lowest: range.lo,
    highest: range.hi,
  };
};

const round = (x) => Math.round(x * 1000) / 1000;
