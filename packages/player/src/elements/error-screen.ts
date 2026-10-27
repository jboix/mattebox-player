/**
 * <mbx-error-screen>: a fatal error over the picture, with the category,
 * the code and a retry. It sits in the player beside the video, hidden
 * until the player reports a fatal error, and clears when a session
 * arrives, a resource starts loading, or playback resumes: an error over
 * a picture that then plays is wrong by definition. The title comes from `label-title`, the button's text
 * from `label-retry`.
 *
 * Retry calls the player's `retry()`, which loads the sources again from
 * the first, whether they came from `src`, `sources` or `<source>` children.
 *
 * It also shows the page's `block()`: its title, else `label-blocked`, and
 * its message, with no retry, since a retry cannot lift a block.
 */
import type { PlayerError } from '@mattebox/player-core';
import { el } from '../dom.js';
import type { Block, PlayerHost } from '../host.js';
import { Component } from './component.js';
import STYLE from './error-screen.css?inline';
import { style } from './shared.js';

export class MbxErrorScreen extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label-title', 'label-retry', 'label-blocked'];
  }

  declare private readonly title_: HTMLElement;
  declare private readonly category: HTMLElement;
  declare private readonly code: HTMLElement;
  declare private readonly detail: HTMLElement;
  declare private readonly message: HTMLElement;
  declare private readonly retry: HTMLButtonElement;
  /** The block shown, or null for an error. */
  declare private block: Block | null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const box = el('div', 'box');
    this.title_ = el('div', 'title');
    this.category = el('span', 'category');
    this.code = el('span', 'code');
    this.detail = el('div', 'detail');
    this.detail.append(this.category, el('span', 'separator', ' · '), this.code);
    this.message = el('div', 'message');
    this.block = null;
    this.retry = el('button', 'retry');
    this.retry.type = 'button';
    this.retry.addEventListener('click', () => {
      this.player?.retry();
    });
    box.append(this.title_, this.detail, this.message, this.retry);
    root.append(style(STYLE), box);
  }

  /** Hidden and named before attaching: a constructor must not add attributes. */
  override connectedCallback(): void {
    if (this.player === null) this.hidden = true;
    if (!this.hasAttribute('role')) this.setAttribute('role', 'alert');
    super.connectedCallback();
  }

  private show(error: PlayerError): void {
    this.block = null;
    this.category.textContent = error.category;
    this.code.textContent = error.code;
    this.render();
    this.hidden = false;
  }

  /** Shows `block`, or hides the screen for null. */
  private showBlock(block: Block | null): void {
    this.block = block;
    this.render();
    this.hidden = block === null;
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
      if (this.block === null) this.hidden = true;
    });
    this.listen(player, ['sourcechange'], () => {
      if (this.block === null) this.hidden = true;
    });
    this.listen(player, ['blockchange'], () => {
      this.showBlock(player.blocked);
    });
    // The error or the block may have come before this element did.
    if (player.error !== null) this.show(player.error);
    if (player.blocked !== null) this.showBlock(player.blocked);
    this.render();
  }

  protected override detach(): void {
    this.hidden = true;
  }

  protected override render(): void {
    const block = this.block;
    this.detail.hidden = block !== null;
    this.retry.hidden = block !== null;
    this.message.hidden = block?.message === undefined;
    if (block === null) {
      this.title_.textContent = this.word('label-title', 'playbackFailed', 'Playback failed');
      this.retry.textContent = this.word('label-retry', 'retry', 'Retry');
      return;
    }
    this.title_.textContent =
      block.title === undefined
        ? this.word('label-blocked', 'blocked', 'Not available')
        : this.pageText(block.title);
    this.message.textContent = block.message === undefined ? '' : this.pageText(block.message);
  }
}
