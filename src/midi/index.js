// The MIDI holon — file ↔ stream. (Input Spec §2)
//
//   .mid → parseMidi → note events → createStream → the engine, the ear
//
// A self-contained Standard MIDI File reader/writer. The browser may instead parse
// with midi-parser-js and pass its JSON to `notesFromMidiJson`; both routes end in
// the same note-event stream, which is the whole point of the stream.

import { createStream } from '../stream/index.js';
import { parseMidi, notesFromMidiJson } from './parse.js';

export { parseMidi, notesFromMidiJson } from './parse.js';
export { writeMidi } from './write.js';

// .mid binary → a NoteStream, source-tagged 'file'.
export const streamFromMidi = (input, { name } = {}) => {
  const { name: n, notes, ppq, tempo } = parseMidi(input, { name: name || 'midi' });
  return createStream({ name: name || n, events: notes, ppq, tempo, source: 'file' });
};

// midi-parser-js JSON → a NoteStream (the browser route).
export const streamFromMidiJson = (mid, { name } = {}) => {
  const { name: n, notes, ppq, tempo } = notesFromMidiJson(mid, { name: name || 'midi' });
  return createStream({ name: name || n, events: notes, ppq, tempo, source: 'file' });
};
