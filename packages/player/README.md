# @mattebox/player

The `<mattebox-player>` custom element of the
[Mattebox player](https://github.com/jboix/mattebox-player): a real
`<video>` with native controls, and panels for what the video cannot show,
over the [mattebox](https://github.com/jboix/mattebox) engine. Importing the
package registers the element.

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
