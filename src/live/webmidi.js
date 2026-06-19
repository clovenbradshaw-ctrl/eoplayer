// The Web MIDI bridge — a real device into the live session. (Input Spec §3)
//
// WebMidi.js (Jean-Philippe Cote) wraps the raw MIDIAccess and MIDIMessageEvent
// handling into a clean listener model: enable, list inputs, attach a noteon and
// noteoff handler. Two platform cautions, both real: it requires HTTPS, and since a
// recent Chrome version it prompts for permission, so the page must request access
// and handle denial. Browser-only — loaded by the UI, dynamically imported from a
// CDN so there is no build step (the same pattern eoreader4 uses for its model
// backends). Under Node this module imports fine but `enableWebMidi` throws a clear
// error rather than pretending a device exists; the pure conversion in
// keyboard.js is what the tests exercise.

const WEBMIDI_URL = 'https://cdn.jsdelivr.net/npm/webmidi@3/dist/esm/webmidi.esm.min.js';

import { createLiveInput } from './keyboard.js';

// Enable Web MIDI and route the first (or named) input's notes into a live session.
// Returns { live, inputs, input, disable }. Pass an existing `live` session (e.g. the
// on-screen keyboard's) to feed a real device INTO it — same stream, two sources —
// in which case its onPress/onNote are already wired and are not re-attached.
// Otherwise a fresh session is created and `onNote`/`onPress` are forwarded to it.
// Rejects with a legible message on the two known failure modes (no Web MIDI /
// permission denied).
export const enableWebMidi = async ({ inputName, onNote, onPress, now, live: existing } = {}) => {
  if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
    throw new Error('Web MIDI is unavailable here — it needs a browser over HTTPS (or localhost).');
  }
  let WebMidi;
  try {
    ({ WebMidi } = await import(/* @vite-ignore */ WEBMIDI_URL));
  } catch (e) {
    throw new Error(`Could not load WebMidi.js from the CDN: ${e?.message || e}`);
  }
  try {
    await WebMidi.enable();          // prompts for permission on recent Chrome; rejects on denial
  } catch (e) {
    throw new Error(`MIDI permission was denied or enable failed: ${e?.message || e}`);
  }

  const inputs = WebMidi.inputs.map(i => i.name);
  const input = inputName ? WebMidi.getInputByName(inputName) : WebMidi.inputs[0];
  if (!input) throw new Error(inputs.length ? `No MIDI input named "${inputName}".` : 'No MIDI inputs are connected.');

  const live = existing || createLiveInput({ name: input.name, now, onPress });
  if (!existing && typeof onNote === 'function') live.onNote(onNote);

  // WebMidi.js delivers note numbers and a normalized 0..1 attack; we restamp onset
  // = now inside the session, so the stream's timing is the player's real timing.
  const onNoteOn  = (e) => live.noteOn(e.note.number, Math.round((e.note.attack ?? e.velocity ?? 0.63) * 127));
  const onNoteOff = (e) => live.noteOff(e.note.number);
  input.addListener('noteon', onNoteOn);
  input.addListener('noteoff', onNoteOff);

  return {
    live,
    stream: live.stream,
    inputs,
    input: input.name,
    disable() {
      input.removeListener('noteon', onNoteOn);
      input.removeListener('noteoff', onNoteOff);
      try { WebMidi.disable(); } catch { /* best-effort */ }
    },
  };
};
