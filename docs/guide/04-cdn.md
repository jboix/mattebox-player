# 04 CDN

This chapter covers using the element from a script tag.

## Two tags

The player's bundle carries the core and the element, and reads the engine
from the `mattebox` global. Load the engine bundle first;
`mattebox.min.js` carries the `full` preset, and the engine's guide, chapter
14, lists the narrower bundles. The page picks the engine's size.

```html
<mattebox-player src="https://example.com/vod/master.m3u8"></mattebox-player>

<script src="https://cdn.jsdelivr.net/npm/mattebox@0.2.1/dist/cdn/mattebox.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/@mattebox/player@0.1.0/dist/cdn/mattebox-player.min.js" defer></script>
```

Deferred scripts run in document order, so the player finds the engine.
Pin both versions in the URL. An unpinned URL follows the latest release
and can change under a live page.

## The matteboxPlayer global

| Member                                 | Is                                 |
| -------------------------------------- | ---------------------------------- |
| `matteboxPlayer.MatteboxPlayerElement` | The element class, already defined |

The `preset` attribute names the preset the engine bundle carries; with a
CDN engine there is one, `mattebox.preset`.

## Integrity

A pinned URL can have a subresource integrity hash, and a page with a
content security policy needs one. Compute it from the published file.

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
