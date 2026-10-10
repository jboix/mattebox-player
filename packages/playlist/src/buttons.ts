/**
 * The playlist's buttons for the control bar:
 *
 * - <mbx-playlist-button> opens and closes the list, the player's
 *   <mbx-playlist>. Hidden without one, or without items.
 * - <mbx-previous-button> goes to the previous item, or back to the start
 *   of this one after its first seconds. Hidden without items.
 * - <mbx-next-button> goes to the next item. Hidden when there is none.
 *
 * The name of each comes from `label`; the glyph from the `icon` slot.
 */
import BUTTON_STYLE from './button.css?inline';
import type { IconName } from './icons.js';
import { icon } from './icons.js';
import { button, PlaylistControl, style } from './ui.js';

abstract class PlaylistButton extends PlaylistControl {
  static get observedAttributes(): readonly string[] {
    return ['label'];
  }

  declare protected readonly button: HTMLButtonElement;

  constructor(glyph: IconName) {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this.button = button('button');
    const slot = document.createElement('slot');
    slot.name = 'icon';
    slot.append(icon(glyph));
    this.button.append(slot);
    this.button.addEventListener('click', () => {
      this.press();
    });
    root.append(style(BUTTON_STYLE), this.button);
  }

  /** The name it has without a `label`. */
  protected abstract word(): string;

  protected abstract press(): void;

  /** Whether it shows, for the playlist as it stands. */
  protected abstract shown(): boolean;

  protected render(): void {
    this.button.setAttribute('aria-label', this.getAttribute('label') ?? this.word());
    this.hidden = !this.shown();
  }
}

export class MbxPlaylistButton extends PlaylistButton {
  constructor() {
    super('playlist');
  }

  /** The list this button opens: the player's <mbx-playlist>. */
  private list(): HTMLElement | null {
    return this.player?.querySelector('mbx-playlist') ?? null;
  }

  protected override attach(): void {
    const list = this.list();
    if (list === null) return;
    // The list opens and closes by its `open` attribute; follow it.
    const watcher = new MutationObserver(() => {
      this.render();
    });
    watcher.observe(list, { attributes: true, attributeFilter: ['open'] });
    this.keep(() => {
      watcher.disconnect();
    });
  }

  protected word(): string {
    return 'Playlist';
  }

  protected press(): void {
    const list = this.list();
    if (list !== null) list.toggleAttribute('open');
  }

  protected shown(): boolean {
    const list = this.list();
    this.button.setAttribute('aria-expanded', String(list?.hasAttribute('open') === true));
    return list !== null && (this.playlist?.items.length ?? 0) > 0;
  }
}

export class MbxPreviousButton extends PlaylistButton {
  constructor() {
    super('previous');
  }

  protected word(): string {
    return 'Previous';
  }

  protected press(): void {
    this.playlist?.previous();
  }

  protected shown(): boolean {
    return (this.playlist?.items.length ?? 0) > 0;
  }
}

export class MbxNextButton extends PlaylistButton {
  constructor() {
    super('next');
  }

  protected word(): string {
    return 'Next';
  }

  protected press(): void {
    this.playlist?.next();
  }

  protected shown(): boolean {
    return this.playlist?.hasNext() === true;
  }
}
