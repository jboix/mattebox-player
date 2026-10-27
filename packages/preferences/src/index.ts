/**
 * @mattebox/player-preferences: the viewer's preferences, as a store that
 * every player and every element of the page reads and writes, and
 * <mbx-preferences>, which keeps the player's own choices in it. Importing
 * this module registers the element; that is the package's one side
 * effect. A page without it stores nothing.
 */
import { MbxPreferences } from './element.js';
import type { PreferenceStore } from './store.js';

export { MbxPreferences } from './element.js';
export type {
  PreferenceOptions,
  PreferenceStorage,
  PreferenceStore,
  Preferences,
  SubtitleLook,
  TrackChoice,
} from './store.js';
export { preferences } from './store.js';

export const PREFERENCES = 'mbx-preferences';

/** The store of the `<mbx-preferences>` inside `player`, or null without one. */
export function preferencesOf(player: Element): PreferenceStore | null {
  return player.querySelector<MbxPreferences>(PREFERENCES)?.store ?? null;
}

if (customElements.get(PREFERENCES) === undefined) {
  customElements.define(PREFERENCES, MbxPreferences);
}

declare global {
  interface HTMLElementTagNameMap {
    'mbx-preferences': MbxPreferences;
  }
}
