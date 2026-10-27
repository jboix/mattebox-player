/**
 * The demo page: a player, two ways of loading content, and the element's
 * options on the side, with the markup that reproduces what is on screen.
 *
 * Content comes the way the engine's playground offers it: a list of demo
 * streams with a URL, a license and a thumbnail track to edit, or SRG SSR
 * through its integration layer. Either way the element gets attributes,
 * which is the route an integrator takes first. The one exception is
 * ClearKey: keys are not an attribute, so that entry swaps in an element
 * built from JavaScript with a stage list.
 */
import type { SourceVideoTrack } from '@mattebox/player-core';
import { inferType } from '@mattebox/player-core';
import '@mattebox/player';
import type { Marker } from '@mattebox/player';
import { MatteboxPlayerElement } from '@mattebox/player';
import '@mattebox/player-cast';
import '@mattebox/player-diagnostics';
import '@mattebox/player-spatial-nav';
import full from 'mattebox/presets/full';
import type { ChapterInput, ChaptersApi } from 'mattebox/stages/chapters';
import emeCore from 'mattebox/stages/eme-core';
// Imported, not referenced from the HTML: the file lives outside the demo
// root, and only an import gives it a URL the dev server and the build serve.
import logoUrl from '../../docs/logo.svg';
import type { StreamEntry } from './catalogue.js';
import { STREAMS, tagsOf } from './catalogue.js';
import type { DemoConnector, Example } from './connectors/index.js';
import { CONNECTORS, DEMO_CONNECTORS } from './connectors/index.js';
import { LANGUAGES, registerLanguages, WORD_PACKAGES } from './languages.js';
import { logTracker } from './log-tracker.js';
import { wireTheme } from './theme.js';

// Before the first load reads the options: every player on the page gets the connectors.
MatteboxPlayerElement.define({ connectors: CONNECTORS });

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`#${id} is missing`);
  return node as T;
}

for (const img of document.querySelectorAll<HTMLImageElement>('img.logo')) img.src = logoUrl;
for (const icon of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')) {
  icon.href = logoUrl;
}

// ---- the element, and the one route that swaps it -------------------------

let player = byId<MatteboxPlayerElement>('player');
/**
 * What the element on the page was built with: a stage list for ClearKey
 * keys, and a buffer goal. Neither is an attribute, so either one needs an
 * element built from script.
 */
let built: { readonly keys: boolean; readonly goal: number | null } = { keys: false, goal: null };
const status = byId<HTMLElement>('status');

function say(text: string, level: '' | 'ok' | 'bad' = ''): void {
  status.textContent = text;
  status.className = `status ${level}`.trim();
}

/** What is on screen, for the status. */
let playing = '';
const contentDialog = byId<HTMLDialogElement>('content-dialog');

function wire(element: MatteboxPlayerElement): void {
  element.video.setAttribute('aria-label', 'Mattebox player');
  element.addEventListener('sourcechange', (event) => {
    if (event.detail === null) return;
    const won = event.detail.handler;
    say(`${playing}, through ${won === 'mattebox' ? 'the engine' : 'the browser'}`, 'ok');
    // The session fires this once its manifest is in, so the chapters land
    // on this load and not the one before. A native session has no
    // `engine.chapters`, and the chapters go unused.
    const list = appChapters;
    appChapters = [];
    const api = (event.detail.engine as { chapters?: ChaptersApi } | null)?.chapters;
    if (list.length > 0 && api !== undefined) api.set(list);
  });
  element.addEventListener('error', (event) => {
    if (event.detail.fatal) say(`${event.detail.category}: ${event.detail.code}`, 'bad');
  });
  // A TV application moves focus out of the player here; the demo says so.
  element.addEventListener('navigateout', (event) => {
    const direction = (event as CustomEvent<string>).detail;
    say(`navigateout: ${direction}. An application moves focus out of the player here.`);
  });
  // A fatal error the engine reports and then plays through is the engine's
  // to explain; the status follows what the picture does.
  element.video.addEventListener('playing', () => {
    if (status.classList.contains('bad'))
      say(`${playing}, playing after an error the engine reported`, 'ok');
  });
}

/** The buffer goal the knob asks for, in seconds, or null for the engine's default. */
function bufferGoal(): number | null {
  const value = Number(knob('buffer-goal') ?? Number.NaN);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** The element a source needs, swapping the one on the page when the route changes. */
function elementFor(
  clearKeys: Readonly<Record<string, string>> | undefined,
): MatteboxPlayerElement {
  const keys = clearKeys !== undefined;
  const goal = bufferGoal();
  if (keys === built.keys && goal === built.goal) return player;
  const next =
    !keys && goal === null
      ? (document.createElement('mattebox-player') as MatteboxPlayerElement)
      : new MatteboxPlayerElement({
          connectors: CONNECTORS,
          // Merged by name: `full` already composes eme-core, so this
          // replaces that instance rather than appending a second one.
          ...(clearKeys === undefined
            ? {}
            : { stages: full.stages({ stages: [emeCore({ clearKeys })] }) }),
          ...(goal === null ? {} : { config: { bufferGoalSeconds: goal } }),
        });
  next.id = 'player';
  // The tracker leaves the old player first, so it stops there before it starts here.
  if (player.trackers.delete(tracker)) next.trackers.add(tracker);
  player.replaceWith(next);
  player = next;
  built = { keys, goal };
  wire(next);
  applyElement(next);
  return next;
}

interface Choice {
  /** What the status calls it. */
  readonly label?: string;
  readonly url: string;
  readonly type?: string;
  readonly licenseUrl?: string;
  readonly certificateUrl?: string;
  readonly thumbnails?: string;
  readonly chapters?: string;
  readonly poster?: string;
  /** Chapters a content API gave, which the session gets through `engine.chapters.set`. */
  readonly appChapters?: readonly ChapterInput[];
  /** Credits and blocked parts a content API gave, for `element.markers`. */
  readonly markers?: readonly Marker[];
  /** Other versions of the picture, written as `<mbx-video-track>` children. */
  readonly videoTracks?: readonly SourceVideoTrack[];
  readonly clearKeys?: Readonly<Record<string, string>>;
}

/** The chapters the next session gets through `engine.chapters.set`, once its manifest is in. */
let appChapters: readonly ChapterInput[] = [];

/** The source on screen, loaded again when the buffer goal changes. */
let current: Choice | null = null;

/** The connector type and input of the programme on screen, or null for a URL. A programme names itself. */
let programme: { readonly type: string; readonly injected: boolean } | null = null;

/** One door for every way of choosing a source. Whatever is not given is cleared, and the chooser closes. */
function load(choice: Choice): void {
  current = choice;
  programme = null;
  playing = choice.label ?? choice.url;
  say(`loading ${playing}…`);
  contentDialog.close();
  const element = elementFor(choice.clearKeys);
  appChapters = choice.appChapters ?? [];
  // The source goes last so the attributes that describe it are already in
  // place: every one of them reloads, and only the last load counts.
  element.removeAttribute('src');
  const type = choice.type ?? inferType(choice.url) ?? null;
  if (type === null) element.removeAttribute('type');
  else element.setAttribute('type', type);
  if (choice.licenseUrl === undefined) element.removeAttribute('license-url');
  else element.setAttribute('license-url', choice.licenseUrl);
  if (choice.certificateUrl === undefined) element.removeAttribute('certificate-url');
  else element.setAttribute('certificate-url', choice.certificateUrl);
  if (choice.thumbnails === undefined) element.removeAttribute('thumbnails');
  else element.setAttribute('thumbnails', choice.thumbnails);
  if (choice.chapters === undefined) element.removeAttribute('chapters');
  else element.setAttribute('chapters', choice.chapters);
  // The side shows what the source brought, and edits it from there.
  thumbnails.value = choice.thumbnails ?? '';
  chapters.value = choice.chapters ?? '';
  // A source that brings a poster fills the field; one that does not clears it.
  poster.value = choice.poster ?? '';
  attribute(element, 'poster', choice.poster ?? null);
  // Before the source, so its first load already lists them.
  for (const child of element.querySelectorAll(':scope > mbx-video-track')) child.remove();
  for (const track of choice.videoTracks ?? []) element.append(videoTrackElement(track));
  element.setAttribute('src', choice.url);
  // After the source: a new one clears the markers of the last.
  if (choice.markers !== undefined) element.markers.set(choice.markers);
  render();
}

/** The `<mbx-video-track>` child that declares `track`. */
function videoTrackElement(track: SourceVideoTrack): HTMLElement {
  const child = document.createElement('mbx-video-track');
  child.setAttribute('src', track.url);
  child.setAttribute('kind', track.kind);
  if (track.label !== undefined) child.setAttribute('label', track.label);
  if (track.language !== undefined) child.setAttribute('srclang', track.language);
  if (track.type !== undefined) child.setAttribute('type', track.type);
  return child;
}

// ---- static content ----------------------------------------------------------

const streamList = byId<HTMLOListElement>('stream-list');
const streamUrl = byId<HTMLInputElement>('stream-url');
const licenseUrl = byId<HTMLInputElement>('license-url');
const thumbUrl = byId<HTMLInputElement>('thumb-url');
const chaptersUrl = byId<HTMLInputElement>('chapters-url');
const streamNote = byId<HTMLElement>('stream-note');

function chooseStream(entry: StreamEntry): void {
  streamUrl.value = entry.url;
  licenseUrl.value = entry.licenseUrl ?? '';
  thumbUrl.value = entry.thumbnails ?? '';
  chaptersUrl.value = entry.chapters ?? '';
  streamNote.textContent = entry.note ?? '';
  for (const item of streamList.querySelectorAll('li')) {
    item.classList.toggle('current', item.dataset.url === entry.url);
  }
  load(entry);
}

for (const stream of STREAMS) {
  const item = document.createElement('li');
  item.dataset.url = stream.url;
  const button = document.createElement('button');
  button.type = 'button';
  const title = document.createElement('span');
  title.className = 'result-title';
  title.textContent = stream.label;
  const meta = document.createElement('span');
  meta.className = 'result-meta';
  meta.textContent = stream.url;
  const tags = document.createElement('span');
  tags.className = 'tags';
  for (const text of tagsOf(stream)) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = text;
    tags.append(tag);
  }
  button.append(title, tags, meta);
  button.addEventListener('click', () => {
    chooseStream(stream);
  });
  item.append(button);
  streamList.append(item);
}

/** The schemes a source may come over. */
const SCHEMES = ['http:', 'https:', 'blob:', 'data:'];

/** A typed URL as the player gets it: absolute, over one of the schemes, or nothing. */
function mediaUrl(text: string): string | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  return SCHEMES.includes(url.protocol) ? url.href : null;
}

byId<HTMLButtonElement>('load-url').addEventListener('click', () => {
  if (streamUrl.value.trim() === '') return;
  const url = mediaUrl(streamUrl.value.trim());
  if (url === null) {
    say('not a URL the player can load', 'bad');
    return;
  }
  const license = licenseUrl.value.trim();
  const thumbs = thumbUrl.value.trim();
  const chapters = chaptersUrl.value.trim();
  // A hand-edited URL is its own entry: no keys, no note.
  const match = STREAMS.find((s) => s.url === url);
  streamNote.textContent = '';
  load({
    label: match?.label ?? url,
    url,
    ...(license !== '' ? { licenseUrl: license } : {}),
    ...(thumbs !== '' ? { thumbnails: thumbs } : {}),
    ...(chapters !== '' ? { chapters } : {}),
    ...(match?.clearKeys !== undefined ? { clearKeys: match.clearKeys } : {}),
  });
});

// ---- broadcasters: a programme id, or its data, through a connector ----------

/** Loads a programme through its connector: by id through the attributes, or by data through `sources`. */
function loadProgramme(
  type: string,
  input: { readonly id: string } | { readonly data: unknown },
  label: string,
): void {
  current = null;
  programme = { type, injected: !('id' in input) };
  playing = label;
  say(`loading ${label}…`);
  contentDialog.close();
  const element = elementFor(undefined);
  appChapters = [];
  for (const name of [
    'src',
    'license-url',
    'certificate-url',
    'thumbnails',
    'chapters',
    'poster',
  ]) {
    element.removeAttribute(name);
  }
  thumbnails.value = '';
  chapters.value = '';
  // The programme's own poster shows: the connector gives it.
  poster.value = '';
  for (const child of element.querySelectorAll(':scope > mbx-video-track')) child.remove();
  if ('id' in input) {
    element.setAttribute('type', type);
    element.setAttribute('src', input.id);
  } else {
    // The type goes with the data in `sources`; the attributes stay empty.
    element.removeAttribute('type');
    element.sources = [{ type, data: input.data }];
  }
  render();
}

{
  const picker = byId<HTMLSelectElement>('connector');
  const unit = byId<HTMLSelectElement>('connector-unit');
  const query = byId<HTMLInputElement>('connector-query');
  const form = byId<HTMLFormElement>('connector-form');
  const id = byId<HTMLInputElement>('connector-id');
  const state = byId<HTMLElement>('connector-state');
  const examples = byId<HTMLOListElement>('connector-examples');
  const panel = byId<HTMLElement>('connector-data');
  const text = byId<HTMLTextAreaElement>('connector-json');
  for (const [index, entry] of DEMO_CONNECTORS.entries()) {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = entry.name;
    picker.append(option);
  }
  let inflight: AbortController | null = null;
  let debounce = 0;

  const chosen = (): DemoConnector => DEMO_CONNECTORS[Number(picker.value)] as DemoConnector;

  function next(): AbortSignal {
    inflight?.abort();
    inflight = new AbortController();
    return inflight.signal;
  }

  function tell(words: string, bad = false): void {
    state.textContent = words;
    state.classList.toggle('bad', bad);
  }

  function renderExamples(list: readonly Example[]): void {
    examples.replaceChildren();
    for (const example of list) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      const title = document.createElement('span');
      title.className = 'result-title';
      title.textContent = example.title;
      const meta = document.createElement('span');
      meta.className = 'result-meta';
      meta.textContent = [example.id, example.note].filter((bit) => bit).join(' · ');
      button.append(title, meta);
      button.addEventListener('click', () => {
        id.value = example.id;
        loadProgramme(chosen().connector.type, { id: example.id }, example.title);
      });
      item.append(button);
      examples.append(item);
    }
  }

  async function list(find: (signal: AbortSignal) => Promise<readonly Example[]>): Promise<void> {
    tell('loading…');
    const signal = next();
    try {
      const found = await find(signal);
      renderExamples(found);
      tell(found.length === 0 ? 'nothing found' : `${found.length} programmes`);
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      examples.replaceChildren();
      tell(`could not list: ${String((error as Error).message)}`, true);
    }
  }

  function choose(): void {
    const entry = chosen();
    id.placeholder = entry.placeholder;
    id.value = '';
    panel.hidden = true;
    unit.hidden = entry.units === undefined;
    query.hidden = entry.search === undefined;
    query.value = '';
    unit.replaceChildren();
    for (const name of entry.units ?? []) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name.toUpperCase();
      option.selected = name === 'rts';
      unit.append(option);
    }
    void list((signal) => entry.examples(signal));
  }

  function search(): void {
    clearTimeout(debounce);
    const entry = chosen();
    const words = query.value.trim();
    if (entry.search === undefined || words === '') return;
    debounce = window.setTimeout(() => {
      void list((signal) =>
        (entry.search as NonNullable<DemoConnector['search']>)(words, unit.value, signal),
      );
    }, 300);
  }

  picker.addEventListener('change', choose);
  query.addEventListener('input', search);
  unit.addEventListener('change', search);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = id.value.trim();
    if (value !== '') loadProgramme(chosen().connector.type, { id: value }, value);
  });
  // The data path: what `fetch` returns, shown, edited, and played without a second fetch.
  byId<HTMLButtonElement>('connector-fetch').addEventListener('click', async () => {
    const value = id.value.trim();
    const connector = chosen().connector;
    if (value === '' || connector.fetch === undefined) return;
    tell('fetching…');
    try {
      const data = await connector.fetch(value, next());
      text.value = JSON.stringify(data, null, 2);
      panel.hidden = false;
      tell('the data, as the connector fetched it');
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      tell(`could not fetch: ${String((error as Error).message)}`, true);
    }
  });
  byId<HTMLButtonElement>('connector-inject').addEventListener('click', () => {
    let data: unknown;
    try {
      data = JSON.parse(text.value);
    } catch (error) {
      tell(`not JSON: ${String((error as Error).message)}`, true);
      return;
    }
    loadProgramme(chosen().connector.type, { data }, `${chosen().name} data`);
  });
  choose();
}

// ---- the tracker: added to the player on the page, and moved with it ---------

const trackerLog = byId<HTMLOListElement>('tracker-log');
const tracker = logTracker((line) => {
  const item = document.createElement('li');
  item.textContent = `${new Date().toLocaleTimeString()} ${line}`;
  trackerLog.append(item);
  // The newest line stays in view, as a console does.
  trackerLog.scrollTop = trackerLog.scrollHeight;
});
const logToggle = byId<HTMLInputElement>('log-tracker');
if (logToggle.checked) player.trackers.add(tracker);
logToggle.addEventListener('change', () => {
  if (logToggle.checked) player.trackers.add(tracker);
  else player.trackers.delete(tracker);
});
byId<HTMLButtonElement>('clear-log').addEventListener('click', () => {
  trackerLog.replaceChildren();
});

// ---- the chooser: a dialog with the two routes ---------------------------------

byId<HTMLButtonElement>('open-content').addEventListener('click', () => {
  contentDialog.showModal();
});
byId<HTMLButtonElement>('close-content').addEventListener('click', () => {
  contentDialog.close();
});
// A click on the backdrop, which is the dialog itself and not its content, closes it.
contentDialog.addEventListener('click', (event) => {
  if (event.target === contentDialog) contentDialog.close();
});

// ---- the two routes ------------------------------------------------------------

for (const tab of document.querySelectorAll<HTMLButtonElement>('[data-route]')) {
  tab.addEventListener('click', () => {
    for (const other of document.querySelectorAll<HTMLButtonElement>('[data-route]')) {
      other.setAttribute('aria-selected', String(other === tab));
    }
    for (const panel of document.querySelectorAll<HTMLElement>('[id^="route-"]')) {
      panel.hidden = panel.id !== `route-${tab.dataset.route}`;
    }
  });
}

// ---- the options: controls mode, media flags, and the markup they make ---------

const controlsSelect = byId<HTMLSelectElement>('controls');
const flags = [...document.querySelectorAll<HTMLInputElement>('[data-flag]')];
const looks = [...document.querySelectorAll<HTMLSelectElement>('[data-look]')];
const poster = byId<HTMLInputElement>('poster');
const thumbnails = byId<HTMLInputElement>('thumbnails');
const chapters = byId<HTMLInputElement>('chapters');
const castReceiver = byId<HTMLInputElement>('cast-receiver');
const preset = byId<HTMLSelectElement>('preset');
const nativeHls = byId<HTMLSelectElement>('native-hls');
const markup = byId<HTMLPreElement>('markup');
const screens = [...document.querySelectorAll<HTMLInputElement>('[data-screen]')];
const knobInputs = [...document.querySelectorAll<HTMLInputElement>('[data-knob]')];
const language = byId<HTMLSelectElement>('language');
const setupSelect = byId<HTMLSelectElement>('setup');
const lists = {
  seek: byId<HTMLUListElement>('layout-seek'),
  left: byId<HTMLUListElement>('layout-left'),
  right: byId<HTMLUListElement>('layout-right'),
};
type Row = keyof typeof lists;
const ROWS: readonly Row[] = ['seek', 'left', 'right'];

// ---- the composition: the rows, the ticks and the knobs, as markup -------------

/** Every control the bar can carry, by the name the lists know it by, with its tag. */
const CONTROLS: ReadonlyArray<readonly [string, string, string]> = [
  ['current-time', 'Current time', 'mbx-current-time'],
  ['seek-bar', 'Seek bar', 'mbx-seek-bar'],
  ['duration', 'Duration', 'mbx-duration'],
  ['remaining-time', 'Time left', 'mbx-remaining-time'],
  ['live', 'Live', 'mbx-live-button'],
  ['scan-back', 'Rewind', 'mbx-scan-button'],
  ['skip-back', 'Skip back', 'mbx-skip-button'],
  ['play', 'Play / pause', 'mbx-play-button'],
  ['skip-forward', 'Skip forward', 'mbx-skip-button'],
  ['scan-forward', 'Fast forward', 'mbx-scan-button'],
  ['volume', 'Volume', 'mbx-volume'],
  ['speed', 'Speed', 'mbx-speed-menu'],
  ['chapters', 'Chapters', 'mbx-chapters-menu'],
  ['subtitles', 'Subtitles', 'mbx-subtitles-menu'],
  ['audio', 'Audio', 'mbx-audio-menu'],
  ['video', 'Video', 'mbx-video-menu'],
  ['quality', 'Quality', 'mbx-quality-menu'],
  ['drm', 'DRM lock', 'mbx-drm-badge'],
  ['airplay', 'AirPlay', 'mbx-airplay-button'],
  ['cast', 'Chromecast', 'mbx-cast-button'],
  ['pip', 'PiP', 'mbx-pip-button'],
  ['fullscreen', 'Fullscreen', 'mbx-fullscreen-button'],
  ['diagnostics', 'Diagnostics', 'mbx-diagnostics'],
];
const LABELS = new Map(CONTROLS.map(([name, label]) => [name, label]));
const TAGS = new Map(CONTROLS.map(([name, , tag]) => [name, tag]));
const DEFAULT_ROWS: Readonly<Record<Row, readonly string[]>> = {
  seek: ['current-time', 'seek-bar', 'duration', 'remaining-time', 'live'],
  left: ['scan-back', 'skip-back', 'play', 'skip-forward', 'scan-forward', 'volume'],
  right: [
    'speed',
    'chapters',
    'subtitles',
    'audio',
    'video',
    'quality',
    'drm',
    'airplay',
    'cast',
    'pip',
    'fullscreen',
    'diagnostics',
  ],
};
/**
 * What the element composes on its own: everything but the time left, the
 * lock, the cast and the diagnostics, packages of their own, and the scan
 * buttons, which suit a TV remote more than a pointer or a finger.
 */
const DEFAULT_OFF = new Set([
  'remaining-time',
  'drm',
  'cast',
  'diagnostics',
  'scan-back',
  'scan-forward',
]);
const KNOB_DEFAULTS: Readonly<Record<string, string>> = {
  'skip-back': '10',
  'skip-forward': '10',
  'idle-ms': '3000',
  'seek-step': '5',
  'seek-page': '30',
  'live-window': '3',
  rates: '0.5 0.75 1 1.25 1.5 2',
  'scan-rates': '4 8 16',
  'buffer-goal': '30',
  chapters: 'divided titles',
  scrub: 'true',
  preview: 'frames tiles',
  'key-mode': 'instant',
};
/** The demo's own receiver, from the mattebox-receiver repository. Empty means the Default Media Receiver. */
const CAST_RECEIVER = '6BCED548';

/** The layout as the page holds it: every control in one row, ticked when the bar carries it. */
const rows: Record<Row, string[]> = { seek: [], left: [], right: [] };
const enabled = new Set<string>();

/** Every field and list back to the defaults the markup carries. */
function defaults(): void {
  for (const row of ROWS) rows[row] = [...DEFAULT_ROWS[row]];
  enabled.clear();
  for (const [name] of CONTROLS) if (!DEFAULT_OFF.has(name)) enabled.add(name);
  for (const flag of flags) flag.checked = flag.defaultChecked;
  for (const screen of screens) screen.checked = screen.defaultChecked;
  poster.value = '';
  preset.value = 'full';
  nativeHls.value = 'auto';
  for (const look of looks) look.value = look.dataset.look === 'subtitle-size' ? 'medium' : 'dark';
  controlsSelect.value = 'custom';
  for (const input of knobInputs) input.value = KNOB_DEFAULTS[input.dataset.knob as string] ?? '';
  language.value = 'en';
  castReceiver.value = CAST_RECEIVER;
  setupSelect.value = 'default';
}

/**
 * The setups: starting points for the composition, the screens and the knobs
 * alone. The source, the media flags, the engine preset, the looks and the
 * words stay as they are.
 */
const SETUPS: Readonly<Record<string, () => void>> = {
  default: () => undefined,
  // What a remote needs: focus moved by the arrows, scanning, and a seek bar
  // that aims before it seeks. A TV has no volume, picture in picture or
  // fullscreen of its own to offer.
  tv: () => {
    enabled.clear();
    for (const name of [
      'current-time',
      'seek-bar',
      'duration',
      'live',
      'scan-back',
      'play',
      'scan-forward',
      'chapters',
      'subtitles',
      'audio',
      'video',
      'quality',
    ]) {
      enabled.add(name);
    }
    for (const screen of screens) {
      if (screen.dataset.screen === 'spatial-nav') screen.checked = true;
    }
    setKnob('key-mode', 'preview');
    setKnob('seek-step', '10');
    setKnob('idle-ms', '5000');
  },
};

/** Puts the composition back to the demo's own, then applies the setup `name` over it. */
function applySetup(name: string): void {
  for (const row of ROWS) rows[row] = [...DEFAULT_ROWS[row]];
  enabled.clear();
  for (const [control] of CONTROLS) if (!DEFAULT_OFF.has(control)) enabled.add(control);
  for (const screen of screens) screen.checked = screen.defaultChecked;
  controlsSelect.value = 'custom';
  for (const input of knobInputs) input.value = KNOB_DEFAULTS[input.dataset.knob as string] ?? '';
  SETUPS[name]?.();
  setupSelect.value = name;
}

/** An edit to the composition by hand: it no longer matches a setup. */
function edited(): void {
  setupSelect.value = 'custom';
  render();
}
defaults();

/** Sets a knob's field. */
function setKnob(name: string, value: string): void {
  const input = knobInputs.find((k) => k.dataset.knob === name);
  if (input !== undefined) input.value = value;
}

/** A knob's value, or null where it is empty or the default and needs no attribute. */
function knob(name: string): string | null {
  const input = knobInputs.find((k) => k.dataset.knob === name);
  const value = input?.value.trim() ?? '';
  return value === '' || value === KNOB_DEFAULTS[name] ? null : value;
}

/** A value inside a quoted attribute: the characters that could end it, or open a tag, as entities. */
function quoted(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** One element as markup: the tag, then the attributes in the order given. */
function tag(name: string, attributes: Readonly<Record<string, string | null>>): string {
  const text = Object.entries(attributes)
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([key, value]) => ` ${key}="${quoted(value)}"`)
    .join('');
  return `<${name}${text}></${name}>`;
}

/** A control's markup: its tag and its knobs. Its words come from the player's language. */
function controlMarkup(name: string, row: Row): string {
  const tagName = TAGS.get(name);
  if (tagName === undefined) return '';
  const own: Record<string, string | null> = {};
  const seekRow = ['current-time', 'seek-bar', 'duration', 'remaining-time', 'live'];
  if (row === 'seek' && !seekRow.includes(name)) own.slot = 'seek';
  if (row !== 'seek' && seekRow.includes(name)) own.slot = '';
  if (name === 'skip-back') own.seconds = `-${knob('skip-back') ?? '10'}`;
  if (name === 'skip-forward') own.seconds = knob('skip-forward') ?? '10';
  if (name === 'scan-back') own.direction = 'backward';
  if (name === 'scan-back' || name === 'scan-forward') own.rates = knob('scan-rates');
  if (name === 'seek-bar') {
    own.step = knob('seek-step');
    own.page = knob('seek-page');
    own['live-window'] = knob('live-window');
    own.chapters = knob('chapters');
    own.scrub = knob('scrub');
    own.preview = knob('preview');
    own['key-mode'] = knob('key-mode');
  }
  if (name === 'speed') own.rates = knob('rates');
  if (name === 'cast')
    own.receiver = castReceiver.value.trim() === '' ? null : castReceiver.value.trim();
  if (name === 'volume') {
    // The group's two parts, written out so a page sees where each word goes.
    const inner = [tag('mbx-mute-button', {}), tag('mbx-volume-slider', {})];
    const open = tag(tagName, own);
    return `${open.slice(0, open.indexOf('></') + 1)}\n    ${inner.join('\n    ')}\n  </${tagName}>`;
  }
  return tag(tagName, own);
}

const SCREEN_TAGS: Readonly<Record<string, string>> = {
  start: 'mbx-start-button',
  markers: 'mbx-marker-button',
  error: 'mbx-error-screen',
  spinner: 'mbx-spinner',
  title: 'mbx-title',
  'spatial-nav': 'mbx-spatial-nav',
};

/** The whole composition: the screens, and the bar with its rows. */
function composition(): string {
  const lines: string[] = [];
  // The title first: its band paints under the other screens.
  const ordered = [...screens].sort(
    (a, b) => Number(b.dataset.screen === 'title') - Number(a.dataset.screen === 'title'),
  );
  for (const screen of ordered) {
    if (!screen.checked) continue;
    const tagName = SCREEN_TAGS[screen.dataset.screen ?? ''] ?? 'mbx-error-screen';
    // The title shows what the demo knows of the source: its name and its
    // poster. A connector's programme brings its own title, which the
    // element shows when the attributes leave it out.
    const own =
      tagName === 'mbx-title' && programme === null
        ? { heading: playing, artwork: poster.value === '' ? null : poster.value }
        : {};
    lines.push(tag(tagName, own));
  }
  // The cast screen comes with the cast button: one package, one toggle.
  if (enabled.has('cast')) lines.push(tag('mbx-cast-screen', {}));
  const on = (row: Row) => rows[row].filter((name) => enabled.has(name));
  const inner = [
    ...on('seek').map((name) => controlMarkup(name, 'seek')),
    ...on('left').map((name) => controlMarkup(name, 'left')),
    ...(on('right').length > 0 ? ['<mbx-spacer></mbx-spacer>'] : []),
    ...on('right').map((name) => controlMarkup(name, 'right')),
  ].filter((line) => line !== '');
  const bar = tag('mbx-control-bar', {
    'idle-ms': knob('idle-ms'),
    'seek-step': knob('seek-step'),
  });
  const open = bar.slice(0, bar.indexOf('></') + 1);
  lines.push(open, ...inner.map((line) => `  ${line}`), '</mbx-control-bar>');
  return lines.join('\n');
}

/** A cast button was on the page, so the SDK's context has its receiver id. */
let castConnected = false;

/** What each element on the page carries, so an unchanged composition is left alone. */
const applied = new WeakMap<HTMLElement, string>();

/**
 * What goes inside the player when the bar does not: the diagnostics alone,
 * placed in the player itself, where the element is its panel under the
 * picture. Nothing else has a place outside the bar.
 */
function inlineComposition(): string {
  return enabled.has('diagnostics') ? controlMarkup('diagnostics', 'right') : '';
}

/** What goes inside the player for the mode on the side. */
function childrenFor(): string {
  return controlsSelect.value === 'custom' ? composition() : inlineComposition();
}

/** Replaces the controls inside `element` with the composition for the mode. */
function applyComposition(element: MatteboxPlayerElement): void {
  const wanted = childrenFor();
  if (applied.get(element) === wanted) return;
  applied.set(element, wanted);
  // The video and the versions belong to the source, not to the controls.
  for (const child of [...element.children]) {
    if (child.localName !== 'video' && child.localName !== 'mbx-video-track') child.remove();
  }
  if (wanted !== '') element.insertAdjacentHTML('beforeend', wanted);
  if (wanted.includes('<mbx-cast-button')) castConnected = true;
}

/** Sets or removes an attribute, only where that changes it. */
function attribute(element: HTMLElement, name: string, value: string | null): void {
  if (element.getAttribute(name) === value) return;
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

/** Applies every choice on the side to an element: the media and the mode. */
function applyElement(element: MatteboxPlayerElement): void {
  for (const flag of flags)
    attribute(element, flag.dataset.flag as string, flag.checked ? '' : null);
  attribute(element, 'poster', poster.value.trim() === '' ? null : poster.value.trim());
  attribute(element, 'thumbnails', thumbnails.value.trim() === '' ? null : thumbnails.value.trim());
  attribute(element, 'chapters', chapters.value.trim() === '' ? null : chapters.value.trim());
  attribute(element, 'preset', preset.value === 'full' ? null : preset.value);
  attribute(element, 'native-hls', nativeHls.value === 'off' ? 'off' : null);
  for (const look of looks) {
    const name = look.dataset.look as string;
    const fallback = name === 'subtitle-size' ? 'medium' : 'dark';
    attribute(element, name, look.value === fallback ? null : look.value);
  }
  attribute(element, 'controls', controlsSelect.value === 'native' ? null : controlsSelect.value);
  // English is the controls' own; any other language comes from the packages.
  attribute(element, 'language', language.value === 'en' ? null : language.value);
  applyComposition(element);
}

/** The markup that reproduces the element on screen, attributes at their non-defaults only. */
function markupFor(element: MatteboxPlayerElement): string {
  const attributes: string[] = [];
  const src = element.getAttribute('src');
  if (src !== null) attributes.push(`src="${src}"`);
  for (const name of [
    'type',
    'preset',
    'native-hls',
    'license-url',
    'certificate-url',
    'thumbnails',
    'chapters',
    'poster',
    'subtitle-size',
    'subtitle-background',
    'language',
  ]) {
    const value = element.getAttribute(name);
    if (value !== null) attributes.push(`${name}="${value}"`);
  }
  for (const flag of flags) if (flag.checked) attributes.push(flag.dataset.flag as string);
  if (controlsSelect.value !== 'native') attributes.push(`controls="${controlsSelect.value}"`);
  const inner = attributes.map((a) => `\n  ${a}`).join('');
  const versions = [...element.querySelectorAll(':scope > mbx-video-track')]
    .map((child) => child.outerHTML)
    .join('\n');
  const composed = [versions, childrenFor()].filter((part) => part !== '').join('\n');
  const children =
    composed === ''
      ? ''
      : `\n${composed
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n')}\n`;
  // The cast and the diagnostics are packages of their own, so their imports come with them.
  const extra = [
    ...(controlsSelect.value === 'custom' && enabled.has('cast')
      ? ["\n  import '@mattebox/player-cast';"]
      : []),
    ...(composed.includes('<mbx-diagnostics')
      ? ["\n  import '@mattebox/player-diagnostics';"]
      : []),
    ...(composed.includes('<mbx-spatial-nav')
      ? ["\n  import '@mattebox/player-spatial-nav';"]
      : []),
  ].join('');
  // At an edge the spatial navigation hands focus to the application.
  const edges = composed.includes('<mbx-spatial-nav')
    ? `\n\n  document.querySelector('mattebox-player').addEventListener('navigateout', (event) => {
    // event.detail is 'up', 'down', 'left' or 'right': move focus to your own UI.
  });`
    : '';
  // Markers come from a content API, not the markup: the page sets them.
  const marks = element.markers.list;
  const markers =
    programme !== null
      ? programme.injected
        ? `\n\n  // The programme's data, which the connector resolves without a fetch.\n  document.querySelector('mattebox-player').sources = [\n    { type: '${programme.type}', data: /* what the connector's fetch returns */ },\n  ];`
        : ''
      : marks.length === 0
        ? ''
        : `\n\n  // After src: a new source clears them.\n  document.querySelector('mattebox-player').markers.set([\n${marks
            .map(
              (marker) =>
                `    { ${Object.entries(marker)
                  .map(
                    ([key, value]) =>
                      `${key}: ${typeof value === 'string' ? `'${value}'` : typeof value === 'number' ? value : JSON.stringify(value)}`,
                  )
                  .join(', ')} },`,
            )
            .join('\n')}\n  ]);`;
  // A stage list and kernel config are not attributes: they go to define().
  const options = [
    ...(built.keys
      ? [
          '    // ClearKey keys are not an attribute: this entry needs a stage list.',
          '    stages: full.stages({ stages: [emeCore({ clearKeys: { /* key id: key */ } })] }),',
        ]
      : []),
    ...(built.goal === null ? [] : [`    config: { bufferGoalSeconds: ${built.goal} },`]),
    ...connectorOptions(),
  ];
  const connector = connectorOptions().length > 0;
  const name = (programme?.type ?? '').split('/')[0];
  const imports = `${
    built.keys
      ? "\n  import full from 'mattebox/presets/full';\n  import emeCore from 'mattebox/stages/eme-core';"
      : ''
  }${connector ? `\n  import { ${name} } from './connectors/${name}.js';` : ''}`;
  // A language is one import per package on the page that has words, and one registration.
  const code = element.getAttribute('language');
  const used = WORD_PACKAGES.filter(
    (name) =>
      name === '@mattebox/player' ||
      (name === '@mattebox/player-cast' && extra.includes(name)) ||
      (name === '@mattebox/player-diagnostics' && extra.includes(name)),
  );
  const words = used.map((name) =>
    name === '@mattebox/player' ? 'words' : `${name.slice('@mattebox/player-'.length)}Words`,
  );
  const locales =
    code === null
      ? ''
      : `${used.map((name, index) => `\n  import ${words[index]} from '${name}/locales/${code}';`).join('')}`;
  const register =
    code === null ? '' : `\n  MatteboxPlayerElement.addLocale('${code}', ${words.join(', ')});`;
  const script =
    options.length > 0
      ? `<script type="module">
  import { MatteboxPlayerElement } from '@mattebox/player';${extra}${imports}${locales}
  MatteboxPlayerElement.define({
${options.join('\n')}
  });${register}${edges}${markers}
</script>`
      : code !== null
        ? `<script type="module">
  import { MatteboxPlayerElement } from '@mattebox/player';${extra}${locales}${register}${edges}${markers}
</script>`
        : `<script type="module">
  import '@mattebox/player';${extra}${edges}${markers}
</script>`;
  return `<mattebox-player${inner}\n>${children}</mattebox-player>\n\n${script}`;
}

/** The `connectors` option, when the source is a programme a demo connector resolves. */
function connectorOptions(): string[] {
  const type = programme?.type;
  const entry = DEMO_CONNECTORS.find((candidate) => candidate.connector.type === type);
  if (entry === undefined) return [];
  // The export of `demo/src/connectors/<name>.ts` is named after the type's first word.
  const name = entry.connector.type.split('/')[0] as string;
  return [
    `    // The demo's own connector: demo/src/connectors/${name}.ts`,
    `    connectors: [${name}],`,
  ];
}

function render(): void {
  applyElement(player);
  markup.textContent = markupFor(player);
  savePreferences();
}

// ---- the preferences, kept per browser so the page opens the way it was left ----

const PREFERENCES = 'mattebox.demo.options';

interface Preferences {
  readonly flags: Record<string, boolean>;
  readonly poster: string;
  readonly preset: string;
  readonly nativeHls: string;
  readonly looks: Record<string, string>;
  readonly controls: string;
  readonly rows: Record<Row, string[]>;
  readonly enabled: string[];
  readonly screens: Record<string, boolean>;
  readonly knobs: Record<string, string>;
  readonly language: string;
  readonly castReceiver: string;
  readonly setup: string;
}

function savePreferences(): void {
  const prefs: Preferences = {
    flags: Object.fromEntries(flags.map((f) => [f.dataset.flag as string, f.checked])),
    poster: poster.value,
    preset: preset.value,
    nativeHls: nativeHls.value,
    looks: Object.fromEntries(looks.map((l) => [l.dataset.look as string, l.value])),
    controls: controlsSelect.value,
    rows,
    enabled: [...enabled],
    screens: Object.fromEntries(screens.map((s) => [s.dataset.screen as string, s.checked])),
    knobs: Object.fromEntries(knobInputs.map((k) => [k.dataset.knob as string, k.value])),
    language: language.value,
    castReceiver: castReceiver.value,
    setup: setupSelect.value,
  };
  try {
    localStorage.setItem(PREFERENCES, JSON.stringify(prefs));
  } catch {
    // Storage may be unavailable; the page still works, it just forgets.
  }
}

/** Puts what was saved back into the fields. Anything malformed is ignored. */
function loadPreferences(): void {
  let prefs: Partial<Preferences>;
  try {
    const raw = localStorage.getItem(PREFERENCES);
    if (raw === null) return;
    prefs = JSON.parse(raw) as Partial<Preferences>;
  } catch {
    return;
  }
  for (const f of flags) {
    const saved = prefs.flags?.[f.dataset.flag as string];
    if (typeof saved === 'boolean') f.checked = saved;
  }
  if (typeof prefs.poster === 'string') poster.value = prefs.poster;
  if (
    typeof prefs.preset === 'string' &&
    [...preset.options].some((o) => o.value === prefs.preset)
  ) {
    preset.value = prefs.preset;
  }
  if (prefs.nativeHls === 'auto' || prefs.nativeHls === 'off') nativeHls.value = prefs.nativeHls;
  for (const l of looks) {
    const saved = prefs.looks?.[l.dataset.look as string];
    if (typeof saved === 'string' && [...l.options].some((o) => o.value === saved)) l.value = saved;
  }
  if (typeof prefs.controls === 'string' && ['custom', 'native', 'none'].includes(prefs.controls)) {
    controlsSelect.value = prefs.controls;
  }
  const known = (names: unknown): string[] =>
    Array.isArray(names)
      ? names.filter((n): n is string => typeof n === 'string' && LABELS.has(n))
      : [];
  const saved = ROWS.map((row) => known(prefs.rows?.[row]));
  const all = saved.flat();
  if (all.length === CONTROLS.length && new Set(all).size === CONTROLS.length) {
    for (const [i, row] of ROWS.entries()) rows[row] = saved[i] ?? [];
  }
  if (Array.isArray(prefs.enabled)) {
    enabled.clear();
    for (const name of known(prefs.enabled)) enabled.add(name);
  }
  for (const s of screens) {
    const value = prefs.screens?.[s.dataset.screen as string];
    if (typeof value === 'boolean') s.checked = value;
  }
  for (const k of knobInputs) {
    const value = prefs.knobs?.[k.dataset.knob as string];
    if (typeof value === 'string') k.value = value;
  }
  if (
    typeof prefs.language === 'string' &&
    (prefs.language === 'en' || prefs.language in LANGUAGES)
  ) {
    language.value = prefs.language;
  }
  if (typeof prefs.castReceiver === 'string') castReceiver.value = prefs.castReceiver;
  if (
    typeof prefs.setup === 'string' &&
    [...setupSelect.options].some((o) => o.value === prefs.setup)
  ) {
    setupSelect.value = prefs.setup;
  }
}

/** One row of the layout lists: a tick, a name, and a handle to drag it by. */
function layoutItem(name: string): HTMLLIElement {
  const item = document.createElement('li');
  item.draggable = true;
  item.dataset.name = name;
  const label = document.createElement('label');
  const tick = document.createElement('input');
  tick.type = 'checkbox';
  tick.checked = enabled.has(name);
  tick.addEventListener('change', () => {
    if (tick.checked) enabled.add(name);
    else enabled.delete(name);
    edited();
  });
  const text = document.createElement('span');
  text.textContent = LABELS.get(name) ?? name;
  label.append(tick, text);
  // The grip every list that reorders by drag uses: two columns of dots.
  const handle = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  handle.setAttribute('class', 'handle');
  handle.setAttribute('viewBox', '0 0 10 16');
  handle.setAttribute('aria-hidden', 'true');
  for (const [x, y] of [
    [2.5, 3],
    [7.5, 3],
    [2.5, 8],
    [7.5, 8],
    [2.5, 13],
    [7.5, 13],
  ]) {
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', String(x));
    dot.setAttribute('cy', String(y));
    dot.setAttribute('r', '1.4');
    handle.append(dot);
  }
  item.title = 'Drag to reorder';
  item.append(label, handle);

  item.addEventListener('dragstart', (event) => {
    event.dataTransfer?.setData('text/plain', name);
    if (event.dataTransfer !== null) event.dataTransfer.effectAllowed = 'move';
    item.classList.add('dragging');
  });
  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
  });
  return item;
}

function renderLists(): void {
  for (const row of ROWS) {
    lists[row].replaceChildren();
    for (const name of rows[row]) lists[row].append(layoutItem(name));
  }
}

/** Moves a name to a row and index, out of wherever it was. */
function move(name: string, row: Row, index: number): void {
  for (const other of ROWS) {
    const at = rows[other].indexOf(name);
    if (at >= 0) {
      rows[other].splice(at, 1);
      if (other === row && at < index) index -= 1;
    }
  }
  rows[row].splice(index, 0, name);
  renderLists();
  edited();
}

for (const row of ROWS) {
  const list = lists[row];
  list.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move';
  });
  list.addEventListener('drop', (event) => {
    event.preventDefault();
    const name = event.dataTransfer?.getData('text/plain') ?? '';
    if (!LABELS.has(name)) return;
    // Before the first item whose middle the pointer is above; else at the end.
    const items = [...list.querySelectorAll<HTMLLIElement>('li')];
    let index = items.length;
    for (const [i, item] of items.entries()) {
      const rect = item.getBoundingClientRect();
      if (event.clientY < rect.top + rect.height / 2) {
        index = i;
        break;
      }
    }
    move(name, row, index);
  });
}

registerLanguages();
for (const [code, name] of Object.entries(LANGUAGES)) {
  const option = document.createElement('option');
  option.value = code;
  option.textContent = name;
  language.append(option);
}
controlsSelect.addEventListener('change', edited);
for (const screen of screens) screen.addEventListener('change', edited);
for (const input of knobInputs) input.addEventListener('input', edited);
setupSelect.addEventListener('change', () => {
  applySetup(setupSelect.value);
  renderLists();
  render();
});
// The buffer goal is kernel config, fixed when the engine is built: a new
// value takes a new element, so the source loads again on one.
knobInputs
  .find((input) => input.dataset.knob === 'buffer-goal')
  ?.addEventListener('change', () => {
    if (current !== null) load(current);
  });
language.addEventListener('change', render);
for (const flag of flags) flag.addEventListener('change', render);
for (const look of looks) look.addEventListener('change', render);
poster.addEventListener('change', render);
thumbnails.addEventListener('change', render);
chapters.addEventListener('change', render);
castReceiver.addEventListener('change', () => {
  render();
  // The SDK's context is one per page and keeps the id of the first button
  // that connected. After that, only a new page takes a new id. The
  // preferences carry it over.
  if (castConnected) location.reload();
});
preset.addEventListener('change', render);
nativeHls.addEventListener('change', render);
// The subtitles menu in the bar writes the same two attributes; the side follows it.
new MutationObserver(() => {
  for (const look of looks) {
    const name = look.dataset.look as string;
    const value = player.getAttribute(name) ?? (name === 'subtitle-size' ? 'medium' : 'dark');
    if (look.value !== value) look.value = value;
  }
  markup.textContent = markupFor(player);
}).observe(document.querySelector('.frame') as HTMLElement, {
  attributes: true,
  subtree: true,
  attributeFilter: ['subtitle-size', 'subtitle-background'],
});
byId<HTMLButtonElement>('copy-markup').addEventListener('click', () => {
  void navigator.clipboard?.writeText(markup.textContent ?? '').then(
    () => say('markup copied', 'ok'),
    () => say('could not copy; select the markup and copy it yourself', 'bad'),
  );
});

// ---- the room ------------------------------------------------------------------

wireTheme(byId<HTMLButtonElement>('theme-toggle'));

loadPreferences();
byId<HTMLButtonElement>('reset-options').addEventListener('click', () => {
  try {
    localStorage.removeItem(PREFERENCES);
  } catch {
    // Nothing saved to forget.
  }
  defaults();
  renderLists();
  render();
});
renderLists();

wire(player);
render();

// The first entry plays on arrival, so the page is a player and not a form.
// `?row=n` picks another; `?row=none` waits for a choice, which the E2E
// suite wants so that nothing from the internet is in flight under it.
const wanted = new URLSearchParams(location.search).get('row');
if (wanted !== 'none') {
  const entry = STREAMS[Number.parseInt(wanted ?? '0', 10) || 0];
  if (entry !== undefined) chooseStream(entry);
}
