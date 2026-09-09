/**
 * What a panel is. A panel reads one engine namespace, subscribes to what it
 * needs, and hands back a root and a teardown. It renders nothing for a
 * native session, and nothing for an engine whose stage was not composed:
 * the factory answers null and the element never inserts it.
 */
import type { Session } from '@mattebox/player-core';

export interface Panel {
  readonly root: HTMLElement;
  dispose(): void;
}

export type PanelFactory = (session: Session, video: HTMLVideoElement) => Panel | null;
