/**
 * <mbx-subtitles-menu>: the text track over `engine.tracks`, or over the
 * video's `textTracks` of kind `subtitles` and `captions` for a native
 * session, with "off" because a text selection is releasable and an audio
 * one is not, and a Settings page behind it with the size and the
 * background. The glyph says whether a track is on: `icon` or `icon-on`.
 * Hidden without text tracks.
 *
 * The looks are attributes on the player, `subtitle-size` and
 * `subtitle-background`, where the element's stylesheet turns them into
 * the cue rules; a page can set them in markup and persist them however
 * it likes. Every word the menu shows is an attribute: `label`,
 * `label-off`, `label-track`, `label-settings`, `label-size`,
 * `label-background`, one per size and one per background, `label-sdh`
 * for the badge on subtitles for the deaf and hard of hearing, and
 * `label-cc` for the badge on closed captions carried in the video.
 * `label-track` also names a track that has no name and no language.
 *
 * Forced tracks are not listed. The engine's forced-subtitles stage shows
 * one while no subtitle is selected, so the menu reads Off then (guide
 * chapter 06). In a native session Safari shows them itself. A native
 * `captions` track carries the SDH badge: Safari gives that kind to the
 * subtitles that describe music and sound.
 */
import type { Mattebox } from 'mattebox';
import { isSdh } from 'mattebox';
import { icon } from '../controls/icons.js';
import type { MenuGroup } from '../controls/menu.js';
import { nativeTracks, onNativeTracks } from '../controls/native-tracks.js';
import type { TrackEntry } from '../controls/track-names.js';
import { trackNames } from '../controls/track-names.js';
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
      'label-sdh',
      'label-cc',
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
      const tick = (): void => {
        this.render();
      };
      return engine === null
        ? onNativeTracks(player.video, 'textTracks', tick)
        : onTracks(engine, tick);
    });
  }

  /** The native session's subtitle tracks as entries, and the showing one's. */
  private native(tracks: readonly TextTrack[]): [TrackEntry[], string | null] {
    const sdh = this.getAttribute('label-sdh') ?? 'SDH';
    const entries = tracks.map(
      (track, index): TrackEntry => [
        String(index),
        track.label,
        track.language,
        track.kind === 'captions' ? [sdh] : [],
        [],
      ],
    );
    const on = tracks.findIndex((track) => track.mode === 'showing');
    return [entries, on === -1 ? null : String(on)];
  }

  protected override render(): void {
    super.render();
    const engine = this.engine;
    const player = this.player;
    // The chapters track the element adds, and any metadata track, are not subtitles.
    const listed =
      engine === null && player !== null
        ? nativeTracks<TextTrack>(player, 'textTracks')?.filter(
            (track) => track.kind === 'subtitles' || track.kind === 'captions',
          )
        : undefined;
    if (player === null || (engine === null && listed === undefined)) {
      this.hidden = true;
      return;
    }
    const [tracks, active] =
      listed !== undefined
        ? this.native(listed)
        : trackItems(
            engine as Mattebox,
            'text',
            (track) => [
              // A manifest names in-band captions by their channel (guide chapter 06).
              ...(track.instreamId !== undefined ? [this.getAttribute('label-cc') ?? 'CC'] : []),
              ...(isSdh(track) ? [this.getAttribute('label-sdh') ?? 'SDH'] : []),
            ],
            (track) => track.forced !== true,
          );
    const word = this.getAttribute('label-track');
    const items: MenuGroup['items'] = [
      [OFF, this.getAttribute('label-off') ?? 'Off'],
      ...trackNames(tracks, word),
    ];
    this.menu.fill([
      {
        name: 'track',
        label: word ?? 'Track',
        items,
        value: active ?? OFF,
        onSelect: (value) => {
          if (listed !== undefined) {
            // Off first, so two tracks never show at once.
            for (const track of listed) track.mode = 'disabled';
            const chosen = listed[Number(value)];
            if (chosen !== undefined) chosen.mode = 'showing';
          } else if (value === OFF) engine?.tracks.deselect('text');
          else engine?.tracks.select(value);
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
