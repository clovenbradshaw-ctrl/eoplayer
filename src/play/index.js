// The play holon — the ear. (Input Spec §2, §7)
//
//   stream → player → backend (sink / Web Audio / midicube soundfont) → sound
//
// Output only, kept separate from the reading path. The same player sounds a loaded
// file and a generated composition, because both are the same note-event stream.

export { createPlayer } from './player.js';
export { createSink } from './sink.js';
export { createWebAudioBackend } from './webaudio.js';
export { createSoundfontBackend } from './soundfont.js';
