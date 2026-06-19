// Tagging, two kinds. (Input Spec §4)
//
// User tags — free labels you attach (a genre, a mood, a source, "study these").
// Auto tags — derived from the features (key of D, fast, sparse, minor). The
// library is then a tagged, queryable set: show me the minor-key sparse ones, load
// all the ones tagged baroque, pull the fast major ones into the engine. Tagging is
// how you choose what the engine reads without hand-feeding files.
//
// Auto-tags are buckets over the cheap features — coarse on purpose, so a few
// thousand files partition into a handful of useful classes you can filter by.

const tempoBucket = (bpm) => (bpm < 76 ? 'slow' : bpm <= 120 ? 'medium' : 'fast');
const densityBucket = (d) => (d < 2 ? 'sparse' : d <= 6 ? 'medium' : 'busy');
const registerBucket = (mid) => (mid < 48 ? 'low' : mid <= 72 ? 'mid' : 'high');
const lengthBucket = (sec) => (sec < 10 ? 'short' : sec < 60 ? 'medium-length' : 'long');

// Features → auto tags. Returns a de-duplicated, lower-cased label list.
export const autoTags = (features) => {
  const mid = features.range ? (features.range.lo + features.range.hi) / 2 : 60;
  const tags = [
    features.tonic,                 // 'D'
    features.mode,                  // 'minor'
    `key:${features.key}`,          // 'key:D minor'  (structured, exact match)
    tempoBucket(features.tempo),    // 'fast'
    densityBucket(features.density),// 'sparse'
    registerBucket(mid),            // 'mid'
    lengthBucket(features.seconds), // 'short'
  ];
  return [...new Set(tags.map(t => String(t).toLowerCase()))];
};

// Normalize any free user label to a tag (trimmed, lower-cased).
export const normTag = (t) => String(t).trim().toLowerCase();

// Does an entry's tag set satisfy a query? `all` requires every tag; `any` requires
// at least one; `none` forbids; `where` is an arbitrary predicate over features.
export const matchesQuery = (entry, { all = [], any = [], none = [], where } = {}) => {
  const tags = new Set(entry.tags.map(normTag));
  if (all.length && !all.every(t => tags.has(normTag(t)))) return false;
  if (any.length && !any.some(t => tags.has(normTag(t)))) return false;
  if (none.length && none.some(t => tags.has(normTag(t)))) return false;
  if (typeof where === 'function' && !where(entry.features, entry)) return false;
  return true;
};
