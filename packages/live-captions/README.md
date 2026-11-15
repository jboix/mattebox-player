<h1>
  <img src="https://raw.githubusercontent.com/jboix/mattebox-player/main/docs/logo.svg" width="44" height="44" align="absmiddle" alt="">
  @mattebox/player-live-captions
</h1>

Live captions for the
[Mattebox player](https://github.com/jboix/mattebox-player): the browser
recognizes what is said in the video and writes it over the picture.

- The words appear as they are said and roll up, five words a line, two lines at most.
- Recognition runs on the device. No sound leaves it unless you allow a server.
- The viewer turns live captions on from the subtitles menu, where a badge says a machine wrote them.
- They follow the subtitle size and background chosen in the subtitles menu.
- Chrome is the one browser that recognizes speech from a video today. Elsewhere nothing shows.

```sh
npm install @mattebox/player-live-captions @mattebox/player mattebox
```

```html
<mattebox-player src="https://example.com/vod/master.m3u8" controls="custom">
  <mbx-live-captions></mbx-live-captions>
  <mbx-control-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-subtitles-menu></mbx-subtitles-menu>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import '@mattebox/player';
  import '@mattebox/player-live-captions';
</script>
```

The [guide chapter](https://github.com/jboix/mattebox-player/blob/main/docs/guide/15-live-captions.md)
lists the attributes, the events and the limits.

## License

MIT
