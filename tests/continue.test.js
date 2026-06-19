// Continuation: the reader keeps going. Reading and generating are one faculty —
// read a prefix, recover its frame, write the next notes onto the same stream.
// (The point of the fork: play three notes and it plays the fourth.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createStream } from '../src/stream/index.js';
import { continueStream, predictedNext } from '../src/generate/index.js';
import { readingAt } from '../src/engine/index.js';

const twinkle = JSON.parse(readFileSync(new URL('../data/twinkle.json', import.meta.url)));

test('continueStream refuses an empty prefix', () => {
  assert.throws(() => continueStream(createStream({ events: [] })), /nothing to continue/);
});

test('the continuation appends to the same stream, after the seam, in the recovered key', () => {
  const prefix = createStream({ ...twinkle, source: 'sample' });
  const { stream, meta } = continueStream(prefix, { noteCount: 10 });

  // The prefix is preserved verbatim as the head of the one stream.
  assert.equal(meta.seam, prefix.length);
  assert.equal(stream.source, 'generated');
  assert.ok(stream.length > prefix.length);
  for (let i = 0; i < prefix.length; i++) assert.equal(stream.events[i].pitch, prefix.events[i].pitch);

  // Everything the engine wrote begins after everything you played.
  for (let i = meta.seam; i < stream.length; i++) assert.ok(stream.events[i].onset >= meta.seamOnset);

  // Twinkle is in C — the frame the continuation was built in.
  assert.match(meta.key, /^C /);

  // And the single stream reads end to end with no idea where the seam is.
  const doc = stream.toDoc();
  assert.ok(Number.isFinite(readingAt(doc, doc.sequence.length - 1).surprise));
});

test('play three notes and it plays the fourth', () => {
  const three = createStream({
    events: [
      { pitch: 60, onset: 0, duration: 400, velocity: 80 },
      { pitch: 62, onset: 500, duration: 400, velocity: 80 },
      { pitch: 64, onset: 1000, duration: 400, velocity: 80 },
    ],
    source: 'live',
  });

  // The reader has a prediction for what comes next — the seed of the continuation.
  const pred = predictedNext(three);
  assert.ok(pred && Array.isArray(pred.figures) && pred.figures.length >= 1);

  const { stream, meta } = continueStream(three, { noteCount: 1 });
  assert.equal(meta.seam, 3);
  assert.ok(stream.length >= 4);                       // a fourth note (and its phrase) now exist
  assert.ok(stream.events[3].onset >= 1000 + 400);     // it lands after the third note's release
});
