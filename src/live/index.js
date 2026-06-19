// The live holon — keyboard → stream, in real time. (Input Spec §3)
//
//   keyboard → Web MIDI (WebMidi.js) → note-event stream → engine (real-time cursor)
//
// Same stream as a file, arriving one key-press at a time. The pure session
// (createLiveInput) is testable headless; enableWebMidi wires a real device to it
// in the browser.

export { createLiveInput } from './keyboard.js';
export { enableWebMidi } from './webmidi.js';
