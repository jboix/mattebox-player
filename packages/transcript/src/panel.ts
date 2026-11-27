/**
 * <mbx-transcript>: the subtitles of the programme as a list of lines, in a
 * panel over the player. One line for each cue, in time order. The line
 * that is spoken is marked and kept in view, and a press on a line seeks
 * to it.
 *
 * The lines come from the engine's `transcript` stage, which reads a text
 * track apart from playback. They load as the viewer needs them: around
 * the playhead when the panel opens, further as the list is scrolled, and
 * all of them at the first character of a search. They are held in memory
 * for the source that plays, and nowhere else.
 *
 * The language is the one the subtitles show, else the player's, else the
 * viewer's. The menu in the header picks another, which changes the panel
 * and not the subtitles. The panel follows the subtitles again when the
 * viewer changes them.
 *
 * A range that must not play shows one row in place of its lines. Their
 * text is not in the page, and a search does not find it.
 *
 * `search` takes a page's own search, such as a call to a search engine.
 * The panel then asks it for the matches and never loads every line.
 *
 * The element carries `unavailable` where there is nothing it can read:
 * no text track with segments of its own, a live stream, Safari's own HLS.
 * It does not open then, and its button hides.
 */
import type { Messages, PlayerHost } from '@mattebox/player';
import type { Mattebox } from 'mattebox';
import type {} from 'mattebox/stages/transcript';
import BUTTON_STYLE from './button.css?inline';
import { choose } from './choose.js';
import type { IconName } from './icons.js';
import { icon } from './icons.js';
import type { Line, Row, Span } from './lines.js';
import { clock, lineAt, toLines, toRows, within } from './lines.js';
import type { Loader } from './loader.js';
import { createLoader, missing } from './loader.js';
import PANEL_STYLE from './panel.css?inline';
import type { TranscriptMatch, TranscriptSearch } from './search.js';
import { nearest, occurrences, searchLines } from './search.js';
import { button, el, fill, style, TranscriptControl } from './ui.js';

/** A text track of the engine. */
type Track = Mattebox['tracks']['available'][number];

/** The name the panel gives its matches on the seek bar. */
const OWNER = 'transcript';
/** How long the viewer stops typing before a page's own search is asked. */
const DEBOUNCE_MS = 300;
/** How long after the viewer's last scroll the list follows the playhead again. */
const BROWSE_MS = 5000;
/** Seconds ahead of the playhead that are loaded while the panel is open. */
const AHEAD = 30;
/** The least time between two loads the playhead asks for, so a failing server is not asked at each tick. */
const RETRY_MS = 2000;

/** A row's node, with what it was drawn from. */
interface Drawn {
  readonly sign: string;
  readonly node: HTMLLIElement;
}

/** The key of a line among the rows. */
function lineKey(line: Line): string {
  return `l|${line.start}|${line.end}|${line.text}`;
}

/** The key of a row among the rows. */
function rowKey(row: Row): string {
  return row.kind === 'line' ? lineKey(row.line) : `${row.kind}|${row.span.start}`;
}

/** The language's name in `locale`, with a capital first letter, or undefined. */
function languageName(lang: string, locale: string): string | undefined {
  try {
    const names = new (Intl as { DisplayNames: typeof Intl.DisplayNames }).DisplayNames(
      locale === '' ? undefined : locale,
      { type: 'language', fallback: 'none' },
    );
    const name = names.of(lang) as string;
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return undefined;
  }
}

/** Whether the viewer asked for less motion. */
function still(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class MbxTranscript extends TranscriptControl {
  static get observedAttributes(): readonly string[] {
    return [
      'open',
      'label',
      'label-close',
      'label-language',
      'label-subtitles',
      'label-none',
      'label-track',
      'label-search',
      'label-previous',
      'label-next',
      'label-count',
      'label-no-match',
      'label-search-failed',
      'label-blocked',
      'label-range',
      'label-more',
      'label-loading',
      'label-partial',
      'label-choose',
      'label-empty',
    ];
  }

  declare private readonly header: HTMLElement;
  declare private readonly heading: HTMLElement;
  declare private readonly close: HTMLButtonElement;
  /** The language menu: its button and its popup. */
  declare private readonly language: HTMLElement;
  declare private readonly chooser: HTMLButtonElement;
  declare private readonly chosen: HTMLElement;
  declare private readonly popup: HTMLElement;
  /** The search row. */
  declare private readonly tools: HTMLElement;
  declare private readonly field: HTMLInputElement;
  declare private readonly count: HTMLElement;
  declare private readonly previous: HTMLButtonElement;
  declare private readonly next: HTMLButtonElement;
  declare private readonly list: HTMLOListElement;
  /** Under the list: what a search does not cover yet. */
  declare private readonly status: HTMLElement;

  declare private engine: Mattebox | null;
  /** The text tracks the panel can read. */
  declare private tracks: readonly Track[];
  /** Whether the language is the subtitles' and not a pick in the panel. */
  declare private follows: boolean;
  /** The viewer's pick in the panel, a track id, or null for no language. */
  declare private picked: string | null;
  /** The subtitles' track as last seen, to tell a change of it from other track events. */
  declare private subtitles: string | null;
  /** The track whose lines show. */
  declare private shown: string | null;
  /** The programme's length the loader was made for. */
  declare private length: number;
  declare private loader: Loader | null;
  /** The lines loaded, without those of the ranges that must not play. */
  declare private lines: readonly Line[];
  declare private nodes: Map<string, Drawn>;
  /** The key of the line that is spoken. */
  declare private spoken: string | null;
  /** Whether the list was placed at the playhead since it last got its first lines. */
  declare private settled: boolean;
  /** The text searched for, trimmed. */
  declare private query: string;
  declare private found: readonly TranscriptMatch[];
  /** The match the viewer is at, an index into `found`. */
  declare private at: number;
  declare private searching: 'idle' | 'busy' | 'failed';
  declare private asking: AbortController | null;
  declare private timer: ReturnType<typeof setTimeout> | undefined;
  declare private finder: TranscriptSearch | null;
  /** Whether the current match is brought into view at the next draw. */
  declare private jump: boolean;
  /** Until when the viewer is reading elsewhere in the list, as a clock time. */
  declare private browsing: number;
  /** When the playhead last asked for lines, as a clock time. */
  declare private asked: number;
  /** The last direction the list was scrolled: 1 is down. */
  declare private direction: number;
  declare private top: number;
  declare private leave: (() => void) | null;
  declare private watcher: IntersectionObserver | null;
  declare private gaps: Map<Element, Span>;
  declare private away: ((event: Event) => void) | null;

  constructor() {
    super();
    this.engine = null;
    this.tracks = [];
    this.follows = true;
    this.picked = null;
    this.subtitles = null;
    this.shown = null;
    this.length = 0;
    this.loader = null;
    this.lines = [];
    this.nodes = new Map();
    this.spoken = null;
    this.settled = false;
    this.query = '';
    this.found = [];
    this.at = -1;
    this.searching = 'idle';
    this.asking = null;
    this.timer = undefined;
    this.finder = null;
    this.jump = false;
    this.browsing = 0;
    this.asked = 0;
    this.direction = 1;
    this.top = 0;
    this.leave = null;
    this.watcher = null;
    this.gaps = new Map();
    this.away = null;

    const root = this.attachShadow({ mode: 'open' });
    this.header = el('div', 'header');
    this.heading = el('div', 'heading');
    this.language = el('div', 'language');
    this.chooser = button('chooser');
    this.chooser.setAttribute('aria-haspopup', 'menu');
    this.chooser.setAttribute('aria-expanded', 'false');
    this.chosen = el('span', 'chosen');
    this.chooser.append(this.chosen, icon('down'));
    this.popup = el('div', 'popup');
    this.popup.setAttribute('role', 'menu');
    this.popup.hidden = true;
    this.language.append(this.chooser, this.popup);
    this.close = this.control('close', () => {
      this.dismiss();
    });
    this.close.setAttribute('part', 'button close');
    this.header.append(this.heading, this.language, this.close);

    this.tools = el('div', 'tools');
    const box = el('div', 'search');
    this.field = el('input', 'field');
    this.field.type = 'search';
    this.field.autocomplete = 'off';
    this.field.spellcheck = false;
    this.count = el('span', 'count');
    // Read out when it changes: a screen reader hears how many lines match.
    this.count.setAttribute('role', 'status');
    box.append(this.field, this.count);
    this.previous = this.control('up', () => {
      this.step(-1);
    });
    this.next = this.control('down', () => {
      this.step(1);
    });
    this.tools.append(box, this.previous, this.next);

    this.list = el('ol', 'list');
    this.status = el('div', 'status');
    this.status.hidden = true;
    root.append(style(BUTTON_STYLE + PANEL_STYLE), this.header, this.tools, this.list, this.status);
    this.wire();
  }

  /** A page's own search, in place of the panel's. Null takes the panel's again. */
  get search(): TranscriptSearch | null {
    return this.finder;
  }

  set search(value: TranscriptSearch | null) {
    this.finder = typeof value === 'function' ? value : null;
    if (this.player !== null) this.typed();
  }

  override connectedCallback(): void {
    // A `search` set before the element was defined is the instance's own
    // property, which hides the accessor: it goes through the setter now.
    if (Object.getOwnPropertyDescriptor(this, 'search') !== undefined) {
      const own = (this as { search: TranscriptSearch | null }).search;
      delete (this as { search?: TranscriptSearch | null }).search;
      this.search = own;
    }
    super.connectedCallback();
  }

  override disconnectedCallback(): void {
    this.player?.spots.set(OWNER, []);
    super.disconnectedCallback();
    this.forget();
    this.engine = null;
  }

  override attributeChangedCallback(name: string): void {
    if (name === 'open') {
      if (this.hasAttribute('open')) this.opened();
      else this.closed();
    }
    super.attributeChangedCallback(name);
  }

  /** A button of the panel with its glyph, doing `act` on a press. */
  private control(glyph: IconName, act: () => void): HTMLButtonElement {
    const node = button('button');
    node.append(icon(glyph));
    node.addEventListener('click', act);
    return node;
  }

  /** The listeners of the panel's own nodes, which live as long as the element. */
  private wire(): void {
    // On a compact player the host covers the player: a press beside the sheet closes it.
    this.addEventListener('click', (event) => {
      if (event.composedPath()[0] === this) this.dismiss();
    });
    this.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' && event.key !== 'GoBack') return;
      event.preventDefault();
      event.stopPropagation();
      if (!this.popup.hidden) this.unfold(false, true);
      else if (this.field.value !== '' && event.composedPath().includes(this.field)) {
        this.field.value = '';
        this.typed();
      } else this.dismiss();
    });
    // The player's shortcuts are not for a letter typed in the field, nor
    // for an arrow that moves through the menu or the lines.
    const leaves = (key: string): boolean => key === 'Escape' || key === 'GoBack' || key === 'Tab';
    const moves = (key: string): boolean =>
      key.startsWith('Arrow') || key === 'Home' || key === 'End';
    this.tools.addEventListener('keydown', (event) => {
      if (!leaves(event.key)) event.stopPropagation();
    });
    for (const node of [this.header, this.list]) {
      node.addEventListener('keydown', (event) => {
        if (moves(event.key)) event.stopPropagation();
      });
    }
    this.chooser.addEventListener('click', () => {
      this.unfold(this.popup.hidden, false);
    });
    this.chooser.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      this.unfold(true, true);
    });
    this.popup.addEventListener('keydown', (event) => {
      this.roam(event);
    });
    this.field.addEventListener('input', () => {
      this.typed();
    });
    this.field.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      this.step(event.shiftKey ? -1 : 1);
    });
    this.list.addEventListener('keydown', (event) => {
      this.walk(event);
    });
    // The viewer reads elsewhere: the list stops following the playhead for a while.
    const browse = (): void => {
      this.browsing = Date.now() + BROWSE_MS;
    };
    for (const name of ['wheel', 'touchmove', 'pointerdown', 'keydown']) {
      this.list.addEventListener(name, browse, { passive: true });
    }
    this.list.addEventListener(
      'scroll',
      () => {
        const top = this.list.scrollTop;
        if (top !== this.top) this.direction = top > this.top ? 1 : -1;
        this.top = top;
      },
      { passive: true },
    );
    if (typeof IntersectionObserver !== 'undefined') {
      // A part that is not loaded loads when its row scrolls into view.
      this.watcher = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const span = this.gaps.get(entry.target);
            if (entry.isIntersecting && span !== undefined) this.more(span, false);
          }
        },
        { root: this.list },
      );
    }
  }

  protected override attach(player: PlayerHost): void {
    let off: (() => void) | undefined;
    const run = (): void => {
      off?.();
      this.forget();
      const engine = player.engine;
      this.engine = engine;
      this.subtitles = engine?.tracks.active('text')?.id ?? null;
      if (engine !== null) {
        const offs = [
          engine.on('tracks:changed', () => {
            this.sync();
          }),
          engine.on('tracks:selected', () => {
            this.selected();
          }),
        ];
        off = () => {
          for (const each of offs) each();
        };
      } else off = undefined;
      this.sync();
    };
    player.addEventListener('sourcechange', run);
    const media = player.media;
    const tick = (): void => {
      this.tick();
    };
    const sync = (): void => {
      this.sync();
    };
    const marked = (): void => {
      this.arrived();
    };
    const place = (): void => {
      if (this.hasAttribute('open')) this.place(true);
    };
    media.addEventListener('timeupdate', tick);
    media.addEventListener('seeked', tick);
    media.addEventListener('durationchange', sync);
    player.addEventListener('markerschange', marked);
    player.addEventListener('layoutchange', place);
    this.keep(() => {
      off?.();
      player.removeEventListener('sourcechange', run);
      media.removeEventListener('timeupdate', tick);
      media.removeEventListener('seeked', tick);
      media.removeEventListener('durationchange', sync);
      player.removeEventListener('markerschange', marked);
      player.removeEventListener('layoutchange', place);
      this.place(false);
    });
    run();
    place();
  }

  /** Another source plays: nothing of the last one is kept. */
  private forget(): void {
    this.loader?.stop();
    this.loader = null;
    this.lines = [];
    this.shown = null;
    this.length = 0;
    this.follows = true;
    this.picked = null;
    this.subtitles = null;
    this.tracks = [];
    this.field.value = '';
    this.quit();
  }

  /** The ranges that must not play. */
  private blocked(): Span[] {
    return (this.player?.markers.list ?? []).filter((marker) => marker.kind === 'blocked');
  }

  /** The viewer changed a track: when it is the subtitles, the panel follows them again. */
  private selected(): void {
    const now = this.engine?.tracks.active('text')?.id ?? null;
    if (now !== this.subtitles) {
      this.subtitles = now;
      this.follows = true;
    }
    this.sync();
  }

  /** Reads what the engine offers, and starts the lines of the language to show. */
  private sync(): void {
    const player = this.player;
    if (player === null) return;
    const engine = this.engine;
    const api = engine?.transcript;
    const every = engine?.tracks.available ?? [];
    const tracks: Track[] = [];
    for (const id of api?.tracks ?? []) {
      const track = every.find((each) => each.id === id);
      // Forced subtitles hold only what is not in the viewer's language.
      if (track !== undefined && track.forced !== true) tracks.push(track);
    }
    this.tracks = tracks;
    const live = (engine as { live?: { edge: unknown } } | null)?.live;
    const available = tracks.length > 0 && (live === undefined || live.edge === null);
    this.toggleAttribute('unavailable', !available);
    if (!available && this.hasAttribute('open')) this.removeAttribute('open');

    if (!this.follows && this.picked !== null && !tracks.some((t) => t.id === this.picked)) {
      this.follows = true;
    }
    const showing = engine?.tracks.active('text')?.id ?? null;
    const languages = [player.locale, ...(navigator.languages ?? [navigator.language])];
    const wanted = !available
      ? null
      : this.follows
        ? choose(tracks, showing, languages)
        : this.picked;
    const duration = player.media.duration;
    const length = Number.isFinite(duration) ? duration : 0;
    // The length settles by a fraction of a second as the media loads: the lines stay.
    const same =
      wanted === this.shown &&
      (this.loader !== null ? Math.abs(length - this.length) <= 1 : length === 0);
    if (!same) {
      this.loader?.stop();
      this.loader = null;
      this.lines = [];
      this.shown = wanted;
      this.length = length;
      this.settled = false;
      if (wanted !== null && length > 0 && api !== undefined) {
        this.loader = createLoader(
          async (range) => {
            const cues = await api.cues(wanted, range);
            // The words of a range that must not play are dropped as they arrive.
            const blocked = this.blocked();
            return cues.filter((cue) => !within(cue.start, blocked));
          },
          length,
          () => {
            this.arrived();
          },
        );
        if (this.hasAttribute('open')) this.near();
      }
      // The matches were of the other language.
      this.typed();
    }
    this.refresh();
  }

  /** Loads the lines around the playhead. */
  private near(): void {
    const time = this.player?.media.currentTime ?? 0;
    this.asked = Date.now();
    void this.loader?.around(time);
  }

  /** Lines arrived, or the ranges that must not play changed. */
  private arrived(): void {
    const blocked = this.blocked();
    this.lines = toLines(this.loader?.cues ?? []).filter((line) => !within(line.start, blocked));
    if (this.query !== '' && this.finder === null) {
      this.settle(searchLines(this.lines, this.query), true);
    } else if (this.found.length > 0) {
      const kept = this.found.filter((match) => !within(match.time, blocked));
      if (kept.length !== this.found.length) this.settle(kept, true);
    }
    this.draw();
    this.tally();
  }

  /** The playhead moved: the spoken line, and the lines ahead of it. */
  private tick(): void {
    this.mark(true);
    const loader = this.loader;
    const player = this.player;
    if (loader === null || player === null || !this.hasAttribute('open')) return;
    const time = player.media.currentTime;
    const ahead = { start: time, end: Math.min(this.length, time + AHEAD) };
    if (missing(ahead, loader.loaded).length === 0) return;
    if (Date.now() - this.asked < RETRY_MS) return;
    this.near();
  }

  /** Loads a part that is not loaded, next to the lines the viewer came from. */
  private more(span: Span, pressed: boolean): void {
    const loader = this.loader;
    if (loader === null) return;
    // A row in view asks by itself; after a failure only a press asks again.
    if (!pressed && (loader.loaded.length === 0 || loader.failed)) return;
    const above = loader.loaded.some((part) => part.end === span.start);
    const below = loader.loaded.some((part) => part.start === span.end);
    const side = above && below ? (this.direction >= 0 ? 'start' : 'end') : below ? 'end' : 'start';
    void loader.into(span, side);
    this.draw();
  }

  private opened(): void {
    // One panel at a time over the picture.
    this.player?.querySelector('mbx-playlist[open]')?.removeAttribute('open');
    this.settled = false;
    this.browsing = 0;
    this.place(true);
    this.sync();
    this.near();
    this.publish();
  }

  private closed(): void {
    this.unfold(false, false);
    this.place(false);
    this.publish();
  }

  /**
   * Puts the panel where the player shows it: in a drawer over the page
   * when a compact player asks for one with `drawer`, else in the player.
   * The element carries `in-drawer` while its parts are there. An open
   * panel takes the focus.
   */
  private place(open: boolean): void {
    this.leave?.();
    const drawer = open ? this.player?.drawer : undefined;
    this.leave =
      drawer?.call(this.player, [this.header, this.tools, this.list, this.status], {
        label: this.heading.textContent ?? '',
        dismiss: () => {
          this.dismiss();
        },
      }) ?? null;
    this.toggleAttribute('in-drawer', this.leave !== null);
    if (open) this.close.focus();
  }

  /** Closes the panel and gives focus back to the button that opens it. */
  private dismiss(): void {
    this.removeAttribute('open');
    const opener = this.player?.querySelector('mbx-transcript-button');
    opener?.shadowRoot?.querySelector('button')?.focus();
  }

  /** Opens or closes the language menu; `focus` moves it to the picked item, or back to the button. */
  private unfold(open: boolean, focus: boolean): void {
    if (this.popup.hidden === !open) return;
    this.popup.hidden = !open;
    this.chooser.setAttribute('aria-expanded', String(open));
    if (this.away !== null) {
      document.removeEventListener('pointerdown', this.away, true);
      this.away = null;
    }
    if (!open) {
      if (focus) this.chooser.focus();
      return;
    }
    // A press beside the menu closes it.
    this.away = (event) => {
      if (!event.composedPath().includes(this.language)) this.unfold(false, false);
    };
    document.addEventListener('pointerdown', this.away, true);
    const picked = this.popup.querySelector<HTMLElement>('[aria-checked="true"]');
    (picked ?? this.popup.querySelector<HTMLElement>('button'))?.focus();
  }

  /** Up and down move between the menu's items; Tab leaves it. */
  private roam(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      this.unfold(false, false);
      return;
    }
    const items = Array.from(this.popup.querySelectorAll('button'));
    const at = items.indexOf(this.shadowRoot?.activeElement as HTMLButtonElement);
    const to =
      event.key === 'ArrowDown'
        ? at + 1
        : event.key === 'ArrowUp'
          ? at - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : -2;
    if (to === -2) return;
    event.preventDefault();
    items[(to + items.length) % items.length]?.focus();
  }

  /** Up and down move between the rows of the list. */
  private walk(event: KeyboardEvent): void {
    const by = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (by === 0) return;
    const items = Array.from(this.list.querySelectorAll('button'));
    const root = this.list.getRootNode() as ShadowRoot;
    const at = items.indexOf(root.activeElement as HTMLButtonElement);
    const next = items[Math.min(items.length - 1, Math.max(0, at + by))];
    if (next === undefined) return;
    event.preventDefault();
    next.focus();
  }

  /** The viewer's pick in the menu. It changes the panel and not the subtitles. */
  private pick(id: string | null): void {
    const showing = this.engine?.tracks.active('text')?.id ?? null;
    // The subtitles' own language: the panel follows them again.
    this.follows = id !== null && id === showing;
    this.picked = id;
    this.unfold(false, true);
    this.sync();
  }

  /** The field changed, or what it searches did. */
  private typed(): void {
    clearTimeout(this.timer);
    this.asking?.abort();
    this.asking = null;
    const query = this.field.value.trim();
    if (query === '' || this.shown === null) {
      this.quit();
      this.draw();
      this.tally();
      return;
    }
    if (this.finder === null) {
      this.query = query;
      this.searching = 'idle';
      // The panel's own search needs every line.
      void this.loader?.all(this.player?.media.currentTime ?? 0);
      this.settle(searchLines(this.lines, query), false);
      this.draw();
      this.tally();
      return;
    }
    this.searching = 'busy';
    this.tally();
    this.timer = setTimeout(() => {
      void this.ask(query);
    }, DEBOUNCE_MS);
  }

  /** Asks the page's own search, and takes its answer unless the viewer typed on. */
  private async ask(query: string): Promise<void> {
    const finder = this.finder;
    if (finder === null) return;
    const control = new AbortController();
    this.asking = control;
    const track = this.tracks.find((each) => each.id === this.shown);
    let matches: readonly TranscriptMatch[] = [];
    let failed = false;
    try {
      matches = await finder(query, {
        language: track?.lang ?? '',
        signal: control.signal,
        local: async () => {
          await this.loader?.all(this.player?.media.currentTime ?? 0);
          return searchLines(this.lines, query);
        },
      });
    } catch {
      failed = true;
    }
    if (control.signal.aborted) return;
    this.asking = null;
    this.query = query;
    this.searching = failed ? 'failed' : 'idle';
    const blocked = this.blocked();
    this.settle(
      (Array.isArray(matches) ? matches : [])
        .filter((match) => Number.isFinite(match.time) && !within(match.time, blocked))
        .sort((a, b) => a.time - b.time),
      false,
    );
    this.draw();
    this.tally();
  }

  /**
   * Takes the matches of the search. With `keep`, the viewer stays at the
   * match they were at, as when more lines load under a search; without,
   * they go to the first match from the playhead on.
   */
  private settle(matches: readonly TranscriptMatch[], keep: boolean): void {
    const was = this.found[this.at]?.time;
    this.found = matches;
    const same = keep && was !== undefined ? matches.findIndex((m) => m.time === was) : -1;
    if (same !== -1) this.at = same;
    else {
      this.at = nearest(matches, this.player?.media.currentTime ?? 0);
      if (!keep || was === undefined) this.go();
    }
    this.publish();
  }

  /** Ends the search. */
  private quit(): void {
    clearTimeout(this.timer);
    this.asking?.abort();
    this.asking = null;
    this.query = '';
    this.found = [];
    this.at = -1;
    this.searching = 'idle';
    this.jump = false;
    this.publish();
  }

  /** To the next match, or the previous, around the ends. */
  private step(by: number): void {
    const count = this.found.length;
    if (count === 0) return;
    this.at = (this.at + by + count) % count;
    this.go();
    this.publish();
    this.draw();
    this.tally();
  }

  /** Brings the current match into view, loading the lines around it first when they are not there. */
  private go(): void {
    const match = this.found[this.at];
    if (match === undefined) return;
    this.jump = true;
    void this.loader?.around(match.time);
  }

  /** The matches on the seek bar, while the panel is open. */
  private publish(): void {
    const shown = this.hasAttribute('open') && this.query !== '';
    this.player?.spots.set(
      OWNER,
      shown
        ? this.found.map((match, index) =>
            index === this.at ? { time: match.time, current: true } : { time: match.time },
          )
        : [],
    );
  }

  /** The line a match points at: the one that starts there, else the one spoken then. */
  private target(time: number): Line | null {
    const exact = this.lines.find((line) => Math.abs(line.start - time) < 0.5);
    if (exact !== undefined) return exact;
    // The last line before a part still to load is not the line spoken then.
    return within(time, this.loader?.loaded ?? []) ? lineAt(this.lines, time) : null;
  }

  /** The count beside the field, the two step buttons, and the note under the list. */
  private tally(): void {
    const word = (name: string, id: keyof Messages, english: string): string =>
      this.word(`label-${name}`, id, english);
    const local = this.finder === null;
    const loading = (this.loader?.pending ?? 0) > 0;
    let text = '';
    if (this.query !== '' || this.searching !== 'idle') {
      if (this.searching === 'failed') {
        text = word('search-failed', 'transcriptSearchFailed', 'Search is not available');
      } else if (this.searching === 'busy') text = '';
      else if (this.found.length > 0) {
        text = fill(word('count', 'transcriptCount', '{at} of {count}'), {
          at: this.at + 1,
          count: this.found.length,
        });
      } else if (!local || !loading) text = word('no-match', 'transcriptNoMatch', 'No match');
    }
    if (this.count.textContent !== text) this.count.textContent = text;
    this.previous.disabled = this.found.length === 0;
    this.next.disabled = this.found.length === 0;
    const partial = local && this.query !== '' && loading;
    this.status.hidden = !partial;
    this.status.textContent = partial
      ? word(
          'partial',
          'transcriptPartial',
          'Loading more lines. A search covers the lines loaded so far.',
        )
      : '';
  }

  protected render(): void {
    const word = (name: string, id: keyof Messages, english: string): string =>
      this.word(`label-${name}`, id, english);
    this.heading.textContent = this.word('label', 'transcript', 'Transcript');
    this.close.setAttribute('aria-label', word('close', 'transcriptClose', 'Close'));
    const search = word('search', 'transcriptSearch', 'Search');
    this.field.placeholder = search;
    this.field.setAttribute('aria-label', search);
    this.previous.setAttribute(
      'aria-label',
      word('previous', 'transcriptPrevious', 'Previous match'),
    );
    this.next.setAttribute('aria-label', word('next', 'transcriptNext', 'Next match'));
    // The words of the rows changed with the language: they are drawn again.
    this.nodes = new Map();
    this.refresh();
  }

  /** Draws what changes with the tracks, the lines and the search. */
  private refresh(): void {
    this.menu();
    this.draw();
    this.tally();
  }

  /** The names of the tracks, each told apart from a twin by its place. */
  private names(): string[] {
    const locale = this.player?.locale ?? '';
    const track = this.word('label-track', 'transcriptTrack', 'Track');
    const names = this.tracks.map(
      (each, index) =>
        each.name ||
        (each.lang !== undefined && each.lang !== ''
          ? (languageName(each.lang, locale) ?? each.lang)
          : `${track} ${index + 1}`),
    );
    return names.map((name, index) =>
      names.some((other, at) => at !== index && other === name) ? `${name} (${index + 1})` : name,
    );
  }

  /** The language menu: the tracks, then no language. */
  private menu(): void {
    const none = this.word('label-none', 'transcriptNone', 'None');
    const subtitles = this.word('label-subtitles', 'transcriptSubtitles', 'Subtitles');
    const language = this.word('label-language', 'transcriptLanguage', 'Language');
    const showing = this.engine?.tracks.active('text')?.id ?? null;
    const names = this.names();
    const item = (id: string | null, name: string): HTMLButtonElement => {
      const node = button('item');
      node.setAttribute('role', 'menuitemradio');
      node.setAttribute('aria-checked', String(id === this.shown));
      node.append(el('span', 'item-text', name));
      if (id !== null && id === showing) node.append(el('span', 'item-detail', subtitles));
      node.addEventListener('click', () => {
        this.pick(id);
      });
      return node;
    };
    const open = !this.popup.hidden;
    const first = el('div', 'section');
    this.tracks.forEach((track, index) => {
      first.append(item(track.id, names[index] as string));
    });
    const last = el('div', 'section');
    last.append(item(null, none));
    while (this.popup.firstChild !== null) this.popup.firstChild.remove();
    this.popup.append(first, last);
    const at = this.tracks.findIndex((track) => track.id === this.shown);
    const name = at === -1 ? none : (names[at] as string);
    this.chosen.textContent = name;
    this.chooser.setAttribute('aria-label', `${language}: ${name}`);
    if (open) this.popup.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }

  /** The rows of the list, with the nodes of the rows that did not change kept as they are. */
  private draw(): void {
    const word = (name: string, id: keyof Messages, english: string): string =>
      this.word(`label-${name}`, id, english);
    const loader = this.loader;
    const rows =
      loader === null || this.shown === null
        ? []
        : toRows(this.lines, loader.loaded, this.blocked(), this.length);
    const loading = (loader?.pending ?? 0) > 0;
    // A page's own search names lines; the panel's finds the text in them.
    const hits = new Set<string>();
    if (this.query !== '' && this.finder !== null) {
      for (const match of this.found) {
        const line = this.target(match.time);
        if (line !== null) hits.add(lineKey(line));
      }
    }
    const next = new Map<string, Drawn>();
    const wanted: HTMLLIElement[] = [];
    for (const row of rows) {
      const key = rowKey(row);
      let sign: string;
      if (row.kind === 'line') {
        const marked =
          this.query !== '' &&
          (this.finder === null || hits.has(key)) &&
          occurrences(row.line.text, this.query).length > 0;
        sign = marked ? `m|${this.query}` : hits.has(key) ? 'h' : '';
      } else sign = `${row.span.end}|${row.kind === 'gap' && loading}`;
      const old = this.nodes.get(key);
      const drawn =
        old !== undefined && old.sign === sign ? old : { sign, node: this.row(row, sign) };
      next.set(key, drawn);
      wanted.push(drawn.node);
    }
    if (wanted.length === 0) {
      const text =
        this.shown === null
          ? word('choose', 'transcriptChoose', 'Choose a language to read the transcript.')
          : loader === null || loading || loader.loaded.length === 0
            ? word('loading', 'transcriptLoading', 'Loading more lines')
            : word('empty', 'transcriptEmpty', 'This language has no lines.');
      wanted.push(el('li', 'note', text));
    }

    // The line the viewer reads stays where it is while lines arrive above it.
    const root = this.list.getRootNode() as ShadowRoot | Document;
    const focused = root.activeElement?.parentElement ?? null;
    let anchor: { key: string; offset: number } | null = null;
    for (const [key, drawn] of this.nodes) {
      const node = drawn.node;
      if (!key.startsWith('l|') || node.parentNode !== this.list) continue;
      const top = this.topOf(node);
      if (top + node.offsetHeight > this.list.scrollTop) {
        anchor = { key, offset: top - this.list.scrollTop };
        break;
      }
    }
    let focus: string | null = null;
    for (const [key, drawn] of this.nodes) if (drawn.node === focused) focus = key;
    for (const node of Array.from(this.gaps.keys())) {
      if (wanted.includes(node as HTMLLIElement)) continue;
      this.watcher?.unobserve(node);
      this.gaps.delete(node);
    }
    wanted.forEach((node, index) => {
      const here = this.list.children[index] ?? null;
      if (here !== node) this.list.insertBefore(node, here);
    });
    while (this.list.children.length > wanted.length) this.list.lastElementChild?.remove();
    this.nodes = next;
    for (const [node] of this.gaps) this.watcher?.observe(node);

    if (focus !== null) {
      const node = next.get(focus)?.node;
      if (node !== undefined && node !== focused) node.querySelector('button')?.focus();
    }
    const kept = anchor === null ? undefined : next.get(anchor.key)?.node;
    if (this.settled && anchor !== null && kept !== undefined) {
      this.list.scrollTop = this.topOf(kept) - anchor.offset;
    }
    this.spoken = null;
    this.mark(false);
    this.point();
    if (!this.settled && this.lines.length > 0 && this.hasAttribute('open')) {
      this.settled = true;
      if (this.query === '') this.show(this.spokenNode() ?? this.nearNode(), false);
    }
  }

  /** The node of a row. */
  private row(row: Row, sign: string): HTMLLIElement {
    const word = (name: string, id: keyof Messages, english: string): string =>
      this.word(`label-${name}`, id, english);
    if (row.kind === 'blocked') {
      const node = el('li', 'blocked');
      const text = el('span', 'blocked-text');
      text.append(
        el(
          'span',
          'blocked-label',
          word('blocked', 'transcriptBlocked', 'This part is not available'),
        ),
        el(
          'span',
          'blocked-range',
          fill(word('range', 'transcriptRange', '{start} to {end}'), {
            start: clock(row.span.start),
            end: clock(row.span.end),
          }),
        ),
      );
      node.append(icon('blocked'), text);
      return node;
    }
    if (row.kind === 'gap') {
      const node = el('li', 'gap');
      const loading = sign.endsWith('true');
      const press = button(
        'more',
        loading
          ? word('loading', 'transcriptLoading', 'Loading more lines')
          : word('more', 'transcriptMore', 'Load more lines'),
      );
      press.disabled = loading;
      press.addEventListener('click', () => {
        this.more(row.span, true);
      });
      node.append(press);
      this.gaps.set(node, row.span);
      return node;
    }
    const line = row.line;
    const node = el('li', 'row');
    const press = button(sign === 'h' ? 'line hit' : 'line');
    const text = el('span', 'text');
    if (line.speaker !== undefined) text.append(el('span', 'speaker', line.speaker), ' ');
    let from = 0;
    for (const [start, end] of sign.startsWith('m|') ? occurrences(line.text, this.query) : []) {
      text.append(line.text.slice(from, start), el('mark', 'match', line.text.slice(start, end)));
      from = end;
    }
    text.append(line.text.slice(from));
    press.append(el('span', 'time', clock(line.start)), text);
    press.addEventListener('click', () => {
      const player = this.player;
      if (player === null) return;
      player.media.currentTime = line.start;
      // The viewer chose where to be: the list follows the playhead from there.
      this.browsing = 0;
    });
    node.append(press);
    return node;
  }

  /** The node of the line that is spoken, when its part is loaded. */
  private spokenNode(): HTMLLIElement | null {
    const time = this.player?.media.currentTime ?? 0;
    if (!within(time, this.loader?.loaded ?? [])) return null;
    const line = lineAt(this.lines, time);
    return line === null ? null : (this.nodes.get(lineKey(line))?.node ?? null);
  }

  /** The node of the first line from the playhead on, else of the last line. */
  private nearNode(): HTMLLIElement | null {
    const time = this.player?.media.currentTime ?? 0;
    const line = this.lines.find((each) => each.start >= time) ?? this.lines[this.lines.length - 1];
    return line === undefined ? null : (this.nodes.get(lineKey(line))?.node ?? null);
  }

  /** Marks the line that is spoken; with `follow`, keeps it in view while the viewer reads along. */
  private mark(follow: boolean): void {
    const node = this.spokenNode();
    const key = node === null ? null : this.keyOf(node);
    if (key === this.spoken) return;
    this.spoken = key;
    for (const old of Array.from(this.list.querySelectorAll('[aria-current]'))) {
      if (old.parentElement !== node) old.removeAttribute('aria-current');
    }
    node?.querySelector('button')?.setAttribute('aria-current', 'true');
    const reading =
      follow && this.hasAttribute('open') && this.query === '' && Date.now() > this.browsing;
    if (reading && node !== null) this.show(node, true);
  }

  /** The key a node was drawn for. */
  private keyOf(node: HTMLLIElement): string | null {
    for (const [key, drawn] of this.nodes) if (drawn.node === node) return key;
    return null;
  }

  /** Marks the line of the current match, and brings it into view after a step to it. */
  private point(): void {
    const match = this.found[this.at];
    const line = match === undefined ? null : this.target(match.time);
    const node = line === null ? null : (this.nodes.get(lineKey(line))?.node ?? null);
    for (const old of Array.from(this.list.querySelectorAll('[data-current]'))) {
      if (old.parentElement !== node) old.removeAttribute('data-current');
    }
    const press = node?.querySelector('button') ?? null;
    press?.setAttribute('data-current', '');
    if (this.jump && node !== null) {
      this.jump = false;
      this.show(node, true);
    }
  }

  /**
   * Where `node` starts in the list's content. Measured, because the list
   * is not always the offset parent of its rows: the drawer lays it out
   * as a static box.
   */
  private topOf(node: HTMLElement): number {
    const list = this.list;
    return (
      node.getBoundingClientRect().top -
      list.getBoundingClientRect().top -
      list.clientTop +
      list.scrollTop
    );
  }

  /** Scrolls the list so `node` is at its middle. */
  private show(node: HTMLElement | null, smooth: boolean): void {
    if (node === null) return;
    const top = Math.max(0, this.topOf(node) - (this.list.clientHeight - node.offsetHeight) / 2);
    if (typeof this.list.scrollTo === 'function') {
      this.list.scrollTo({ top, behavior: smooth && !still() ? 'smooth' : 'auto' });
    } else this.list.scrollTop = top;
  }
}
