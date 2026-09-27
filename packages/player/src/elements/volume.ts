/**
 * <mbx-volume>: the mute button with the slider unfolding from it under
 * the pointer or keyboard focus, the way a bar keeps its width for the
 * rest. The two are its children, in light DOM, so the page labels and
 * styles each; a group left empty fills itself with both. The slider
 * folds to nothing otherwise, and a page that wants it always out sets
 * its width on `mbx-volume-slider` itself.
 *
 * Keyboard focus, not any focus: a click leaves focus on the mute button,
 * and a slider that stayed out until something else took it would read as
 * stuck. So the group carries `pointer` from a pointer press until a key
 * is pressed or focus leaves, and focus unfolds the slider only without it.
 */
import { MUTE_BUTTON, VOLUME_SLIDER } from '../tags.js';
import { Component } from './component.js';
import { style } from './shared.js';
import STYLE from './volume.css?inline';

export class MbxVolume extends Component {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).append(style(STYLE), document.createElement('slot'));
  }

  /** Both parts, when the page wrote none: a constructor must not add children. */
  override connectedCallback(): void {
    if (this.childElementCount === 0) {
      this.append(document.createElement(MUTE_BUTTON), document.createElement(VOLUME_SLIDER));
    }
    super.connectedCallback();
  }

  protected override attach(): void {
    this.listen(this, ['pointerdown'], () => {
      this.toggleAttribute('pointer', true);
    });
    this.listen(this, ['keydown', 'focusout'], () => {
      this.removeAttribute('pointer');
    });
  }

  protected override detach(): void {
    this.removeAttribute('pointer');
  }
}
