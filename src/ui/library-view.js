// The library view — the tagged, queryable set, with a tag filter. (Input Spec §4)
//
// Show the corpus and the tags it auto-derived; click a tag to filter, click an
// entry to read it, or read a whole tagged set at once. This is "select by tag into
// the engine" as a UI: choose what the engine reads without hand-feeding files.

import { provenanceOf } from './provenance.js';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

export const renderLibrary = (container, library, handlers = {}) => {
  const { onSelect, onPlay, onReadSet, activeTags = new Set(), onToggleTag, nameQuery = '' } = handlers;
  container.innerHTML = '';

  // The tag cloud — chips that filter, with counts. An active chip is highlighted.
  const cloud = el('div', 'tag-cloud');
  for (const { tag, count } of library.tagCloud()) {
    const chip = el('button', 'chip' + (activeTags.has(tag) ? ' active' : ''), `${tag} ·${count}`);
    chip.type = 'button';
    chip.addEventListener('click', () => onToggleTag?.(tag));
    cloud.appendChild(chip);
  }
  if (!library.size) cloud.appendChild(el('span', 'hint', 'Library empty — drop .mid files to fill it.'));
  container.appendChild(cloud);

  // The filtered entry list — by tag (the chips) and by free text (the search box).
  const spec = activeTags.size ? { all: [...activeTags] } : {};
  const q = String(nameQuery).trim().toLowerCase();
  const entries = library.query(spec)
    .filter(e => !q || `${e.name} ${e.tags.join(' ')} ${e.stream.source}`.toLowerCase().includes(q));

  if (activeTags.size || q) {
    const setBar = el('div', 'set-bar');
    const desc = [activeTags.size ? [...activeTags].join(' + ') : null, q ? `“${q}”` : null].filter(Boolean).join(' + ');
    setBar.appendChild(el('span', 'hint', `${entries.length} match ${desc}`));
    const readSet = el('button', 'small', 'Read this set →');
    readSet.type = 'button';
    readSet.addEventListener('click', () => onReadSet?.(entries));
    setBar.appendChild(readSet);
    container.appendChild(setBar);
  }

  const list = el('div', 'lib-list');
  for (const e of entries) {
    const card = el('div', 'lib-card');
    const head = el('div', 'lib-head');
    head.appendChild(el('span', 'lib-name', e.name));
    head.appendChild(el('span', 'lib-key', e.features.key));
    card.appendChild(head);
    // Provenance — Generated or Precoded — so the corpus never blurs what the machine
    // made up with what was loaded or bundled.
    const prov = provenanceOf(e.stream.source);
    const provRow = el('div', 'lib-prov');
    const badge = el('span', 'prov ' + prov.cls, prov.family); badge.title = prov.detail;
    provRow.appendChild(badge);
    provRow.appendChild(el('span', 'hint', prov.detail));
    card.appendChild(provRow);
    card.appendChild(el('div', 'lib-meta', `${e.features.noteCount} notes · ${e.features.tempo}bpm · ${e.features.density} n/s · ${e.features.seconds}s`));
    const tags = el('div', 'lib-tags');
    for (const t of e.tags) tags.appendChild(el('span', 'tag-mini' + (e.autoTags.includes(t) ? '' : ' user'), t));
    card.appendChild(tags);
    const actions = el('div', 'lib-actions');
    const read = el('button', 'small', 'Read'); read.type = 'button'; read.addEventListener('click', () => onSelect?.(e));
    const play = el('button', 'small', 'Play'); play.type = 'button'; play.addEventListener('click', () => onPlay?.(e));
    actions.append(read, play);
    card.appendChild(actions);
    list.appendChild(card);
  }
  container.appendChild(list);
};
