/**
 * What the playlist's elements share: finding their player and its
 * playlist, letting go of them, and the small DOM helpers. The player
 * exports no base class, so a package of controls carries its own, as the
 * cast package does.
 *
 * No class fields: the ES2015 build would lower them into helpers. State is
 * declared, then assigned in the constructor.
 */
import type { PlayerHost } from '@mattebox/player';
import type { Playlist } from './playlist.js';
import { playlistOf } from './playlist.js';

export const PLAYER = 'mattebox-player';

/** The nearest player above `node`, through shadow hosts, or null. */
export function findPlayer(node: Node): HTMLElement | null {
  let current: Node | null = node;
  while (current !== null) {
    if (current instanceof HTMLElement && current.localName === PLAYER) return current;
    current = current.parentNode ?? (current instanceof ShadowRoot ? current.host : null);
  }
  return null;
}

/** A `<style>` with `text`, for a shadow root. */
export function style(text: string): HTMLStyleElement {
  const node = document.createElement('style');
  node.textContent = text;
  return node;
}

/** An element with its part names, and its text when it has any. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  part: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.setAttribute('part', part);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Replaces `parent`'s children; `replaceChildren` needs Chromium 86. */
export function setChildren(parent: Element, children: readonly Node[]): void {
  while (parent.firstChild !== null) parent.firstChild.remove();
  for (const child of children) parent.append(child);
}

/** A plain `<button>` with its part names. */
export function button(part: string): HTMLButtonElement {
  const node = el('button', part);
  node.type = 'button';
  return node;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** `m:ss`, or `h:mm:ss` from an hour up; empty for no length. */
export function format(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = `${hours > 0 ? pad(minutes) : minutes}:${pad(total % 60)}`;
  return hours > 0 ? `${hours}:${rest}` : rest;
}

/**
 * A control of the playlist: it attaches once its player is upgraded, and
 * follows the player's playlist, which a script or the markup may make
 * after the control connects. The player says so with a `playlist` event.
 */
export abstract class PlaylistControl extends HTMLElement {
  declare protected player: PlayerHost | null;
  declare protected playlist: Playlist | null;
  declare private offs: Array<() => void>;

  constructor() {
    super();
    this.player = null;
    this.playlist = null;
    this.offs = [];
  }

  connectedCallback(): void {
    const found = findPlayer(this.parentNode ?? this);
    if (found === null) return;
    void customElements.whenDefined(PLAYER).then(() => {
      if (!this.isConnected || this.player !== null) return;
      const player = found as unknown as PlayerHost;
      this.player = player;
      const render = (): void => {
        this.render();
      };
      let off = (): void => {};
      const follow = (): void => {
        off();
        this.playlist = playlistOf(player);
        this.playlist?.addEventListener('change', render);
        const playlist = this.playlist;
        off = () => playlist?.removeEventListener('change', render);
        this.render();
      };
      player.addEventListener('playlist', follow);
      this.offs.push(() => {
        off();
        player.removeEventListener('playlist', follow);
      });
      this.attach(player);
      follow();
    });
  }

  disconnectedCallback(): void {
    for (const off of this.offs.splice(0)) off();
    this.player = null;
    this.playlist = null;
  }

  attributeChangedCallback(_name?: string): void {
    if (this.player !== null) this.render();
  }

  /** Keeps `off` to run on disconnect. */
  protected keep(off: () => void): void {
    this.offs.push(off);
  }

  /** The control has its player; the playlist follows right after. */
  protected attach(_player: PlayerHost): void {}

  protected abstract render(): void;
}
