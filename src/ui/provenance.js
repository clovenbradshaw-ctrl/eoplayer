// Provenance — say plainly where a stream came from. (UI only.)
//
// The engine is source-blind on purpose: a file, a live take, and a generated
// composition are all one note-event stream, and it reads them identically. But a
// PERSON looking at the app wants to know which is which — what the machine made up
// versus what was already written. This is the one place that distinction is named,
// so generated music is never mistaken for a pre-existing piece.
//
// Two families do the heavy lifting, in the user's own words:
//   Generated — produced by the generator here, no file behind it.
//   Precoded  — pre-existing music: a .mid you loaded, the built-in sample, the catalog.
// plus Live (played just now on the keyboard) and Set (several streams read as one).

export const provenanceOf = (source) => {
  switch (source) {
    case 'generated': return { family: 'Generated', detail: 'made by the generator', cls: 'generated' };
    case 'live':      return { family: 'Live',      detail: 'played on the keyboard', cls: 'live' };
    case 'set':       return { family: 'Set',       detail: 'several streams read as one', cls: 'set' };
    case 'sample':    return { family: 'Precoded',  detail: 'built-in sample melody', cls: 'precoded' };
    case 'catalog':   return { family: 'Precoded',  detail: 'from the built-in catalog', cls: 'precoded' };
    case 'file':      return { family: 'Precoded',  detail: 'loaded .mid file', cls: 'precoded' };
    default:          return { family: 'Precoded',  detail: source || 'unknown source', cls: 'precoded' };
  }
};

// "Generated · made by the generator" — the family and the specifics in one line.
export const provenanceLabel = (source) => {
  const p = provenanceOf(source);
  return `${p.family} · ${p.detail}`;
};
