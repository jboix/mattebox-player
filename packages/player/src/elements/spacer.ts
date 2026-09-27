/** <mbx-spacer>: takes the room in a row, so what follows sits at the far end. */
import { style } from './shared.js';
import STYLE from './spacer.css?inline';

export class MbxSpacer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).append(style(STYLE));
  }
}
