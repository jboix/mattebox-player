/**
 * <mbx-audio-menu>: the audio track over `engine.tracks`, or over the
 * video's `audioTracks` for a native session. Hidden unless there is a
 * choice to make. The name comes from `label`. An engine track reads as
 * its name in the manifest, else its language's name, else its language
 * code, else "Track" (`label-track`) and its place. A native track reads
 * the same from its label and language. A badge marks an
 * audio description track (`label-ad`, "AD") and the original language
 * (`label-original`, "Original"), from the engine's standard
 * characteristics (guide chapter 06), or from the native track's `kind`.
 */
import type { ContentType, Mattebox, Track } from 'mattebox';
import { isAudioDescription, isOriginal } from 'mattebox';
import type { NativeTrack } from '../controls/native-tracks.js';
import { nativeTracks, onNativeTracks } from '../controls/native-tracks.js';
import type { TrackEntry } from '../controls/track-names.js';
import { layout, trackNames } from '../controls/track-names.js';
import type { PlayerHost } from '../host.js';
import { MenuElement, single } from './menu-element.js';
import { show } from './shared.js';

/**
 * A track's channel layout, from its first rendition: `channels` and
 * `audioObjects` (`JOC` for Dolby Atmos) arrived in mattebox 0.12, so they
 * are read structurally and an older engine gives none.
 */
function channels(track: Track): string | undefined {
  const first = track.renditions[0] as
    | { readonly channels?: number; readonly audioObjects?: string }
    | undefined;
  return first?.channels === undefined
    ? undefined
    : layout(`${first.channels}${first.audioObjects ? `/${first.audioObjects}` : ''}`);
}

/**
 * The tracks of one content type that the engine can play and `listed`
 * keeps, as entries with their badges, and the active one's id when it
 * is listed. A track the browser cannot decode, or that no stage plays,
 * stays out (guide chapter 06).
 */
export function trackItems(
  engine: Mattebox,
  contentType: ContentType,
  badges: (track: Track) => readonly string[] = () => [],
  listed: (track: Track) => boolean = () => true,
): [TrackEntry[], string | null] {
  const tracks = engine.tracks;
  const available = tracks.available.filter(
    (track) => track.contentType === contentType && tracks.selectable(track.id) && listed(track),
  );
  const entries = available.map(
    (track): TrackEntry => [
      track.id,
      track.name,
      track.lang,
      badges(track),
      // The role "main" tells nothing apart: every stream has one.
      [channels(track), track.role === 'main' ? undefined : track.role],
    ],
  );
  const active = tracks.active(contentType)?.id;
  return [entries, available.some((track) => track.id === active) ? (active as string) : null];
}

/** What the menu reads and writes of Safari's `AudioTrack`. */
interface NativeAudioTrack extends NativeTrack {
  enabled: boolean;
}

/** Subscribes `tick` to the track events, and answers the unsubscribe. */
export function onTracks(engine: Mattebox, tick: () => void): () => void {
  const offs = [engine.on('tracks:changed', tick), engine.on('tracks:selected', tick)];
  return () => {
    for (const off of offs) off();
  };
}

export class MbxAudioMenu extends MenuElement {
  static get observedAttributes(): readonly string[] {
    return ['label', 'label-back', 'label-ad', 'label-original', 'label-track'];
  }

  declare private engine: Mattebox | null;

  constructor() {
    super(...single('music'));
    this.engine = null;
    show(this.slots, 'default');
  }

  protected override name(): string {
    return 'Audio';
  }

  protected override attach(player: PlayerHost): void {
    this.follow(player, (engine) => {
      this.engine = engine;
      this.render();
      const tick = (): void => {
        this.render();
      };
      return engine === null
        ? onNativeTracks(player.video, 'audioTracks', tick)
        : onTracks(engine, tick);
    });
  }

  /** The native session's audio tracks as entries, and the enabled one's. */
  private native(tracks: readonly NativeAudioTrack[]): [TrackEntry[], string | null] {
    const ad = this.getAttribute('label-ad') ?? 'AD';
    const entries = tracks.map(
      (track, index): TrackEntry => [
        String(index),
        track.label,
        track.language,
        // HTML's kinds for an audio description track.
        track.kind === 'description' || track.kind === 'main-desc' ? [ad] : [],
        [],
      ],
    );
    const on = tracks.findIndex((track) => track.enabled);
    return [entries, on === -1 ? null : String(on)];
  }

  protected override render(): void {
    super.render();
    const engine = this.engine;
    const player = this.player;
    const tracks =
      engine === null && player !== null
        ? nativeTracks<NativeAudioTrack>(player, 'audioTracks')
        : undefined;
    if (engine === null && tracks === undefined) {
      this.hidden = true;
      return;
    }
    const [entries, active] =
      tracks !== undefined
        ? this.native(tracks)
        : trackItems(engine as Mattebox, 'audio', (track) => [
            ...(isAudioDescription(track) ? [this.getAttribute('label-ad') ?? 'AD'] : []),
            ...(isOriginal(track) ? [this.getAttribute('label-original') ?? 'Original'] : []),
          ]);
    const items = trackNames(entries, this.getAttribute('label-track'));
    this.menu.fill([
      {
        name: 'track',
        items,
        value: active ?? '',
        onSelect: (value) => {
          // One audio track plays at a time, so the others are turned off.
          if (tracks !== undefined) {
            tracks.forEach((track, index) => {
              track.enabled = String(index) === value;
            });
          } else engine?.tracks.select(value);
          this.render();
        },
      },
    ]);
    this.hidden = items.length < 2;
  }
}
