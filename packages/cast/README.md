<h1>
  <img src="https://raw.githubusercontent.com/jboix/mattebox-player/main/docs/logo.svg" width="44" height="44" align="absmiddle" alt="">
  @mattebox/player-cast
</h1>

`<mbx-cast-button>` and `<mbx-cast-screen>` for the
[Mattebox player](https://github.com/jboix/mattebox-player): Chromecast
from the page, over Google's sender SDK. The button starts and ends a
session, and the screen covers the picture while the receiver plays, with
its name, play and pause, the seek slider, the time and a stop button.
Importing the package registers both elements.

It is a package of its own because the button loads Google's script onto
the page, which the player never does on an integrator's behalf. The AirPlay
button, over Safari's own API, ships with the player.

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

On start the player pauses the video, freezes the engine so nothing is
fetched for a paused picture, and sends the session's source to the
receiver at the video's time. On end the engine resumes and the video
picks up where the receiver stopped. The receiver plays the URL by itself,
so DRM and signed URLs are the page's to arrange through the `castload`
event, which carries the load request before it goes out:

```ts
button.addEventListener('castload', (event) => {
  event.detail.customData = { licenseUrl: 'https://drm.example/widevine' };
});
```

`receiver` on the button names the receiver application, the Default Media
Receiver without one; `sdk="none"` leaves loading the SDK to the page. The
[guide](https://github.com/jboix/mattebox-player/blob/main/docs/guide/03-the-element.md#casting)
covers the rest.
