<h1>
  <img src="https://raw.githubusercontent.com/jboix/mattebox-player/main/docs/logo.svg" width="44" height="44" align="absmiddle" alt="">
  @mattebox/player-spatial-nav
</h1>

`<mbx-spatial-nav>` and `<mbx-gamepad>` for the
[Mattebox player](https://github.com/jboix/mattebox-player): the remote
control on a TV, and a game controller anywhere.

- The arrows move focus to the nearest control on their side. The opposite arrow goes back.
- On a slider, left and right seek or set the volume. In an open menu, every arrow is the menu's.
- The remote's Back goes back a step: the menu, then the controls, then your application.
- The remote's media keys reach the player under their standard names, on Tizen and webOS too.
- A game controller moves focus, selects, goes back, plays, scans and skips chapters. You change any button.
- `<mbx-gamepad-help>` lists what each button does, as the make of the pad prints it.

The import registers `<mbx-spatial-nav>`. The `/gamepad` entry registers it
with `<mbx-gamepad>` and `<mbx-gamepad-help>`, so a page with a remote alone
pays nothing for the controller. It is a package of its own because most
pages never run on a TV.

```sh
npm install @mattebox/player-spatial-nav @mattebox/player mattebox
```

```html
<mattebox-player src="https://example.com/vod/master.m3u8" controls="custom">
  <mbx-spatial-nav></mbx-spatial-nav>
  <mbx-gamepad map="west:mute"></mbx-gamepad>
  <mbx-gamepad-help></mbx-gamepad-help>
  <mbx-control-bar>
    <mbx-seek-bar key-mode="preview"></mbx-seek-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-spacer></mbx-spacer>
    <mbx-subtitles-menu></mbx-subtitles-menu>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import '@mattebox/player';
  import '@mattebox/player-spatial-nav/gamepad';
</script>
```

| Element            | Attribute                       | What it does                                                               |
| ------------------ | ------------------------------- | -------------------------------------------------------------------------- |
| `mbx-spatial-nav`  | `initial`                       | The tag of the control the first key focuses. `mbx-play-button` by default |
| `mbx-gamepad`      | `map`                           | Buttons to change, as `button:action` pairs. `none` unbinds one            |
| `mbx-gamepad-help` | `manual`, `close-ms`, `label-*` | Opens only on the help action; closes after; names the actions             |

| Event               | When                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `navigateout`       | An arrow finds no control on its side. `detail` is the direction. Your application moves focus out |
| `gamepadaction`     | A button is pressed, before its action. Cancel it to take the action                               |
| `gamepadconnect`    | A pad connects. `detail` holds its `kind` and `id`                                                 |
| `gamepaddisconnect` | A pad goes                                                                                         |

Your application registers the remote's media keys with the platform, for
example `tizen.tvinputdevice.registerKey` on Tizen. The player never does.

The [player guide](https://github.com/jboix/mattebox-player/blob/main/docs/guide/06-tv.md)
covers the elements in chapter 06.

## License

MIT
