# 08 Preferences

This chapter explains how to keep the viewer's choices from one programme to
the next, and from one visit to the next. `@mattebox/player-preferences`
gives a store that every player and every element of the page share, and
`<mbx-preferences>`, which keeps the player's own choices in it.

## Install

```sh
npm install @mattebox/player-preferences @mattebox/player mattebox
```

The engine is a peer dependency, for its track helpers. The package uses the
player's public types only, like a control of the page's own in chapter 03.
The import registers `<mbx-preferences>` and nothing else. A page without
the package stores nothing.

From a script tag, load `dist/cdn/mattebox-player-preferences.min.js` after
the engine and the player (see [04 CDN](04-cdn.md)). The global is
`matteboxPlayerPreferences`.

## The element

Place `<mbx-preferences>` anywhere inside the player. It renders nothing.

```html
<mattebox-player src="https://example.com/vod/master.m3u8" controls="custom">
  <mbx-preferences storage-key="my-site"></mbx-preferences>
  <mbx-control-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-seek-bar></mbx-seek-bar>
    <mbx-audio-menu></mbx-audio-menu>
    <mbx-subtitles-menu></mbx-subtitles-menu>
  </mbx-control-bar>
</mattebox-player>
```

| Attribute     | What it does                                                                              |
| ------------- | ----------------------------------------------------------------------------------------- |
| `storage-key` | Stores the choices in localStorage under this key. Without it, the choices stay in memory |
| `except`      | The keys the element leaves alone, separated by spaces, such as `except="rate quality"`   |

It keeps these keys:

| Key             | What it keeps                                                                 | Put back                                    |
| --------------- | ----------------------------------------------------------------------------- | ------------------------------------------- |
| `volume`        | The volume                                                                    | When the element attaches                   |
| `muted`         | The mute, unless the page set `muted` for autoplay                            | When the element attaches                   |
| `rate`          | The playback rate                                                             | At each load's `loadedmetadata`             |
| `quality`       | The height of the quality the viewer pinned, or null for Auto                 | The tallest quality at or under that height |
| `audio`         | The audio track's language and kind: `main`, `description`, `enhanced-speech` | Once the track list arrives                 |
| `subtitles`     | The subtitle track's language and kind, `subtitles` or `captions`, or null    | Once the track list arrives                 |
| `subtitle-look` | The player's `subtitle-size` and `subtitle-background`                        | When the element attaches                   |

- A track matches by language and kind first, then by language. An audio
  description or an enhanced speech track matches by its kind alone too,
  so a viewer who needs one keeps it in another language.
- `de-CH` and `de` are the same language.
- Without a match, the engine's own choice stays.
- Only the viewer's changes are saved. The element ignores the tracks it put
  back itself, a forced subtitle track, the rate of a scan or of a live
  catch-up, and the reset of the rate at a load.
- A native session in Safari reads the same keys from the video's
  `audioTracks` and `textTracks`.

## Storage and consent

With `storage-key`, the choices go to localStorage and come back on the next
visit. Without it, they stay in memory: they carry from one programme to the
next while the page is open, as in a playlist, and they are gone on reload.

A page that needs consent leaves `storage-key` off, and sets it when its own
consent banner allows. The element then writes the choices the viewer already
made. The player never asks the viewer anything.

```ts
// Your consent banner's own callback.
consent.onAccept(() => {
  document.querySelector('mbx-preferences')?.setAttribute('storage-key', 'my-site');
});
```

The entry is JSON with a version, `{ "version": 1, "values": { … } }`. An
entry of another version is ignored. Every storage call sits in `try`, so a
browser that blocks storage keeps the choices in memory.

## The store

`preferences()` gives the store. The same key gives the same object, so every
player and element of the page share it.

```ts
import { preferences, preferencesOf } from '@mattebox/player-preferences';

const prefs = preferences({ key: 'my-site' });
prefs.get('volume');
prefs.set('volume', 0.4);
const off = prefs.on('volume', (value) => console.log(value));

// The store the <mbx-preferences> inside a player uses, or null without one.
preferencesOf(document.querySelector('mattebox-player'));
```

| Call                            | What it does                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `preferences({ key, storage })` | The store for `key`. Without `key`, the memory store. `storage` is localStorage by default |
| `get(key)`                      | The value, or undefined                                                                    |
| `set(key, value)`               | Sets the value. Undefined removes it                                                       |
| `on(key, fn)`                   | Calls `fn` when the value changes, here or in another tab. Returns the unsubscribe         |

`storage` takes any object with `getItem` and `setItem`: sessionStorage, or
your own, such as one over a cookie or a server.

## Keys of your own

An element of your own adds its keys to the `Preferences` type through
declaration merging, under a prefix of its name:

```ts
import { preferencesOf } from '@mattebox/player-preferences';

declare module '@mattebox/player-preferences' {
  interface Preferences {
    'my-app.theme': 'dark' | 'light';
  }
}

const prefs = preferencesOf(player);
prefs?.set('my-app.theme', 'dark');
```

`get` and `set` are typed by key, so a wrong value fails to compile.
