/**
 * What the transcript's elements share: finding the player, the words, and
 * the small DOM helpers.
 */
import type { Messages, PlayerHost } from '@mattebox/player';
import type {} from './messages.js';

/** The player's tag: a control waits for its definition. */
const PLAYER = 'mattebox-player';

/** The player `node` is in, through shadow roots. Null outside a player. */
function findPlayer(node: Node): HTMLElement | null {
  let current: Node | null = node;
  while (current !== null) {
    if (current instanceof HTMLElement && current.localName === PLAYER) return current;
    current = current.parentNode ?? (current instanceof ShadowRoot ? current.host : null);
  }
  return null;
}

/** A `<style>` with `text`. */
export function style(text: string): HTMLStyleElement {
  const node = document.createElement('style');
  node.textContent = text;
  return node;
}

/** An element with its `part`, and its text when given. */
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

/** A button that submits no form. */
export function button(part: string, text?: string): HTMLButtonElement {
  const node = el('button', part, text);
  node.type = 'button';
  return node;
}

/** `text` with each `{name}` replaced by its value. */
export function fill(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

/**
 * A control of the transcript: it attaches once its player is upgraded,
 * carries the player's size tier in `layout`, and draws again when the
 * player's language changes.
 */
export abstract class TranscriptControl extends HTMLElement {
  declare protected player: PlayerHost | null;
  declare private offs: Array<() => void>;

  constructor() {
    super();
    this.player = null;
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
      // The player's size tier, on the control itself, for its stylesheet.
      const tier = (): void => {
        const layout = player.getAttribute('layout');
        if (layout === null) this.removeAttribute('layout');
        else this.setAttribute('layout', layout);
      };
      player.addEventListener('layoutchange', tier);
      player.addEventListener('localechange', render);
      this.offs.push(() => {
        player.removeEventListener('layoutchange', tier);
        player.removeEventListener('localechange', render);
      });
      tier();
      this.attach(player);
      this.render();
    });
  }

  disconnectedCallback(): void {
    for (const off of this.offs.splice(0)) off();
    this.player = null;
  }

  attributeChangedCallback(_name?: string): void {
    if (this.player !== null) this.render();
  }

  /**
   * A word the element shows: its `attribute` when the page set one, else
   * the player's language's `id`, else `english`.
   */
  protected word(attribute: string, id: keyof Messages, english: string): string {
    return this.getAttribute(attribute) ?? this.player?.message(id) ?? english;
  }

  /** Keeps `off` to run on disconnect. */
  protected keep(off: () => void): void {
    this.offs.push(off);
  }

  /** The control has its player. */
  protected attach(_player: PlayerHost): void {}

  /** Draws the words and what the control shows of the player. */
  protected abstract render(): void;
}
