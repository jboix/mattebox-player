<h1>
  <img src="https://raw.githubusercontent.com/jboix/mattebox-player/main/docs/logo.svg" width="44" height="44" align="absmiddle" alt="">
  @mattebox/player-preferences
</h1>

The viewer's preferences for the
[Mattebox player](https://github.com/jboix/mattebox-player).

- `<mbx-preferences>` keeps the audio and subtitle tracks, the volume, the mute, the rate, the quality and the subtitle look.
- It puts them back at each load, by language and kind.
- `preferences()` is a store that every player and element of the page share. Your own elements add typed keys to it.
- Without `storage-key`, nothing is written to storage.

```sh
npm install @mattebox/player-preferences @mattebox/player mattebox
```

```html
<mattebox-player src="https://example.com/vod/master.m3u8" controls="custom">
  <mbx-preferences storage-key="my-site"></mbx-preferences>
  <mbx-control-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-audio-menu></mbx-audio-menu>
    <mbx-subtitles-menu></mbx-subtitles-menu>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import '@mattebox/player';
  import '@mattebox/player-preferences';
</script>
```

| Attribute     | What it does                                                                       |
| ------------- | ---------------------------------------------------------------------------------- |
| `storage-key` | Stores the choices in localStorage under this key. Without it, they stay in memory |
| `except`      | The keys the element leaves alone, such as `except="rate quality"`                 |

The [player guide](https://github.com/jboix/mattebox-player/blob/main/docs/guide/08-preferences.md)
explains the store and your own keys.

## License

MIT
