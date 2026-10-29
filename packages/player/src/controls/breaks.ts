/**
 * Break marks: where the programme's ad breaks are, for the seek bar. Each
 * owner gives its own, such as `@mattebox/player-ads` for the breaks the
 * stream and the ad schedule name, so one owner never replaces another's.
 * The owner clears its marks when its programme ends.
 */

/** One break on the programme's timeline. */
export interface BreakMark {
  /** Programme seconds. */
  readonly start: number;
  /** The end of the span it replaces, when it replaces one. */
  readonly end?: number;
  /** It played and plays no more: the seek bar draws it faded. */
  readonly played?: boolean;
}

export interface BreakMarks {
  /** Every owner's marks, by start. */
  readonly list: readonly BreakMark[];
  /** Sets the marks of `owner`. An empty list removes them. */
  set(owner: string, marks: readonly BreakMark[]): void;
}

/** Break marks; `emit` reports each change as `breakschange`, with the list. */
export function createBreakMarks(emit: (list: readonly BreakMark[]) => void): BreakMarks {
  const owners = new Map<string, readonly BreakMark[]>();
  let list: readonly BreakMark[] = [];
  return {
    get list() {
      return list;
    },
    set(owner, marks) {
      if (marks.length === 0) owners.delete(owner);
      else owners.set(owner, marks);
      list = [...owners.values()].flat().sort((a, b) => a.start - b.start);
      emit(list);
    },
  };
}
