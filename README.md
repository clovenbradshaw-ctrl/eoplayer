# eoplayer — eocomposer, the music fork

> Input is one thing: an ordered stream of note events. A MIDI file is that stream
> recorded. A live keyboard is that stream in real time. A library is many such
> streams, tagged. Generation is the same stream produced in reverse. The engine
> reads all of it identically because it is all one stream — the music version of
> the modality-blindness that let the reader read tones and pixels and prose. The
> source does not matter; the stream does.

This is the front end of the music fork. It takes the source-blind reading engine
from [eoreader4](../eoreader4) (the reader work) and gives it music to read: MIDI
files, a live keyboard, a tagged library, and a generator — all reduced to one
note-event stream, read and sounded through one path.

## The single fact

```
note event = { pitch (MIDI 0..127), onset, duration, velocity, channel }
the stream  = an ordered sequence of these — the thing the engine reads.
```

A file, a live keyboard, and a generated composition are all just this stream from
different sources. The engine never knows or cares which it is reading.

```
file:      .mid → parse → note-event stream → engine
                                   ↘ soundfont → ear
live:      keyboard → Web MIDI → note-event stream → engine (real-time cursor)
library:   many .mid → parse + feature + auto-tag → persisted tagged set → select → engine
generate:  engine (arcs) → realizer (notes) → note-event stream → soundfont → ear
                                   ↘ stop at noteCount / arcCount / cadence
```

## The engine is vendored, not reinvented

`src/engine/` is copied from eoreader4 — `core/` (the nine-operator genome, the
append-only log), `read/` (the predict·evaluate·surprise reading), and `enact/`
(the DEF–EVA–REC strain loop). It is unchanged but for one inlined constant. The
fork's own contribution is everything that turns a source into the stream the
engine reads, and everything that sounds it.

When the engine reads a melody it folds out the same things it folds from a novel:
the **DEF** of the key it settles on, the **EVA** strain across phrases, the
**REC** at modulations and cadences, and surprise spiking where the music defies
its own established frame.

## Layout (holons — each a single `index.js`, nothing reaches inside another)

```
src/
  engine/     VENDORED reader engine — the source-blind operator engine
  stream/     THE note-event stream: the one internal representation + the seam to the engine
  midi/       file ↔ stream: a dependency-free Standard MIDI File reader/writer
  live/       keyboard → stream: the same stream, arriving in real time
  library/    many streams: features computed on load, auto-tags, query, OPFS persistence
  generate/   stream produced in reverse: arcs → realizer → notes, with the count controls
  play/       one player for every stream: a file and a composition play through identical code
  ui/         the browser app wiring it together
```

## Build order (Input Spec §8)

1. **file → stream → play** — load one `.mid`, parse to events, play through soundfont.
2. **stream → engine read** — feed one file's stream to the engine; show DEF/EVA/REC and surprise.
3. **live keyboard → stream** — Web MIDI in, same stream, engine reads you in real time.
4. **library** — many files, parse + feature + auto-tag, OPFS persistence, tag-filter UI.
5. **generate + count** — arc generation, realizer to notes, the count controls, played through the same path.

## Run

```
npm test            # node --test over the pure logic (parser, stream, read, features, generate, player, UI render)
npm run demo        # the whole spine in one run: file → read → .mid round trip → generate → read the composition
npm run serve       # static server at http://localhost:8000 — the browser app
```

`npm run demo` is the fastest way to see it: the engine reads Twinkle and recovers
C and G with no key supplied, the `.mid` round trip is byte-exact, the generator
runs out tension-release arcs, and the engine — handed its own composition — finds
the key it was given. All five build steps are implemented; the browser app wires
them together.

No build step, no bundler, no server logic — vanilla ES modules, the way eoreader4
runs. The browser-only pieces (soundfont playback, Web MIDI, OPFS) degrade to
testable shims under Node so the whole input path can be exercised without a
browser.

## The count controls (Input Spec §6)

```
noteCount         N notes, hard stop          (literal)
noteCount + soft  N notes, finish the phrase   (default — the simple dial without the guillotine)
arcCount          N tension-release cycles     (structural, musical — the unit the engine generates)
untilResolved     generate to the next full cadence and stop
```
