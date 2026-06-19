// The recording sink — a player backend that makes no sound. (Input Spec §2, §7)
//
// Playback is output only, the ear, not part of the reading path. To test the
// player's one property that matters — that a loaded file and a generated
// composition schedule through the IDENTICAL path — we need a backend that records
// what it was asked to play instead of sounding it. This is that backend, and it is
// what lets `play(stream)` be exercised under Node with no audio device.

export const createSink = () => {
  const scheduled = [];   // { pitch, velocity, channel, startMs, durationMs } in schedule order
  return {
    kind: 'sink',
    schedule(note) { scheduled.push({ ...note }); },
    start() {},
    stop() { scheduled.length = 0; },
    get scheduled() { return scheduled; },
  };
};
