/**
 * @mattebox/player-playlist: a playlist for <mattebox-player>. Importing
 * this module registers the playlist's elements: <mbx-playlist>,
 * <mbx-playlist-item>, and the bar's <mbx-playlist-button>,
 * <mbx-previous-button> and <mbx-next-button>, and the end card
 * <mbx-up-next>; that is the package's one
 * side effect. `createPlaylist` is the same playlist from a
 * script. It is a package of its own because most pages play one source.
 */
import { MbxNextButton, MbxPlaylistButton, MbxPreviousButton } from './buttons.js';
import { MbxPlaylist, MbxPlaylistItem } from './markup.js';
import { MbxUpNext } from './up-next.js';

export { MbxNextButton, MbxPlaylistButton, MbxPreviousButton } from './buttons.js';
export { MbxPlaylist, MbxPlaylistItem } from './markup.js';
export type { RepeatMode } from './order.js';
export type { Playlist, PlaylistChange, PlaylistItem, PlaylistOptions } from './playlist.js';
export { createPlaylist, playlistOf } from './playlist.js';
export { MbxUpNext } from './up-next.js';

const ELEMENTS: ReadonlyArray<readonly [string, CustomElementConstructor]> = [
  ['mbx-playlist-item', MbxPlaylistItem],
  ['mbx-playlist', MbxPlaylist],
  ['mbx-playlist-button', MbxPlaylistButton],
  ['mbx-previous-button', MbxPreviousButton],
  ['mbx-next-button', MbxNextButton],
  ['mbx-up-next', MbxUpNext],
];
for (const [name, element] of ELEMENTS) {
  if (customElements.get(name) === undefined) customElements.define(name, element);
}

declare global {
  interface HTMLElementTagNameMap {
    'mbx-playlist': MbxPlaylist;
    'mbx-playlist-item': MbxPlaylistItem;
    'mbx-playlist-button': MbxPlaylistButton;
    'mbx-previous-button': MbxPreviousButton;
    'mbx-next-button': MbxNextButton;
    'mbx-up-next': MbxUpNext;
  }
}
