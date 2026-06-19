// The browser entry — wires the DOM to the holons. (Input Spec §7, §8)
//
// Everything below is one stream from different sources, read and sounded through
// one path. main.js is only glue: it never computes meaning, it routes a source
// into a stream and hands that stream to the engine (to read) and the player (to
// sound). The engine never learns which source it was — but the UI labels each
// stream's provenance (Generated vs Precoded vs Live) so a person always can.

import { streamFromMidi, writeMidi } from './midi/index.js';
import { createStream } from './stream/index.js';
import { createLibrary, createStore } from './library/index.js';
import { generate } from './generate/index.js';
import { catalogStream } from './catalog/index.js';
import { createPlayer, createSoundfontBackend } from './play/index.js';
import { enableWebMidi } from './live/index.js';
import { renderReading } from './ui/read-view.js';
import { renderLibrary } from './ui/library-view.js';
import { renderKeyboard } from './ui/keyboard-view.js';
import { renderFind } from './ui/find-view.js';
import { provenanceOf } from './ui/provenance.js';

const $ = (id) => document.getElementById(id);
const status = (msg) => { $('status').textContent = msg; };

const state = {
  store: null,
  library: null,
  current: null,        // the NoteStream the read view / transport act on
  player: null,         // lazily created on first play (AudioContext needs a gesture)
  activeTags: new Set(),
  nameQuery: '',        // the library free-text filter
  keyboard: null,       // the on-screen keyboard session
  midi: null,           // an optional external MIDI device, feeding the same session
};

// --- Boot: restore the library, build the keyboard and catalog, show the sample. --
const boot = async () => {
  state.store = await createStore();
  state.library = createLibrary({ store: state.store });
  try { await state.library.restore(); } catch { /* first run: nothing to restore */ }

  setupKeyboard();
  renderFind($('find-view'), { onAdd: addFromCatalog, onImportUrl: importFromUrl });

  // Seed the read view with the sample melody so the engine read is visible at once.
  try {
    const sample = await (await fetch('data/twinkle.json')).json();
    setCurrent(createStream({ ...sample, source: 'sample' }));
  } catch { /* offline / file:// — fine, the panels still work */ }

  renderAll();
  status(`ready · library ${state.library.size} · storage ${state.store.kind}`);
};

const libHandlers = () => ({
  activeTags: state.activeTags,
  nameQuery: state.nameQuery,
  onSelect: (e) => setCurrent(e.stream),
  onPlay: (e) => play(e.stream),
  onReadSet: (entries) => readSet(entries),
  onToggleTag: (tag) => { state.activeTags.has(tag) ? state.activeTags.delete(tag) : state.activeTags.add(tag); renderLibraryOnly(); },
});

const renderLibraryOnly = () => renderLibrary($('library-view'), state.library, libHandlers());
const renderAll = () => { renderReading($('read-view'), state.current); renderLibraryOnly(); };

const setCurrent = (stream) => {
  state.current = stream;
  $('play-btn').disabled = $('stop-btn').disabled = $('export-btn').disabled = !stream;
  const prov = stream ? provenanceOf(stream.source) : null;
  const badge = $('now-prov');
  badge.className = 'prov' + (prov ? ' ' + prov.cls : '');
  badge.textContent = prov ? prov.family : '';
  badge.title = prov ? prov.detail : '';
  $('now-playing').textContent = stream ? `${stream.name} · ${stream.length} notes · ${prov.detail}` : 'nothing loaded';
  renderReading($('read-view'), stream);
};

// Reading a tagged SET: concatenate the streams end-to-end into one stream and read
// that — the surface grammar of the whole set, scoped by the filter. (Input Spec §5)
const readSet = (entries) => {
  let onset = 0; const events = [];
  for (const e of entries) {
    for (const ev of e.stream.events) events.push({ ...ev, onset: ev.onset + onset });
    onset += e.stream.durationMs + 400;
  }
  const label = [...state.activeTags].join('+') || state.nameQuery || 'filtered';
  setCurrent(createStream({ name: `set: ${label} (${entries.length})`, events, source: 'set' }));
  status(`reading ${entries.length} streams as one set`);
};

// --- The ear: one player, created lazily, used for every stream. -----------------
const ensurePlayer = async () => {
  if (state.player) return state.player;
  status('loading the soundfont…');
  const backend = await createSoundfontBackend();
  state.player = createPlayer({ backend });
  status(`ear ready · ${backend.kind}`);
  return state.player;
};

const play = async (stream) => {
  if (!stream) return;
  const player = await ensurePlayer();
  player.play(stream);
  status(`playing ${stream.name}`);
};

// --- Files → streams → library. --------------------------------------------------
const ingestFiles = async (files) => {
  let last = null, n = 0;
  for (const file of files) {
    if (!/\.midi?$/i.test(file.name)) continue;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      last = state.library.addMidi(bytes, { name: file.name });
      n++;
    } catch (e) { status(`could not read ${file.name}: ${e.message}`); }
  }
  if (last) {
    try { await state.library.persist(); } catch { /* memory backend: nothing persisted */ }
    setCurrent(last.stream);
    status(`imported ${n} file${n === 1 ? '' : 's'} · library ${state.library.size}`);
  } else {
    status('no .mid files found in that selection');
  }
  renderAll();
};

// Import a .mid straight from a URL — works for hosts that serve files cross-origin
// (GitHub raw, some archives). Many sites block it; then download and drop instead.
const importFromUrl = async (url) => {
  status(`fetching ${url} …`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const name = (url.split('/').pop() || 'import').replace(/\?.*$/, '') || 'import.mid';
    const entry = state.library.addMidi(bytes, { name });
    try { await state.library.persist(); } catch { /* memory backend */ }
    setCurrent(entry.stream);
    renderAll();
    status(`imported ${entry.name} · library ${state.library.size}`);
  } catch (e) {
    status(`could not import — ${e.message}. Many sites block cross-origin fetch; download the file and drop it here.`);
  }
};

// Add a built-in catalog melody into the library (Precoded provenance).
const addFromCatalog = (item) => {
  const entry = state.library.add(catalogStream(item), { tags: item.tags });
  state.library.persist().catch(() => {});
  setCurrent(entry.stream);
  renderAll();
  status(`added “${item.title}” to the library · ${state.library.size} entries`);
};

// --- Generate: the same stream, produced in reverse. -----------------------------
const runGenerate = () => {
  const key = $('gen-key').value;
  const seed = Number($('gen-seed').value) || 1;
  const n = Number($('gen-n').value) || 8;
  const mode = document.querySelector('input[name="count"]:checked').value;
  const opts = { key, seed };
  if (mode === 'arcCount') opts.arcCount = n;
  else if (mode === 'untilResolved') opts.untilResolved = true;
  else if (mode === 'noteCountHard') { opts.noteCount = n; opts.soft = false; }
  else { opts.noteCount = n; opts.soft = true; }

  const { stream, meta } = generate(opts);
  // A composition is a stream like any other — taggable into the library, persisted.
  const entry = state.library.add(stream, { tags: ['generated', meta.key] });
  state.library.persist().catch(() => {});
  setCurrent(entry.stream);
  renderAll();
  status(`generated ${meta.notes} notes · ${meta.arcs} arc(s) · ended on ${meta.endedOn}`);
  play(entry.stream);
};

const exportCurrent = () => {
  if (!state.current) return;
  const bytes = writeMidi(state.current.events, { tempo: state.current.tempo, ppq: state.current.ppq });
  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }));
  const a = document.createElement('a');
  a.href = url; a.download = `${state.current.name.replace(/\.midi?$/i, '')}.mid`;
  a.click();
  URL.revokeObjectURL(url);
};

// --- The on-screen keyboard: the live stream, played in the app. ------------------
const setupKeyboard = () => {
  state.keyboard = renderKeyboard($('keyboard-view'), {
    onPress: async ({ pitch, velocity }) => { const p = await ensurePlayer(); playOne(p, pitch, velocity); },
    onNote: (_ev, stream) => setCurrent(stream),   // the live cursor advances; the engine re-reads
  });
  $('live-status').textContent = 'on-screen keyboard ready';
};

// Sound a single live note immediately (no full-stream schedule).
const playOne = (player, pitch, velocity) => {
  try { player.play(createStream({ events: [{ pitch, onset: 0, duration: 300, velocity }] })); } catch { /* ignore */ }
};

const saveTake = () => {
  const s = state.keyboard?.stream;
  if (!s || !s.length) { status('play some notes on the keyboard first'); return; }
  const entry = state.library.add(s.clone({ name: `live take · ${s.length} notes` }));
  state.library.persist().catch(() => {});
  setCurrent(entry.stream);
  renderAll();
  status(`saved live take · library ${state.library.size}`);
};

const clearTake = () => { setCurrent(state.keyboard.clear()); status('cleared the live take'); };

// Optionally feed a real MIDI device INTO the on-screen keyboard's session.
const connectMidi = async () => {
  $('live-status').textContent = 'requesting MIDI access…';
  try {
    state.midi = await enableWebMidi({ live: state.keyboard.live });
    $('live-status').textContent = `MIDI: ${state.midi.input} · ${state.midi.inputs.length} input(s) → on-screen take`;
  } catch (e) {
    $('live-status').textContent = e.message;
  }
};

// --- Wire the DOM. ---------------------------------------------------------------
const wire = () => {
  const dz = $('dropzone');
  $('file-input').addEventListener('change', (e) => ingestFiles([...e.target.files]));
  $('folder-input').addEventListener('change', (e) => ingestFiles([...e.target.files]));
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); ingestFiles([...e.dataTransfer.files]); });

  $('play-btn').addEventListener('click', () => play(state.current));
  $('stop-btn').addEventListener('click', () => state.player?.stop());
  $('export-btn').addEventListener('click', () => exportCurrent());

  $('gen-btn').addEventListener('click', () => runGenerate());

  $('kbd-keys').addEventListener('change', (e) => state.keyboard?.setComputerKeys(e.target.checked));
  $('kbd-clear').addEventListener('click', () => clearTake());
  $('kbd-save').addEventListener('click', () => saveTake());
  $('connect-midi').addEventListener('click', () => connectMidi());

  $('library-search').addEventListener('input', (e) => { state.nameQuery = e.target.value; renderLibraryOnly(); });
};

wire();
boot();
