/**
 * The trackers of one player: what the page added, started at each
 * programme and stopped at its end. The page decides which trackers run,
 * and when it adds or removes them; the player only starts and stops them.
 * The lifecycle is pillarbox-apple's `PlayerItemTracker`, enable at the
 * start of an item and disable at its end, without its tracking switch:
 * consent is the page's to decide.
 */
import type { Programme } from '@mattebox/player-core';
import type { PlayerHost, Tracker, Trackers } from './host.js';

export type { Tracker, Trackers };

/** What the element drives: the programme that starts, or null at its end. */
export interface TrackerRunner extends Trackers {
  begin(programme: Programme | null): void;
}

/** Runs `fn`, and throws its error on a task of its own: one tracker's bug stops neither playback nor the others. */
function guard(fn: () => void): void {
  try {
    fn();
  } catch (error) {
    setTimeout(() => {
      throw error;
    });
  }
}

/** The trackers of `host`. `changed` runs after each start, stop, addition and removal. */
export function createTrackers(host: PlayerHost, changed: () => void): TrackerRunner {
  const set = new Set<Tracker>();
  let current: Programme | null = null;
  return {
    add(tracker) {
      if (set.has(tracker)) return;
      set.add(tracker);
      const programme = current;
      if (programme !== null) guard(() => tracker.start(programme, host));
      changed();
    },
    delete(tracker) {
      if (!set.delete(tracker)) return false;
      if (current !== null) guard(() => tracker.stop());
      changed();
      return true;
    },
    has: (tracker) => set.has(tracker),
    get list() {
      return [...set];
    },
    begin(programme) {
      if (current === null && programme === null) return;
      if (current !== null) for (const tracker of set) guard(() => tracker.stop());
      current = programme;
      if (programme !== null)
        for (const tracker of set) guard(() => tracker.start(programme, host));
      changed();
    },
  };
}
