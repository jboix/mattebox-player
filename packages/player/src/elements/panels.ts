/**
 * <mbx-panels>: the row under the video for what native controls cannot
 * show. It sits in the player beside the video, in flow, so it lands
 * under the picture, and lays its children out in a row: the quality,
 * audio and subtitles menus, the live button, the lock. Each child hides
 * itself when its session has nothing for it, and the row hides when
 * every child has, so a native session shows no strip at all.
 */
import { Component } from './component.js';
import { style } from './shared.js';

const STYLE = `
:host {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--mbx-gap);
  padding: var(--mbx-pad);
  background: var(--mbx-surface);
  color: var(--mbx-text);
  font: 400 13px/1.4 var(--mbx-font);
}
:host([hidden]) { display: none; }
`;

export class MbxPanels extends Component {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.append(style(STYLE), document.createElement('slot'));
  }

  private empty(): boolean {
    return ![...this.children].some((child) => !(child as HTMLElement).hidden);
  }

  protected override attach(): void {
    const tick = (): void => {
      const empty = this.empty();
      // Only on a change: the observer sees the row's own attribute too, and
      // a write it did not need would wake it again without end.
      if (this.hidden !== empty) this.hidden = empty;
    };
    // The children say `hidden` on themselves; the row follows the last of them.
    const observer = new MutationObserver(tick);
    observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden'],
    });
    this.keep(() => {
      observer.disconnect();
    });
    tick();
  }
}
