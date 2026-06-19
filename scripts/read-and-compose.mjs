// The whole spine in one run — no browser, no audio, just the stream and the engine.
//
//   file → stream → engine read → .mid round trip → generate → read the composition
//
// Every stage hands the next the SAME note-event stream. The engine never knows
// whether it is reading a loaded file or its own composition — the modality-
// blindness of the reader work, now over where the music comes from.

import { readFileSync } from 'node:fs';
import { createStream } from '../src/stream/index.js';
import { writeMidi, streamFromMidi } from '../src/midi/index.js';
import { generate, continueStream, predictedNext } from '../src/generate/index.js';
import { readingAt, surfFold, projectGraph } from '../src/engine/index.js';

const bar = (x, w = 24) => '█'.repeat(Math.round(x * w));
const pc = (e) => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][((e.pitch % 12) + 12) % 12];

const readReport = (stream, label) => {
  const doc = stream.toDoc();
  console.log(`\n=== ${label} — ${stream.length} notes, source: ${stream.source} ===`);
  console.log('  ' + doc.sequence.map(s => s.note).join(' '));

  const byMass = [...projectGraph(doc.log).entities.values()].sort((a, b) => b.sightings - a.sightings);
  console.log(`  tonal center (DEF, by mass): ${byMass.slice(0, 3).map(e => `${e.label}×${e.sightings}`).join('  ')}`);
  console.log(`  → the two the mass-fold keeps returning to: ${byMass[0].label} and ${byMass[1].label} — the key center, unsupplied.`);

  const curve = doc.sequence.map(s => ({ note: s.note, ...readingAt(doc, s.unitIdx) }));
  const surf = surfFold(doc, Math.floor(doc.sequence.length / 2), { behind: doc.sequence.length, ahead: doc.sequence.length });
  const recSet = new Set(surf.recCursors);
  console.log('  surprise across the stream (■ = a REC, a frame breaking):');
  curve.forEach((r, i) => {
    const mark = recSet.has(i) ? '■' : ' ';
    console.log(`   ${mark} ${String(i).padStart(2)} ${r.note.padEnd(4)} ${r.surprise.toFixed(2)} ${bar(r.surprise)}` +
      (r.surprises[0] ? `  ${r.surprises[0].op} ${r.surprises[0].text}` : ''));
  });
  if (surf.recCursors.length) console.log(`  REC stops at: ${surf.recCursors.map(c => curve[c]?.note || c).join(', ')}`);
};

// 1. file → stream → read --------------------------------------------------------
const twinkle = JSON.parse(readFileSync(new URL('../data/twinkle.json', import.meta.url)));
const loaded = createStream({ ...twinkle, source: 'file' });
readReport(loaded, 'LOADED FILE (twinkle)');

// 2. the .mid round trip ----------------------------------------------------------
const bytes = writeMidi(loaded.events, { tempo: loaded.tempo, ppq: loaded.ppq });
const reloaded = streamFromMidi(bytes, { name: 'twinkle.mid' });
console.log(`\n=== .mid ROUND TRIP ===\n  wrote ${bytes.length} bytes, parsed back ${reloaded.length} notes — ` +
  (reloaded.events.map(e => e.pitch).join() === loaded.events.map(e => e.pitch).join() ? 'identical pitches.' : 'MISMATCH!'));

// 3. generate → read the composition ---------------------------------------------
const { stream: comp, meta } = generate({ key: 'D minor', seed: 7, arcCount: 3 });
console.log(`\n=== GENERATED (${meta.key}, ${meta.arcs} arcs, ${meta.notes} notes, ended on ${meta.endedOn}) ===`);
readReport(comp, 'THE ENGINE READS ITS OWN COMPOSITION');

// 4. the count controls -----------------------------------------------------------
console.log('\n=== THE COUNT CONTROLS (same key, same seed) ===');
for (const [label, opts] of [
  ['noteCount 8, hard', { noteCount: 8, soft: false }],
  ['noteCount 8, soft (default)', { noteCount: 8, soft: true }],
  ['arcCount 2', { arcCount: 2 }],
  ['untilResolved', { untilResolved: true }],
]) {
  const { stream, meta: m } = generate({ key: 'C major', seed: 4, ...opts });
  const last = stream.events[stream.events.length - 1];
  console.log(`  ${label.padEnd(28)} → ${String(stream.length).padStart(2)} notes, ended on ${m.endedOn}` +
    `, last note ${['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][((last.pitch % 12) + 12) % 12]}` +
    `${(((last.pitch % 12) + 12) % 12) === 0 ? ' (tonic — resolved)' : ''}`);
}

// 5. continuation — read a prefix, then KEEP GOING on the same stream ------------
// The point: the reader is a predictor, and a predictor run forward is a generator.
console.log('\n=== CONTINUATION — the reader keeps going (the point) ===');
const prefix = loaded.clone({ events: loaded.events.slice(0, 6) });   // cut twinkle off after 6 notes
const pred = predictedNext(prefix);
console.log(`  you play:  ${prefix.events.map(pc).join(' ')}   → the reader predicts next: ${pred.figures.join(', ')}`);
const { stream: continued, meta: cm } = continueStream(prefix, { noteCount: 8 });
console.log(`  it recovered ${cm.key} from those 6 notes and wrote ${cm.addedNotes} more onto the SAME stream (seam at note ${cm.seam}):`);
console.log(`   yours:    ${continued.events.slice(0, cm.seam).map(pc).join(' ')}`);
console.log(`   engine:   ${continued.events.slice(cm.seam).map(pc).join(' ')}`);
readReport(continued, 'THE ENGINE READS THE WHOLE THING — your notes + its own, one stream');

console.log('\nOne stream throughout. The engine read a file and its own composition with the');
console.log('same surfaces; the count you choose stopped generation on a hard boundary or a');
console.log('resolution; and handed a prefix, the same reader CONTINUED it — because reading');
console.log('(predict the next note) and generating (emit your prediction) are one faculty.');
console.log('The source did not matter, and neither did the direction; the stream did.');
