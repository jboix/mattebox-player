/** <mbx-spacer>: takes the room in a row, so what follows sits at the far end. */
import { style } from './shared.js';

export class MbxSpacer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).append(style(':host { display: block; flex: 1 1 auto; }'));
  }
}
