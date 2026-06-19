// Reading MIDI files: the file adapter round-trips through real .mid bytes.
// (Input Spec §2 — build step 1: file → stream.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { writeMidi, parseMidi, streamFromMidi } from '../src/midi/index.js';
import { streamOf } from '../src/stream/index.js';

const melody = [
  { pitch: 60, onset: 0,    duration: 450, velocity: 80, channel: 0 },
  { pitch: 64, onset: 500,  duration: 450, velocity: 80, channel: 0 },
  { pitch: 67, onset: 1000, duration: 450, velocity: 90, channel: 0 },
  { pitch: 72, onset: 1500, duration: 950, velocity: 70, channel: 0 },
];

test('writeMidi produces a well-formed SMF (MThd / MTrk headers)', () => {
  const bytes = writeMidi(melody, { tempo: 120, ppq: 480 });
  assert.ok(bytes instanceof Uint8Array);
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'MThd');
  assert.equal(String.fromCharCode(...bytes.slice(14, 18)), 'MTrk');
});

test('parseMidi recovers the note events written (pitch, order, ~timing)', () => {
  const bytes = writeMidi(melody, { tempo: 120, ppq: 480 });
  const { notes, tempo } = parseMidi(bytes);
  assert.equal(tempo, 120);
  assert.equal(notes.length, melody.length);
  assert.deepEqual(notes.map(n => n.pitch), [60, 64, 67, 72]);
  // Onsets survive the ticks→ms round trip within rounding tolerance.
  notes.forEach((n, i) => {
    assert.ok(Math.abs(n.onset - melody[i].onset) <= 2, `onset[${i}] ${n.onset} ≈ ${melody[i].onset}`);
    assert.ok(Math.abs(n.duration - melody[i].duration) <= 4, `dur[${i}] ${n.duration} ≈ ${melody[i].duration}`);
  });
});

test('velocity and channel survive the round trip', () => {
  const bytes = writeMidi(melody, { tempo: 120, ppq: 480 });
  const { notes } = parseMidi(bytes);
  assert.equal(notes[2].velocity, 90);
  assert.equal(notes.every(n => n.channel === 0), true);
});

test('running status: a chord written then parsed keeps all three notes', () => {
  const chord = [
    { pitch: 60, onset: 0, duration: 480, velocity: 80 },
    { pitch: 64, onset: 0, duration: 480, velocity: 80 },
    { pitch: 67, onset: 0, duration: 480, velocity: 80 },
  ];
  const { notes } = parseMidi(writeMidi(chord));
  assert.equal(notes.length, 3);
  assert.deepEqual(notes.map(n => n.pitch).sort((a, b) => a - b), [60, 64, 67]);
});

test('streamFromMidi yields a file-sourced stream the engine can read', () => {
  const bytes = writeMidi(melody, { tempo: 120, ppq: 480 });
  const s = streamFromMidi(bytes, { name: 'arp.mid' });
  assert.equal(s.source, 'file');
  assert.equal(s.name, 'arp.mid');
  const doc = s.toDoc();
  assert.equal(doc.sentences.join(' '), 'C E G C');   // a C-major arpeggio, read as pitch classes
});

test('a generated stream survives export→reload identically (the reverse path)', () => {
  const original = streamOf(melody, { name: 'gen', source: 'generated' });
  const bytes = writeMidi(original.events, { tempo: original.tempo, ppq: original.ppq });
  const reloaded = streamFromMidi(bytes);
  assert.deepEqual(reloaded.events.map(e => e.pitch), original.events.map(e => e.pitch));
});
