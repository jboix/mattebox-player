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
import { inferType } from '@mattebox/player-core';
import '@mattebox/player';
import { MatteboxPlayerElement } from '@mattebox/player';
import full from 'mattebox/presets/full';
import emeCore from 'mattebox/stages/eme-core';
// Imported, not referenced from the HTML: the file lives outside the demo
// root, and only an import gives it a URL the dev server and the build serve.
import logoUrl from '../../docs/logo.svg';
import type { StreamEntry } from './catalogue.js';
import { STREAMS } from './catalogue.js';
import type { BusinessUnit, Composition, IlResource, SearchResult } from './srgssr.js';
import {
  BUSINESS_UNITS,
  fetchComposition,
  fmtDuration,
  licenseUrlFor,
  searchMedia,
  tokenize,
} from './srgssr.js';
import { attributesFor, LANGUAGES } from './words.js';

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
/** Whether the element on the page was built with a stage list. */
let scripted = false;
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
  });
  element.addEventListener('error', (event) => {
    if (event.detail.fatal) say(`${event.detail.category}: ${event.detail.code}`, 'bad');
  });
  // A fatal error the engine reports and then plays through is the engine's
  // to explain; the status follows what the picture does.
  element.video.addEventListener('playing', () => {
    if (status.classList.contains('bad'))
      say(`${playing}, playing after an error the engine reported`, 'ok');
  });
}

/** The element a source needs, swapping the one on the page when the route changes. */
function elementFor(
  clearKeys: Readonly<Record<string, string>> | undefined,
): MatteboxPlayerElement {
  if ((clearKeys !== undefined) === scripted) return player;
  const next =
    clearKeys === undefined
      ? (document.createElement('mattebox-player') as MatteboxPlayerElement)
      : // Merged by name: `full` already composes eme-core, so this replaces
        // that instance rather than appending a second one.
        new MatteboxPlayerElement({
          stages: full.stages({ stages: [emeCore({ clearKeys })] }),
        });
  next.id = 'player';
  player.replaceWith(next);
  player = next;
  scripted = clearKeys !== undefined;
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
  readonly thumbnails?: string;
  readonly poster?: string;
  readonly clearKeys?: Readonly<Record<string, string>>;
}

/** One door for every way of choosing a source. Whatever is not given is cleared, and the chooser closes. */
function load(choice: Choice): void {
  playing = choice.label ?? choice.url;
  say(`loading ${playing}…`);
  contentDialog.close();
  const element = elementFor(choice.clearKeys);
  // The source goes last so the attributes that describe it are already in
  // place: every one of them reloads, and only the last load counts.
  element.removeAttribute('src');
  const type = choice.type ?? inferType(choice.url) ?? null;
  if (type === null) element.removeAttribute('type');
  else element.setAttribute('type', type);
  if (choice.licenseUrl === undefined) element.removeAttribute('license-url');
  else element.setAttribute('license-url', choice.licenseUrl);
  if (choice.thumbnails === undefined) element.removeAttribute('thumbnails');
  else element.setAttribute('thumbnails', choice.thumbnails);
  // A source that brings a poster fills the field; one that does not clears it.
  poster.value = choice.poster ?? '';
  attribute(element, 'poster', choice.poster ?? null);
  element.setAttribute('src', choice.url);
  render();
}

// ---- static content ----------------------------------------------------------

const streamList = byId<HTMLOListElement>('stream-list');
const streamUrl = byId<HTMLInputElement>('stream-url');
const licenseUrl = byId<HTMLInputElement>('license-url');
const thumbUrl = byId<HTMLInputElement>('thumb-url');
const streamNote = byId<HTMLElement>('stream-note');

function chooseStream(entry: StreamEntry): void {
  streamUrl.value = entry.url;
  licenseUrl.value = entry.licenseUrl ?? '';
  thumbUrl.value = entry.thumbnails ?? '';
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
  button.append(title, meta);
  button.addEventListener('click', () => {
    chooseStream(stream);
  });
  item.append(button);
  streamList.append(item);
}

byId<HTMLButtonElement>('load-url').addEventListener('click', () => {
  const url = streamUrl.value.trim();
  if (url === '') return;
  const license = licenseUrl.value.trim();
  const thumbs = thumbUrl.value.trim();
  // A hand-edited URL is its own entry: no keys, no note.
  const match = STREAMS.find((s) => s.url === url);
  streamNote.textContent = '';
  load({
    label: match?.label ?? url,
    url,
    ...(license !== '' ? { licenseUrl: license } : {}),
    ...(thumbs !== '' ? { thumbnails: thumbs } : {}),
    ...(match?.clearKeys !== undefined ? { clearKeys: match.clearKeys } : {}),
  });
});

// ---- SRG SSR: search, resolve, pick a resource --------------------------------

{
  const form = byId<HTMLFormElement>('search-form');
  const bu = byId<HTMLSelectElement>('search-bu');
  const query = byId<HTMLInputElement>('search-query');
  const state = byId<HTMLElement>('search-state');
  const results = byId<HTMLOListElement>('search-results');
  const composition = byId<HTMLElement>('composition');
  for (const unit of BUSINESS_UNITS) {
    const option = document.createElement('option');
    option.value = unit;
    option.textContent = unit.toUpperCase();
    option.selected = unit === 'rts';
    bu.append(option);
  }
  let inflight: AbortController | null = null;
  let debounce = 0;

  function next(): AbortSignal {
    inflight?.abort();
    inflight = new AbortController();
    return inflight.signal;
  }

  function tell(text: string, bad = false): void {
    state.textContent = text;
    state.classList.toggle('bad', bad);
  }

  function renderResults(list: SearchResult[]): void {
    results.replaceChildren();
    results.hidden = list.length === 0;
    for (const result of list) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      const title = document.createElement('span');
      title.className = 'result-title';
      title.textContent = result.title;
      const meta = document.createElement('span');
      meta.className = 'result-meta';
      const bits = [result.mediaType.toLowerCase()];
      if (result.duration) bits.push(fmtDuration(result.duration));
      if (result.date) bits.push(new Date(result.date).toLocaleDateString());
      meta.textContent = bits.join(' · ');
      button.append(title, meta);
      button.addEventListener('click', () => {
        void resolve(result.urn);
      });
      item.append(button);
      results.append(item);
    }
  }

  function describeResource(r: IlResource): string {
    const parts = [r.streaming, r.quality, r.presentation];
    if (r.mediaContainer) parts.push(r.mediaContainer);
    if (r.live) parts.push(r.dvr ? 'live, DVR' : 'live');
    return parts.filter((s) => s).join(', ');
  }

  function cell(text: string, className?: string): HTMLTableCellElement {
    const td = document.createElement('td');
    td.textContent = text;
    if (className !== undefined) td.className = className;
    return td;
  }

  /** The composition's resources, one row each, with a Play where the engine can. */
  function renderComposition(c: Composition): void {
    composition.replaceChildren();
    composition.hidden = false;
    const name = document.createElement('h3');
    name.className = 'composition-title';
    name.textContent = c.title;
    composition.append(name);
    if (c.resources.length === 0) {
      const none = document.createElement('p');
      none.className = 'hint';
      none.textContent = 'This media has no playable resource.';
      composition.append(none);
      return;
    }
    const table = document.createElement('table');
    table.className = 'resources';
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const text of ['Resource', 'DRM', 'Token', '']) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = text;
      headRow.append(th);
    }
    head.append(headRow);
    const body = document.createElement('tbody');
    for (const resource of c.resources) {
      const tr = document.createElement('tr');
      const drm = (resource.drmList ?? []).map((d) => d.type.toLowerCase()).join(', ');
      tr.append(
        cell(describeResource(resource)),
        cell(drm === '' ? 'clear' : drm, drm === '' ? 'muted' : 'pill'),
        cell(
          resource.tokenType === 'AKAMAI' ? 'akamai' : 'none',
          resource.tokenType === 'AKAMAI' ? 'pill' : 'muted',
        ),
      );
      const action = document.createElement('td');
      if (resource.streaming === 'HLS' || resource.streaming === 'DASH') {
        const play = document.createElement('button');
        play.type = 'button';
        play.textContent = 'Play';
        play.addEventListener('click', () => {
          void play_(c, resource);
        });
        action.append(play);
      } else {
        action.className = 'muted';
        action.title = 'The engine plays HLS and DASH; a progressive file needs no engine';
        action.textContent = 'not adaptive';
      }
      tr.append(action);
      body.append(tr);
    }
    table.append(head, body);
    composition.append(table);
  }

  async function play_(c: Composition, resource: IlResource): Promise<void> {
    tell(`preparing ${c.title}…`);
    try {
      const signal = next();
      const url =
        resource.tokenType === 'AKAMAI' ? await tokenize(resource.url, signal) : resource.url;
      const license = licenseUrlFor(resource);
      load({
        label: c.title,
        url,
        type: resource.mimeType,
        ...(license === null ? {} : { licenseUrl: license }),
        ...(c.imageUrl === undefined ? {} : { poster: `${c.imageUrl}?width=1280&format=jpg` }),
      });
      tell(`playing ${c.title}${license === null ? '' : ' (DRM)'}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      tell(`could not prepare the stream: ${String((error as Error).message)}`, true);
    }
  }

  async function resolve(urn: string): Promise<void> {
    results.hidden = true;
    tell('resolving…');
    const signal = next();
    try {
      const c = await fetchComposition(urn, signal);
      renderComposition(c);
      tell(`${c.resources.length} resource(s)`);
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      composition.hidden = true;
      tell(`could not resolve ${urn}: ${String((error as Error).message)}`, true);
    }
  }

  async function search(text: string): Promise<void> {
    tell('searching…');
    const signal = next();
    try {
      const list = await searchMedia(bu.value as BusinessUnit, text, signal);
      renderResults(list);
      tell(list.length === 0 ? 'no results' : `${list.length} results`);
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      tell(`search failed: ${String((error as Error).message)}`, true);
    }
  }

  function submit(): void {
    clearTimeout(debounce);
    const text = query.value.trim();
    if (text === '') return;
    if (text.startsWith('urn:')) void resolve(text);
    else void search(text);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit();
  });
  query.addEventListener('input', () => {
    clearTimeout(debounce);
    const text = query.value.trim();
    if (text === '' || text.startsWith('urn:')) {
      results.hidden = true;
      return;
    }
    debounce = window.setTimeout(() => void search(text), 300);
  });
  bu.addEventListener('change', submit);
}

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
const preset = byId<HTMLSelectElement>('preset');
const markup = byId<HTMLPreElement>('markup');
const screens = [...document.querySelectorAll<HTMLInputElement>('[data-screen]')];
const knobInputs = [...document.querySelectorAll<HTMLInputElement>('[data-knob]')];
const language = byId<HTMLSelectElement>('language');
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
  ['live', 'Live', 'mbx-live-button'],
  ['skip-back', 'Skip back', 'mbx-skip-button'],
  ['play', 'Play / pause', 'mbx-play-button'],
  ['skip-forward', 'Skip forward', 'mbx-skip-button'],
  ['volume', 'Volume', 'mbx-volume'],
  ['speed', 'Speed', 'mbx-speed-menu'],
  ['subtitles', 'Subtitles', 'mbx-subtitles-menu'],
  ['audio', 'Audio', 'mbx-audio-menu'],
  ['quality', 'Quality', 'mbx-quality-menu'],
  ['drm', 'DRM lock', 'mbx-drm-badge'],
  ['pip', 'PiP', 'mbx-pip-button'],
  ['fullscreen', 'Fullscreen', 'mbx-fullscreen-button'],
];
const LABELS = new Map(CONTROLS.map(([name, label]) => [name, label]));
const TAGS = new Map(CONTROLS.map(([name, , tag]) => [name, tag]));
const DEFAULT_ROWS: Readonly<Record<Row, readonly string[]>> = {
  seek: ['current-time', 'seek-bar', 'duration', 'live'],
  left: ['skip-back', 'play', 'skip-forward', 'volume'],
  right: ['speed', 'subtitles', 'audio', 'quality', 'drm', 'pip', 'fullscreen'],
};
/** What the element composes on its own: everything but the lock. */
const DEFAULT_OFF = new Set(['drm']);
const KNOB_DEFAULTS: Readonly<Record<string, string>> = {
  'skip-back': '10',
  'skip-forward': '10',
  'idle-ms': '3000',
  'seek-step': '5',
  'seek-page': '30',
  'live-window': '3',
  rates: '0.5 0.75 1 1.25 1.5 2',
};

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
  for (const look of looks) look.value = look.dataset.look === 'subtitle-size' ? 'medium' : 'dark';
  controlsSelect.value = 'custom';
  for (const input of knobInputs) input.value = KNOB_DEFAULTS[input.dataset.knob as string] ?? '';
  language.value = 'en';
}
defaults();

/** A knob's value, or null where it is empty or the default and needs no attribute. */
function knob(name: string): string | null {
  const input = knobInputs.find((k) => k.dataset.knob === name);
  const value = input?.value.trim() ?? '';
  return value === '' || value === KNOB_DEFAULTS[name] ? null : value;
}

/** One element as markup: the tag, then the attributes in the order given. */
function tag(name: string, attributes: Readonly<Record<string, string | null>>): string {
  const text = Object.entries(attributes)
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([key, value]) => ` ${key}="${value}"`)
    .join('');
  return `<${name}${text}></${name}>`;
}

/** The words a control takes in the chosen language, none in English: English is the default. */
function words(tagName: string, name: string): Record<string, string | null> {
  const chosen = LANGUAGES[language.value];
  if (chosen === undefined) return {};
  const out: Record<string, string | null> = { ...attributesFor(tagName, chosen.words) };
  if (name === 'skip-back') out.label = chosen.words.skipBack;
  if (name === 'skip-forward') out.label = chosen.words.skipForward;
  return out;
}

/** A control's markup: its tag, its knobs, and its words. */
function controlMarkup(name: string, row: Row): string {
  const tagName = TAGS.get(name) ?? name;
  const own: Record<string, string | null> = {};
  const seekRow = ['current-time', 'seek-bar', 'duration', 'live'];
  if (row === 'seek' && !seekRow.includes(name)) own.slot = 'seek';
  if (row !== 'seek' && seekRow.includes(name)) own.slot = '';
  if (name === 'skip-back') own.seconds = `-${knob('skip-back') ?? '10'}`;
  if (name === 'skip-forward') own.seconds = knob('skip-forward') ?? '10';
  if (name === 'seek-bar') {
    own.step = knob('seek-step');
    own.page = knob('seek-page');
    own['live-window'] = knob('live-window');
  }
  if (name === 'speed') own.rates = knob('rates');
  if (name === 'volume') {
    // The group's two parts, written out so their words can be set.
    const inner = [
      tag('mbx-mute-button', words('mbx-mute-button', 'mute')),
      tag('mbx-volume-slider', words('mbx-volume-slider', 'volume')),
    ];
    const open = tag(tagName, own);
    return `${open.slice(0, open.indexOf('></') + 1)}\n    ${inner.join('\n    ')}\n  </${tagName}>`;
  }
  return tag(tagName, { ...own, ...words(tagName, name) });
}

/** The whole composition: the screens, and the bar with its rows. */
function composition(): string {
  const lines: string[] = [];
  for (const screen of screens) {
    if (!screen.checked) continue;
    const tagName = screen.dataset.screen === 'start' ? 'mbx-start-button' : 'mbx-error-screen';
    lines.push(tag(tagName, words(tagName, '')));
  }
  const on = (row: Row) => rows[row].filter((name) => enabled.has(name));
  const inner = [
    ...on('seek').map((name) => controlMarkup(name, 'seek')),
    ...on('left').map((name) => controlMarkup(name, 'left')),
    ...(on('right').length > 0 ? ['<mbx-spacer></mbx-spacer>'] : []),
    ...on('right').map((name) => controlMarkup(name, 'right')),
  ];
  const bar = tag('mbx-control-bar', {
    'idle-ms': knob('idle-ms'),
    'seek-step': knob('seek-step'),
  });
  const open = bar.slice(0, bar.indexOf('></') + 1);
  lines.push(open, ...inner.map((line) => `  ${line}`), '</mbx-control-bar>');
  return lines.join('\n');
}

/** What each element on the page carries, so an unchanged composition is left alone. */
const applied = new WeakMap<HTMLElement, string>();

/** Replaces the controls inside `element` with the composition, under custom controls. */
function applyComposition(element: MatteboxPlayerElement): void {
  const wanted = controlsSelect.value === 'custom' ? composition() : '';
  if (applied.get(element) === wanted) return;
  applied.set(element, wanted);
  for (const child of [...element.children]) if (child.localName !== 'video') child.remove();
  if (wanted !== '') element.insertAdjacentHTML('beforeend', wanted);
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
  attribute(element, 'preset', preset.value === 'full' ? null : preset.value);
  for (const look of looks) {
    const name = look.dataset.look as string;
    const fallback = name === 'subtitle-size' ? 'medium' : 'dark';
    attribute(element, name, look.value === fallback ? null : look.value);
  }
  attribute(element, 'controls', controlsSelect.value === 'native' ? null : controlsSelect.value);
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
    'license-url',
    'thumbnails',
    'poster',
    'subtitle-size',
    'subtitle-background',
  ]) {
    const value = element.getAttribute(name);
    if (value !== null) attributes.push(`${name}="${value}"`);
  }
  for (const flag of flags) if (flag.checked) attributes.push(flag.dataset.flag as string);
  if (controlsSelect.value !== 'native') attributes.push(`controls="${controlsSelect.value}"`);
  const inner = attributes.map((a) => `\n  ${a}`).join('');
  const children =
    controlsSelect.value === 'custom'
      ? `\n${composition()
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n')}\n`
      : '';
  const script = scripted
    ? `<script type="module">
  import { MatteboxPlayerElement } from '@mattebox/player';
  import full from 'mattebox/presets/full';
  import emeCore from 'mattebox/stages/eme-core';
  // ClearKey keys are not an attribute: this entry needs a stage list.
  MatteboxPlayerElement.define({
    stages: full.stages({ stages: [emeCore({ clearKeys: { /* key id: key */ } })] }),
  });
</script>`
    : `<script type="module">
  import '@mattebox/player';
</script>`;
  return `<mattebox-player${inner}\n>${children}</mattebox-player>\n\n${script}`;
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
  readonly looks: Record<string, string>;
  readonly controls: string;
  readonly rows: Record<Row, string[]>;
  readonly enabled: string[];
  readonly screens: Record<string, boolean>;
  readonly knobs: Record<string, string>;
  readonly language: string;
}

function savePreferences(): void {
  const prefs: Preferences = {
    flags: Object.fromEntries(flags.map((f) => [f.dataset.flag as string, f.checked])),
    poster: poster.value,
    preset: preset.value,
    looks: Object.fromEntries(looks.map((l) => [l.dataset.look as string, l.value])),
    controls: controlsSelect.value,
    rows,
    enabled: [...enabled],
    screens: Object.fromEntries(screens.map((s) => [s.dataset.screen as string, s.checked])),
    knobs: Object.fromEntries(knobInputs.map((k) => [k.dataset.knob as string, k.value])),
    language: language.value,
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
    render();
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
  render();
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

for (const [code, { name }] of Object.entries(LANGUAGES)) {
  const option = document.createElement('option');
  option.value = code;
  option.textContent = name;
  language.append(option);
}
controlsSelect.addEventListener('change', render);
for (const screen of screens) screen.addEventListener('change', render);
for (const input of knobInputs) input.addEventListener('input', render);
language.addEventListener('change', render);
for (const flag of flags) flag.addEventListener('change', render);
for (const look of looks) look.addEventListener('change', render);
poster.addEventListener('change', render);
preset.addEventListener('change', render);
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

// ---- the room: one button, naming the room it would switch to ------------------

{
  const KEY = 'mattebox.demo.theme';
  const button = byId<HTMLButtonElement>('theme-toggle');
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  function current(): 'light' | 'dark' {
    const set = document.documentElement.dataset.theme;
    if (set === 'light' || set === 'dark') return set;
    return system.matches ? 'dark' : 'light';
  }
  function paint(): void {
    const dark = current() === 'dark';
    button.textContent = dark ? '☀ Light' : '☾ Dark';
    button.title = `Switch to the ${dark ? 'light' : 'dark'} room`;
    button.setAttribute('aria-pressed', String(dark));
  }
  button.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage may be unavailable; the room still changes.
    }
    paint();
  });
  // Follows the system until a choice is made.
  system.addEventListener('change', paint);
  paint();
}

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
