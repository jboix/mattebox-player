<h1>
  <img src="https://raw.githubusercontent.com/jboix/mattebox-player/main/docs/logo.svg" width="44" height="44" align="absmiddle" alt="">
  @mattebox/player-cast
</h1>

`<mbx-cast-button>` and `<mbx-cast-screen>` for the
[Mattebox player](https://github.com/jboix/mattebox-player): Chromecast
from the page, over Google's sender SDK.

- The button starts and ends a session.
- The screen covers the picture while the receiver plays. It shows the name of the receiver, play and pause, the seek slider, the time and a stop button.

The import registers both elements.

The cast is a package of its own because the button loads Google's script
onto the page. The player never loads third-party code for a page. The
AirPlay button uses Safari's own API, so it is part of the player.

```sh
npm install @mattebox/player-cast @mattebox/player mattebox
```

```html
<mattebox-player src="https://example.com/vod/master.m3u8" controls="custom">
  <mbx-cast-screen></mbx-cast-screen>
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
the session to the receiver, at the video's current time. When the session
ends, the engine resumes and the video continues from the time where the
receiver stopped.

The receiver plays the URL by itself. A signed URL goes as it is, since it
is the source's URL. The source's DRM servers go in `customData.mattebox`:
`licenseUrl`, `licenseUrls` and `certificateUrl`. `@mattebox/cast-receiver`
reads them.

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
