// Choosing how many notes it plays. (Input Spec §6)
//
// Generation needs a stop condition, and "how many notes" is the simplest honest
// one. But there are two senses of count and the architecture wants both:
//
//   noteCount         N notes, hard stop          (literal)
//   noteCount + soft  N notes, finish the phrase   (default — no guillotine)
//   arcCount          N tension-release cycles     (structural, the engine's unit)
//   untilResolved     generate to the next full cadence and stop
//
// `produceArc` is a thunk that realizes and returns the next arc { events, … }; this
// drives it under the chosen control and reports where it stopped. The soft option
// is the bridge: a literal count still ends on a resolution rather than mid-phrase.

export const accumulateByControl = (produceArc, control = {}) => {
  const { type = 'noteCount', n = 8, soft = true } = control;
  const events = [];
  const arcs = [];
  const pushArc = () => { const a = produceArc(); arcs.push(a); events.push(...a.events); return a; };

  if (type === 'arcCount') {
    for (let i = 0; i < Math.max(1, n); i++) pushArc();
    return { events, arcs, endedOn: 'arc', requested: n, notes: events.length };
  }

  if (type === 'untilResolved') {
    pushArc();   // one arc, run to its cadence — the next full resolution
    return { events, arcs, endedOn: 'cadence', requested: 1, notes: events.length };
  }

  // noteCount: keep emitting arcs until at least N notes exist.
  while (events.length < Math.max(1, n)) pushArc();
  if (soft) {
    // Finish the current phrase: keep the whole arc that crossed N, so the output
    // ends on the cadence — the simple dial without the guillotine (the default).
    return { events, arcs, endedOn: 'cadence', requested: n, notes: events.length };
  }
  // Hard stop: exactly N notes, even if that cuts the phrase off before resolution.
  const cut = events.slice(0, n);
  return { events: cut, arcs, endedOn: 'hard', requested: n, notes: cut.length };
};
