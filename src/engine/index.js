// The engine — vendored from eoreader4 (the reader work), unchanged but for one
// inlined constant. This is the source-blind operator engine the whole fork is
// built around: it reads a stream of note events as INS/CON events and folds out
// the same DEF (the key it settles on), EVA (the strain across phrases), REC (the
// restructuring at a modulation or cadence), and surprise that read a novel.
//
// The fork's single fact: there is ONE note-event stream, and a file, a live
// keyboard, and the generator are all just that stream from different sources. The
// engine never knows or cares which it is reading. Everything below this facade is
// modality-blind; everything above it (src/stream, src/midi, src/live, src/library,
// src/generate, src/play) only ever hands it the stream.
//
// Nothing here is music-specific. `src/stream/stream.js#toDoc` is the seam: it
// turns a note-event stream into the { log, units, sentences, projectGraph } doc
// shape these functions read, exactly as eoreader4's ingest adapters do for text.

export {
  MODES, DOMAINS, GRAINS, OPERATORS, isOperator,
  operatorsByMode, operatorsByDomain,
  createLog, isLog,
  eoAddressOfEvent, eoNotation,
  projectGraph, projectionStats, DEFAULT_PROJECTION_RULES,
  VERDICTS,
} from './core/index.js';

// L3 significance — the per-cursor reading: prediction (REC), evaluation (EVA),
// surprise, and the tagged surprises (INS/CON/DEF/SEG). This is what build step 2
// reads off a single file's stream.
export { readingAt } from './read/reading.js';

// The surfer — rides the field, arrests on Bayesian-surprise peaks, and reports
// the cursors where a frame broke (the RECs: modulations and cadences).
export { surfFold } from './read/surf.js';

// The enacted DEF–EVA–REC loop and its scale calibration — the strain dynamics the
// generator borrows to build and release tension over an arc.
export {
  createEnactedLoop, calibrateReader,
  DEFAULT_THRESHOLDS, DEFAULT_CONFIRM_BAND, DEFAULT_IMPULSE, DEFAULT_REFRACTORY,
} from './enact/loop.js';
export { createFrame, snapshotFrame, sameTerms, DEFAULT_STRAIN_LEAK } from './enact/frame.js';
