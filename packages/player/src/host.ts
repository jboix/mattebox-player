/**
 * What a control sees of the player it sits in: the video, the engine, the
 * core, and the element itself for its events and attributes. Declared
 * here and not imported from the element, because the element registers
 * the controls and a control that imported the element would close a cycle.
 * `MatteboxPlayerElement` implements it.
 *
 * This is the whole surface a control gets. A control that needs more
 * has found a gap in the player's public API, and the gap is the bug.
 */
import type {
  Block,
  Player,
  PlayerError,
  Programme,
  Source,
  SourceVideoTrack,
} from '@mattebox/player-core';
import type { Mattebox } from 'mattebox';
import type { Markers } from './controls/markers.js';
import type { Messages } from './messages.js';
import { PLAYER } from './tags.js';

export type { Block };

export interface Tracker {
  /** What the diagnostics panel calls it. */
  readonly name: string;
  /** The id of the tracker's current session, which the diagnostics panel shows for support. */
  readonly session?: string | undefined;
  /** The id of the device the tracker reports, which the diagnostics panel shows too. */
  readonly device?: string | undefined;
  /** At the start of each programme, or at once when added during one. */
  start(programme: Programme, player: PlayerHost): void;
  /** At the end of the programme, at unload, or when removed during one. */
  stop(): void;
}

export interface Trackers {
  /** Adds a tracker; during a programme, it starts at once. */
  add(tracker: Tracker): void;
  /** Removes a tracker; during a programme, it stops at once. False when it was not there. */
  delete(tracker: Tracker): boolean;
  has(tracker: Tracker): boolean;
  /** The trackers, in the order they were added. */
  readonly list: readonly Tracker[];
}

export interface PlayerHost extends HTMLElement {
  readonly video: HTMLVideoElement;
  readonly engine: Mattebox | null;
  readonly player: Player | null;
  /** The fatal error of the current load, or null: a control attached after the event still sees it. */
  readonly error: PlayerError | null;
  /** What `block()` set, or null: a control attached after `blockchange` still sees it. */
  readonly blocked: Block | null;
  /** The ranges the page named: credits to skip, parts that must not play. */
  readonly markers: Markers;
  /** What the current load resolved to, with what a connector said of the programme; null without one. */
  readonly programme: Programme | null;
  /** The page's trackers, started at each programme. */
  readonly trackers: Trackers;
  /** Loads the sources again, in the order a load reads them. */
  retry(): void;
  /** The other versions of the picture the source names at their own URLs. */
  readonly videoSources: readonly SourceVideoTrack[];
  /** The version of `videoSources` that plays, or null for the source itself. */
  readonly videoSource: SourceVideoTrack | null;
  selectVideoSource(track: SourceVideoTrack | null): void;
  /** Loads another source of the same programme in place, holding the frame and the controls. */
  switchSource(source: Source): void;
  /** The language tag the words come from, or empty for English. */
  readonly locale: string;
  /**
   * The word of `id` in the player's language, or undefined, where the
   * control's own English applies. The player fires `localechange` when
   * the words change.
   */
  message(id: keyof Messages): string | undefined;
}

/** The parent, or the host of the shadow root `node` sits in, or null at the document. */
function above(node: Node): Node | null {
  const parent = node.parentNode;
  if (parent !== null) return parent;
  return node instanceof ShadowRoot ? node.host : null;
}

/**
 * The nearest player above `node`, through shadow hosts, or null outside
 * one. The element found may not be upgraded yet; the caller waits for the
 * definition before reading it.
 */
export function findPlayer(node: Node): HTMLElement | null {
  let current: Node | null = node;
  while (current !== null) {
    if (current instanceof HTMLElement && current.localName === PLAYER) return current;
    current = above(current);
  }
  return null;
}
