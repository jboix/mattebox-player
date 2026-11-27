/**
 * Spots: moments an add-on points at on the seek bar, such as the lines a
 * search of the transcript found. Each owner gives its own, so one owner
 * never replaces another's, and none of them touches the page's markers.
 * The owner clears its spots when they no longer apply.
 */

/** One moment on the programme's timeline. */
export interface Spot {
  /** Programme seconds. */
  readonly time: number;
  /** The one the viewer is at: the seek bar draws it taller. */
  readonly current?: boolean;
}

export interface Spots {
  /** Every owner's spots, by time. */
  readonly list: readonly Spot[];
  /** Sets the spots of `owner`. An empty list removes them. */
  set(owner: string, spots: readonly Spot[]): void;
}

/** Spots; `emit` reports each change as `spotschange`, with the list. */
export function createSpots(emit: (list: readonly Spot[]) => void): Spots {
  const owners = new Map<string, readonly Spot[]>();
  let list: readonly Spot[] = [];
  return {
    get list() {
      return list;
    },
    set(owner, spots) {
      // Nothing to clear: no event for an owner that had none.
      if (spots.length === 0 && !owners.has(owner)) return;
      if (spots.length === 0) owners.delete(owner);
      else owners.set(owner, spots);
      list = [...owners.values()].flat().sort((a, b) => a.time - b.time);
      emit(list);
    },
  };
}
