// The read view — the engine reading the current stream, drawn. (Input Spec §5)
//
// This is build step 2 made visible: feed a stream to the engine and watch it read.
// The DEF of the key (the pitch classes the mass-fold keeps returning to), the
// surprise spiking where the music defies its established frame, and the REC stops
// (the cursors where a frame broke — modulations and cadences). The same surfaces
// that read a novel, run over a melody. Nothing here is music-specific; it only
// renders what the engine returns.

import { readingAt, surfFold, projectGraph } from '../engine/index.js';
import { noteName } from '../stream/index.js';
import { provenanceOf } from './provenance.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

export const renderReading = (container, stream, opts = {}) => {
  container.innerHTML = '';
  if (!stream || !stream.length) { container.appendChild(el('p', 'hint', 'No stream loaded. Drop a .mid, play live, pick from the library, or generate.')); return; }

  const doc = stream.toDoc();

  // --- Provenance: name what is being read — Generated or Precoded — before the
  // engine reads it (the engine itself is source-blind; the reader is not). --------
  const prov = provenanceOf(stream.source);
  const banner = el('div', 'prov-banner');
  banner.appendChild(el('span', 'prov ' + prov.cls, prov.family));
  banner.appendChild(el('span', 'hint', `${stream.name} — ${prov.detail} · ${stream.length} notes`));
  container.appendChild(banner);

  // --- The DEF of the key: the pitches the whole stream keeps returning to. ------
  const g = projectGraph(doc.log);
  const byMass = [...g.entities.values()].sort((a, b) => b.sightings - a.sightings);
  const center = el('div', 'read-block');
  center.appendChild(el('h4', null, 'Tonal center — the DEF the mass-fold settles on'));
  const masses = el('div', 'pc-mass');
  const max = byMass[0]?.sightings || 1;
  for (const e of byMass) {
    const row = el('div', 'pc-row');
    row.appendChild(el('span', 'pc-name', e.label));
    const bar = el('span', 'pc-bar');
    bar.style.width = `${Math.round((e.sightings / max) * 100)}%`;
    row.appendChild(bar);
    row.appendChild(el('span', 'pc-count', `×${e.sightings}`));
    masses.appendChild(row);
  }
  center.appendChild(masses);
  if (byMass.length >= 2) center.appendChild(el('p', 'hint', `heaviest two: ${byMass[0].label} and ${byMass[1].label} — tonic and dominant, recovered without being told the key.`));
  container.appendChild(center);

  // --- The surprise curve + the REC stops (frame breaks). ------------------------
  const readings = doc.sequence.map(n => ({ idx: n.unitIdx, note: noteName(n.pitch), ...readingAt(doc, n.unitIdx) }));
  const surf = surfFold(doc, Math.floor(doc.sequence.length / 2), { behind: doc.sequence.length, ahead: doc.sequence.length });
  const recSet = new Set(surf.recCursors);

  // The seam: where your notes end and the engine's continuation begins. When set,
  // the two regions are tinted and a divider is drawn — the takeover made visible.
  const seam = Number.isInteger(opts.seam) && opts.seam > 0 && opts.seam < readings.length ? opts.seam : null;

  const curve = el('div', 'read-block');
  curve.appendChild(el('h4', null, seam ? 'Surprise across the stream — you ▏the engine continues' : 'Surprise across the stream — REC stops where a frame broke'));
  const grid = el('div', 'surprise-grid');
  for (const r of readings) {
    const region = seam == null ? '' : (r.idx < seam ? ' mine' : ' gen');
    const atSeam = seam != null && r.idx === seam ? ' seam' : '';
    const cell = el('div', 'surprise-cell' + (recSet.has(r.idx) ? ' rec' : '') + region + atSeam);
    const bar = el('div', 'surprise-bar');
    bar.style.height = `${Math.round(r.surprise * 100)}%`;
    bar.title = `${r.note}: surprise ${r.surprise.toFixed(2)}${r.surprises[0] ? ' — ' + r.surprises[0].text : ''}`;
    cell.appendChild(bar);
    cell.appendChild(el('span', 'surprise-note', r.note.replace(/\d/, '')));
    grid.appendChild(cell);
  }
  curve.appendChild(grid);
  if (seam) curve.appendChild(el('p', 'hint', `The first ${seam} notes are yours; the engine read them and wrote the rest. The join is in the same key and register — inaudible in playback.`));
  if (surf.recCursors.length) {
    const recs = surf.recCursors.map(c => readings.find(r => r.idx === c)?.note || c).join(', ');
    curve.appendChild(el('p', 'hint', `REC — the reading restructured at: ${recs} (a modulation or a cadence).`));
  } else {
    curve.appendChild(el('p', 'hint', 'No frame break — the stream held one frame throughout.'));
  }
  container.appendChild(curve);

  // --- The sharpest moments, tagged with the operator each fired under. -----------
  const peaks = readings.filter(r => r.idx > 0 && r.surprises.length).sort((a, b) => b.surprise - a.surprise).slice(0, 5);
  if (peaks.length) {
    const sharp = el('div', 'read-block');
    sharp.appendChild(el('h4', null, 'Sharpest moments'));
    const list = el('ul', 'surprise-list');
    for (const p of peaks) {
      const li = el('li');
      li.appendChild(el('span', 'op-tag op-' + (p.surprises[0].op || '').toLowerCase(), p.surprises[0].op));
      li.appendChild(el('span', null, ` ${p.note} — ${p.surprises[0].text} (${p.surprise.toFixed(2)})`));
      list.appendChild(li);
    }
    sharp.appendChild(list);
    container.appendChild(sharp);
  }
};
