// The online sources directory (from awesome-midi-sources): searchable, credited,
// every entry a real https link. (Input Spec §4 — the door to the millions of files
// on the web.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MIDI_SOURCES, searchSources, SOURCES_CREDIT } from '../src/sources/index.js';

test('the directory credits awesome-midi-sources and lists many sources', () => {
  assert.match(SOURCES_CREDIT.url, /awesome-midi-sources/);
  assert.ok(MIDI_SOURCES.length >= 10);
  for (const s of MIDI_SOURCES) {
    assert.match(s.url, /^https:\/\//, `${s.name} should have an https URL`);
    assert.ok(s.name && s.note && s.kind);
  }
});

test('sources are searchable by name, genre, and kind', () => {
  assert.equal(searchSources('').length, MIDI_SOURCES.length);
  assert.ok(searchSources('bach').length >= 1);
  assert.ok(searchSources('video').length >= 1);
  assert.ok(searchSources('dataset').length >= 1);
  assert.equal(searchSources('definitely-not-here').length, 0);
});
