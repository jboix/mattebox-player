# 12 Fallback and versions

A programme can have more than one source: the same picture in two
formats, at two CDNs, or in another version such as sign language. The
player tries the sources in order until one plays, and offers the versions
in its video menu.

## Fallback

You list the sources in order, as `<source>` children or in the `sources`
property. The player plays the first one a handler takes. A source that
fails before the first frame gives way to the next one.

```ts
player.sources = [
  { url: 'https://cdn-a.example/vod/master.m3u8' },
  { url: 'https://cdn-b.example/vod/manifest.mpd', type: 'application/dash+xml' },
];
```

- Each replaced source dispatches `error` with `fatal: false` and its
  `source`. The error of the last one is fatal.
- After the first `playing` event, the player stays on the source. The
  engine's own recovery handles errors from then on.
- `retry()` loads the list again from the start, as does the Retry of
  `<mbx-error-screen>`.
- `switchSource(source)` loads another source of the same programme in
  place, holding the frame, the position and the tracks.

[Chapter 02](02-handlers.md#several-sources) has the rules of the list, and
[chapter 03](03-the-element.md#several-sources) the attributes of a
`<source>`.

## Versions of the picture

A source can name other versions of its picture at their own URLs, such as
a sign-language version. `<mbx-video-menu>` lists them after the video
tracks of the manifest. You declare them as `<mbx-video-track>` children,
which apply to the `src` attribute and the `<source>` children:

```html
<mattebox-player controls="custom" src="vod/master.m3u8">
  <mbx-video-track src="vod/sign.m3u8" kind="sign" srclang="sgg"></mbx-video-track>
</mattebox-player>
```

| Attribute of `<mbx-video-track>` | What it does                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `src`                            | Sets the URL of the version                                                             |
| `kind`                           | Sets the kind, as HTML's `VideoTrack.kind`: `sign`, `captions`, `alternative` (default) |
| `label`                          | Sets the name the menu shows. Without it, the menu names the kind                       |
| `srclang`                        | Sets the language tag                                                                   |
| `type`                           | Sets its MIME type                                                                      |

From script, a source of the `sources` property carries the same fields in
`videoTracks`, with `url`, `language` and an optional `drm`:

```ts
player.sources = [
  { url: 'vod/master.m3u8', videoTracks: [{ url: 'vod/sign.m3u8', kind: 'sign', language: 'sgg' }] },
];
```

- A version is a new load, not a track switch. The picture stops for as long as the version takes to start.
- The last frame stays on screen as the poster until the version shows its own. A video from another origin needs CORS for this; without it, the poster shows.
- The controls show the play state from before until then, and the player carries `switching`.
- The version starts at the same position and in the same play state. A live source joins it at its live edge.
- The audio and subtitle tracks with the same language, audio description and SDH are selected on the version.
- On a version, the menu offers the source back instead of the version's own tracks.
- A new `src`, `sources` or `<source>` load is a new source, and drops the versions of the old one.

## Example

A programme at two CDNs, with a sign-language version:

```html
<mattebox-player controls="custom">
  <source src="https://cdn-a.example/vod/master.m3u8" type="application/vnd.apple.mpegurl" />
  <source src="https://cdn-b.example/vod/master.m3u8" type="application/vnd.apple.mpegurl" />
  <mbx-video-track src="https://cdn-a.example/vod/sign.m3u8" kind="sign" srclang="sgg"></mbx-video-track>
  <mbx-control-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-seek-bar></mbx-seek-bar>
    <mbx-video-menu></mbx-video-menu>
  </mbx-control-bar>
</mattebox-player>
```
