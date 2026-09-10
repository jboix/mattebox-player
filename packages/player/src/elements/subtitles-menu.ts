/**
 * <mbx-subtitles-menu>: the text track over `engine.tracks`, with "off"
 * because a text selection is releasable and an audio one is not, and a
 * Settings page behind it with the size and the background. The glyph
 * says whether a track is on: `icon` or `icon-on`. Hidden without text
 * tracks, and for a native session.
 *
 * The looks are attributes on the player, `subtitle-size` and
 * `subtitle-background`, where the element's stylesheet turns them into
 * the cue rules; a page can set them in markup and persist them however
 * it likes. Every word the menu shows is an attribute: `label`,
 * `label-off`, `label-track`, `label-settings`, `label-size`,
 * `label-background`, one per size and one per background.
 */
import type { Mattebox } from 'mattebox';
import { icon } from '../controls/icons.js';
import type { MenuGroup } from '../controls/menu.js';
import type { PlayerHost } from '../host.js';
import { onTracks, trackItems } from './audio-menu.js';
import { MenuElement } from './menu-element.js';
import { show } from './shared.js';

const OFF = 'off';
export const SUBTITLE_SIZE = 'subtitle-size';
export const SUBTITLE_BACKGROUND = 'subtitle-background';

const SIZES: ReadonlyArray<readonly [string, string]> = [
  ['small', 'Small'],
  ['medium', 'Medium'],
  ['large', 'Large'],
  ['xlarge', 'Extra large'],
];
const BACKGROUNDS: ReadonlyArray<readonly [string, string]> = [
  ['none', 'None'],
  ['dark', 'Dark'],
  ['solid', 'Solid'],
];

type State = 'off' | 'on';
const STATES: readonly State[] = ['off', 'on'];

export class MbxSubtitlesMenu extends MenuElement<State> {
  static get observedAttributes(): readonly string[] {
    return [
      'label',
      'label-back',
      'label-off',
      'label-track',
      'label-settings',
      'label-size',
      'label-background',
      ...SIZES.map(([id]) => `label-${id}`),
      ...BACKGROUNDS.map(([id]) => `label-${id}`),
    ];
  }

  declare private engine: Mattebox | null;

  constructor() {
    super(STATES, (state) => icon(state === 'on' ? 'closed-captions-on' : 'closed-captions'));
    this.engine = null;
    show(this.slots, 'off');
  }

  protected override name(): string {
    return 'Subtitles';
  }

  /** A look's group: the choices named from the attributes, the value from the player's. */
  private looks(
    player: PlayerHost,
    attribute: string,
    name: string,
    fallback: string,
    choices: ReadonlyArray<readonly [string, string]>,
    initial: string,
  ): MenuGroup {
    const set = player.getAttribute(attribute);
    const value = set !== null && choices.some(([id]) => id === set) ? set : initial;
    return {
      name,
      label: this.getAttribute(`label-${name}`) ?? fallback,
      items: choices.map(([id, text]) => [id, this.getAttribute(`label-${id}`) ?? text]),
      value,
      onSelect: (chosen) => {
        player.setAttribute(attribute, chosen);
        this.render();
      },
    };
  }

  protected override attach(player: PlayerHost): void {
    this.follow(player, (engine) => {
      this.engine = engine;
      this.render();
      if (engine === null) return undefined;
      return onTracks(engine, () => {
        this.render();
      });
    });
  }

  protected override render(): void {
    super.render();
    const engine = this.engine;
    const player = this.player;
    if (engine === null || player === null) {
      this.hidden = true;
      return;
    }
    const [tracks, active] = trackItems(engine, 'text');
    const items: Array<readonly [string, string]> = [
      [OFF, this.getAttribute('label-off') ?? 'Off'],
      ...tracks,
    ];
    this.menu.fill([
      {
        name: 'track',
        label: this.getAttribute('label-track') ?? 'Track',
        items,
        value: active ?? OFF,
        onSelect: (value) => {
          if (value === OFF) engine.tracks.deselect('text');
          else engine.tracks.select(value);
          this.render();
        },
      },
      {
        name: 'settings',
        label: this.getAttribute('label-settings') ?? 'Settings',
        entries: [
          this.looks(player, SUBTITLE_SIZE, 'size', 'Size', SIZES, 'medium'),
          this.looks(player, SUBTITLE_BACKGROUND, 'background', 'Background', BACKGROUNDS, 'dark'),
        ],
      },
    ]);
    show(this.slots, active === null ? 'off' : 'on');
    this.hidden = tracks.length === 0;
  }
}
