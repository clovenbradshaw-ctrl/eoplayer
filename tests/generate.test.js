// Generation: arcs → realizer → notes, stopped by a count you choose.
// (Input Spec §5, §6 — build step 5.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generate, parseKey, SCALES } from '../src/generate/index.js';
import { pitchClass, isStream } from '../src/stream/index.js';
import { readingAt, projectGraph } from '../src/engine/index.js';

const scalePcs = (tonic, mode) => new Set(SCALES[mode].map(s => (tonic + s) % 12));
const lastPc = (stream) => pitchClass(stream.events[stream.events.length - 1].pitch);

test('parseKey accepts strings, flats, and feature objects', () => {
  assert.deepEqual({ ...parseKey('C major') }, { tonic: 0, mode: 'major', name: 'C major' });
  assert.equal(parseKey('Eb minor').tonic, 3);        // Eb = D#
  assert.equal(parseKey('Eb minor').mode, 'minor');
  assert.equal(parseKey({ tonic: 'D', mode: 'minor' }).tonic, 2);
  assert.equal(parseKey({ key: 'A minor' }).name, 'A minor');
});

test('arcCount: N runs out N tension-release cycles, each resolving to the tonic', () => {
  const { stream, meta } = generate({ key: 'C major', seed: 7, arcCount: 3 });
  assert.ok(isStream(stream));
  assert.equal(meta.control, 'arcCount');
  assert.equal(meta.arcs, 3);
  assert.equal(meta.endedOn, 'arc');        // stopped on the arc count …
  assert.equal(lastPc(stream), 0);          // … and the last arc still resolved to C, the tonic
});

test('noteCount hard: exactly N notes, even if the phrase is cut off (the guillotine)', () => {
  const { stream, meta } = generate({ key: 'C major', seed: 7, noteCount: 8, soft: false });
  assert.equal(stream.length, 8);
  assert.equal(meta.endedOn, 'hard');
});

test('noteCount soft (default): at least N notes, and ends on a resolution', () => {
  const { stream, meta } = generate({ key: 'C major', seed: 7, noteCount: 8 });   // soft defaults true
  assert.ok(stream.length >= 8, `got ${stream.length}`);
  assert.equal(meta.endedOn, 'cadence');
  assert.equal(lastPc(stream), 0);          // finished the phrase on the tonic
});

test('untilResolved: one arc, to the next full cadence', () => {
  const { stream, meta } = generate({ key: 'C major', seed: 7, untilResolved: true });
  assert.equal(meta.arcs, 1);
  assert.equal(meta.endedOn, 'cadence');
  assert.equal(lastPc(stream), 0);
});

test('every generated pitch is diatonic to the chosen key (D minor)', () => {
  const { stream } = generate({ key: 'D minor', seed: 3, arcCount: 4 });
  const allowed = scalePcs(2, 'minor');
  for (const e of stream.events) assert.ok(allowed.has(pitchClass(e.pitch)), `${e.pitch} (${pitchClass(e.pitch)}) not in D minor`);
});

test('generation is deterministic given a seed', () => {
  const a = generate({ key: 'C major', seed: 42, arcCount: 2 }).stream.events.map(e => e.pitch);
  const b = generate({ key: 'C major', seed: 42, arcCount: 2 }).stream.events.map(e => e.pitch);
  assert.deepEqual(a, b);
  const c = generate({ key: 'C major', seed: 43, arcCount: 2 }).stream.events.map(e => e.pitch);
  assert.notDeepEqual(a, c);                // a different seed is a different composition
});

test('the engine reads its own composition and finds the key it was given', () => {
  // The closed loop: generate in C, hand the generated stream back to the engine,
  // and its flat mass-fold should settle on C — the DEF of the key, recovered.
  const { stream } = generate({ key: 'C major', seed: 9, arcCount: 4 });
  const doc = stream.toDoc();
  const heaviest = [...projectGraph(doc.log).entities.values()].sort((a, b) => b.sightings - a.sightings)[0];
  assert.equal(heaviest.label, 'C');
  // And surprise lives in the body of the phrases, not at the resolving tonic.
  const curve = doc.sequence.map(n => readingAt(doc, n.unitIdx).surprise);
  assert.ok(Math.max(...curve) > 0.3, `the build should surprise, got max ${Math.max(...curve)}`);
});
