// The spine: a source becomes the one note-event stream, and the engine reads it.
// (Input Spec §1, §2 — build step 1 proven, build step 2 begun.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createStream, streamOf, noteEvent, noteName, pitchClass, isStream } from '../src/stream/index.js';
import { readingAt } from '../src/engine/index.js';

const twinkle = JSON.parse(readFileSync(new URL('../data/twinkle.json', import.meta.url)));

test('noteEvent normalizes and clamps into the canonical shape', () => {
  const e = noteEvent({ pitch: 60.4, velocity: 999, onset: -5 });
  assert.equal(e.pitch, 60);
  assert.equal(e.velocity, 127);
  assert.equal(e.onset, 0);        // negative coerced to 0
  assert.equal(e.channel, 0);      // default
  assert.equal(e.duration, 0);     // default
});

test('pitchClass folds octaves; noteName reads MIDI 60 as C4', () => {
  assert.equal(pitchClass(60), 0);
  assert.equal(pitchClass(72), 0);   // an octave up is the same class
  assert.equal(noteName(60), 'C4');
  assert.equal(noteName(67), 'G4');
});

test('a stream orders events by the reading line (onset, then pitch)', () => {
  const s = streamOf([
    { pitch: 67, onset: 500 },
    { pitch: 64, onset: 0 },
    { pitch: 60, onset: 0 },   // shares onset with 64 → sorts below it
  ]);
  assert.ok(isStream(s));
  assert.deepEqual(s.events.map(e => e.pitch), [60, 64, 67]);
  assert.equal(s.length, 3);
});

test('a live-style append keeps the stream ordered', () => {
  const s = createStream({ source: 'live' });
  s.add({ pitch: 67, onset: 500 });
  s.add({ pitch: 60, onset: 0 });    // arrives later but onset is earlier
  assert.deepEqual(s.events.map(e => e.pitch), [60, 67]);
});

test('toDoc folds the stream into the engine doc shape (INS per note, CON per step)', () => {
  const s = streamOf([
    { pitch: 60, onset: 0, duration: 400 },
    { pitch: 67, onset: 500, duration: 400 },
  ], { name: 'two-notes' });
  const doc = s.toDoc();
  assert.equal(doc.modality, 'music');
  assert.equal(doc.units.length, 2);
  assert.equal(doc.sentences[0], 'C');
  assert.equal(doc.sentences[1], 'G');
  const ops = doc.log.events.map(e => e.op);
  assert.deepEqual(ops, ['INS', 'INS', 'CON']);   // two sightings + one bond
  const con = doc.log.events.find(e => e.op === 'CON');
  assert.equal(con.via, 'up7');                    // C→G is +7 semitones, by arithmetic
});

test('the engine reads the stream: Twinkle recovers tonic+dominant with no key supplied', () => {
  // The exact claim of scripts/extract-music-meaning.mjs, now over a note-event
  // stream built from the file representation rather than note-name strings.
  const s = createStream(twinkle);
  const doc = s.toDoc();
  const g = doc.projectGraph();
  const byMass = [...g.entities.values()].sort((a, b) => b.sightings - a.sightings);
  const heaviest = byMass.slice(0, 2).map(e => e.label).sort();
  assert.deepEqual(heaviest, ['C', 'G']);   // tonic and dominant of C major, unsupplied
});

test('the engine marks surprise across the melody and peaks after the opening', () => {
  const s = createStream(twinkle);
  const doc = s.toDoc();
  const curve = doc.sequence.map(n => readingAt(doc, n.unitIdx).surprise);
  assert.equal(curve.length, 14);
  // The bare opening has no prior, so its surprise is ~0; later entrances spike.
  assert.ok(curve[0] < 0.01, `opening flat, got ${curve[0]}`);
  assert.ok(Math.max(...curve) > 0.4, `a real surprise peak exists, got max ${Math.max(...curve)}`);
});
