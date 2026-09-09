/**
 * What a control is: a root the bar places, and a teardown. The same shape
 * as a panel, kept separate because a control reads the video and a panel
 * reads an engine namespace.
 */
export interface Control {
  readonly root: HTMLElement;
  dispose(): void;
}

/** Reports a state the bar carries on its part name: `playing`, `muted`, `fullscreen`. */
export type Flag = (name: string, on: boolean) => void;
