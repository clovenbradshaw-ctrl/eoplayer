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
live:      on-screen keyboard (click / tap / type) → note-event stream → engine (real-time cursor)
                                   ↘ (optional) a real MIDI device feeds the same stream
catalog:   built-in melody → note-event stream → engine        (search & add, no network)
library:   many .mid → parse + feature + auto-tag → persisted tagged set → select → engine
generate:  engine (arcs) → realizer (notes) → note-event stream → soundfont → ear
                                   ↘ stop at noteCount / arcCount / cadence
```

Whatever the source, the UI labels each stream's **provenance** — **Generated** (the
machine made it) vs **Precoded** (a loaded file, the bundled sample, or the catalog),
plus **Live** and **Set** — on the transport, in the read view, and on every library
card. The engine stays source-blind; only the person reading the screen is told which.

## Continuation — the point

The reading engine is a **predictor**: at every note it builds a prior over what
comes next and measures its surprise when the next note lands. Run that prediction
forward with no input and the predictor *is* a generator — emit the prediction, then
predict again from it. **Reading and generating are one faculty pointed two ways.**

So these are the same operation, and they are what the whole architecture is for:

```
play three notes  → it reads them → it plays the fourth (and the phrase)
load a file, cut it off → it reads the prefix → the generation takes over
```

`Continue` reads a **prefix** (your live notes, or a file truncated at a cut point),
recovers its frame — the key (the DEF the mass-fold settles on), the register, your
tempo — and writes the next notes onto the **same stream**. What you played and what
it wrote are one note-event stream; the **seam** is marked in the reading (your notes
tinted one way, the engine's the other, a divider where it took over) and is inaudible
in playback. Run `npm run demo` to watch it cut Twinkle off after six notes, recover C
major, and finish the melody in the same hand.

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
  live/       keyboard → stream: the same stream, arriving in real time (on-screen or a real device)
  catalog/    a small built-in library of public-domain melodies: search and add into memory
  sources/    a searchable directory of real MIDI libraries (from awesome-midi-sources)
  library/    many streams: features computed on load, auto-tags, query, OPFS persistence
  generate/   stream produced in reverse: arcs → realizer → notes, with the count controls
  play/       one player for every stream: a file and a composition play through identical code
  ui/         the browser app wiring it together (incl. the on-screen keyboard and provenance labels)
```

## Build order (Input Spec §8)

1. **file → stream → play** — load one `.mid` (drag, browse, import a folder, or by URL), parse to events, play through soundfont.
2. **stream → engine read** — feed one file's stream to the engine; show DEF/EVA/REC and surprise.
3. **live keyboard → stream** — an **on-screen keyboard** (click, tap, or type `a w s e d f t g y h u j k`); same stream, engine reads you in real time. A real MIDI device can feed the same session.
4. **library** — many files, parse + feature + auto-tag, OPFS persistence, tag- and text-search UI, provenance shown per entry. A built-in **catalog** and a searchable directory of online **sources** fill it.
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

## Finding & importing music

Three ways to fill the library, all landing as the same stream:

- **Your own files** — drag `.mid` files onto the dropzone, browse, or **import a whole
  folder** at once; each is parsed, featured, auto-tagged, and persisted to OPFS.
- **The built-in catalog** — a handful of public-domain melodies you can search by
  title, composer, or tag and add with one click. No network required.
- **Online sources** — a searchable directory of real MIDI libraries (Lakh, the
  Utrecht archive, VGMusic, Bach pages, and more), drawn from
  [awesome-midi-sources](https://github.com/albertmeronyo/awesome-midi-sources). Open a
  source and drop its files here, or paste a **direct `.mid` URL** to import (works for
  hosts that serve files cross-origin, e.g. GitHub raw; others block it, so download
  and drop).

The library has a **text search** alongside the tag chips, and every entry shows its
**provenance** badge so a Generated composition is never mistaken for a Precoded file.

## Credits

The online sources directory is built from
[albertmeronyo/awesome-midi-sources](https://github.com/albertmeronyo/awesome-midi-sources).
The reading engine under `src/engine/` is vendored from eoreader4.
