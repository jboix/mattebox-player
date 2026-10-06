# 04 CDN

This chapter explains how to use the player from a script tag.

## Two tags

The page loads two bundles: the engine first, then the player. The player's
bundle contains the core and the element, and reads the engine from the
`mattebox` global.

`mattebox.min.js` contains the `full` preset. The engine's guide, chapter
14, lists the smaller bundles. The page picks the engine bundle, and with
it the size of the engine.

```html
<mattebox-player src="https://example.com/vod/master.m3u8"></mattebox-player>

<script src="https://cdn.jsdelivr.net/npm/mattebox@0.2.1/dist/cdn/mattebox.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/@mattebox/player@0.1.0/dist/cdn/mattebox-player.min.js" defer></script>
```

Deferred scripts run in document order, so the player finds the engine.

Pin both versions in the URL. A URL without a version follows the latest
release, and the code can change under a published page.

## The matteboxPlayer global

| Member                                 | What it is                         |
| -------------------------------------- | ---------------------------------- |
| `matteboxPlayer.MatteboxPlayerElement` | The element class, already defined |

The `preset` attribute names a preset the engine bundle contains. A CDN
engine bundle contains one preset, `mattebox.preset`.

## Integrity

A pinned URL can have a subresource integrity hash. A page with a content
security policy needs one. Compute the hash from the published file.

```sh
curl -s https://cdn.jsdelivr.net/npm/@mattebox/player@0.1.0/dist/cdn/mattebox-player.min.js \
  | openssl dgst -sha384 -binary | openssl base64 -A
```

```html
<script
  src="https://cdn.jsdelivr.net/npm/@mattebox/player@0.1.0/dist/cdn/mattebox-player.min.js"
  integrity="sha384-<hash>"
  crossorigin="anonymous"
  defer
></script>
```

## DRM on a native session

Safari plays HLS natively by default (see
[03 The element](03-the-element.md)). The engine does
not run then, and the player attaches the engine's DRM to the video with
`mattebox.attachEme`.

- The engine bundles with DRM have `mattebox.attachEme`: `mattebox.min.js` and the `-drm` bundles.
- The other engine bundles do not. A native session then attaches no DRM, and encrypted content fails to play.
- The player's bundle does not contain `attachEme`. It reads it from the engine's global.

A FairPlay stream needs the application certificate. Create the element from
JavaScript and pass the key system:

```html
<script src="https://cdn.jsdelivr.net/npm/mattebox@0.11.0/dist/cdn/mattebox.hls-drm.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/@mattebox/player@0.1.0/dist/cdn/mattebox-player.min.js" defer></script>
<script type="module">
  const player = new matteboxPlayer.MatteboxPlayerElement({
    drm: {
      keySystems: [mattebox.emeFairplay({ certificateUrl: 'https://drm.example/fps.cer' })],
      licenseUrl: 'https://drm.example/fps',
    },
  });
  player.setAttribute('src', 'https://example.com/vod/master.m3u8');
  document.body.append(player);
</script>
```
