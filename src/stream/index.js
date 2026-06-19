// The stream holon — the one internal representation. (Input Spec §1)
//
// Everything in the fork is this: a file is a stream recorded, a live keyboard is
// this stream in real time, a composition is this stream produced in reverse. The
// engine reads all of it identically because it is all one stream.

export {
  PC_NAME, pitchClass, noteName, interval, noteEvent, isNoteEvent, byReadingLine,
} from './event.js';
export { createStream, streamOf, isStream } from './stream.js';
