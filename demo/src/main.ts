/**
 * The demo page. Seven source kinds through one element, each row stating
 * which handler won.
 *
 * Six rows take the route an integrator takes first: attributes only, and the
 * default `full` preset, resolved at runtime without bundling one. The
 * ClearKey row cannot: ClearKey is only ever a candidate when `eme-core` is
 * built with the keys, and building a stage means importing it. So that row
 * swaps in an element constructed from JavaScript with a stage list, which is
 * the other route the element offers. See docs/integrator-log.md.
 */
import { inferType } from '@mattebox/player-core';
import '@mattebox/player';
import { MatteboxPlayerElement } from '@mattebox/player';
import full from 'mattebox/presets/full';
import emeCore from 'mattebox/stages/eme-core';
// Imported, not referenced from the HTML: the file lives outside the demo
// root, and only an import gives it a URL the dev server and the build serve.
import logoUrl from '../../docs/logo.svg';

interface Row {
  readonly kind: string;
  readonly url: string;
  /** Only where the extension does not say it. */
  readonly type?: string;
  /** Key id to key, base64url. Their presence is what forces the JavaScript route. */
  readonly clearKeys?: Readonly<Record<string, string>>;
  readonly note?: string;
}

const ROWS: readonly Row[] = [
  {
    kind: 'HLS VOD',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8',
    note: 'MPEG-TS segments, so the ts tier of the preset does the work',
  },
  {
    kind: 'DASH VOD',
    url: 'https://media.axprod.net/TestVectors/v7-Clear/Manifest_1080p.mpd',
  },
  {
    kind: 'DASH live',
    url: 'https://livesim2.dashif.org/livesim2/testpic_2s/Manifest.mpd',
    note: 'the live badge appears once the availability window opens',
  },
  {
    kind: 'mp3',
    url: 'https://download.samplelib.com/mp3/sample-3s.mp3',
    note: 'the engine parses no manifest of this type, so it never asks for it',
  },
  {
    kind: 'Progressive mp4',
    url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
  },
  {
    kind: 'Extensionless URL',
    // Served by the demo itself, as audio with no extension in its path: the
    // shape of a signed CDN URL.
    url: '/signed/12345',
    note: 'one round of headers, then native',
  },
  {
    kind: 'ClearKey DASH',
    url: 'https://media.axprod.net/TestVectors/v7-MultiDRM-SingleKey/Manifest_1080p_ClearKey.mpd',
    clearKeys: { nrQFDeRLSAKTLifXUIPiZg: 'ABEiM0RVZneImaq7zN3u_w' },
    note: 'needs stages from JavaScript: keys are not an attribute',
  },
];

for (const img of document.querySelectorAll<HTMLImageElement>('img.logo')) img.src = logoUrl;
for (const icon of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')) {
  icon.href = logoUrl;
}

const body = document.querySelector('#sources tbody');
const cells: HTMLTableCellElement[] = [];
let playing = -1;
let player = document.getElementById('player') as MatteboxPlayerElement;
/** Whether the element on the page was built with a stage list. */
let scripted = false;

/** Writes the row's verdict: the Handler cell, and the coloured edge beside it. */
function report(text: string, verdict: 'mattebox' | 'native' | 'failed' | null): void {
  const cell = cells[playing];
  if (cell === undefined) return;
  cell.replaceChildren(text);
  cell.classList.toggle('failed', verdict === 'failed');
  const row = cell.parentElement;
  if (row === null) return;
  if (verdict === null) row.removeAttribute('data-verdict');
  else row.dataset.verdict = verdict;
}

function wire(element: MatteboxPlayerElement): void {
  element.video.setAttribute('aria-label', 'Mattebox player');
  element.addEventListener('sourcechange', (event) => {
    if (event.detail === null || playing < 0) return;
    const won = event.detail.handler;
    report(won, won === 'mattebox' ? 'mattebox' : 'native');
  });
  element.addEventListener('error', (event) => {
    // A row that failed still says what happened. The element's own error
    // surface carries the same code.
    if (event.detail.fatal && playing >= 0) report(event.detail.code, 'failed');
  });
}

/** The element this row needs, swapping the one on the page when the route changes. */
function elementFor(row: Row): MatteboxPlayerElement {
  const keys = row.clearKeys;
  if ((keys !== undefined) === scripted) return player;
  const next =
    keys === undefined
      ? (document.createElement('mattebox-player') as MatteboxPlayerElement)
      : // Merged by name: `full` already composes eme-core, so this replaces
        // that instance rather than appending a second one.
        new MatteboxPlayerElement({
          stages: full.stages({ stages: [emeCore({ clearKeys: keys })] }),
        });
  next.id = 'player';
  next.setAttribute('muted', '');
  player.replaceWith(next);
  player = next;
  scripted = keys !== undefined;
  wire(next);
  return next;
}

function select(index: number): void {
  const row = ROWS[index];
  if (row === undefined) return;
  playing = index;
  for (const [at, cell] of cells.entries()) {
    cell.parentElement?.classList.toggle('playing', at === index);
  }
  report('loading…', null);

  const element = elementFor(row);
  // The source goes last so the attributes that describe it are already in
  // place: every one of them reloads, and only the last load counts.
  element.removeAttribute('src');
  if (row.type === undefined) element.removeAttribute('type');
  else element.setAttribute('type', row.type);
  element.setAttribute('src', row.url);
}

for (const [index, row] of ROWS.entries()) {
  const tr = document.createElement('tr');
  tr.tabIndex = 0;

  const kind = document.createElement('td');
  kind.textContent = row.kind;
  if (row.note !== undefined) {
    const note = document.createElement('small');
    note.textContent = row.note;
    kind.append(document.createElement('br'), note);
  }

  const source = document.createElement('td');
  const url = document.createElement('code');
  url.textContent = row.url;
  source.append(url);

  const type = document.createElement('td');
  type.textContent = row.type ?? inferType(row.url) ?? '—';

  const handler = document.createElement('td');
  handler.textContent = '—';
  cells.push(handler);

  tr.append(kind, source, type, handler);
  tr.addEventListener('click', () => {
    select(index);
  });
  tr.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(index);
    }
  });
  body?.append(tr);
}

wire(player);
