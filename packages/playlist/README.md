<h1>
  <img src="https://raw.githubusercontent.com/jboix/mattebox-player/main/docs/logo.svg" width="44" height="44" align="absmiddle" alt="">
  @mattebox/player-playlist
</h1>

A playlist for the
[Mattebox player](https://github.com/jboix/mattebox-player): next,
previous, repeat, shuffle, and auto-advance, from a script or from markup.

- The end of an item plays the next one. Repeat goes none, all, then one.
- Shuffle plays the items in a random order and keeps your list as it is.
- Previous restarts an item after its first 3 seconds, and goes back before.
- A failed item is skipped after 3 seconds.
- Near the end of an item, a card offers the next one, and the next one
  loads ahead so it starts at once.
- The system's media keys, lock screen and TV remote go to next and previous.

```sh
npm install @mattebox/player-playlist @mattebox/player mattebox
```

## From markup

```html
<mattebox-player controls="custom">
  <mbx-title></mbx-title>
  <mbx-playlist repeat="all">
    <mbx-playlist-item src="https://example.com/one.m3u8" heading="Episode 1"></mbx-playlist-item>
    <mbx-playlist-item src="https://example.com/two.m3u8" heading="Episode 2" start-time="30"></mbx-playlist-item>
  </mbx-playlist>
  <mbx-control-bar>…</mbx-control-bar>
</mattebox-player>

<script type="module">
  import '@mattebox/player';
  import '@mattebox/player-playlist';
</script>
```

An item takes the player's own attributes (`src`, `type`, `poster`,
`thumbnails`, `chapters`, `license-url`, `certificate-url`), the title's
(`heading`, `subheading`, `artwork`), `start-time` and `duration`.
`markers` takes the item's markers as JSON:
`markers='[{"start":1300,"end":1380,"kind":"closing-credits"}]'`.
`<mbx-playlist>` takes `repeat` (`none`, `all`, `one`), `shuffle`,
`autoadvance="off"`, and `pause-on-open`.

## The controls

| Element                 | What it does                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `<mbx-playlist>`        | The list: over the right of the picture while it has `open`, with shuffle, repeat, previous and next |
| `<mbx-playlist-button>` | Opens and closes the list, in the bar. Hidden without a `<mbx-playlist>` or without items            |
| `<mbx-previous-button>` | Previous item, or the start of this one after its first seconds. Hidden without items                |
| `<mbx-next-button>`     | Next item. Hidden when there is none                                                                 |
| `<mbx-up-next>`         | A card that offers the next item near the end of this one                                            |

The buttons take `label`. `<mbx-playlist>` takes `label`, `label-close`,
`label-shuffle`, `label-repeat-off`, `label-repeat-all`, `label-repeat-one`,
`label-previous` and `label-next`. Without children, `<mbx-playlist>` shows
the list a script loaded. Picking an item plays it and closes the list;
Escape closes it too. With `pause-on-open`, the video pauses while the list
is open, and plays again when it closes without a pick.

`<mbx-up-next>` shows from the item's closing-credits marker, and in its last
10 seconds. It shows the next item's artwork and heading, and a countdown
while auto-advance is on. Next episode plays the next item now. Close stays
on this item, and its end does not move on. While the card shows, the player
carries `upnext`, and the player's skip button leaves the closing credits to
the card. The card takes `label`, `label-play`, `label-dismiss`, and
`label-countdown` with `{seconds}`.

```html
<mattebox-player controls="custom">
  <mbx-up-next></mbx-up-next>
  <mbx-playlist pause-on-open></mbx-playlist>
  <mbx-control-bar>
    <mbx-previous-button></mbx-previous-button>
    <mbx-play-button></mbx-play-button>
    <mbx-next-button></mbx-next-button>
    <mbx-spacer></mbx-spacer>
    <mbx-playlist-button></mbx-playlist-button>
  </mbx-control-bar>
</mattebox-player>
```

## From a script

```ts
import { createPlaylist } from '@mattebox/player-playlist';

const playlist = createPlaylist(document.querySelector('mattebox-player'), { repeat: 'all' });
playlist.load([
  { src: 'https://example.com/one.m3u8', heading: 'Episode 1' },
  { src: 'https://example.com/two.m3u8', heading: 'Episode 2', markers: [{ start: 1300, end: 1380, kind: 'closing-credits' }] },
]);
playlist.addEventListener('change', () => console.log(playlist.index));
```

| Member                                  | What it does                                                       |
| --------------------------------------- | ------------------------------------------------------------------ |
| `load(items, start?)`                   | Replaces the list and plays `start`                                |
| `push(...items)`                        | Adds items at the end                                              |
| `splice(start, count, ...items)`        | Removes and inserts items; the item that plays keeps playing       |
| `clear()`                               | Empties the list                                                   |
| `select(index)`, `next()`, `previous()` | Plays another item                                                 |
| `stay()`                                | Stays at the end of the item that plays, once                      |
| `hasNext()`, `hasPrevious()`            | Whether next and previous have an item to go to                    |
| `toggleRepeat()`                        | None, all, one, and none again                                     |
| `items`, `index`, `item`, `upcoming`    | The list, the item that plays, and the one after it                |
| `repeat`, `shuffle`, `autoadvance`      | The modes, to read or set                                          |
| `change` event                          | `detail` says whether the `items`, the `index` or a `mode` changed |
| `skip` event                            | A failed item was skipped: `detail.index`, `item` and `error`      |

`playlistOf(player)` returns the playlist of a player, whether the markup or
a script made it.

The [guide](https://github.com/jboix/mattebox-player/blob/main/docs/guide/07-playlist.md)
explains the items, the controls and the script API.
