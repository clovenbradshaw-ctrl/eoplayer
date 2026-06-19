// The library: features on load, auto-tags, query, OPFS-shaped persistence.
// (Input Spec §4 — build step 4.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createStream } from '../src/stream/index.js';
import { writeMidi } from '../src/midi/index.js';
import { createLibrary, createStore, memoryBackend, computeFeatures, estimateKey, autoTags } from '../src/library/index.js';

const twinkle = JSON.parse(readFileSync(new URL('../data/twinkle.json', import.meta.url)));

// A C-major scale and an A-minor-ish stream, for key/mode estimation.
const cMajorScale = createStream({ name: 'cmaj', tempo: 120, events: [60, 62, 64, 65, 67, 69, 71, 72].map((p, i) => ({ pitch: p, onset: i * 500, duration: 480, velocity: 80 })) });
const aMinor = createStream({ name: 'amin', tempo: 90, events: [57, 59, 60, 62, 64, 65, 67, 69].map((p, i) => ({ pitch: p, onset: i * 666, duration: 640, velocity: 80 })) });

test('estimateKey recovers C major from a C-major scale', () => {
  const k = estimateKey(cMajorScale.events);
  assert.equal(k.tonicName, 'C');
  assert.equal(k.mode, 'major');
});

test('computeFeatures reports count, range, density, tempo from the header', () => {
  const f = computeFeatures(cMajorScale);
  assert.equal(f.noteCount, 8);
  assert.equal(f.range.lo, 60);
  assert.equal(f.range.hi, 72);
  assert.equal(f.tempo, 120);
  assert.equal(f.tempoSource, 'header');
  assert.ok(f.density > 0);
});

test('autoTags bucket the features into filterable labels', () => {
  const f = computeFeatures(aMinor);
  const tags = autoTags(f);
  assert.ok(tags.includes('minor'), `expected minor in ${tags}`);
  assert.ok(tags.some(t => ['slow', 'medium', 'fast'].includes(t)));
  assert.ok(tags.some(t => ['sparse', 'medium', 'busy'].includes(t)));
});

test('the library auto-tags on add and answers queries by tag', () => {
  const lib = createLibrary();
  lib.add(cMajorScale, { tags: ['study these'] });
  lib.add(aMinor, { tags: ['etude'] });
  assert.equal(lib.size, 2);

  const majors = lib.selectByTag('major');
  assert.equal(majors.length, 1);
  assert.equal(majors[0].name, 'cmaj');

  // A user tag is queryable just like an auto tag.
  const studied = lib.query({ all: ['study these'] });
  assert.equal(studied.length, 1);

  // A `where` predicate over features composes with tags.
  const slowMinor = lib.query({ all: ['minor'], where: (f) => f.tempo < 100 });
  assert.equal(slowMinor.length, 1);
  assert.equal(slowMinor[0].name, 'amin');
});

test('streamsFor hands the engine the streams a query selects', () => {
  const lib = createLibrary();
  lib.add(cMajorScale);
  lib.add(aMinor);
  const streams = lib.streamsFor({ all: ['major'] });
  assert.equal(streams.length, 1);
  // It's a real stream the engine can read.
  assert.equal(streams[0].toDoc().sentences[0], 'C');
});

test('addMidi parses bytes, features, and tags in one step', () => {
  const lib = createLibrary();
  const bytes = writeMidi(cMajorScale.events, { tempo: 120, ppq: 480 });
  const entry = lib.addMidi(bytes, { name: 'scale.mid', tags: ['scale'] });
  assert.equal(entry.features.noteCount, 8);
  assert.ok(entry.tags.includes('scale'));
});

test('persist→restore survives a reload (same origin), round-tripping the corpus', async () => {
  const shared = new Map();                       // simulate "the same origin on reload"
  const store1 = await createStore({ backend: memoryBackend(shared) });
  const lib1 = createLibrary({ store: store1 });
  lib1.add(createStream(twinkle), { tags: ['nursery'] });
  await lib1.persist();

  const store2 = await createStore({ backend: memoryBackend(shared) });
  const lib2 = createLibrary({ store: store2 });
  await lib2.restore();
  assert.equal(lib2.size, 1);
  const e = lib2.all()[0];
  assert.equal(e.name, 'twinkle');
  assert.ok(e.tags.includes('nursery'));
  // The reconstituted stream still reads — events survived the persistence.
  assert.equal(e.stream.toDoc().sentences.length, 14);
});
