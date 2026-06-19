// The generate holon — the stream produced in reverse. (Input Spec §5, §6)
//
// The engine generates arcs (tension-release cycles); the realizer voices them to
// notes; a count you choose stops it — either a literal note count that finishes
// its phrase, or a structural arc count that fits how the engine actually composes.
// The output is a note-event stream like any other, read and sounded through the
// same path.

export { generate, parseKey } from './generate.js';
export { makeArc, rng } from './arc.js';
export { realizeArc, degreeToPitch, SCALES } from './realize.js';
export { accumulateByControl } from './count.js';
