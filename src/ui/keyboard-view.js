// The on-screen keyboard — the live stream, played inside the app. (Input Spec §3)
//
// The live holon's createLiveInput is hardware-blind: it turns noteOn/noteOff into
// the same note-event stream a file yields. webmidi.js drives it from a real device;
// this drives it from a piano you click, tap, or type — so a live take needs no MIDI
// hardware at all. It is the architecture paying off again: swap the source (real
// keys → on-screen keys) and nothing downstream changes. The engine reads the result
// identically, with no idea where the keypress came from.

import { createLiveInput } from '../live/index.js';
import { PC_NAME } from '../stream/index.js';

const WHITE_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);
const isBlack = (pitch) => !WHITE_PCS.has(((pitch % 12) + 12) % 12);

// Computer keys → semitone offset from the keyboard's start pitch — the familiar
// two-row piano layout:   w e   t y u
//                        a s d f g h j k
const KEY_OFFSET = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12 };
const charFor = (pitch, startPitch) => Object.keys(KEY_OFFSET).find(c => startPitch + KEY_OFFSET[c] === pitch);

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

export const renderKeyboard = (container, { onPress, onNote, startPitch = 60, octaves = 2, velocity = 90, computerKeys = true } = {}) => {
  let live = createLiveInput({ name: 'on-screen keyboard', onPress });
  if (onNote) live.onNote(onNote);

  const held = new Set();
  const keyEls = new Map();              // pitch → element, so a press can light its key
  const lastPitch = startPitch + octaves * 12;   // include the top C

  const press = (pitch) => {
    if (held.has(pitch)) return;
    held.add(pitch);
    keyEls.get(pitch)?.classList.add('down');
    live.noteOn(pitch, velocity);        // onPress (set at creation) sounds it; subscribers re-read
  };
  const release = (pitch) => {
    if (!held.has(pitch)) return;
    held.delete(pitch);
    keyEls.get(pitch)?.classList.remove('down');
    live.noteOff(pitch);                 // completes the note → appended to the stream
  };

  const wireKey = (k, pitch) => {
    k.addEventListener('pointerdown', (e) => { e.preventDefault?.(); press(pitch); });
    k.addEventListener('pointerup', () => release(pitch));
    k.addEventListener('pointerleave', () => release(pitch));
    k.addEventListener('pointercancel', () => release(pitch));
  };

  const draw = () => {
    container.innerHTML = '';
    keyEls.clear();
    const piano = el('div', 'piano');

    const whites = [];
    for (let p = startPitch; p <= lastPitch; p++) if (!isBlack(p)) whites.push(p);
    const whiteW = 100 / whites.length;

    // White keys lay out in flow.
    const whiteRow = el('div', 'piano-white');
    for (const p of whites) {
      const k = el('button', 'key white'); k.type = 'button';
      k.appendChild(el('span', 'key-name', PC_NAME[((p % 12) + 12) % 12]));
      const c = charFor(p, startPitch); if (c) k.appendChild(el('span', 'key-hint', c));
      wireKey(k, p); keyEls.set(p, k); whiteRow.appendChild(k);
    }
    piano.appendChild(whiteRow);

    // Black keys overlay, centred on the boundary after their preceding white key.
    const blackRow = el('div', 'piano-black');
    for (let p = startPitch; p <= lastPitch; p++) {
      if (!isBlack(p)) continue;
      const whitesBefore = whites.filter(w => w < p).length;
      const k = el('button', 'key black'); k.type = 'button';
      k.style.left = `${whitesBefore * whiteW - whiteW * 0.3}%`;
      k.style.width = `${whiteW * 0.6}%`;
      const c = charFor(p, startPitch); if (c) k.appendChild(el('span', 'key-hint', c));
      wireKey(k, p); keyEls.set(p, k); blackRow.appendChild(k);
    }
    piano.appendChild(blackRow);
    container.appendChild(piano);
  };

  // The computer keyboard, when enabled and you are not typing into a field.
  let keysOn = computerKeys;
  const typingInField = () => {
    const a = (typeof document !== 'undefined') && document.activeElement;
    return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName || '');
  };
  const onKeyDown = (e) => {
    if (!keysOn || e.repeat || typingInField()) return;
    const off = KEY_OFFSET[e.key]; if (off == null) return;
    e.preventDefault(); press(startPitch + off);
  };
  const onKeyUp = (e) => { const off = KEY_OFFSET[e.key]; if (off == null) return; release(startPitch + off); };
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  draw();

  return {
    get stream() { return live.stream; },
    get live() { return live; },
    setComputerKeys(on) { keysOn = !!on; },
    // Start a fresh take — a new live session, same wiring and the same keys.
    clear() {
      for (const p of [...held]) release(p);
      live = createLiveInput({ name: 'on-screen keyboard', onPress });
      if (onNote) live.onNote(onNote);
      return live.stream;
    },
    destroy() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
      }
    },
  };
};
