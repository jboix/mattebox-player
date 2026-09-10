# @mattebox/player-diagnostics

`<mbx-diagnostics>` for the
[Mattebox player](https://github.com/jboix/mattebox-player): what the
session is doing and what the browser can do, inside the player, and a
report to send when something goes wrong. In the bar it is a button that
opens a panel over the picture; anywhere else in the player, the panel
itself, in flow under the video. Importing the package registers the
element.

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

The panel has four pages: the playback facts, the charts of the buffer,
the throughput, the stalls, the frames and the quality switches, the
engine's state, and the browser's support for codecs and DRM. The Copy
button puts the report on the clipboard, `element.report()` returns it,
and every fatal error dispatches it as a `report` event on the element,
bubbling through the player:

```ts
player.addEventListener('report', (event) => {
  navigator.sendBeacon('/diagnostics', JSON.stringify(event.detail));
});
```

The [guide](https://github.com/jboix/mattebox-player/blob/main/docs/guide/05-diagnostics.md)
covers the rest.
