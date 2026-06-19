// The read/library views render without a browser — a minimal DOM stub stands in
// for document, so the render logic (not just the holons) is covered. (Build step 2
// and 4 made visible.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// A tiny DOM good enough for the two view modules: createElement, append, text,
// className, style, listeners. No layout, no events fired.
class El {
  constructor(tag) { this.tagName = tag; this.children = []; this.className = ''; this.style = {}; this.attrs = {}; this._text = ''; this.listeners = {}; }
  set textContent(v) { this._text = String(v); }
  get textContent() { return this._text; }
  set innerHTML(_v) { this.children = []; }
  get innerHTML() { return ''; }
  set title(v) { this.attrs.title = v; }
  set type(v) { this.attrs.type = v; }
  appendChild(c) { this.children.push(c); return c; }
  append(...cs) { for (const c of cs) this.children.push(c); }
  addEventListener(ev, fn) { (this.listeners[ev] || (this.listeners[ev] = [])).push(fn); }
  querySelector() { return null; }
}
globalThis.document = { createElement: (t) => new El(t) };

const flatten = (node, out = []) => { if (node._text) out.push(node._text); for (const c of node.children || []) flatten(c, out); return out; };
const allText = (node) => flatten(node).join(' · ');

const { createStream } = await import('../src/stream/index.js');
const { createLibrary } = await import('../src/library/index.js');
const { renderReading } = await import('../src/ui/read-view.js');
const { renderLibrary } = await import('../src/ui/library-view.js');
const { renderKeyboard } = await import('../src/ui/keyboard-view.js');

const twinkle = JSON.parse(readFileSync(new URL('../data/twinkle.json', import.meta.url)));

test('renderReading draws the tonal center and a surprise cell per note', () => {
  const container = new El('div');
  renderReading(container, createStream(twinkle));
  const text = allText(container);
  assert.match(text, /Precoded/);          // the provenance banner names what is read
  assert.match(text, /Tonal center/);
  assert.match(text, /tonic and dominant/);
  // One surprise cell per note (14 in Twinkle).
  const cells = [];
  const walk = (n) => { if (n.className === 'surprise-cell' || n.className?.startsWith('surprise-cell')) cells.push(n); for (const c of n.children || []) walk(c); };
  walk(container);
  assert.equal(cells.length, 14);
});

test('renderReading handles an empty stream gracefully', () => {
  const container = new El('div');
  renderReading(container, createStream({ events: [] }));
  assert.match(allText(container), /No stream loaded/);
});

test('renderLibrary draws the tag cloud and a card per entry', () => {
  const lib = createLibrary();
  lib.add(createStream(twinkle), { tags: ['nursery'] });
  const container = new El('div');
  renderLibrary(container, lib, { activeTags: new Set() });
  const text = allText(container);
  assert.match(text, /nursery/);            // the user tag is in the cloud
  assert.match(text, /twinkle/);            // the entry card shows its name
  assert.match(text, /major/);              // an auto tag derived from features
  assert.match(text, /Precoded/);           // the provenance badge on the card
});

test('renderKeyboard draws a playable on-screen piano driving a live stream', () => {
  const container = new El('div');
  const kbd = renderKeyboard(container, { startPitch: 60, octaves: 2 });
  const whites = [];
  const walk = (n) => { if (n.className === 'key white') whites.push(n); for (const c of n.children || []) walk(c); };
  walk(container);
  assert.equal(whites.length, 15);          // C4..C6 inclusive
  assert.equal(kbd.stream.source, 'live');  // the same live stream a real device feeds
  assert.equal(kbd.stream.length, 0);       // nothing played yet
});
