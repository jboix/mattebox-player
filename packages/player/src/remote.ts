/**
 * What a cast package gives the player while a device plays, and what the
 * player gives it back with each load. Types alone: the player knows no
 * device, and a cast package knows no control.
 */
import type { Marker, Programme, Source } from '@mattebox/player-core';

/** The read side of `TimeRanges`. */
export interface Ranges {
  readonly length: number;
  start(index: number): number;
  end(index: number): number;
}

/** The device that plays: its kind, such as `chromecast` or `airplay`, and its name, or empty. */
export interface CastTarget {
  readonly kind: string;
  readonly name: string;
}

/**
 * The playback members the device answers, with its playback events. A
 * member it has is read from it and written to it through `player.media`;
 * every other member of the video stays the video's.
 */
export interface RemoteMedia extends EventTarget {
  currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
  readonly seekable: Ranges;
  volume: number;
  muted: boolean;
  play(): Promise<void>;
  pause(): void;
}

/** A subtitle or caption file the page gave the video as a `<track>`. */
export interface TextFile {
  readonly url: string;
  readonly kind: 'subtitles' | 'captions';
  readonly label: string;
  readonly language: string;
}

/** What the player gives a remote with each load. Plain JSON. */
export interface RemoteLoad {
  /** The sources, the metadata, and the connector's type, id and data. Null for a source loaded without one. */
  readonly programme: Programme | null;
  /**
   * On demand: seconds, or null for the start. Live: null at the edge, or
   * the clock time the viewer watches, in epoch seconds.
   */
  readonly at: number | { readonly date: number } | null;
  readonly playing: boolean;
  /** The source is a live stream. */
  readonly live: boolean;
  /** The player's markers now: the page may have set its own after the load. */
  readonly markers: readonly Marker[];
  /** The `chapters` attribute: the URL of a chapters file. */
  readonly chapters?: string;
  /** The `thumbnails` attribute: the URL of the thumbnail track. */
  readonly thumbnails?: string;
  /** The `<track>` subtitle and caption files of the page. */
  readonly textTracks: readonly TextFile[];
  /** What each add-on sends, under its name. The player does not read it. */
  readonly addons: { readonly [name: string]: unknown };
}

export interface Remote {
  readonly target: CastTarget;
  readonly media: RemoteMedia;
  /** Plays a source on the device. A rejection is a load the device refused. */
  load(source: Source, load: RemoteLoad): Promise<void>;
  /** Stops the media on the device. The device session stays. */
  stop(): void;
}

export interface CastOptions {
  /** The device already plays the player's source, such as a session the browser rejoined: no load is sent. */
  readonly adopted?: boolean;
}
