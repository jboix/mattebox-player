<h1>
  <img src="https://raw.githubusercontent.com/jboix/mattebox-player/main/docs/logo.svg" width="44" height="44" align="absmiddle" alt="">
  @mattebox/player
</h1>

The `<mattebox-player>` custom element of the
[Mattebox player](https://github.com/jboix/mattebox-player): a real
`<video>` with native controls, panels for what the video cannot show, and
under `controls="custom"` a bar of controls that are elements the page
places inside it, over the [mattebox](https://github.com/jboix/mattebox)
engine. Importing the package registers every element.

```sh
npm install @mattebox/player mattebox
```

```html
<mattebox-player src="https://example.com/vod/master.m3u8"></mattebox-player>

<script type="module">
  import '@mattebox/player';
</script>
```

The [guide](https://github.com/jboix/mattebox-player/blob/main/docs/guide/README.md)
covers the rest.
