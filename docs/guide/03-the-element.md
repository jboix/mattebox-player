# 03 The element

This chapter covers `<mattebox-player>`: its attributes, properties, events,
and the panels it draws over the engine's namespaces.

## Attributes

| Attribute     | Is                                                            |
| ------------- | ------------------------------------------------------------- |
| `src`         | The source URL. Changing it loads the new source.             |
| `type`        | The source's MIME type. Optional when the extension is known. |
| `preset`      | The engine preset by name, default `dual`.                    |
| `license-url` | The DRM license URL, given to `engine.drm.setLicenseUrl`.     |
| `thumbnails`  | A thumbnail track URL, given to `engine.thumbnails.load`.     |
| `autoplay`    | Forwarded onto the video, as an attribute.                    |
| `muted`       | Forwarded onto the video, as an attribute.                    |
| `poster`      | Forwarded onto the video, as an attribute.                    |

## Properties

| Property | Is                                    |
| -------- | ------------------------------------- |
| `player` | The core's `Player`                   |
| `engine` | The current session's engine, or null |
| `video`  | The `<video>` inside, in light DOM    |

## Events

The core's `sourcechange` and `error` are re-dispatched as `CustomEvent`s on
the element, composed and bubbling, with the core's payload as `detail`.

```ts
player.addEventListener('error', (event) => {
  console.error(event.detail.code);
});
```

## Stages come from the integrator

Attribute-only usage gets the named preset. From JavaScript, the constructor
and the static `define()` accept a handler list or a stage list, so the page
decides what the engine carries.

```ts
import { MatteboxPlayerElement } from '@mattebox/player';
import hlsCmaf from 'mattebox/protocols/hls-cmaf';
import abr from 'mattebox/stages/abr';

MatteboxPlayerElement.define({ stages: [hlsCmaf(), abr()] });
```

## The panels

Native controls carry playback. The panels cover only what the video cannot
show. Each one feature-tests its namespace and renders nothing for a native
session.

| Panel      | Shows                                               | Namespace           |
| ---------- | --------------------------------------------------- | ------------------- |
| Quality    | The renditions, with "auto" meaning no pin          | `engine.quality`    |
| Tracks     | Audio and text track selectors                      | `engine.tracks`     |
| Live       | A badge with the latency and a go-to-edge button    | `engine.live`       |
| DRM        | The key system in use                               | `engine.drm`        |
| Thumbnails | A preview on the scrub bar, when the app gave a URL | `engine.thumbnails` |
| Error      | The category and code, with a retry                 | the `error` event   |

## Lifecycle

`disconnectedCallback` disposes the session. Reconnecting reloads the `src`.

## Example

```html
<mattebox-player
  src="https://example.com/live/master.m3u8"
  preset="hls"
  muted
  autoplay
></mattebox-player>

<script type="module">
  import '@mattebox/player';
</script>
```

Next: [04 CDN](04-cdn.md).
