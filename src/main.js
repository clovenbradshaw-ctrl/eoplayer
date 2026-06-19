// The browser entry — wires the DOM to the holons. (Input Spec §7, §8)
//
// Everything below is one stream from different sources, read and sounded through
// one path. main.js is only glue: it never computes meaning, it routes a source
// into a stream and hands that stream to the engine (to read) and the player (to
// sound). The engine never learns which source it was.

import { streamFromMidi, writeMidi } from './midi/index.js';
import { createStream } from './stream/index.js';
import { createLibrary, createStore } from './library/index.js';
import { generate } from './generate/index.js';
import { createPlayer, createSoundfontBackend } from './play/index.js';
import { createLiveInput, enableWebMidi } from './live/index.js';
import { renderReading } from './ui/read-view.js';
import { renderLibrary } from './ui/library-view.js';

const $ = (id) => document.getElementById(id);
const status = (msg) => { $('status').textContent = msg; };

const state = {
  store: null,
  library: null,
  current: null,        // the NoteStream the read view / transport act on
  player: null,         // lazily created on first play (AudioContext needs a gesture)
  activeTags: new Set(),
  live: null,
};

// --- Boot: restore the library, show the sample, render. ---------------------
const boot = async () => {
  state.store = await createStore();
  state.library = createLibrary({ store: state.store });
  try { await state.library.restore(); } catch { /* first run: nothing to restore */ }

  // Seed the read view with the sample melody so step 2 is visible immediately.
  try {
    const sample = await (await fetch('data/twinkle.json')).json();
    setCurrent(createStream({ ...sample, source: 'sample' }));
  } catch { /* offline / file:// — fine, the panels still work */ }

  renderAll();
  status(`ready · library ${state.library.size} · storage ${state.store.kind}`);
};

const renderAll = () => {
  renderReading($('read-view'), state.current);
  renderLibrary($('library-view'), state.library, {
    activeTags: state.activeTags,
    onSelect: (e) => setCurrent(e.stream),
    onPlay: (e) => play(e.stream),
    onReadSet: (entries) => readSet(entries),
    onToggleTag: (tag) => { state.activeTags.has(tag) ? state.activeTags.delete(tag) : state.activeTags.add(tag); renderAll(); },
  });
};

const setCurrent = (stream) => {
  state.current = stream;
  $('play-btn').disabled = $('stop-btn').disabled = $('export-btn').disabled = !stream;
  $('now-playing').textContent = stream ? `${stream.name} · ${stream.length} notes · ${stream.source}` : 'nothing loaded';
  renderReading($('read-view'), stream);
};

// Reading a tagged SET: concatenate the streams end-to-end into one stream and read
// that — the surface grammar of the whole set, scoped by the tag. (Input Spec §5)
const readSet = (entries) => {
  let onset = 0; const events = [];
  for (const e of entries) {
    for (const ev of e.stream.events) events.push({ ...ev, onset: ev.onset + onset });
    onset += e.stream.durationMs + 400;
  }
  setCurrent(createStream({ name: `set: ${[...state.activeTags].join('+')} (${entries.length})`, events, source: 'set' }));
  status(`reading ${entries.length} streams as one set`);
};

// --- The ear: one player, created lazily, used for every stream. -------------
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

// --- Files → streams → library. ----------------------------------------------
const ingestFiles = async (files) => {
  let last = null;
  for (const file of files) {
    if (!/\.midi?$/i.test(file.name)) continue;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const entry = state.library.addMidi(bytes, { name: file.name });
      last = entry;
    } catch (e) { status(`could not read ${file.name}: ${e.message}`); }
  }
  if (last) {
    try { await state.library.persist(); } catch { /* memory backend: nothing persisted */ }
    setCurrent(last.stream);
    status(`loaded ${last.name} · library ${state.library.size}`);
  }
  renderAll();
};

// --- Wire the DOM. -----------------------------------------------------------
const wire = () => {
  const dz = $('dropzone');
  $('file-input').addEventListener('change', (e) => ingestFiles([...e.target.files]));
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); ingestFiles([...e.dataTransfer.files]); });

  $('play-btn').addEventListener('click', () => play(state.current));
  $('stop-btn').addEventListener('click', () => state.player?.stop());
  $('export-btn').addEventListener('click', () => exportCurrent());

  $('gen-btn').addEventListener('click', () => runGenerate());

  $('live-btn').addEventListener('click', () => toggleLive());
};

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

// --- Live keyboard: the same stream, arriving in real time. ------------------
const toggleLive = async () => {
  if (state.live) { state.live.disable(); state.live = null; $('live-btn').textContent = 'Enable live keyboard'; $('live-status').textContent = 'live off'; return; }
  $('live-status').textContent = 'requesting MIDI access…';
  try {
    const session = await enableWebMidi({
      onPress: async ({ pitch, velocity }) => { const p = await ensurePlayer(); p.kind && playOne(p, pitch, velocity); },
      onNote: (_ev, stream) => { setCurrent(stream); },   // the live cursor advances; the engine re-reads
    });
    state.live = session;
    $('live-btn').textContent = 'Disable live keyboard';
    $('live-status').textContent = `listening on ${session.input} · ${session.inputs.length} input(s)`;
    setCurrent(session.stream);
  } catch (e) {
    $('live-status').textContent = e.message;
  }
};

// Sound a single live note immediately (no full-stream schedule).
const playOne = (player, pitch, velocity) => {
  try { player.play(createStream({ events: [{ pitch, onset: 0, duration: 300, velocity }] })); } catch { /* ignore */ }
};

wire();
boot();
