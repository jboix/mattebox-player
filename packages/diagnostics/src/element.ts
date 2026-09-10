/**
 * <mbx-diagnostics>: what the session is doing, for an integrator's eyes.
 * In the bar it is a button that opens a panel over the picture; anywhere
 * else inside the player, the panel itself, open, in flow. Four pages:
 * the playback facts, the charts, the engine's state, and what the browser
 * supports. A button copies the report, and `report()` hands it to a page,
 * which also gets it as a `report` event on every fatal error, so a page
 * sends it where its errors go.
 *
 * The sampler runs while the element is attached, panel open or not, so
 * the counts cover the session, and keeps the session's trace, slimmed,
 * from the engine's `trace` events, or off its ring where it emits none. The pages redraw twice a second while
 * shown, the charts four times. The browser is probed once, the first
 * time its page is shown: the key-system probes are not free, and Firefox
 * asks the viewer about a DRM module it has not enabled.
 *
 * A native session has no engine, and the engine's rules say a native
 * session has no diagnostics beyond the video's own: the playback page and
 * the buffer, stall and frame charts read the video, the rest says so.
 *
 * No class fields: the ES2015 build would lower them into helpers, and the
 * player's emit check bans helpers. State is declared, then assigned.
 */
import type { Mattebox } from 'mattebox';
import type { Charts, ChartTab, Palette } from './charts.js';
import { CHART_TABS, createCharts } from './charts.js';
import { bitrate, clock, fixed, ranges, rendition, share } from './format.js';
import type { PlayerError, PlayerHost } from './host.js';
import { findPlayer, whenPlayer } from './host.js';
import { icon } from './icon.js';
import type { DiagnosticsReport } from './report.js';
import { buildReport } from './report.js';
import type { Sampler } from './sampler.js';
import { createSampler } from './sampler.js';
import { STYLE } from './style.js';
import type { Cell, Support } from './support.js';
import { probeSupport } from './support.js';

const POLL_MS = 500;
const DRAW_MS = 250;
const WINDOW = 120;
const WINDOWS = [30, 60, 120, 300, 600];
const PANEL_WIDTH = 560;
/** Air between the panel's top and the picture's, and around it. */
const AIR = 8;

const TABS = ['playback', 'charts', 'engine', 'browser'] as const;
type Tab = (typeof TABS)[number];
const TAB_NAMES: Readonly<Record<Tab, string>> = {
  playback: 'Playback',
  charts: 'Charts',
  engine: 'Engine',
  browser: 'Browser',
};

const READY_STATES = ['nothing', 'metadata', 'current data', 'future data', 'enough data'];
const NETWORK_STATES = ['empty', 'idle', 'loading', 'no source'];

type Pair = readonly [string, string];

interface Section {
  readonly title: string | null;
  readonly rows: readonly Pair[];
  /** A line instead of rows, for a section with nothing to list. */
  readonly note?: string | undefined;
}

/** The optional namespaces the pages read, cast once, the way the player does it. */
interface Namespaces {
  readonly live?: { readonly latency: number | null; readonly atEdge: boolean };
  readonly drm?: {
    readonly keySystem: string | null;
    readonly sessions: ReadonlyArray<{ readonly keyId: string; readonly status: string }>;
  };
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  part: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.setAttribute('part', part);
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(part: string, text?: string): HTMLButtonElement {
  const node = el('button', part, text);
  node.type = 'button';
  return node;
}

/** A cell's text and its part: a tick, a cross, a dash, or the text itself. */
function cell(value: Cell): [string, string] {
  switch (value) {
    case 'yes':
      return ['✓', 'cell ok'];
    case 'no':
      return ['✕', 'cell bad'];
    case 'na':
      return ['–', 'cell na'];
    case 'maybe':
      return ['maybe', 'cell maybe'];
    default:
      return [value, 'cell'];
  }
}

export class MbxDiagnostics extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return ['label', 'label-copy', 'label-copied', 'window'];
  }

  declare private player: PlayerHost | null;
  declare private cancel: (() => void) | null;
  declare private offs: Array<() => void>;
  declare private readonly sampler: Sampler;
  declare private readonly charts: Charts;
  declare private timer: ReturnType<typeof setInterval> | undefined;
  declare private drawer: ReturnType<typeof setInterval> | undefined;
  declare private copied: ReturnType<typeof setTimeout> | undefined;
  declare private tab: Tab;
  declare private chartTab: ChartTab;
  declare private support: Support | null;
  declare private probing: boolean;

  declare private readonly toggle: HTMLButtonElement;
  declare private readonly panel: HTMLElement;
  declare private readonly body: HTMLElement;
  declare private readonly tabs: Record<Tab, HTMLButtonElement>;
  declare private readonly pages: Record<Tab, HTMLElement>;
  declare private readonly copy: HTMLButtonElement;
  declare private readonly canvas: HTMLCanvasElement;
  declare private readonly chartTabs: Record<ChartTab, HTMLButtonElement>;
  declare private readonly windowSelect: HTMLSelectElement;
  declare private readonly outside: (event: PointerEvent) => void;
  declare private readonly refit: () => void;

  constructor() {
    super();
    this.player = null;
    this.cancel = null;
    this.offs = [];
    this.sampler = createSampler();
    this.timer = undefined;
    this.drawer = undefined;
    this.copied = undefined;
    this.tab = 'playback';
    this.chartTab = 'buffer';
    this.support = null;
    this.probing = false;

    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLE;

    this.toggle = button('button');
    this.toggle.setAttribute('aria-haspopup', 'dialog');
    this.toggle.setAttribute('aria-expanded', 'false');
    const slot = document.createElement('slot');
    slot.name = 'icon';
    slot.append(icon());
    this.toggle.append(slot);
    this.toggle.addEventListener('click', () => {
      if (this.panel.hidden) this.show();
      else this.hide();
    });

    this.panel = el('div', 'panel');
    this.panel.setAttribute('role', 'dialog');
    this.panel.hidden = true;
    this.panel.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || this.hasAttribute('inline')) return;
      event.preventDefault();
      this.hide();
      this.toggle.focus();
    });

    const head = el('div', 'head');
    head.setAttribute('role', 'tablist');
    this.tabs = {} as Record<Tab, HTMLButtonElement>;
    this.pages = {} as Record<Tab, HTMLElement>;
    this.body = el('div', 'body');
    for (const tab of TABS) {
      const node = button(`tab tab-${tab}`, TAB_NAMES[tab]);
      node.setAttribute('role', 'tab');
      node.addEventListener('click', () => {
        this.select(tab);
      });
      this.tabs[tab] = node;
      head.append(node);
      const page = el('div', `page page-${tab}`);
      page.setAttribute('role', 'tabpanel');
      page.hidden = true;
      this.pages[tab] = page;
      this.body.append(page);
    }
    this.copy = button('copy');
    this.copy.addEventListener('click', () => {
      void this.copyReport();
    });
    const close = button('close', '✕');
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => {
      this.hide();
      this.toggle.focus();
    });
    head.append(this.copy, close);

    // The charts page: its own tabs, the window, the canvas, the legend and the readout.
    const chartTabs = el('div', 'chart-tabs');
    chartTabs.setAttribute('role', 'tablist');
    this.chartTabs = {} as Record<ChartTab, HTMLButtonElement>;
    for (const tab of CHART_TABS) {
      const node = button(`chart-tab chart-tab-${tab}`, tab);
      node.setAttribute('role', 'tab');
      node.addEventListener('click', () => {
        this.chartTab = tab;
        this.markChartTab();
        this.draw();
      });
      this.chartTabs[tab] = node;
      chartTabs.append(node);
    }
    this.windowSelect = el('select', 'window');
    this.windowSelect.setAttribute('aria-label', 'Window');
    for (const seconds of WINDOWS) {
      const option = document.createElement('option');
      option.value = String(seconds);
      option.textContent = seconds < 60 ? `${seconds} s` : `${seconds / 60} min`;
      this.windowSelect.append(option);
    }
    this.windowSelect.addEventListener('change', () => {
      this.draw();
    });
    chartTabs.append(this.windowSelect);
    this.canvas = el('canvas', 'chart');
    const legend = el('div', 'legend');
    const readout = el('p', 'readout');
    this.pages.charts.append(chartTabs, this.canvas, legend, readout);
    this.charts = createCharts(this.canvas, legend, readout);

    this.outside = (event: PointerEvent): void => {
      if (!event.composedPath().includes(this)) this.hide();
    };
    this.refit = (): void => {
      this.fit();
    };

    this.panel.append(head, this.body);
    root.append(style, this.toggle, this.panel);
    this.markTab();
    this.markChartTab();
    this.renderLabels();
  }

  connectedCallback(): void {
    // In the bar, a button and a popup; anywhere else, the panel in flow.
    this.toggleAttribute('inline', this.parentElement?.localName !== 'mbx-control-bar');
    const found = findPlayer(this);
    if (found === null) return;
    this.cancel?.();
    this.cancel = whenPlayer(found, (player) => {
      if (!this.isConnected) return;
      this.attach(player);
    });
  }

  disconnectedCallback(): void {
    this.cancel?.();
    this.cancel = null;
    this.detach();
  }

  attributeChangedCallback(): void {
    this.renderLabels();
  }

  private attach(player: PlayerHost): void {
    this.player = player;
    this.sampler.attach(player.video, player.engine);
    const on = (target: EventTarget, name: string, fn: (event: Event) => void): void => {
      target.addEventListener(name, fn);
      this.offs.push(() => {
        target.removeEventListener(name, fn);
      });
    };
    on(player, 'sourcechange', () => {
      this.sampler.attach(player.video, player.engine);
      this.poll();
    });
    on(player, 'error', (event) => {
      const error = (event as CustomEvent<PlayerError>).detail;
      if (error.fatal) {
        this.dispatchEvent(
          new CustomEvent('report', { detail: this.report(), bubbles: true, composed: true }),
        );
      }
    });
    this.timer = setInterval(() => {
      this.poll();
    }, POLL_MS);
    this.poll();
    if (this.hasAttribute('inline')) this.show();
  }

  private detach(): void {
    for (const off of this.offs) off();
    this.offs = [];
    clearInterval(this.timer);
    this.timer = undefined;
    this.sampler.release();
    this.hide();
    this.player = null;
  }

  /** The report, as of now. */
  report(): DiagnosticsReport {
    const player = this.player;
    if (player === null) throw new Error('mbx-diagnostics is not inside a player');
    return buildReport({
      player,
      samples: this.sampler.samples,
      marks: this.sampler.marks,
      counters: this.sampler.counters,
      history: this.sampler.history,
      support: this.support,
    });
  }

  private poll(): void {
    const player = this.player;
    if (player === null) return;
    this.sampler.poll(player.video, player.engine);
    if (!this.panel.hidden) this.paint();
  }

  private show(): void {
    if (!this.panel.hidden) return;
    this.panel.hidden = false;
    if (!this.hasAttribute('inline')) {
      this.setAttribute('open', '');
      this.toggle.setAttribute('aria-expanded', 'true');
      document.addEventListener('pointerdown', this.outside, true);
      window.addEventListener('resize', this.refit);
      this.fit();
    }
    this.paint();
    this.drawer = setInterval(() => {
      this.draw();
    }, DRAW_MS);
    if (!this.hasAttribute('inline')) this.tabs[this.tab].focus();
  }

  private hide(): void {
    clearInterval(this.drawer);
    this.drawer = undefined;
    if (this.panel.hidden) return;
    this.panel.hidden = true;
    this.removeAttribute('open');
    this.toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', this.outside, true);
    window.removeEventListener('resize', this.refit);
  }

  /** The panel never leaves the picture: fitted to the room above the button, within the player's width. */
  private fit(): void {
    const player = this.player;
    if (player === null) return;
    const box = player.getBoundingClientRect();
    const host = this.getBoundingClientRect();
    const top = player.video.getBoundingClientRect().top;
    const room = host.top - top - AIR;
    this.panel.style.maxHeight = `${Math.max(120, Math.floor(room))}px`;
    const width = Math.min(PANEL_WIDTH, Math.max(200, box.width - AIR * 2));
    this.panel.style.width = `${width}px`;
    const left = Math.max(box.left + AIR, Math.min(host.right - width, box.right - AIR - width));
    this.panel.style.right = 'auto';
    this.panel.style.left = `${left - host.left}px`;
  }

  private select(tab: Tab): void {
    this.tab = tab;
    this.markTab();
    this.tabs[tab].focus();
    this.paint();
    this.draw();
  }

  private markTab(): void {
    for (const tab of TABS) {
      this.tabs[tab].setAttribute('aria-selected', String(tab === this.tab));
      this.tabs[tab].tabIndex = tab === this.tab ? 0 : -1;
      this.pages[tab].hidden = tab !== this.tab;
    }
  }

  private markChartTab(): void {
    for (const tab of CHART_TABS) {
      this.chartTabs[tab].setAttribute('aria-selected', String(tab === this.chartTab));
    }
  }

  private renderLabels(): void {
    this.toggle.setAttribute('aria-label', this.getAttribute('label') ?? 'Diagnostics');
    this.panel.setAttribute('aria-label', this.getAttribute('label') ?? 'Diagnostics');
    if (this.copied === undefined) {
      this.copy.textContent = this.getAttribute('label-copy') ?? 'Copy report';
    }
    const raw = Number(this.getAttribute('window'));
    const seconds = Number.isFinite(raw) && raw > 0 ? raw : WINDOW;
    if (!WINDOWS.includes(seconds)) {
      const option = document.createElement('option');
      option.value = String(seconds);
      option.textContent = `${seconds} s`;
      this.windowSelect.append(option);
    }
    this.windowSelect.value = String(seconds);
  }

  private async copyReport(): Promise<void> {
    const text = JSON.stringify(this.report(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    this.copy.textContent = this.getAttribute('label-copied') ?? 'Copied';
    clearTimeout(this.copied);
    this.copied = setTimeout(() => {
      this.copied = undefined;
      this.renderLabels();
    }, 1500);
  }

  /** The colours the charts draw with, off the element's tokens. */
  private palette(): Palette {
    const computed = getComputedStyle(this);
    const token = (name: string, fallback: string): string =>
      computed.getPropertyValue(name).trim() || fallback;
    return {
      ink: token('--mbx-text', '#f2f3f5'),
      muted: token('--mbx-muted', '#9aa0a6'),
      accent: token('--mbx-accent', '#5b8cff'),
      warn: token('--mbx-chart-3', '#d9a83f'),
      series: [1, 2, 3, 4, 5].map((i) => token(`--mbx-chart-${i}`, '#888')),
    };
  }

  private draw(): void {
    const player = this.player;
    if (player === null || this.panel.hidden || this.tab !== 'charts') return;
    this.charts.draw({
      tab: this.chartTab,
      window: Number(this.windowSelect.value) || WINDOW,
      samples: this.sampler.samples,
      marks: this.sampler.marks,
      counters: this.sampler.counters,
      video: player.video,
      engine: player.engine,
      palette: this.palette(),
    });
  }

  /** The page shown, from the facts of the moment. */
  private paint(): void {
    const player = this.player;
    if (player === null || this.panel.hidden) return;
    switch (this.tab) {
      case 'playback':
        this.sections(this.pages.playback, this.playbackSections(player));
        break;
      case 'engine':
        this.sections(this.pages.engine, this.engineSections(player.engine));
        break;
      case 'browser':
        this.browser();
        break;
      default:
        break;
    }
  }

  private playbackSections(player: PlayerHost): Section[] {
    const video = player.video;
    const engine = player.engine;
    const quality = video.getVideoPlaybackQuality?.();
    const counters = this.sampler.counters;
    const last = this.sampler.samples[this.sampler.samples.length - 1];
    const state = video.paused ? (video.ended ? 'ended' : 'paused') : 'playing';
    const source: Pair[] = [
      ['source', player.getAttribute('src') ?? '–'],
      ['type', player.getAttribute('type') ?? '–'],
      ['handler', player.player?.session?.handler ?? '–'],
    ];
    if (engine !== null) source.push(['phase', engine.stats.snapshot().lifecycle.phase]);
    if (player.error !== null) {
      source.push(['error', `${player.error.category}: ${player.error.code}`]);
    } else if (video.error !== null) {
      source.push(['media error', `${video.error.code} ${video.error.message}`]);
    }
    const playback: Pair[] = [
      ['time', `${clock(video.currentTime)} of ${clock(video.duration)}`],
      [
        'state',
        `${state}, ${READY_STATES[video.readyState] ?? video.readyState}, network ${NETWORK_STATES[video.networkState] ?? video.networkState}`,
      ],
      ['rate', `${video.playbackRate}×`],
      ['picture', video.videoWidth > 0 ? `${video.videoWidth}×${video.videoHeight}` : '–'],
      [
        'frames',
        quality === undefined
          ? '–'
          : `${quality.totalVideoFrames} decoded, ${quality.droppedVideoFrames} dropped (${share(quality.droppedVideoFrames, quality.totalVideoFrames)})`,
      ],
      ['buffered', `${fixed(last?.ahead ?? 0)}s ahead: ${ranges(playbackRanges(video))}`],
      ['stalls', `${counters.stalls}, ${counters.stalledSeconds.toFixed(1)}s in total`],
    ];
    if (engine !== null) {
      const snapshot = engine.stats.snapshot();
      playback.push(
        [
          'throughput',
          `slow ${bitrate(snapshot.stats.throughputEwma)}, fast ${bitrate(snapshot.stats.throughputFastEwma)}`,
        ],
        ['playing', rendition(engine.quality.playing)],
        ['switches', String(counters.switches)],
      );
    }
    return [
      { title: 'Source', rows: source },
      { title: 'Playback', rows: playback },
    ];
  }

  private engineSections(engine: Mattebox | null): Section[] {
    if (engine === null) {
      return [
        {
          title: null,
          rows: [],
          note: 'A native session: the browser plays this, and there is no engine to ask.',
        },
      ];
    }
    const state = engine.stats.snapshot();
    const optional = engine as Namespaces;
    const live = state.live;
    const rows: Pair[] = [
      ['capabilities', [...engine.capabilities()].join(', ') || 'none'],
      ['phase', state.lifecycle.phase],
      ['buffer goal', `${state.scheduling.bufferGoal}s`],
      [
        'throughput',
        `slow ${bitrate(state.stats.throughputEwma)}, fast ${bitrate(state.stats.throughputFastEwma)}`,
      ],
      [
        'in flight',
        [...state.scheduling.inflight.values()].map((r) => `${r.trackId} #${r.seq}`).join(', ') ||
          'none',
      ],
      [
        'live',
        live === null
          ? 'VOD'
          : `window ${clock(live.span.start)} to ${clock(live.span.end)}, edge ${clock(live.edge)}${
              optional.live?.latency === null || optional.live?.latency === undefined
                ? ''
                : `, ${optional.live.latency.toFixed(1)}s behind`
            }`,
      ],
      ['trace', `${engine.stats.trace().length} entries`],
    ];
    const error = engine.error;
    if (error !== null) rows.push(['last error', `${error.category}: ${error.code}`]);

    const buffers: Pair[] = [...state.buffers.entries()].map(([id, buffer]) => [
      id.replace('sb:', ''),
      `${buffer.codecs}: ${ranges(buffer.ranges)}${buffer.pendingAppends > 0 ? `, ${buffer.pendingAppends} pending` : ''}`,
    ]);

    const tracks: Pair[] = engine.tracks.available.map((track) => {
      const active = engine.tracks.active(track.contentType)?.id === track.id;
      const name = [track.lang, track.role].filter((v) => v !== undefined).join(' · ');
      return [
        `${track.contentType}${active ? ' ●' : ''}`,
        `${track.id}${name === '' ? '' : ` (${name})`}, ${track.renditions.length} renditions`,
      ];
    });

    const playing = engine.quality.playing?.id ?? null;
    const active = engine.quality.active?.id ?? null;
    const allowed = new Set(engine.quality.allowed.map((r) => r.id));
    const renditions: Pair[] = engine.quality.renditions.map((r) => {
      const flags = [
        r.id === playing ? 'playing' : '',
        r.id === active && active !== playing ? 'next' : '',
        r.id === engine.quality.pinned ? 'pinned' : '',
        allowed.has(r.id) ? '' : 'capped',
      ].filter((f) => f !== '');
      const size = r.width !== undefined && r.height !== undefined ? `${r.width}×${r.height}` : '';
      const text = [
        size,
        bitrate(r.bitrate),
        r.frameRate === undefined ? '' : `${r.frameRate} fps`,
        r.codecs ?? '',
      ]
        .filter((v) => v !== '')
        .join(', ');
      return [r.id, `${text}${flags.length > 0 ? ` [${flags.join(', ')}]` : ''}`];
    });

    const drm: Pair[] =
      optional.drm === undefined
        ? []
        : [
            ['key system', optional.drm.keySystem ?? 'none yet'],
            [
              'keys',
              optional.drm.sessions.length === 0
                ? 'none yet'
                : optional.drm.sessions.map((s) => `${s.keyId}: ${s.status}`).join(', '),
            ],
          ];

    return [
      { title: 'Engine', rows },
      {
        title: 'Source buffers',
        rows: buffers,
        note: buffers.length === 0 ? 'none yet' : undefined,
      },
      { title: 'Tracks', rows: tracks, note: tracks.length === 0 ? 'none yet' : undefined },
      {
        title: 'Renditions',
        rows: renditions,
        note: renditions.length === 0 ? 'none yet' : undefined,
      },
      ...(optional.drm === undefined ? [] : [{ title: 'DRM', rows: drm }]),
    ];
  }

  /**
   * Draws sections into a page, reusing what is there: a heading and a
   * list per section, a row per pair, texts replaced only where they
   * changed, so a page open for an hour neither flickers nor grows.
   */
  private sections(page: HTMLElement, sections: readonly Section[]): void {
    const wanted = sections.flatMap((section) => {
      const nodes: Array<['heading' | 'note' | 'rows', string | readonly Pair[]]> = [];
      if (section.title !== null) nodes.push(['heading', section.title]);
      if (section.note !== undefined && section.rows.length === 0)
        nodes.push(['note', section.note]);
      else nodes.push(['rows', section.rows]);
      return nodes;
    });
    while (page.childElementCount > wanted.length) page.lastElementChild?.remove();
    wanted.forEach(([kind, content], i) => {
      let node = page.children[i] as HTMLElement | undefined;
      const tag = kind === 'heading' ? 'h3' : kind === 'note' ? 'p' : 'dl';
      if (node === undefined || node.localName !== tag) {
        const fresh = el(tag, kind);
        if (node === undefined) page.append(fresh);
        else node.replaceWith(fresh);
        node = fresh;
      }
      if (typeof content === 'string') {
        if (node.textContent !== content) node.textContent = content;
        return;
      }
      // Rows: a key and a value each, as children of the list in pairs.
      while (node.childElementCount > content.length * 2) node.lastElementChild?.remove();
      content.forEach(([key, value], j) => {
        let dt = node.children[j * 2] as HTMLElement | undefined;
        let dd = node.children[j * 2 + 1] as HTMLElement | undefined;
        if (dt === undefined || dd === undefined) {
          dt = el('dt', 'key');
          dd = el('dd', 'value');
          node.append(dt, dd);
        }
        if (dt.textContent !== key) dt.textContent = key;
        if (dd.textContent !== value) dd.textContent = value;
      });
    });
  }

  /** The browser page: probed once, the first time it is shown, then a set of tables. */
  private browser(): void {
    const page = this.pages.browser;
    if (this.support !== null || this.probing) return;
    this.probing = true;
    page.replaceChildren(el('p', 'note', 'Probing the browser…'));
    void probeSupport().then((support) => {
      this.support = support;
      this.probing = false;
      this.tables(page, support);
    });
  }

  private tables(page: HTMLElement, support: Support): void {
    page.replaceChildren();
    page.append(el('h3', 'heading', 'Platform'), el('p', 'note', support.userAgent));
    const platform = el('table', 'table');
    for (const row of support.platform) {
      const tr = document.createElement('tr');
      const [text, part] = cell(row.value);
      tr.append(el('th', 'cell label', row.label), el('td', part, text));
      platform.append(tr);
    }
    page.append(platform);

    page.append(el('h3', 'heading', 'Codecs'));
    const codecs = el('table', 'table');
    const head = document.createElement('tr');
    for (const name of ['Codec', 'MSE fMP4', 'MSE WebM', '<video>', 'Smooth', 'Efficient']) {
      head.append(el('th', 'cell label', name));
    }
    codecs.append(head);
    for (const row of support.codecs) {
      const tr = document.createElement('tr');
      const label = el('th', 'cell label', row.label);
      label.title = row.codec;
      tr.append(label);
      for (const value of [row.mse, row.webm, row.element, row.smooth, row.efficient]) {
        const [text, part] = cell(value);
        tr.append(el('td', part, text));
      }
      codecs.append(tr);
    }
    page.append(codecs);

    page.append(el('h3', 'heading', 'DRM'));
    const drm = el('table', 'table');
    const drmHead = document.createElement('tr');
    for (const name of [
      'System',
      'Available',
      'Level',
      'Schemes',
      'Persistent',
      'Identifier',
      'HDCP',
    ]) {
      drmHead.append(el('th', 'cell label', name));
    }
    drm.append(drmHead);
    for (const row of support.drm) {
      const tr = document.createElement('tr');
      const label = el('th', 'cell label', row.label);
      if (row.keySystem !== null) label.title = row.keySystem;
      tr.append(label);
      const values: Cell[] = [
        row.keySystem === null ? 'no' : 'yes',
        row.level,
        row.schemes,
        row.persistent,
        row.identifier,
        row.hdcp,
      ];
      for (const value of values) {
        const [text, part] = cell(value);
        tr.append(el('td', part, text));
      }
      drm.append(tr);
    }
    page.append(drm);
  }
}

function playbackRanges(video: HTMLVideoElement): Array<{ start: number; end: number }> {
  return Array.from({ length: video.buffered.length }, (_, i) => ({
    start: video.buffered.start(i),
    end: video.buffered.end(i),
  }));
}
