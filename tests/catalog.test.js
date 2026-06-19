// The built-in catalog: a searchable library of melodies, each expanding to the same
// stream the engine reads. (Input Spec §4 — search a library and add into memory.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CATALOG, searchCatalog, catalogStream } from '../src/catalog/index.js';
import { readingAt } from '../src/engine/index.js';

test('the catalog ships several melodies and is searchable', () => {
  assert.ok(CATALOG.length >= 6);
  assert.equal(searchCatalog('').length, CATALOG.length);
  assert.ok(searchCatalog('beethoven').length >= 1);
  assert.ok(searchCatalog('nursery').length >= 1);
  assert.equal(searchCatalog('zzzz-no-such-thing').length, 0);
});

test('a catalog entry expands to a Precoded stream the engine can read', () => {
  const item = CATALOG[0];
  const stream = catalogStream(item);
  assert.equal(stream.source, 'catalog');                 // Precoded, not Generated
  assert.equal(stream.length, item.notes.length);
  assert.ok(stream.durationMs > 0);
  // Onsets are strictly increasing — a real, playable timeline.
  const onsets = stream.events.map(e => e.onset);
  for (let i = 1; i < onsets.length; i++) assert.ok(onsets[i] > onsets[i - 1]);
  // And the source-blind engine reads it like anything else.
  const doc = stream.toDoc();
  const r = readingAt(doc, doc.sequence.length - 1);
  assert.ok(Number.isFinite(r.surprise));
});
