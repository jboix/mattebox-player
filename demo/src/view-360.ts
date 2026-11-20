/**
 * The 360° demo: a player with <mbx-360>, the RTS programmes the SRG SSR
 * content API marks as 360°, a choice of projection, and where the view
 * looks. The connector reads the IL's `presentation`, so the player knows
 * the source is 360°; the stream itself does not say. The markup that
 * builds the same player is written out under it.
 */

import { MatteboxPlayerElement } from '@mattebox/player';
import type { Mbx360 } from '@mattebox/player-360';
import { setChildren } from './dom.js';
import '@mattebox/player-360';
import logoUrl from '../../docs/logo.svg';
import { srgssr } from './connectors/srgssr.js';
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

MatteboxPlayerElement.define({ connectors: [srgssr] });

interface Example {
  readonly urn: string;
  readonly label: string;
  readonly note: string;
}

/** Every RTS programme the IL marked VIDEO_360 when the demo was written: clear HLS, no token. */
const EXAMPLES: readonly Example[] = [
  {
    urn: 'urn:rts:video:11073114',
    label: 'Le petit Burki animé, le film en 360°',
    note: 'An animated film, 4096 by 2048 at the top of the ladder.',
  },
  {
    urn: 'urn:rts:video:8414077',
    label: 'Le Gothard en 360°',
    note: 'The Gotthard, filmed from the road and the tunnel.',
  },
  {
    urn: 'urn:rts:video:9191199',
    label: 'Mobilité en 360°',
    note: 'Getting around, in 360°.',
  },
  {
    urn: 'urn:rts:video:7800215',
    label: 'Le goût du risque 360',
    note: 'A report filmed in 360°.',
  },
  {
    urn: 'urn:rts:video:10017904',
    label: 'Test 360: Bord du lac',
    note: 'An RTS test clip: a lake shore.',
  },
  {
    urn: 'urn:rts:video:10017956',
    label: 'Test 360: Vignoble',
    note: 'An RTS test clip: a vineyard.',
  },
];

const player = byId<MatteboxPlayerElement>('player');
const view = byId<Mbx360>('view');
const select = byId<HTMLSelectElement>('example');
const projection = byId<HTMLSelectElement>('projection');
const note = byId<HTMLElement>('note');
const code = byId<HTMLElement>('code');
const status = byId<HTMLElement>('status');
const readout = byId<HTMLElement>('readout');

for (const [index, example] of EXAMPLES.entries()) {
  select.append(new Option(example.label, String(index)));
}

const KEY = 'mattebox.demo.360.example';
function remembered(): number {
  try {
    const value = Number(localStorage.getItem(KEY));
    return Number.isInteger(value) && EXAMPLES[value] !== undefined ? value : 0;
  } catch {
    return 0;
  }
}

function markup(example: Example): string {
  const forced = projection.value === '' ? '' : ` projection="${projection.value}"`;
  return `<mattebox-player controls="custom" muted
  type="srgssr/urn" src="${example.urn}">
  <mbx-360${forced}></mbx-360>
  <mbx-control-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-seek-bar></mbx-seek-bar>
    <mbx-volume></mbx-volume>
    <mbx-fullscreen-button></mbx-fullscreen-button>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import { MatteboxPlayerElement } from '@mattebox/player';
  import '@mattebox/player-360';

  // The connector sets the source's projection, here from the IL's
  // presentation VIDEO_360.
  MatteboxPlayerElement.define({ connectors: [srgssrConnector] });
</script>`;
}

function choose(index: number): void {
  const example = EXAMPLES[index] ?? EXAMPLES[0];
  if (example === undefined) return;
  try {
    localStorage.setItem(KEY, String(index));
  } catch {
    // A browser that keeps nothing still plays the example.
  }
  note.textContent = `${example.note} ${example.urn}`;
  code.textContent = markup(example);
  player.setAttribute('src', example.urn);
}

select.value = String(remembered());
select.addEventListener('change', () => choose(Number(select.value)));
projection.addEventListener('change', () => {
  if (projection.value === '') view.removeAttribute('projection');
  else view.setAttribute('projection', projection.value);
  code.textContent = markup(EXAMPLES[Number(select.value)] ?? (EXAMPLES[0] as Example));
});
choose(Number(select.value));

byId<HTMLButtonElement>('ahead').addEventListener('click', () => {
  view.yaw = 0;
  view.pitch = 0;
});

/** One row of the readout. */
function row(term: string, value: string): HTMLElement[] {
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  dd.textContent = value;
  return [dt, dd];
}

/** Writes where the view looks, once a frame while the page shows. */
function read(): void {
  const why = view.getAttribute('unavailable');
  const state = view.hasAttribute('active')
    ? 'shows'
    : why === null
      ? 'flat source'
      : `off: ${why}`;
  setChildren(
    readout,
    ...row('View', state),
    ...row('Projection', view.projection ?? 'none'),
    ...row('Yaw', `${Math.round(view.yaw)}°`),
    ...row('Pitch', `${Math.round(view.pitch)}°`),
    ...row('Field of view', `${Math.round(view.fov)}°`),
  );
  requestAnimationFrame(read);
}
requestAnimationFrame(read);

player.addEventListener('error', (event) => {
  const detail = (event as CustomEvent<{ code?: string }>).detail;
  status.textContent = `error: ${detail.code ?? ''}`;
});
player.addEventListener('sourcechange', () => {
  status.textContent = '';
});

byId<HTMLButtonElement>('copy-code').addEventListener('click', () => {
  void navigator.clipboard?.writeText(code.textContent ?? '');
});

wireTheme(byId<HTMLButtonElement>('theme-toggle'));
