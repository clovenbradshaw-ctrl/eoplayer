// The library holon — many streams, feature-tagged on load, persisted, selected by
// tag rather than by hand. (Input Spec §4)
//
//   many .mid → parse + feature + auto-tag → OPFS-persisted tagged set → select by tag → engine

export { createLibrary } from './library.js';
export { computeFeatures, estimateKey, estimateTempo, pitchClassHistogram } from './features.js';
export { autoTags, normTag, matchesQuery } from './tag.js';
export { createStore, opfsBackend, memoryBackend, defaultBackend } from './store.js';
