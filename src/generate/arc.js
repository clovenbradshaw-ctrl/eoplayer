// The arc — one tension-and-release cycle, the unit the engine actually generates.
// (Input Spec §5, §6)
//
// The engine generates at the structural level: set a key, build strain, resolve.
// One arc is one DEF–strain–REC cycle — establish a tonal center (DEF), depart from
// it so tension rises (strain), and resolve with a cadence back to the center
// (REC). "Play me three phrases" is "run three tension-and-release cycles," and the
// note count falls out of how the realizer voices them. This file produces the bare
// STRUCTURE — scale degrees and a tension value per step; realize.js voices it.
//
// The structure here is the generator's own; only the surface (how to voice) is the
// thing a learned grammar would touch. So this is deliberately model-free and
// deterministic given a seed, the way the rest of the fork is.

// A tiny deterministic PRNG (mulberry32), so a seed reproduces a composition.
export const rng = (seed = 1) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Degrees are integers over a 7-note scale: 0 = tonic, 7 = the octave, −1 = the
// leading tone just below the tonic. realize.js turns a degree into a pitch.
const PEAKS = [4, 5, 7];   // resolve a departure that reached the third, fifth, or octave

const pick = (r, xs) => xs[Math.floor(r() * xs.length)];

// One arc: establish → build → resolve. Returns ordered steps, each with the scale
// degree and a tension in [0,1] that rises to the contour peak and falls to 0 at the
// cadence. The final step is always the tonic (degree 0) — the resolution that
// untilResolved and the soft-cadence stop detect as "a full cadence."
export const makeArc = (r = rng(), { minLen = 6, maxLen = 10 } = {}) => {
  const peak = pick(r, PEAKS);
  const steps = [{ degree: 0, tension: 0 }];   // DEF: assert the tonal center

  // BUILD (strain): walk up to the peak by mostly-stepwise motion, tension climbing.
  let d = 0;
  while (d < peak) {
    d += (r() < 0.78 ? 1 : 2);
    if (d > peak) d = peak;
    steps.push({ degree: d, tension: d / peak });
  }

  // DESCEND: ease back down toward the cadence, tension relaxing.
  while (d > 2) {
    d -= (r() < 0.7 ? 1 : 2);
    if (d < 2) d = 2;
    steps.push({ degree: d, tension: Math.max(0, d / peak) });
  }

  // CADENCE (REC): a clear approach to the tonic — a step down (2→1→0) or the
  // leading tone resolving up (−1→0). Either lands on the tonic, the resolution.
  if (r() < 0.5) { steps.push({ degree: 1, tension: 0.15 }); }
  else { steps.push({ degree: -1, tension: 0.2 }); }
  steps.push({ degree: 0, tension: 0, cadence: true });

  // Trim or extend toward the requested phrase length without losing the cadence.
  const minBody = Math.max(minLen, 4);
  if (steps.length > maxLen) {
    const head = steps.slice(0, maxLen - 2);
    return { steps: [...head, { degree: 1, tension: 0.15 }, { degree: 0, tension: 0, cadence: true }], peak };
  }
  void minBody;
  return { steps, peak };
};
