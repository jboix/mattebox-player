<h1>
  <img src="https://raw.githubusercontent.com/jboix/mattebox-player/main/docs/logo.svg" width="44" height="44" align="absmiddle" alt="">
  @mattebox/player-spatial-nav
</h1>

`<mbx-spatial-nav>` for the
[Mattebox player](https://github.com/jboix/mattebox-player): the remote
control on a TV.

- The arrows move focus to the nearest control on their side. The opposite arrow goes back.
- On a slider, left and right seek or set the volume. In an open menu, every arrow is the menu's.
- The remote's Back goes back a step: the menu, then the controls, then your application.
- The remote's media keys reach the player under their standard names, on Tizen and webOS too.

The import registers the element. It is a package of its own because most
pages never run on a TV.

```sh
npm install @mattebox/player-spatial-nav @mattebox/player mattebox
```

```html
<mattebox-player src="https://example.com/vod/master.m3u8" controls="custom">
  <mbx-spatial-nav></mbx-spatial-nav>
  <mbx-control-bar>
    <mbx-seek-bar key-mode="preview"></mbx-seek-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-spacer></mbx-spacer>
    <mbx-subtitles-menu></mbx-subtitles-menu>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import '@mattebox/player';
  import '@mattebox/player-spatial-nav';
</script>
```

| Attribute | What it does                                                               |
| --------- | -------------------------------------------------------------------------- |
| `initial` | The tag of the control the first key focuses. `mbx-play-button` by default |

| Event         | When                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `navigateout` | An arrow finds no control on its side. `detail` is the direction. Your application moves focus out |

Your application registers the remote's media keys with the platform, for
example `tizen.tvinputdevice.registerKey` on Tizen. The player never does.

The [player guide](https://github.com/jboix/mattebox-player/blob/main/docs/guide/06-tv.md)
covers the element in chapter 06.

## License

MIT
