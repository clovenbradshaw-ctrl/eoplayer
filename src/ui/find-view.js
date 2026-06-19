// Find & import music — search a library of files and add them into memory.
// (Input Spec §4)
//
// Two columns, two reaches:
//   • the built-in CATALOG — bundled melodies, searched and added with no network;
//   • the online SOURCES directory (from awesome-midi-sources) — links you open and
//     download from, plus an import-by-URL box for hosts that serve files cross-origin.
// Everything added arrives as the same note-event stream and shows its provenance
// (catalog/file → Precoded) in the library and transport, so it is never confused
// with a Generated composition.

import { searchCatalog } from '../catalog/index.js';
import { searchSources, SOURCES_CREDIT } from '../sources/index.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const link = (text, url) => { const a = el('a', 'find-link', text); a.href = url; a.target = '_blank'; a.rel = 'noopener'; return a; };

export const renderFind = (container, { onAdd, onImportUrl } = {}) => {
  container.innerHTML = '';
  const grid = el('div', 'find-grid');

  // --- Built-in catalog: search and add, no network. -------------------------
  const cat = el('div', 'find-col');
  cat.appendChild(el('h3', 'find-h', 'Built-in catalog'));
  cat.appendChild(el('p', 'hint', 'Public-domain melodies bundled with the app. Search and add — no network needed.'));
  const catSearch = el('input', 'find-search'); catSearch.type = 'text'; catSearch.placeholder = 'Search melodies — title, composer, tag…';
  const catList = el('div', 'find-list');
  const drawCat = () => {
    catList.innerHTML = '';
    const items = searchCatalog(catSearch.value);
    if (!items.length) { catList.appendChild(el('p', 'hint', 'No melodies match.')); return; }
    for (const it of items) {
      const card = el('div', 'find-card');
      card.appendChild(el('span', 'find-name', it.title));
      card.appendChild(el('span', 'find-by', `${it.composer} · ${it.tags.join(', ')} · ${it.notes.length} notes`));
      const add = el('button', 'small primary', 'Add to library'); add.type = 'button';
      add.addEventListener('click', () => onAdd?.(it));
      card.appendChild(add);
      catList.appendChild(card);
    }
  };
  catSearch.addEventListener('input', drawCat);
  cat.append(catSearch, catList);

  // --- Online sources: search the directory, open out, or import by URL. ------
  const src = el('div', 'find-col');
  src.appendChild(el('h3', 'find-h', 'Online sources'));
  const credit = el('p', 'hint');
  credit.appendChild(el('span', null, 'Real MIDI libraries, from '));
  credit.appendChild(link(SOURCES_CREDIT.name, SOURCES_CREDIT.url));
  credit.appendChild(el('span', null, '. Open a source and drop its files above — or paste a direct .mid URL to import.'));
  src.appendChild(credit);

  const urlRow = el('div', 'find-urlrow');
  const urlInput = el('input', 'find-search'); urlInput.type = 'text'; urlInput.placeholder = 'Paste a direct .mid URL…';
  const urlBtn = el('button', 'small primary', 'Import'); urlBtn.type = 'button';
  const doImport = () => { const u = urlInput.value.trim(); if (u) onImportUrl?.(u); };
  urlBtn.addEventListener('click', doImport);
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doImport(); });
  urlRow.append(urlInput, urlBtn);
  src.appendChild(urlRow);

  const srcSearch = el('input', 'find-search'); srcSearch.type = 'text'; srcSearch.placeholder = 'Search sources — name, genre, “dataset”…';
  const srcList = el('div', 'find-list');
  const drawSrc = () => {
    srcList.innerHTML = '';
    const items = searchSources(srcSearch.value);
    if (!items.length) { srcList.appendChild(el('p', 'hint', 'No sources match.')); return; }
    for (const s of items) {
      const card = el('div', 'find-card');
      card.appendChild(link(s.name, s.url));
      card.appendChild(el('span', 'find-by', `${s.kind} · ${s.tags.join(', ')}`));
      card.appendChild(el('span', 'hint', s.note));
      srcList.appendChild(card);
    }
  };
  srcSearch.addEventListener('input', drawSrc);
  src.append(srcSearch, srcList);

  grid.append(cat, src);
  container.appendChild(grid);
  drawCat(); drawSrc();
};
