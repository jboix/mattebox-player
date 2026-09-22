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

The receiver plays the URL by itself, so DRM and signed URLs are the page's
to arrange, in the `castload` event. The event carries the load request
before the button sends it:

```ts
button.addEventListener('castload', (event) => {
  event.detail.customData = { licenseUrl: 'https://drm.example/widevine' };
});
```

`receiver` on the button names the receiver application. Without it, the
button uses the Default Media Receiver. With `sdk="none"`, the page loads
the SDK instead of the button. The
[guide](https://github.com/jboix/mattebox-player/blob/main/docs/guide/03-the-element.md#casting)
explains the rest.
