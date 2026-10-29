/**
 * The playlist demo: a player with the playlist's controls, a choice of
 * ready-made lists, the modes, and a log of the playlist's events. The
 * markup that builds the same player and playlist is written out under the
 * player.
 */
import '@mattebox/player';
import type { MatteboxPlayerElement } from '@mattebox/player';
import type { Playlist, PlaylistItem } from '@mattebox/player-playlist';
import { createPlaylist } from '@mattebox/player-playlist';
import logoUrl from '../../docs/logo.svg';
import { eventLog } from './event-log.js';
import { wireTheme } from './theme.js';

for (const img of document.querySelectorAll<HTMLImageElement>('img.logo')) img.src = logoUrl;
for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')) {
  link.href = logoUrl;
}

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`no #${id}`);
  return node as T;
}

const ICONS = 'https://storage.googleapis.com/shaka-asset-icons';

/** The ready-made lists. The credits markers are examples, not the films' real ones. */
const SAMPLES: Readonly<Record<string, readonly PlaylistItem[]>> = {
  films: [
    {
      src: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
      heading: 'Tears of Steel',
      subheading: 'Blender Foundation, 2012',
      artwork: `${ICONS}/tears_of_steel.png`,
      chapters: 'chapters/tears-of-steel.vtt',
      duration: 734,
      markers: [
        { start: 0, end: 12, kind: 'opening-credits' },
        { start: 640, end: 734, kind: 'closing-credits' },
      ],
    },
    {
      src: 'https://storage.googleapis.com/shaka-demo-assets/sintel/dash.mpd',
      heading: 'Sintel',
      subheading: 'Blender Foundation, 2010',
      artwork: `${ICONS}/sintel.png`,
      duration: 888,
      markers: [{ start: 720, end: 888, kind: 'closing-credits' }],
    },
    {
      src: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
      heading: 'Big Buck Bunny',
      subheading: 'Blender Foundation, 2008',
      artwork: `${ICONS}/big_buck_bunny.png`,
      chapters: 'chapters/big-buck-bunny.vtt',
      duration: 634,
      markers: [{ start: 580, end: 634, kind: 'closing-credits' }],
    },
    {
      src: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
      heading: 'Apple test pattern',
      subheading: 'HLS advanced example',
      artwork: `${ICONS}/apple_test_pattern.png`,
      duration: 1800,
    },
  ],
  tracks: [3, 6, 9, 12].map((seconds, i) => ({
    src: `https://download.samplelib.com/mp3/sample-${seconds}s.mp3`,
    type: 'audio/mpeg',
    heading: `Track ${i + 1}`,
    subheading: 'samplelib.com',
    duration: seconds,
  })),
  broken: [
    {
      src: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
      heading: 'Big Buck Bunny',
      artwork: `${ICONS}/big_buck_bunny.png`,
      duration: 634,
    },
    {
      src: 'https://cdn.example.invalid/missing.m3u8',
      heading: 'A missing stream',
      subheading: 'Skipped after 3 seconds',
    },
    {
      src: 'https://storage.googleapis.com/shaka-demo-assets/sintel/dash.mpd',
      heading: 'Sintel',
      artwork: `${ICONS}/sintel.png`,
      duration: 888,
    },
  ],
};

const player = byId<MatteboxPlayerElement>('player');
const sample = byId<HTMLSelectElement>('sample');
const repeat = byId<HTMLSelectElement>('repeat');
const shuffle = byId<HTMLInputElement>('shuffle');
const autoadvance = byId<HTMLInputElement>('autoadvance');
const autoplay = byId<HTMLInputElement>('autoplay');
const log = eventLog(byId<HTMLElement>('log'), 'Events');
const code = byId<HTMLPreElement>('code');
const status = byId<HTMLElement>('status');

wireTheme(byId<HTMLButtonElement>('theme-toggle'));

/** Attribute names for an item's fields, as <mbx-playlist-item> reads them. */
const ATTRIBUTES: Readonly<Record<string, string>> = {
  licenseUrl: 'license-url',
  certificateUrl: 'certificate-url',
  startTime: 'start-time',
};

function quote(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** One `<mbx-playlist-item>` line, with its fields as attributes and its markers as JSON. */
function itemMarkup(item: PlaylistItem, indent: string): string {
  const attributes = Object.entries(item).map(([field, value]) => {
    const name = ATTRIBUTES[field] ?? field;
    // JSON goes in single quotes, so its own quotes need no escape.
    if (typeof value === 'object') {
      return `\n${indent}  ${name}='${JSON.stringify(value).replace(/'/g, '&#39;')}'`;
    }
    return `\n${indent}  ${name}="${quote(String(value))}"`;
  });
  return `${indent}<mbx-playlist-item${attributes.join('')}>\n${indent}</mbx-playlist-item>`;
}

/**
 * The page's player as markup, with the list and its modes in
 * <mbx-playlist>: the same player and playlist this page builds.
 */
function markup(playlist: Playlist): string {
  const lines: string[] = [];
  const tag = (node: Element, indent: string): void => {
    const name = node.localName;
    if (name === 'mbx-playlist') {
      const modes = [
        playlist.repeat === 'none' ? '' : ` repeat="${playlist.repeat}"`,
        playlist.shuffle ? ' shuffle' : '',
        playlist.autoadvance ? '' : ' autoadvance="off"',
        node.hasAttribute('pause-on-open') ? ' pause-on-open' : '',
      ].join('');
      lines.push(`${indent}<mbx-playlist${modes}>`);
      for (const item of playlist.items) lines.push(itemMarkup(item, `${indent}  `));
      lines.push(`${indent}</mbx-playlist>`);
    } else if (name === 'mbx-control-bar') {
      // Only the bar's own row: a control's inner parts are the player's.
      lines.push(`${indent}<${name}>`);
      for (const child of node.children) tag(child, `${indent}  `);
      lines.push(`${indent}</${name}>`);
    } else {
      lines.push(`${indent}<${name}></${name}>`);
    }
  };
  // The player's own attributes, as the page set them.
  const flags = ['autoplay', 'muted'].filter((name) => player.hasAttribute(name));
  lines.push(`<mattebox-player controls="custom"${flags.map((name) => ` ${name}`).join('')}>`);
  for (const child of player.children) {
    if (child.localName.startsWith('mbx-')) tag(child, '  ');
  }
  lines.push('</mattebox-player>');
  return `<script type="module">
  import '@mattebox/player';
  import '@mattebox/player-playlist';
</script>

${lines.join('\n')}`;
}

const playlist = createPlaylist(player);

function show(): void {
  repeat.value = playlist.repeat;
  shuffle.checked = playlist.shuffle;
  autoadvance.checked = playlist.autoadvance;
  code.textContent = markup(playlist);
  const item = playlist.item;
  status.textContent =
    item === null
      ? ''
      : `${playlist.index + 1} of ${playlist.items.length}: ${item.heading ?? item.src}`;
}

playlist.addEventListener('change', (event) => {
  const { items, index, mode } = (
    event as CustomEvent<{ items: boolean; index: boolean; mode: boolean }>
  ).detail;
  const what = [items ? 'items' : '', index ? `index ${playlist.index}` : '', mode ? 'mode' : '']
    .filter((part) => part !== '')
    .join(', ');
  log.write('change', what);
  show();
});
playlist.addEventListener('skip', (event) => {
  const { index } = (event as CustomEvent<{ index: number }>).detail;
  log.write('skip', `item ${index} failed, moving on`, 'warn');
});

sample.addEventListener('change', () => {
  playlist.load(SAMPLES[sample.value] ?? []);
});
repeat.addEventListener('change', () => {
  playlist.repeat = repeat.value as Playlist['repeat'];
});
shuffle.addEventListener('change', () => {
  playlist.shuffle = shuffle.checked;
});
autoadvance.addEventListener('change', () => {
  playlist.autoadvance = autoadvance.checked;
});
autoplay.addEventListener('change', () => {
  player.toggleAttribute('autoplay', autoplay.checked);
  show();
});
byId<HTMLButtonElement>('copy-code').addEventListener('click', () => {
  void navigator.clipboard?.writeText(code.textContent ?? '');
});

playlist.load(SAMPLES.films ?? []);
