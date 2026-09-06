/**
 * <mattebox-player>: a real <video> as a light-DOM child, so the integrator
 * can reach it, and the player's own panels in shadow DOM. The element never
 * forwards or wraps a media element member: play, pause, seek, and the rest
 * live on the video.
 *
 * No class fields, `#private` or otherwise: the ES2015 build would lower
 * them into runtime helpers, and the emit check bans helpers. Statics are
 * getters and instance state is declared, then assigned in the constructor.
 */
const TAG = 'mattebox-player';

/** Attributes forwarded onto the video as attributes, never as properties. */
const FORWARDED = ['autoplay', 'muted', 'poster'] as const;

export class MatteboxPlayerElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return FORWARDED;
  }

  /** Registers the element once. Safe to call after the package already did. */
  static define(): void {
    if (customElements.get(TAG) === undefined) customElements.define(TAG, MatteboxPlayerElement);
  }

  declare private readonly media: HTMLVideoElement;

  constructor() {
    super();
    this.media = document.createElement('video');
    // Native controls in v1. The panels cover only what the element cannot show.
    this.media.controls = true;
    this.attachShadow({ mode: 'open' }).innerHTML =
      '<style>:host{display:block;position:relative}::slotted(video){display:block;width:100%}</style><slot></slot>';
  }

  /** The media element. Everything the browser already does is here. */
  get video(): HTMLVideoElement {
    return this.media;
  }

  connectedCallback(): void {
    if (this.media.parentNode !== this) this.append(this.media);
    for (const name of FORWARDED) this.forward(name);
  }

  attributeChangedCallback(name: string): void {
    this.forward(name);
  }

  private forward(name: string): void {
    const value = this.getAttribute(name);
    if (value === null) this.media.removeAttribute(name);
    else this.media.setAttribute(name, value);
  }
}
