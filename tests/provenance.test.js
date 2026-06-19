// Provenance names what is Generated and what is Precoded. (The UI distinction the
// engine deliberately ignores.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { provenanceOf, provenanceLabel } from '../src/ui/provenance.js';

test('a generated stream reads as Generated, in its own class', () => {
  const p = provenanceOf('generated');
  assert.equal(p.family, 'Generated');
  assert.equal(p.cls, 'generated');
});

test('every pre-existing source reads as Precoded', () => {
  for (const s of ['file', 'sample', 'catalog', 'whatever-else']) {
    assert.equal(provenanceOf(s).family, 'Precoded', `${s} should be Precoded`);
    assert.equal(provenanceOf(s).cls, 'precoded');
  }
});

test('live and set are their own families', () => {
  assert.equal(provenanceOf('live').family, 'Live');
  assert.equal(provenanceOf('set').family, 'Set');
});

test('the label combines the family and the specifics', () => {
  assert.match(provenanceLabel('generated'), /^Generated · /);
  assert.match(provenanceLabel('file'), /^Precoded · /);
});
