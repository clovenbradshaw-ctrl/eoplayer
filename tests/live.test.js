// The live keyboard produces the SAME stream as a file. (Input Spec §3 — step 3.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createLiveInput } from '../src/live/index.js';
import { readingAt } from '../src/engine/index.js';

// A controllable clock so the "real time" is deterministic in the test.
const fakeClock = () => { let t = 1000; return { now: () => t, advance: (ms) => { t += ms; } }; };

test('press then release becomes one note event with onset=now, duration=held', () => {
  const clk = fakeClock();
  const live = createLiveInput({ now: clk.now });
  live.noteOn(60, 90);          // strike at t=0 of the session
  clk.advance(400);
  const ev = live.noteOff(60);  // release 400ms later
  assert.equal(ev.pitch, 60);
  assert.equal(ev.onset, 0);
  assert.equal(ev.duration, 400);
  assert.equal(ev.velocity, 90);
  assert.equal(live.stream.length, 1);
});

test('a release with no matching press is ignored (no half-events reach the engine)', () => {
  const live = createLiveInput({ now: fakeClock().now });
  assert.equal(live.noteOff(72), null);
  assert.equal(live.stream.length, 0);
});

test('onNote fires per completed note — the real-time tap the engine reads', () => {
  const clk = fakeClock();
  const live = createLiveInput({ now: clk.now });
  const seen = [];
  live.onNote((ev) => seen.push(ev.pitch));
  live.noteOn(60); clk.advance(200); live.noteOff(60);
  live.noteOn(64); clk.advance(200); live.noteOff(64);
  assert.deepEqual(seen, [60, 64]);
});

test('a played phrase is the same stream a file would be — the engine reads it identically', () => {
  const clk = fakeClock();
  const live = createLiveInput({ now: clk.now });
  // Play C E G C as quarter notes.
  for (const p of [60, 64, 67, 72]) { live.noteOn(p); clk.advance(500); live.noteOff(p); clk.advance(0); }
  const doc = live.stream.toDoc();
  assert.equal(doc.sentences.join(' '), 'C E G C');
  // And the engine's reading runs on it with no idea it came from a keyboard.
  const r = readingAt(doc, doc.sequence.length - 1);
  assert.equal(r.evaluation.op, 'EVA');
  assert.ok(Number.isFinite(r.surprise));
});
