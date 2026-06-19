// The library: many files in memory, tagged. (Input Spec §4)
//
// A corpus held in browser memory — modest in size because note-event streams are
// small, far smaller than audio. Drop a folder or many files at once, parse each to
// events, compute features, auto-tag, add, persist. Then you read, tag, filter, and
// select from the library rather than from the filesystem. A few thousand MIDI
// files fit comfortably because each is a small event list.
//
//   library entry = { id, name, events, features, tags }
//
// `streamsFor(query)` is the handoff to the engine: select by tag, get streams,
// feed them to the read side — without ever hand-feeding files.

import { createStream } from '../stream/index.js';
import { streamFromMidi } from '../midi/index.js';
import { computeFeatures } from './features.js';
import { autoTags, normTag, matchesQuery } from './tag.js';

let nextEntryId = 1;

export const createLibrary = ({ store } = {}) => {
  const entries = new Map();   // id → { id, name, stream, features, tags }

  const ingestStream = (stream, { name, tags = [] } = {}) => {
    const features = computeFeatures(stream);
    const auto = autoTags(features);
    const user = tags.map(normTag);
    const id = `e${nextEntryId++}`;
    const entry = {
      id,
      name: name || stream.name,
      stream,
      features,
      // user labels + auto labels, de-duplicated; provenance kept so the UI can
      // show which were derived and which a person attached.
      tags: [...new Set([...user, ...auto])],
      userTags: [...new Set(user)],
      autoTags: auto,
    };
    entries.set(id, entry);
    return entry;
  };

  const api = {
    // Add an already-built stream (e.g. a live take, or a generated composition).
    add(stream, opts) { return ingestStream(stream, opts); },

    // The practical loader: a .mid binary → parse → feature → auto-tag → add.
    addMidi(bytes, { name, tags } = {}) {
      const stream = streamFromMidi(bytes, { name });
      return ingestStream(stream, { name, tags });
    },

    get(id) { return entries.get(id) || null; },
    all() { return [...entries.values()]; },
    get size() { return entries.size; },
    remove(id) { return entries.delete(id); },

    // Attach / detach free user labels after the fact.
    tag(id, ...labels) {
      const e = entries.get(id); if (!e) return null;
      const add = labels.map(normTag);
      e.userTags = [...new Set([...e.userTags, ...add])];
      e.tags = [...new Set([...e.tags, ...add])];
      return e;
    },
    untag(id, ...labels) {
      const e = entries.get(id); if (!e) return null;
      const rm = new Set(labels.map(normTag));
      e.userTags = e.userTags.filter(t => !rm.has(t));
      e.tags = e.tags.filter(t => !rm.has(t) || e.autoTags.includes(t)); // never strip an auto tag
      return e;
    },

    // The queryable set. `query` takes { all, any, none, where }.
    query(spec = {}) { return api.all().filter(e => matchesQuery(e, spec)); },
    selectByTag(tag) { return api.query({ all: [tag] }); },

    // The handoff to the engine: the streams matching a query. Per the spec, read
    // ONE piece (a single stream) or read a TAGGED SET (many) to learn the surface
    // grammar — same call, the query scopes it.
    streamsFor(spec = {}) { return api.query(spec).map(e => e.stream); },

    // All distinct tags with their counts — the material a tag-filter UI is built on.
    tagCloud() {
      const counts = new Map();
      for (const e of api.all()) for (const t of e.tags) counts.set(t, (counts.get(t) || 0) + 1);
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
    },

    // Serialize the corpus — streams (events + tempo/ppq), features, tags. Small.
    toJSON() {
      return {
        version: 1,
        entries: api.all().map(e => ({
          id: e.id, name: e.name, features: e.features,
          tags: e.tags, userTags: e.userTags, autoTags: e.autoTags,
          tempo: e.stream.tempo, ppq: e.stream.ppq, source: e.stream.source,
          events: e.stream.events,
        })),
      };
    },

    // Rebuild the corpus from serialized JSON (streams reconstituted from events).
    fromJSON(data) {
      entries.clear();
      for (const r of (data?.entries || [])) {
        const stream = createStream({ name: r.name, events: r.events, tempo: r.tempo, ppq: r.ppq, source: r.source || 'file' });
        entries.set(r.id, {
          id: r.id, name: r.name, stream, features: r.features,
          tags: r.tags || [], userTags: r.userTags || [], autoTags: r.autoTags || [],
        });
        const n = Number(String(r.id).replace(/^e/, ''));
        if (Number.isFinite(n) && n >= nextEntryId) nextEntryId = n + 1;
      }
      return api;
    },

    // Persistence (OPFS in the browser, memory under Node) — survives a reload.
    async persist(key = 'library') {
      if (!store) throw new Error('library.persist: no store configured');
      await store.saveJSON(key, api.toJSON());
    },
    async restore(key = 'library') {
      if (!store) throw new Error('library.restore: no store configured');
      const data = await store.loadJSON(key);
      if (data) api.fromJSON(data);
      return api;
    },
  };

  return api;
};
