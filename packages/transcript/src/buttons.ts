/**
 * <mbx-transcript-button>: opens and closes the transcript of its player.
 * It reads pressed while the transcript is open. Hidden without an
 * `<mbx-transcript>` in the player, and where that element has nothing it
 * can read. The glyph is the default content of the `icon` slot.
 */
import BUTTON_STYLE from './button.css?inline';
import { icon } from './icons.js';
import type {} from './messages.js';
import { button, style, TranscriptControl } from './ui.js';

export class MbxTranscriptButton extends TranscriptControl {
  static get observedAttributes(): readonly string[] {
    return ['label'];
  }

  declare private readonly button: HTMLButtonElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    this.button = button('button');
    const slot = document.createElement('slot');
    slot.name = 'icon';
    slot.append(icon('transcript'));
    this.button.append(slot);
    this.button.addEventListener('click', () => {
      const panel = this.panel();
      if (panel !== null && !panel.hasAttribute('unavailable')) panel.toggleAttribute('open');
    });
    root.append(style(BUTTON_STYLE), this.button);
  }

  /** The transcript of the player. */
  private panel(): HTMLElement | null {
    return this.player?.querySelector('mbx-transcript') ?? null;
  }

  protected override attach(): void {
    const panel = this.panel();
    if (panel === null) return;
    // The transcript says by its attributes whether it is open and whether it can open.
    const watcher = new MutationObserver(() => {
      this.render();
    });
    watcher.observe(panel, { attributes: true, attributeFilter: ['open', 'unavailable'] });
    this.keep(() => {
      watcher.disconnect();
    });
  }

  protected render(): void {
    const panel = this.panel();
    const open = panel?.hasAttribute('open') === true;
    this.button.setAttribute('aria-label', this.word('label', 'transcript', 'Transcript'));
    this.button.setAttribute('aria-expanded', String(open));
    this.button.setAttribute('aria-pressed', String(open));
    this.hidden = panel === null || panel.hasAttribute('unavailable');
  }
}
