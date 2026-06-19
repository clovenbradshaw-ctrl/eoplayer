// Persistence. (Input Spec §4)
//
// Hold the library in OPFS (the origin private file system, which the project
// already prefers over IndexedDB for scale), so a loaded and tagged library
// survives a reload and you are not re-importing every session. The note-event
// streams and their features and tags persist; the soundfont for playback is
// fetched separately and cached.
//
// The backend is pluggable and self-selecting: OPFS in a browser that has it, an
// in-memory map otherwise (Node, tests, a browser without OPFS). Same async
// surface either way, so the library never asks where it is running.

// OPFS-backed: each key is a JSON file under one app directory.
export const opfsBackend = async (dirName = 'eoplayer') => {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle(dirName, { create: true });
  return {
    kind: 'opfs',
    async save(key, text) {
      const fh = await dir.getFileHandle(`${key}.json`, { create: true });
      const w = await fh.createWritable();
      await w.write(text);
      await w.close();
    },
    async load(key) {
      try {
        const fh = await dir.getFileHandle(`${key}.json`);
        return await (await fh.getFile()).text();
      } catch { return null; }
    },
    async remove(key) { try { await dir.removeEntry(`${key}.json`); } catch { /* absent is fine */ } },
    async list() {
      const keys = [];
      for await (const [name] of dir.entries()) if (name.endsWith('.json')) keys.push(name.slice(0, -5));
      return keys;
    },
  };
};

// In-memory: a Map. Survives nothing, but gives the library a working backend under
// Node and lets persistence be tested without a browser. A caller may pass a shared
// Map to simulate "the same origin on reload".
export const memoryBackend = (map = new Map()) => ({
  kind: 'memory',
  async save(key, text) { map.set(key, text); },
  async load(key) { return map.has(key) ? map.get(key) : null; },
  async remove(key) { map.delete(key); },
  async list() { return [...map.keys()]; },
});

// Pick the best backend available. OPFS when the browser exposes it; memory else.
export const defaultBackend = async () => {
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.getDirectory === 'function') {
    try { return await opfsBackend(); } catch { /* fall through to memory */ }
  }
  return memoryBackend();
};

// A JSON store over any backend — the surface the library actually uses.
export const createStore = async ({ backend } = {}) => {
  const be = backend || await defaultBackend();
  return {
    kind: be.kind,
    async saveJSON(key, obj) { await be.save(key, JSON.stringify(obj)); },
    async loadJSON(key) { const t = await be.load(key); return t == null ? null : JSON.parse(t); },
    async remove(key) { await be.remove(key); },
    async list() { return be.list(); },
  };
};
