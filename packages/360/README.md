<h1>
  <img src="https://raw.githubusercontent.com/jboix/mattebox-player/main/docs/logo.svg" width="44" height="44" align="absmiddle" alt="">
  @mattebox/player-360
</h1>

360° video for the
[Mattebox player](https://github.com/jboix/mattebox-player): the picture is
drawn onto the inside of a sphere, and the viewer looks around.

- A drag turns the view, the wheel zooms, and a game controller's right stick turns it.
- A tap plays or pauses, as on a flat video.
- The source says it is 360°: your connector, or HLS `REQ-VIDEO-LAYOUT`.
- WebGL 1 only, down to Chromium 76.
- An encrypted source plays flat: no browser lets a page draw a DRM picture.

```sh
npm install @mattebox/player-360 @mattebox/player mattebox
```

```html
<mattebox-player src="https://example.com/vod/360/master.m3u8" controls="custom">
  <mbx-360 projection="equirectangular"></mbx-360>
  <mbx-control-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-seek-bar></mbx-seek-bar>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import '@mattebox/player';
  import '@mattebox/player-360';
</script>
```

The [guide chapter](https://github.com/jboix/mattebox-player/blob/main/docs/guide/16-360-video.md)
lists the attributes, the properties and the limits.

## License

MIT
