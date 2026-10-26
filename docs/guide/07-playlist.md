# 07 Playlist

This chapter explains how to play a list of sources in one player.
`@mattebox/player-playlist` gives the list from markup or from a script. It
also gives the controls: the list a viewer opens, the bar's buttons, and
the card that offers the next item.

## Install

```sh
npm install @mattebox/player-playlist @mattebox/player mattebox
```

`@mattebox/player` is a peer dependency of the package. The package uses
the player's public types only, like a control of the page's own in
chapter 03. The import registers the six elements of this chapter and
nothing else. A page that plays one source leaves the package out.

From a script tag, load `dist/cdn/mattebox-player-playlist.min.js` after
the engine and the player (see [04 CDN](04-cdn.md)). The global is
`matteboxPlayerPlaylist`.

## From markup

Place `<mbx-playlist>` inside the player, with one `<mbx-playlist-item>`
per item. The player needs no `src`: the playlist sets it.

```html
<mattebox-player controls="custom">
  <mbx-title></mbx-title>
  <mbx-playlist repeat="all">
    <mbx-playlist-item src="https://example.com/one.m3u8" heading="Episode 1"></mbx-playlist-item>
    <mbx-playlist-item src="https://example.com/two.m3u8" heading="Episode 2" start-time="30"></mbx-playlist-item>
  </mbx-playlist>
  <mbx-control-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-seek-bar></mbx-seek-bar>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import '@mattebox/player';
  import '@mattebox/player-playlist';
</script>
```

The first item loads when the element connects. It starts like any source:
with `autoplay` on the player, or when the viewer presses play.

The children are the items, in order. Add, remove or change a child, and
the list follows. The item that plays keeps playing.

| Attribute of `<mbx-playlist>` | What it does                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `repeat`                      | Sets the repeat mode: `none`, `all` or `one`. The default is `none`           |
| `shuffle`                     | Plays the items in a random order                                             |
| `autoadvance`                 | `autoadvance="off"` stops at the end of each item. The default plays the next |
| `open`                        | Shows the list. See [The list](#the-list)                                     |
| `pause-on-open`               | Pauses the video while the list is open                                       |

## An item

An item writes the player's own attributes, so the engine and a native
session play it the same way.

| Attribute of `<mbx-playlist-item>`                                           | What it does                                                                |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src`                                                                        | Sets the source URL. An item without `src` is left out                      |
| `type`, `poster`, `thumbnails`, `chapters`, `license-url`, `certificate-url` | Set the same attributes on the player. An absent one is removed             |
| `heading`, `subheading`, `artwork`                                           | Set the same attributes on the player's `<mbx-title>`, and show in the list |
| `start-time`                                                                 | Sets where playback starts, in seconds                                      |
| `duration`                                                                   | Sets the length the list shows, in seconds                                  |
| `markers`                                                                    | Sets the item's markers, as JSON                                            |

`markers` takes the list that `player.markers.set()` takes (see
[03 The element](03-the-element.md#markers)):

```html
<mbx-playlist-item
  src="https://example.com/one.m3u8"
  heading="Episode 1"
  markers='[{"start":1300,"end":1380,"kind":"closing-credits"}]'
></mbx-playlist-item>
```

A `markers` value that is not JSON is ignored, and the item plays without
markers.

## What plays next

- The end of an item plays the next one. `autoadvance="off"` stops there.
- `repeat="all"` goes from the last item to the first. `repeat="one"` plays the same item again.
- Shuffle plays the items in a random order. The list keeps its order, and the item that plays stays first.
- Next and a picked item keep playing when the video was playing or had ended.
- Previous goes to the previous item in the first 3 seconds of an item. After them, it restarts the item.
- Previous on a live item always goes to the previous item.
- A fatal error plays the next item after 3 seconds, and fires `skip`.

Near the end of an item, the engine preloads the manifest of the next one:
inside the closing-credits marker, or in the last 30 seconds. The engine
keeps it for 30 seconds, so the playlist asks again every 25 seconds until
the item ends. The segments are not preloaded. The player asks the handler
that will play the next item, so a source the browser plays itself is not
preloaded.

The system's media keys, a lock screen and a TV remote go to next and
previous through the Media Session API. The system shows the item's
`heading`, `subheading` and `artwork`, or its `poster` without artwork.

## The controls

| Element                 | What it does                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `<mbx-playlist>`        | The list of items, over the right of the picture while it has `open`                      |
| `<mbx-playlist-button>` | Opens and closes the list, in the bar. Hidden without a `<mbx-playlist>` or without items |
| `<mbx-previous-button>` | Plays the previous item, or restarts this one. Hidden without items                       |
| `<mbx-next-button>`     | Plays the next item. Hidden when there is none                                            |
| `<mbx-up-next>`         | A card that offers the next item near the end of this one                                 |

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

The three buttons show a tooltip, like the player's buttons.

### The list

The list takes the player's height. It has shuffle, repeat, previous and
next at the top, then one row per item with its artwork, heading,
subheading and length. A row without a heading shows the source URL. A dot
marks the item that plays.

- Opening the list focuses the item that plays.
- Up and Down move between the rows.
- Picking a row plays it and closes the list.
- Escape closes the list. So does Back on a TV remote.
- Closing returns focus to `<mbx-playlist-button>`.

With `pause-on-open`, the video pauses while the list is open. It plays
again when the list closes without a pick.

On a compact player, such as a phone held upright, the list opens as a
sheet from the bottom of the page. The page behind it is dimmed, and a
press there closes the list. On a larger player, and in fullscreen, the
list is over the picture again. See
[Size tiers](03-the-element.md#size-tiers).

Without children, `<mbx-playlist>` shows the list a script loaded.

### The up next card

`<mbx-up-next>` shows inside the item's closing-credits marker, and in its
last 10 seconds. It shows the next item's artwork and heading.

- Next episode plays the next item now.
- Close stays on this item. Its end does not move on, and the card stays closed for this item.
- A countdown shows in the last 10 seconds while auto-advance is on.
- The card does not show without a next item, or under repeat one.

While the card shows, the player has `upnext`. `<mbx-marker-button>` then
hides inside closing credits and leaves them to the card.

The card sits above the bar. When the bar hides, the card moves down into
its place.

## From a script

`createPlaylist(player, options?)` returns the playlist of a player. It
makes one if the player has none, and otherwise applies `repeat`, `shuffle`
and `autoadvance` to the one it has. Markup and script therefore drive the
same playlist.

```ts
import { createPlaylist } from '@mattebox/player-playlist';

const playlist = createPlaylist(document.querySelector('mattebox-player'), { repeat: 'all' });
playlist.load([
  { src: 'https://example.com/one.m3u8', heading: 'Episode 1' },
  {
    src: 'https://example.com/two.m3u8',
    heading: 'Episode 2',
    markers: [{ start: 1300, end: 1380, kind: 'closing-credits' }],
  },
]);
playlist.addEventListener('change', () => console.log(playlist.index));
```

An item is a plain object. Its fields are the item attributes in camel
case: `licenseUrl`, `certificateUrl`, `startTime`. `markers` is an array.
`data` holds anything of your own.

| Option              | What it does                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `repeat`            | `'none'`, `'all'` or `'one'`. The default is `'none'`                                                   |
| `shuffle`           | Plays the items in a random order. The default is `false`                                               |
| `autoadvance`       | Plays the next item when one ends. The default is `true`                                                |
| `previousThreshold` | Sets the seconds into an item before previous restarts it. The default is 3                             |
| `skipOnError`       | Sets the milliseconds after a fatal error before the next item, or `false` to stay. The default is 3000 |

`previousThreshold` and `skipOnError` apply only when the call makes the
playlist. To set them on a page with `<mbx-playlist>`, call
`createPlaylist` before the element connects.

| Member                                  | What it does                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `load(items, start?)`                   | Replaces the list and loads `start`, the first item by default                  |
| `push(...items)`                        | Adds items at the end                                                           |
| `splice(start, count, ...items)`        | Removes and inserts items. The item that plays keeps playing                    |
| `clear()`                               | Empties the list. What plays keeps playing                                      |
| `select(index)`, `next()`, `previous()` | Plays another item                                                              |
| `stay()`                                | Stays at the end of the item that plays, once                                   |
| `hasNext()`, `hasPrevious()`            | Whether next and previous have an item to go to                                 |
| `toggleRepeat()`                        | Goes from none to all, to one, and to none again. Returns the new mode          |
| `items`, `index`, `item`                | The list, and the item that plays. `index` is -1 and `item` is null without one |
| `upcoming`                              | The item that plays after this one, or null                                     |
| `repeat`, `shuffle`, `autoadvance`      | The modes, to read or set                                                       |
| `player`                                | The player                                                                      |
| `dispose()`                             | Removes the playlist from the player, with its listeners                        |

| Event      | Fires on     | What it says                                                                    |
| ---------- | ------------ | ------------------------------------------------------------------------------- |
| `change`   | The playlist | `detail.items`, `detail.index` and `detail.mode` say which of them changed      |
| `skip`     | The playlist | A failed item was skipped. `detail` has its `index`, its `item` and the `error` |
| `playlist` | The player   | The player got a playlist, or lost it                                           |

`playlistOf(player)` returns the playlist of a player, or null. A control
of your own listens for `playlist` on the player, then reads
`playlistOf(player)`.

## Labels, parts, tokens

| Element                                                               | Attribute                                                  | Default                                  |
| --------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| `<mbx-playlist-button>`, `<mbx-previous-button>`, `<mbx-next-button>` | `label`                                                    | "Playlist", "Previous", "Next"           |
| `<mbx-playlist>`                                                      | `label`, `label-close`                                     | "Playlist", "Close"                      |
| `<mbx-playlist>`                                                      | `label-shuffle`                                            | "Shuffle"                                |
| `<mbx-playlist>`                                                      | `label-repeat-off`, `label-repeat-all`, `label-repeat-one` | "Repeat off", "Repeat all", "Repeat one" |
| `<mbx-playlist>`                                                      | `label-previous`, `label-next`                             | "Previous", "Next"                       |
| `<mbx-up-next>`                                                       | `label`, `label-play`, `label-dismiss`                     | "Up next", "Next episode", "Close"       |
| `<mbx-up-next>`                                                       | `label-countdown`                                          | "in {seconds} s"                         |

`{seconds}` in `label-countdown` becomes the seconds left.

The package ships these words in the player's languages, as
`@mattebox/player-playlist/locales/<language>`. You register them with the
player's words: `MatteboxPlayerElement.addLocale('de', words, playlistWords)`.
The ids are in the `PlaylistMessages` type. See the player guide, chapter
03, "Languages".

The icon of a bar button is its `icon` slot. The button shows its own icon
when the slot is empty.

| Element          | Parts                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| The bar buttons  | `button`                                                                                                                                             |
| `<mbx-playlist>` | `header`, `heading`, `controls`, `button`, `badge`, `list`, `row`, `item`, `item-image`, `item-text`, `item-title`, `item-subtitle`, `item-duration` |
| `<mbx-up-next>`  | `card`, `image`, `text`, `top`, `heading`, `countdown`, `title`, `play`, `button`                                                                    |

The item that plays has `aria-current="true"` on its `item` part. `badge`
is the 1 on the repeat button under repeat one.

The elements read the `--mbx-*` custom properties of the player.

## Example

A series with the list, the bar's buttons and the up next card. The page
logs every skipped item.

```html
<mattebox-player id="player" controls="custom" autoplay muted>
  <mbx-title></mbx-title>
  <mbx-start-button></mbx-start-button>
  <mbx-spinner></mbx-spinner>
  <mbx-marker-button></mbx-marker-button>
  <mbx-up-next></mbx-up-next>
  <mbx-playlist pause-on-open>
    <mbx-playlist-item
      src="https://example.com/s1e1/master.m3u8"
      heading="Episode 1"
      subheading="Season 1"
      artwork="https://example.com/s1e1.jpg"
      duration="1440"
      markers='[{"start":1380,"end":1440,"kind":"closing-credits"}]'
    ></mbx-playlist-item>
    <mbx-playlist-item
      src="https://example.com/s1e2/master.m3u8"
      heading="Episode 2"
      subheading="Season 1"
      artwork="https://example.com/s1e2.jpg"
      duration="1500"
      markers='[{"start":1430,"end":1500,"kind":"closing-credits"}]'
    ></mbx-playlist-item>
  </mbx-playlist>
  <mbx-control-bar>
    <mbx-current-time></mbx-current-time>
    <mbx-seek-bar></mbx-seek-bar>
    <mbx-duration></mbx-duration>
    <mbx-previous-button></mbx-previous-button>
    <mbx-play-button></mbx-play-button>
    <mbx-next-button></mbx-next-button>
    <mbx-volume></mbx-volume>
    <mbx-spacer></mbx-spacer>
    <mbx-playlist-button></mbx-playlist-button>
    <mbx-fullscreen-button></mbx-fullscreen-button>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import '@mattebox/player';
  import { createPlaylist } from '@mattebox/player-playlist';

  const player = document.getElementById('player');
  createPlaylist(player).addEventListener('skip', (event) => {
    console.warn('Skipped', event.detail.item.src, event.detail.error);
  });
</script>
```

The demo's [playlist page](https://demo.mattebox.ch/playlist.html)
plays ready-made lists this way, and shows its markup.
