/**
 * The playlist in markup: <mbx-playlist> in the player, with one
 * <mbx-playlist-item> child per item. The element finds or makes the
 * player's playlist, so a page's script and its markup drive the same one.
 * It is also the list a viewer opens: over the right of the picture, with
 * shuffle, repeat, previous and next, and one row per item. `open` shows it.
 *
 * - The children are the items, in order. Adding, removing or changing one
 *   updates the list, and the item that plays keeps playing.
 * - `repeat` is `none`, `all` or `one`; `shuffle` is a boolean attribute;
 *   `autoadvance="off"` stops at the end of each item.
 * - `pause-on-open` pauses the video while the list is open, and plays it
 *   again on close unless the viewer picked an item.
 * - An item's `markers` attribute is its markers as JSON, such as
 *   `[{"start":640,"end":734,"kind":"closing-credits"}]`.
 * - Without children, the list is a script's, and the element shows it.
 */
import BUTTON_STYLE from './button.css?inline';
import type { IconName } from './icons.js';
import { icon } from './icons.js';
import PANEL_STYLE from './panel.css?inline';
import type { PlaylistItem, RepeatMode } from './playlist.js';
import { createPlaylist } from './playlist.js';
import { button, el, format, PlaylistControl, setChildren, style } from './ui.js';

/** The fields an item reads from its attributes, by attribute name. Numbers are parsed. */
const FIELDS: ReadonlyArray<readonly [string, keyof PlaylistItem]> = [
  ['src', 'src'],
  ['type', 'type'],
  ['poster', 'poster'],
  ['heading', 'heading'],
  ['subheading', 'subheading'],
  ['artwork', 'artwork'],
  ['thumbnails', 'thumbnails'],
  ['chapters', 'chapters'],
  ['license-url', 'licenseUrl'],
  ['certificate-url', 'certificateUrl'],
  ['start-time', 'startTime'],
  ['duration', 'duration'],
];
const NUMBERS = new Set<keyof PlaylistItem>(['startTime', 'duration']);

/** <mbx-playlist-item>: one item, in attributes; `markers` is JSON. It draws nothing. */
export class MbxPlaylistItem extends HTMLElement {
  /** The item these attributes describe, or null without a `src`. */
  get item(): PlaylistItem | null {
    if (!this.hasAttribute('src')) return null;
    const item: Record<string, unknown> = {};
    for (const [name, field] of FIELDS) {
      const value = this.getAttribute(name);
      if (value === null) continue;
      if (!NUMBERS.has(field)) item[field] = value;
      else if (Number.isFinite(Number(value))) item[field] = Number(value);
    }
    // Markers are a list: JSON in the attribute, the same shape the script takes.
    try {
      const markers = JSON.parse(this.getAttribute('markers') ?? 'null') as unknown;
      if (Array.isArray(markers)) item.markers = markers;
    } catch {
      // Not JSON: the item plays without markers.
    }
    return item as unknown as PlaylistItem;
  }
}

/** <mbx-playlist>: the player's playlist, from its children and its attributes, and its list. */
export class MbxPlaylist extends PlaylistControl {
  static get observedAttributes(): readonly string[] {
    return [
      'repeat',
      'shuffle',
      'autoadvance',
      'open',
      'label',
      'label-close',
      'label-shuffle',
      'label-repeat-off',
      'label-repeat-all',
      'label-repeat-one',
      'label-previous',
      'label-next',
      'pause-on-open',
    ];
  }

  declare private watcher: MutationObserver | null;
  /** Whether opening paused the video, so closing plays it again. */
  declare private paused: boolean;
  /** Whether the children ever gave items: only then do they own the list. */
  declare private markup: boolean;
  declare private readonly heading: HTMLElement;
  declare private readonly close: HTMLButtonElement;
  declare private readonly shuffle: HTMLButtonElement;
  declare private readonly repeat: HTMLButtonElement;
  declare private readonly badge: HTMLElement;
  declare private readonly previous: HTMLButtonElement;
  declare private readonly next: HTMLButtonElement;
  declare private readonly list: HTMLOListElement;

  constructor() {
    super();
    this.watcher = null;
    this.paused = false;
    this.markup = false;
    const root = this.attachShadow({ mode: 'open' });
    const header = el('div', 'header');
    this.heading = el('div', 'heading');
    this.close = this.control('close', () => {
      this.dismiss();
    });
    header.append(this.heading, this.close);
    const controls = el('div', 'controls');
    this.shuffle = this.control('shuffle', () => {
      if (this.playlist !== null) this.playlist.shuffle = !this.playlist.shuffle;
    });
    this.repeat = this.control('repeat', () => {
      this.playlist?.toggleRepeat();
    });
    this.badge = el('span', 'badge', '1');
    this.repeat.append(this.badge);
    this.previous = this.control('previous', () => {
      this.playlist?.previous();
    });
    this.next = this.control('next', () => {
      this.playlist?.next();
    });
    controls.append(this.shuffle, this.repeat, this.previous, this.next);
    this.list = el('ol', 'list');
    this.list.addEventListener('keydown', (event) => {
      this.step(event);
    });
    root.append(style(BUTTON_STYLE + PANEL_STYLE), header, controls, this.list);
    // On a compact player the host covers the page: a press beside the list closes it.
    this.addEventListener('click', (event) => {
      if (event.composedPath()[0] === this) this.dismiss();
    });
    this.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' && event.key !== 'GoBack') return;
      event.preventDefault();
      event.stopPropagation();
      this.dismiss();
    });
  }

  /** A button of the panel with its glyph, doing `act` on a press. */
  private control(glyph: IconName, act: () => void): HTMLButtonElement {
    const node = button('button');
    node.append(icon(glyph));
    node.addEventListener('click', act);
    return node;
  }

  protected override attach(): void {
    this.options();
    this.read(true);
    // The children's own changes, not the element's attributes, which `open` is one of.
    this.watcher = new MutationObserver((records) => {
      if (records.some((record) => record.type === 'childList' || record.target !== this)) {
        this.read(false);
      }
    });
    this.watcher.observe(this, { childList: true, subtree: true, attributes: true });
    this.keep(() => {
      this.watcher?.disconnect();
      this.watcher = null;
    });
  }

  override attributeChangedCallback(name: string): void {
    if (name === 'repeat' || name === 'shuffle' || name === 'autoadvance') this.options();
    else if (name === 'open') {
      if (this.hasAttribute('open')) this.opened();
      else this.closed();
    }
    super.attributeChangedCallback(name);
  }

  private opened(): void {
    // `pause-on-open`: the list holds the viewer's attention, so playback waits.
    const video = this.player?.video;
    this.paused = this.hasAttribute('pause-on-open') && video !== undefined && !video.paused;
    if (this.paused) video?.pause();
    const current = this.list.querySelector<HTMLButtonElement>('[aria-current="true"]');
    (current ?? this.close).focus();
  }

  /** Playback that the list paused plays again, however the list closed. */
  private closed(): void {
    if (this.paused) this.player?.video.play().catch(() => undefined);
    this.paused = false;
  }

  /**
   * Closes the list and gives focus back to the button that opens it. A
   * picked item plays by itself, so nothing resumes.
   */
  private dismiss(picked = false): void {
    if (picked) this.paused = false;
    this.removeAttribute('open');
    const opener = this.player?.querySelector('mbx-playlist-button');
    opener?.shadowRoot?.querySelector('button')?.focus();
  }

  /** Up and down move between the items. */
  private step(event: KeyboardEvent): void {
    const by = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (by === 0) return;
    const items = [...this.list.querySelectorAll('button')];
    const at = items.indexOf(this.shadowRoot?.activeElement as HTMLButtonElement);
    const next = items[Math.min(items.length - 1, Math.max(0, at + by))];
    if (next === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    next.focus();
  }

  protected render(): void {
    const word = (name: string, fallback: string): string =>
      this.getAttribute(`label-${name}`) ?? fallback;
    this.heading.textContent = this.getAttribute('label') ?? 'Playlist';
    this.close.setAttribute('aria-label', word('close', 'Close'));
    this.shuffle.setAttribute('aria-label', word('shuffle', 'Shuffle'));
    this.previous.setAttribute('aria-label', word('previous', 'Previous'));
    this.next.setAttribute('aria-label', word('next', 'Next'));
    const playlist = this.playlist;
    const mode = playlist?.repeat ?? 'none';
    this.repeat.setAttribute(
      'aria-label',
      mode === 'all'
        ? word('repeat-all', 'Repeat all')
        : mode === 'one'
          ? word('repeat-one', 'Repeat one')
          : word('repeat-off', 'Repeat off'),
    );
    this.repeat.setAttribute('aria-pressed', String(mode !== 'none'));
    this.badge.hidden = mode !== 'one';
    this.shuffle.setAttribute('aria-pressed', String(playlist?.shuffle === true));
    this.next.disabled = playlist?.hasNext() !== true;
    this.previous.disabled = (playlist?.items.length ?? 0) === 0;
    const rows = (playlist?.items ?? []).map((item, index) => {
      const row = el('li', 'row');
      const entry = button('item');
      if (index === playlist?.index) entry.setAttribute('aria-current', 'true');
      const picture = item.artwork ?? item.poster;
      if (picture !== undefined) {
        const image = el('img', 'item-image');
        image.src = picture;
        image.alt = '';
        image.loading = 'lazy';
        entry.append(image);
      }
      const text = el('span', 'item-text');
      text.append(el('span', 'item-title', item.heading ?? item.src));
      if (item.subheading !== undefined) text.append(el('span', 'item-subtitle', item.subheading));
      entry.append(text, el('span', 'item-duration', format(item.duration)));
      entry.addEventListener('click', () => {
        playlist?.select(index);
        this.dismiss(true);
      });
      row.append(entry);
      return row;
    });
    // Keep focus on the same row across a redraw: a keyboard viewer stays put.
    const focused = [...this.list.querySelectorAll('button')].indexOf(
      this.shadowRoot?.activeElement as HTMLButtonElement,
    );
    setChildren(this.list, rows);
    if (focused >= 0) this.list.querySelectorAll('button')[focused]?.focus();
  }

  /** The items of the children, in order. */
  private items(): PlaylistItem[] {
    const out: PlaylistItem[] = [];
    for (const child of Array.from(this.children)) {
      const item = child instanceof MbxPlaylistItem ? child.item : null;
      if (item !== null) out.push(item);
    }
    return out;
  }

  /**
   * Loads the children on connect; later, replaces the list and keeps what
   * plays. A list without children is a script's: the element only shows it.
   */
  private read(first: boolean): void {
    if (this.player === null) return;
    const items = this.items();
    if (items.length === 0 && !this.markup) {
      createPlaylist(this.player);
      return;
    }
    const playlist = createPlaylist(this.player);
    if (first || !this.markup) playlist.load(items);
    else playlist.splice(0, playlist.items.length, ...items);
    this.markup = true;
  }

  private options(): void {
    if (this.player === null) return;
    const repeat = this.getAttribute('repeat');
    createPlaylist(this.player, {
      ...(repeat === 'all' || repeat === 'one' || repeat === 'none'
        ? { repeat: repeat as RepeatMode }
        : {}),
      shuffle: this.hasAttribute('shuffle'),
      autoadvance: this.getAttribute('autoadvance') !== 'off',
    });
  }
}
