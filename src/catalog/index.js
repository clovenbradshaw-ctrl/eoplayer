// The built-in catalog — a small library of melodies you can search and add into
// memory with no network at all. (Input Spec §4)
//
// "Search a library of files and add them into memory": this is the always-works
// half of that. Each entry is a compact [pitch, beats] score of a public-domain
// melody; catalogStream expands it into the one note-event stream the engine reads
// and the player sounds — identical to a loaded file, only its provenance is
// 'catalog' (it shows as Precoded, not Generated). For the much larger world of
// real MIDI files, see ../sources (the awesome-midi-sources directory).

import { createStream } from '../stream/index.js';

// title, composer, tags, tempo(bpm), notes as [midiPitch, beats]
const M = (title, composer, tags, tempo, notes) => ({
  id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
  title, composer, tags, tempo, notes,
});

export const CATALOG = [
  M('Ode to Joy', 'Beethoven', ['classical', 'public-domain'], 120,
    [[64,1],[64,1],[65,1],[67,1],[67,1],[65,1],[64,1],[62,1],[60,1],[60,1],[62,1],[64,1],[64,1.5],[62,0.5],[62,2]]),
  M('Twinkle, Twinkle', 'Traditional', ['nursery', 'public-domain'], 120,
    [[60,1],[60,1],[67,1],[67,1],[69,1],[69,1],[67,2],[65,1],[65,1],[64,1],[64,1],[62,1],[62,1],[60,2]]),
  M('Mary Had a Little Lamb', 'Traditional', ['nursery', 'public-domain'], 120,
    [[64,1],[62,1],[60,1],[62,1],[64,1],[64,1],[64,2],[62,1],[62,1],[62,2],[64,1],[67,1],[67,2]]),
  M('Frère Jacques', 'Traditional', ['nursery', 'folk', 'public-domain'], 108,
    [[60,1],[62,1],[64,1],[60,1],[60,1],[62,1],[64,1],[60,1],[64,1],[65,1],[67,2],[64,1],[65,1],[67,2]]),
  M('Jingle Bells', 'Pierpont', ['holiday', 'public-domain'], 120,
    [[64,1],[64,1],[64,2],[64,1],[64,1],[64,2],[64,1],[67,1],[60,1],[62,1],[64,4]]),
  M('Row, Row, Row Your Boat', 'Traditional', ['nursery', 'folk', 'public-domain'], 108,
    [[60,1],[60,1],[60,1],[62,1],[64,1],[64,1],[62,1],[64,1],[65,1],[67,2]]),
  M('London Bridge', 'Traditional', ['nursery', 'folk', 'public-domain'], 120,
    [[67,1],[69,1],[67,1],[65,1],[64,1],[65,1],[67,2],[62,1],[64,1],[65,2],[64,1],[65,1],[67,2]]),
  M('Symphony No. 5 (motif)', 'Beethoven', ['classical', 'public-domain'], 108,
    [[67,0.5],[67,0.5],[67,0.5],[63,2],[65,0.5],[65,0.5],[65,0.5],[62,2]]),
];

// Search by title, composer, or tag. Empty query returns the whole catalog.
export const searchCatalog = (q = '') => {
  const s = String(q).trim().toLowerCase();
  if (!s) return CATALOG.slice();
  return CATALOG.filter(m => [m.title, m.composer, ...m.tags].join(' ').toLowerCase().includes(s));
};

// Expand a catalog entry into a note-event stream — the same shape a .mid yields.
export const catalogStream = (item, { beatMs = Math.round(60000 / (item.tempo || 120)) } = {}) => {
  let onset = 0;
  const events = [];
  for (const [pitch, beats] of item.notes) {
    events.push({ pitch, onset, duration: Math.max(1, Math.round(beats * beatMs * 0.92)), velocity: 84, channel: 0 });
    onset += Math.round(beats * beatMs);
  }
  return createStream({ name: item.title, events, tempo: item.tempo, source: 'catalog' });
};
