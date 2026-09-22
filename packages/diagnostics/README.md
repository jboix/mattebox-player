<h1>
  <img src="https://raw.githubusercontent.com/jboix/mattebox-player/main/docs/logo.svg" width="44" height="44" align="absmiddle" alt="">
  @mattebox/player-diagnostics
</h1>

`<mbx-diagnostics>` for the
[Mattebox player](https://github.com/jboix/mattebox-player). The element
shows, inside the player, what the session is doing and what the browser
supports. It also builds a report a page sends when playback fails.

- Inside the bar, the element is a button that opens a panel over the picture.
- Anywhere else in the player, the element is the panel itself, under the video.

The import registers the element.

```sh
npm install @mattebox/player-diagnostics @mattebox/player mattebox
```

```html
<mattebox-player src="https://example.com/vod/master.m3u8" controls="custom">
  <mbx-control-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-seek-bar></mbx-seek-bar>
    <mbx-spacer></mbx-spacer>
    <mbx-diagnostics></mbx-diagnostics>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import '@mattebox/player';
  import '@mattebox/player-diagnostics';
</script>
```

The panel has four pages:

- The playback facts.
- The charts of the buffer, the throughput, the stalls, the frames and the quality switches.
- The state of the engine.
- The browser's support for codecs and DRM.

The report is available in three ways. The Copy button puts it on the
clipboard. `element.report()` returns it. Every fatal error dispatches it
as a `report` event on the element, and the event bubbles through the
player:

```ts
player.addEventListener('report', (event) => {
  navigator.sendBeacon('/diagnostics', JSON.stringify(event.detail));
});
```

The [guide](https://github.com/jboix/mattebox-player/blob/main/docs/guide/05-diagnostics.md)
explains the rest.
