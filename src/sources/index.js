// MIDI sources — a searchable directory of where real MIDI files live, built from
// albertmeronyo/awesome-midi-sources. (Input Spec §4)
//
// This is the other half of "search a library of files and add them into memory":
// the catalog (../catalog) is the handful that ship in the app; this is the door to
// the millions out on the web. A browser can't crawl most of these — the hosts
// don't send CORS headers, so a cross-origin fetch is blocked — so each entry is a
// link you open, download from, and drop back here. Where a host DOES serve files
// cross-origin (GitHub raw, some archives), paste the file's URL into "Import from
// URL" and it lands in the library exactly like a dropped file.

export const SOURCES_CREDIT = Object.freeze({
  name: 'awesome-midi-sources',
  url: 'https://github.com/albertmeronyo/awesome-midi-sources',
});

const S = (name, url, kind, tags, note) => ({ name, url, kind, tags, note });

export const MIDI_SOURCES = [
  S('Lakh MIDI Dataset', 'https://colinraffel.com/projects/lmd/', 'dataset', ['research', 'large', 'pop'],
    '176,581 MIDI files, 45,129 aligned to the Million Song Dataset.'),
  S('The Largest MIDI Collection on the Internet', 'https://www.reddit.com/r/WeAreTheMusicMakers/comments/3ajwe4/the_largest_midi_collection_on_the_internet/', 'dataset', ['large', 'mixed'],
    'Aggregated mega-collection curated by u/midi_man.'),
  S('Drum & Percussion MIDI Archive', 'https://www.reddit.com/r/WeAreTheMusicMakers/comments/3anwu8/the_drum_percussion_midi_archive_800k/', 'dataset', ['drums', 'percussion', 'large'],
    '~800k drum and percussion MIDI files.'),
  S('The MIDI Archive (Utrecht University)', 'https://archive.cs.uu.nl/pub/MIDI/', 'archive', ['classical', 'historical'],
    'A historical academic MIDI archive.'),
  S('MuseData', 'https://musedata.org/', 'dataset', ['classical', 'scores'],
    'Classical scores as MIDI, MuseData, and Humdrum.'),
  S('Josquin Research Project', 'https://josquin.stanford.edu/', 'dataset', ['classical', 'renaissance'],
    'Polyphonic music ~1420–1520 in multiple formats.'),
  S('Dave’s J.S. Bach Page', 'https://www.jsbach.net/midi/', 'website', ['classical', 'bach'],
    'Bach compositions in MIDI.'),
  S('BachCentral', 'https://www.bachcentral.com/', 'website', ['classical', 'bach'],
    'A Johann Sebastian Bach MIDI page.'),
  S('MIDIWORLD', 'https://www.midiworld.com/', 'website', ['pop', 'rock'],
    'Pop and rock MIDI files.'),
  S('FreeMidi', 'https://freemidi.org/', 'website', ['pop', 'rock'],
    'Pop and rock MIDI source.'),
  S('Video Game Music Archive', 'https://www.vgmusic.com/', 'website', ['video-game', 'chiptune'],
    'Video game music in MIDI.'),
  S('SCUMM Bar', 'https://www.scummbar.com/', 'website', ['video-game'],
    'Monkey Island game music MIDIs.'),
  S('Midikaos', 'https://midikaos.mnstrl.org/', 'website', ['world'],
    '~3k world-music MIDI files.'),
  S('Composers Offering MIDI Files', 'https://www.aitech.ac.jp/~ckelly/SMF.html', 'directory', ['composers'],
    'Links to professional and amateur composer sites.'),
  S('MIDI Links (McGill)', 'https://www.music.mcgill.ca/~cmckay/midi.html', 'directory', ['reference'],
    'Web pages with MIDI material and technical references.'),
];

// Search by name, kind, tag, or description. Empty query returns the whole directory.
export const searchSources = (q = '') => {
  const s = String(q).trim().toLowerCase();
  if (!s) return MIDI_SOURCES.slice();
  return MIDI_SOURCES.filter(m => [m.name, m.kind, m.note, ...m.tags].join(' ').toLowerCase().includes(s));
};
