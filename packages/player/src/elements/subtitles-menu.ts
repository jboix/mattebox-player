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
import type { IconName } from '../controls/icons.js';
import { icon } from '../controls/icons.js';
import type { MenuGroup, MenuPage } from '../controls/menu.js';
import { nativeTracks, onNativeTracks } from '../controls/native-tracks.js';
import type { TrackEntry } from '../controls/track-names.js';
import { trackNames } from '../controls/track-names.js';
import type { PlayerHost } from '../host.js';
import type { Messages } from '../messages.js';
import { onTracks, trackItems } from './audio-menu.js';
import { MenuElement } from './menu-element.js';
import { show } from './shared.js';

const OFF = 'off';
export const SUBTITLE_SIZE = 'subtitle-size';
export const SUBTITLE_BACKGROUND = 'subtitle-background';

/** A look's value, the id of its word, and its English. */
type Choice = readonly [string, keyof Messages, string];

const SIZES: readonly Choice[] = [
  ['small', 'sizeSmall', 'Small'],
  ['medium', 'sizeMedium', 'Medium'],
  ['large', 'sizeLarge', 'Large'],
  ['xlarge', 'sizeExtraLarge', 'Extra large'],
];
const BACKGROUNDS: readonly Choice[] = [
  ['none', 'backgroundNone', 'None'],
  ['dark', 'backgroundDark', 'Dark'],
  ['solid', 'backgroundSolid', 'Solid'],
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
    super(STATES, (state) => icon(state === 'on' ? 'subtitles-on' : 'subtitles'));
    this.engine = null;
    show(this.slots, 'off');
  }

  protected override name(): readonly [keyof Messages, string] {
    return ['subtitles', 'Subtitles'];
  }

  /**
   * A look's page: an item with the look's glyph, its name and the value
   * chosen, which opens the choices. They are named from the attributes,
   * and the value is the player's.
   */
  private looks(
    player: PlayerHost,
    attribute: string,
    name: string,
    id: keyof Messages,
    fallback: string,
    choices: readonly Choice[],
    initial: string,
    glyph: IconName,
  ): MenuPage {
    const set = player.getAttribute(attribute);
    const value = set !== null && choices.some(([id]) => id === set) ? set : initial;
    const label = this.word(`label-${name}`, id, fallback);
    const items = choices.map(
      ([value, word, english]) => [value, this.word(`label-${value}`, word, english)] as const,
    );
    return {
      name,
      label,
      glyph: () => icon(glyph),
      detail: items.find(([id]) => id === value)?.[1] ?? '',
      entries: [
        {
          name,
          label,
          hideLabel: true,
          items,
          value,
          onSelect: (chosen) => {
            player.setAttribute(attribute, chosen);
            this.render();
          },
        },
      ],
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
    const sdh = this.word('label-sdh', 'sdh', 'SDH');
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
    const cc = this.word('label-cc', 'closedCaptions', 'CC');
    const sdh = this.word('label-sdh', 'sdh', 'SDH');
    const [tracks, active] =
      listed !== undefined
        ? this.native(listed)
        : trackItems(
            engine as Mattebox,
            'text',
            (track) => [
              // A manifest names in-band captions by their channel (guide chapter 06).
              ...(track.instreamId !== undefined ? [cc] : []),
              ...(isSdh(track) ? [sdh] : []),
            ],
            (track) => track.forced !== true,
          );
    const word = this.word('label-track', 'track', 'Track');
    const items: MenuGroup['items'] = [
      [OFF, this.word('label-off', 'subtitlesOff', 'Off')],
      ...trackNames(tracks, word, player.locale || undefined),
    ];
    this.menu.fill([
      {
        name: 'track',
        label: word,
        // The menu's title says what the list is.
        hideLabel: true,
        items,
        // The badges are glyphs, named by `label-cc` and `label-sdh`.
        badgeGlyphs: {
          [cc]: () => icon('closed-captions'),
          [sdh]: () => icon('sdh'),
        },
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
        label: this.word('label-settings', 'subtitleSettings', 'Settings'),
        entries: [
          this.looks(
            player,
            SUBTITLE_SIZE,
            'size',
            'subtitleSize',
            'Size',
            SIZES,
            'medium',
            'text-size',
          ),
          this.looks(
            player,
            SUBTITLE_BACKGROUND,
            'background',
            'subtitleBackground',
            'Background',
            BACKGROUNDS,
            'dark',
            'text-background',
          ),
        ],
      },
    ]);
    show(this.slots, active === null ? 'off' : 'on');
    this.hidden = tracks.length === 0;
  }
}
