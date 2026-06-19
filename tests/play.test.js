// One player, every stream: a loaded file and a generated composition schedule
// through the identical path. (Input Spec §7 — the sameness that is the design.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createPlayer, createSink } from '../src/play/index.js';
import { streamFromMidi, writeMidi } from '../src/midi/index.js';
import { generate } from '../src/generate/index.js';
import { streamOf } from '../src/stream/index.js';

test('the player schedules every note of a stream, in time order', () => {
  const sink = createSink();
  const player = createPlayer({ backend: sink });
  const stream = streamOf([
    { pitch: 67, onset: 500, duration: 400, velocity: 80 },
    { pitch: 60, onset: 0, duration: 400, velocity: 90 },
  ]);
  const handle = player.play(stream);
  assert.equal(handle.notes, 2);
  assert.deepEqual(sink.scheduled.map(n => n.pitch), [60, 67]);      // sorted to the reading line
  assert.deepEqual(sink.scheduled.map(n => n.startMs), [0, 500]);    // scheduled at the stream's onsets
  assert.equal(sink.scheduled[0].velocity, 90);
});

test('a loaded file and a generated composition play through the SAME player', () => {
  const sink = createSink();
  const player = createPlayer({ backend: sink });

  // A file → stream.
  const bytes = writeMidi([{ pitch: 60, onset: 0, duration: 450, velocity: 80 }, { pitch: 64, onset: 500, duration: 450, velocity: 80 }]);
  const fileStream = streamFromMidi(bytes);
  const a = player.play(fileStream);
  assert.equal(a.notes, 2);

  sink.stop();   // clear between takes

  // A generated stream → the identical play() call.
  const { stream: genStream } = generate({ key: 'C major', seed: 5, noteCount: 6 });
  const b = player.play(genStream);
  assert.equal(b.notes, genStream.length);
  assert.equal(sink.scheduled.length, genStream.length);   // the generator's notes reached the ear
});

test('stop() silences the transport', () => {
  const sink = createSink();
  const player = createPlayer({ backend: sink });
  player.play(streamOf([{ pitch: 60, onset: 0, duration: 200 }]));
  player.stop();
  assert.equal(player.playing, null);
});
