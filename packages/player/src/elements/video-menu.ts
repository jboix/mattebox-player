/**
 * <mbx-video-menu>: the version of the picture, such as a sign-language
 * version or a camera angle. It lists the video tracks of `engine.tracks`,
 * or the video's `videoTracks` for a native session, and the versions the
 * source names at their own URLs (`Source.videoTracks`, or
 * `<mbx-video-track>` children). It is not the quality menu: a video track
 * has its own bitrates, and ABR picks among those. Hidden unless there is a
 * choice to make. The name comes from `label`. A version reads as its name
 * in the manifest or its `label`, else the name of its kind (`label-main`,
 * `label-alternative`, `label-sign`, `label-captions`, `label-subtitles`,
 * `label-commentary`), else its language's name, else "Track"
 * (`label-track`) and its place.
 */
import type { SourceVideoTrack } from '@mattebox/player-core';
import type { Mattebox, Track } from 'mattebox';
import { videoKind } from 'mattebox';
import type { NativeTrack } from '../controls/native-tracks.js';
import { nativeTracks, onNativeTracks } from '../controls/native-tracks.js';
import type { TrackEntry } from '../controls/track-names.js';
import { trackNames } from '../controls/track-names.js';
import type { PlayerHost } from '../host.js';
import type { Messages } from '../messages.js';
import { onTracks } from './audio-menu.js';
import { MenuElement, single } from './menu-element.js';
import { show } from './shared.js';

/** The id and the English name of each kind of HTML's `VideoTrack.kind`. */
const KINDS: Readonly<Record<string, readonly [keyof Messages, string]>> = {
  main: ['videoMain', 'Main'],
  alternative: ['videoAlternative', 'Alternative'],
  sign: ['videoSign', 'Sign language'],
  captions: ['videoCaptions', 'Captions'],
  subtitles: ['videoSubtitles', 'Subtitles'],
  commentary: ['videoCommentary', 'Commentary'],
};

/** The value of a version at its own URL, by its place; the source itself is `source:`. */
const SOURCE = 'source:';

/** What the menu reads and writes of Safari's `VideoTrack`. */
interface NativeVideoTrack extends NativeTrack {
  selected: boolean;
}

export class MbxVideoMenu extends MenuElement {
  static get observedAttributes(): readonly string[] {
    return ['label', 'label-back', 'label-track', ...Object.keys(KINDS).map((k) => `label-${k}`)];
  }

  declare private engine: Mattebox | null;

  constructor() {
    super(...single('video'));
    this.engine = null;
    show(this.slots, 'default');
  }

  protected override name(): readonly [keyof Messages, string] {
    return ['video', 'Video'];
  }

  protected override attach(player: PlayerHost): void {
    this.listen(player, ['videosourcechange'], () => {
      this.render();
    });
    this.follow(player, (engine) => {
      this.engine = engine;
      this.render();
      const tick = (): void => {
        this.render();
      };
      return engine === null
        ? onNativeTracks(player.video, 'videoTracks', tick)
        : onTracks(engine, tick);
    });
  }

  /** The name of `kind`, from its attribute; an empty kind is the main picture. */
  private kindName(kind: string): string | undefined {
    const key = kind === '' ? 'main' : kind;
    const known = KINDS[key];
    return known === undefined
      ? (this.getAttribute(`label-${key}`) ?? undefined)
      : this.word(`label-${key}`, ...known);
  }

  /**
   * The engine's video tracks as entries, one per version: the same version
   * in another codec (an AVC and an HEVC set) is one entry, the active one
   * when it is among them.
   */
  private tracks(engine: Mattebox): [TrackEntry[], string | null] {
    const active = engine.tracks.active('video')?.id ?? null;
    const versions = new Map<string, Track>();
    for (const track of engine.tracks.available) {
      if (track.contentType !== 'video' || track.role === 'trick') continue;
      if (!engine.tracks.selectable(track.id)) continue;
      const key = [videoKind(track), track.lang, track.name].join('|');
      const held = versions.get(key);
      if (held === undefined || track.id === active) versions.set(key, track);
    }
    const entries = [...versions.values()].map(
      (track): TrackEntry => [
        track.id,
        track.name ?? this.kindName(videoKind(track)),
        track.lang,
        [],
        [],
      ],
    );
    return [entries, entries.some(([id]) => id === active) ? active : null];
  }

  /** The native session's video tracks as entries, and the selected one's. */
  private native(tracks: readonly NativeVideoTrack[]): [TrackEntry[], string | null] {
    const entries = tracks.map(
      (track, index): TrackEntry => [
        String(index),
        track.label || this.kindName(track.kind),
        track.language,
        [],
        [],
      ],
    );
    const on = tracks.findIndex((track) => track.selected);
    return [entries, on === -1 ? null : String(on)];
  }

  /** The versions at their own URLs as entries, after the ones of the stream. */
  private sources(versions: readonly SourceVideoTrack[]): TrackEntry[] {
    return versions.map(
      (version, index): TrackEntry => [
        `${SOURCE}${index}`,
        version.label ?? this.kindName(version.kind),
        version.language,
        [],
        [],
      ],
    );
  }

  protected override render(): void {
    super.render();
    const player = this.player;
    if (player === null) {
      this.hidden = true;
      return;
    }
    const engine = this.engine;
    const versions = player.videoSources;
    const playing = player.videoSource;
    const tracks =
      engine === null ? nativeTracks<NativeVideoTrack>(player, 'videoTracks') : undefined;
    // On a version at its own URL, the stream's tracks are that version's:
    // the menu offers the way back to the source instead.
    const [own, active]: [TrackEntry[], string | null] =
      playing !== null
        ? [[[SOURCE, this.kindName('main'), undefined, [], []]], null]
        : tracks !== undefined
          ? this.native(tracks)
          : engine !== null
            ? this.tracks(engine)
            : [[], null];
    const entries = [...own, ...this.sources(versions)];
    const value = playing !== null ? `${SOURCE}${versions.indexOf(playing)}` : active;
    const items = trackNames(
      entries,
      this.word('label-track', 'track', 'Track'),
      player.locale || undefined,
    );
    this.menu.fill([
      {
        name: 'track',
        items,
        value: value ?? '',
        onSelect: (picked) => {
          if (picked === SOURCE) player.selectVideoSource(null);
          else if (picked.startsWith(SOURCE)) {
            const version = versions[Number(picked.slice(SOURCE.length))];
            if (version !== undefined) player.selectVideoSource(version);
          } else if (tracks !== undefined) {
            // Setting one track's `selected` clears the others'.
            const track = tracks[Number(picked)];
            if (track !== undefined) track.selected = true;
          } else engine?.tracks.select(picked);
          this.render();
        },
      },
    ]);
    this.hidden = items.length < 2;
  }
}
