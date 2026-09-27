/**
 * <mbx-error-screen>: a fatal error over the picture, with the category,
 * the code and a retry. It sits in the player beside the video, hidden
 * until the player reports a fatal error, and clears when a session
 * arrives, a resource starts loading, or playback resumes: an error over
 * a picture that then plays is wrong by definition. The title comes from `label-title`, the button's text
 * from `label-retry`.
 *
 * Retry sets the player's `src` to its own value again, which is the one
 * public way to load a source again: the element reloads on every write
 * to `src`, equal or not.
 */
import type { PlayerError } from '@mattebox/player-core';
import { el } from '../dom.js';
import type { PlayerHost } from '../host.js';
import { Component } from './component.js';
import STYLE from './error-screen.css?inline';
import { style } from './shared.js';

export class MbxErrorScreen extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label-title', 'label-retry'];
  }

  declare private readonly title_: HTMLElement;
  declare private readonly category: HTMLElement;
  declare private readonly code: HTMLElement;
  declare private readonly retry: HTMLButtonElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const box = el('div', 'box');
    this.title_ = el('div', 'title');
    this.category = el('span', 'category');
    this.code = el('span', 'code');
    const detail = el('div', 'detail');
    detail.append(this.category, el('span', 'separator', ' · '), this.code);
    this.retry = el('button', 'retry');
    this.retry.type = 'button';
    this.retry.addEventListener('click', () => {
      const player = this.player;
      const src = player?.getAttribute('src');
      if (player !== null && player !== undefined && src !== null && src !== undefined) {
        player.setAttribute('src', src);
      }
    });
    box.append(this.title_, detail, this.retry);
    root.append(style(STYLE), box);
  }

  /** Hidden and named before attaching: a constructor must not add attributes. */
  override connectedCallback(): void {
    if (this.player === null) this.hidden = true;
    if (!this.hasAttribute('role')) this.setAttribute('role', 'alert');
    super.connectedCallback();
  }

  private show(error: PlayerError): void {
    this.category.textContent = error.category;
    this.code.textContent = error.code;
    this.hidden = false;
  }

  protected override attach(player: PlayerHost): void {
    const failure = (event: Event): void => {
      const error = (event as CustomEvent<PlayerError>).detail;
      if (error.fatal) this.show(error);
    };
    player.addEventListener('error', failure);
    this.keep(() => {
      player.removeEventListener('error', failure);
    });
    // Not `emptied`: the old session's teardown fires it after the new
    // source's error, and would hide the error it should leave.
    this.listen(player.video, ['playing', 'loadstart'], () => {
      this.hidden = true;
    });
    this.listen(player, ['sourcechange'], () => {
      this.hidden = true;
    });
    // The error may have come before this element did.
    if (player.error !== null) this.show(player.error);
    this.render();
  }

  protected override detach(): void {
    this.hidden = true;
  }

  protected override render(): void {
    this.title_.textContent = this.getAttribute('label-title') ?? 'Playback failed';
    this.retry.textContent = this.getAttribute('label-retry') ?? 'Retry';
  }
}
