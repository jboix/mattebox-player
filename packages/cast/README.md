<h1>
  <img src="https://raw.githubusercontent.com/jboix/mattebox-player/main/docs/logo.svg" width="44" height="44" align="absmiddle" alt="">
  @mattebox/player-cast
</h1>

`<mbx-cast-button>` for the
[Mattebox player](https://github.com/jboix/mattebox-player): Chromecast
from the page, over Google's sender SDK.

- The button starts and ends a session.
- During the session the player's own controls drive the receiver: play, pause, the seek bar, the volume, the chapters.
- `<mbx-casting>` of the player covers the picture with the poster and names the receiver.

The import registers the button.

The cast is a package of its own because the button loads Google's script
onto the page. The player never loads third-party code for a page. The
AirPlay button uses Safari's own API, so it is part of the player.

```sh
npm install @mattebox/player-cast @mattebox/player mattebox
```

The package needs mattebox 0.17.

```html
<mattebox-player src="https://example.com/vod/master.m3u8" controls="custom">
  <mbx-casting></mbx-casting>
  <mbx-control-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-seek-bar></mbx-seek-bar>
    <mbx-spacer></mbx-spacer>
    <mbx-cast-button></mbx-cast-button>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import '@mattebox/player';
  import '@mattebox/player-cast';
</script>
```

When a session starts, the player pauses the video and suspends the engine,
so the engine requests nothing during the cast. It then sends the source of
the session to the receiver, at the video's current time. Every load during
the session goes to the receiver too, such as the next item of a playlist.
When the session ends, the engine resumes and the video continues from the
time where the receiver stopped.

## What the receiver gets

The request carries the programme with the source.

| What                                            | Where                                                  |
| ----------------------------------------------- | ------------------------------------------------------ |
| The URL and the type                            | `media.contentId`, `media.contentType`                 |
| Live or on demand                               | `media.streamType`                                     |
| The subtitle files of the video                 | `media.tracks`                                         |
| The title, the subtitle and the image           | `media.metadata`                                       |
| The time, and playing or paused                 | `currentTime`, `autoplay`                              |
| The DRM servers                                 | `customData.mattebox.licenseUrl` and the two beside it |
| The connector's type, with its id or its data   | `customData.mattebox.programme`                        |
| The metadata, with the chapters and the markers | `customData.mattebox.metadata`                         |
| The chapters file and the thumbnail track       | `customData.mattebox.chapters`, `.thumbnails`          |
| The other versions of the picture               | `customData.mattebox.videoTracks`                      |
| The clock time a live viewer watches            | `customData.mattebox.date`                             |
| What each add-on sends, under its name          | `customData.mattebox.addons`                           |

- `@mattebox/cast-receiver` reads `customData.mattebox`. The Default Media Receiver reads Cast's own fields only.
- A receiver page with the same connector loads the programme by its type and id, with its own token. Without it, the receiver plays the URL with the metadata sent.
- No preference is sent: the receiver picks its own audio, subtitles and quality.
- A request holds 64 kB. The connector's data is left out of a larger one.
- A signed URL goes as it is, since it is the source's URL.

The `castload` event carries the load request before the button sends it.
Add the license headers there:

```ts
player.addEventListener('castload', (event) => {
  event.detail.customData.mattebox.licenseHeaders = { Authorization: `Bearer ${token}` };
});
```

When the receiver's license server answers 401 or 403, the receiver asks
for a new token. The player dispatches `castunauthorized`. Reply with new
headers, or new servers:

```ts
player.addEventListener('castunauthorized', (event) => {
  event.detail.reply(fetchToken().then((token) => ({
    licenseHeaders: { Authorization: `Bearer ${token}` },
  })));
});
```

The messages go on the `urn:x-cast:ch.mattebox.license` namespace
(`LICENSE_NAMESPACE`). The receiver waits 10 seconds for a reply.

`receiver` on the button names the receiver application. Without it, the
button uses the Default Media Receiver. With `sdk="none"`, the page loads
the SDK instead of the button. The
[guide](https://github.com/jboix/mattebox-player/blob/main/docs/guide/03-the-element.md#casting)
explains the rest.
