# 03 The element

This chapter covers `<mattebox-player>`: its attributes, properties, events,
and the panels it draws over the engine's namespaces.

## Attributes

| Attribute     | Is                                                            |
| ------------- | ------------------------------------------------------------- |
| `src`         | The source URL. Changing it loads the new source.             |
| `type`        | The source's MIME type. Optional when the extension is known. |
| `preset`      | The engine preset by name, default `full`.                    |
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

Attribute-only usage gets the named preset, `full` unless the attribute says
otherwise. `full` composes every stage the engine ships, so every panel has
its namespace and no source kind is missing an adapter. Naming a narrower
preset, or passing a stage list, is optimization: it trades features for
bytes, and the engine's guide chapter 02 has the matrix.

From JavaScript, the constructor and the static `define()` accept a handler
list or a stage list, so the page decides what the engine carries.

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

| Panel      | Shows                                            | Namespace           |
| ---------- | ------------------------------------------------ | ------------------- |
| Quality    | The renditions, with "auto" meaning no pin       | `engine.quality`    |
| Tracks     | Audio and text track selectors                   | `engine.tracks`     |
| Live       | A badge with the latency and a go-to-edge button | `engine.live`       |
| DRM        | The key system in use                            | `engine.drm`        |
| Thumbnails | Nothing yet: the track is loaded, not drawn      | `engine.thumbnails` |
| Error      | The category and code, with a retry              | the `error` event   |

The live badge needs more than its namespace. `full` composes both live
adapters, so `engine.live` is there for a VOD stream too; what makes a stream
live is an availability window, so the badge shows only once `edge` is set.

The thumbnails panel draws nothing in v1. Native controls expose no scrub
position, so a preview has nothing to anchor to. The `thumbnails` attribute
still loads the track, so `engine.thumbnails.at(time)` answers for the app,
and the preview arrives with custom controls.

## Styling

The panels are in shadow DOM, so the page's stylesheet does not reach them by
accident. It reaches them on purpose through `::part()`, which carries every
CSS property.

```css
mattebox-player::part(quality-option) { font: inherit; border-radius: 0; }
mattebox-player::part(quality-option):hover { background: rebeccapurple; }
mattebox-player::part(live-badge)::after { content: ' ●'; }
```

Two rules make that work, and neither is optional. Nothing in the element's
own stylesheet carries `!important`: for normal declarations the outer tree
wins over the shadow tree, so a page's `::part()` rule beats the default
whatever its specificity, and an `!important` inside would invert that.
And every element the element draws carries a `part`, because `::part()`
cannot descend: `::part(quality) select` matches nothing.

Each element carries a generic name before its specific one, so
`::part(select)` reaches every menu and `::part(quality-select)` reaches one.

| Part                                                                            | Is                                                  |
| ------------------------------------------------------------------------------- | --------------------------------------------------- |
| `panels`                                                                        | The bar holding the panels                          |
| `panel`                                                                         | Every panel root, and the error surface             |
| `label`, `text`, `value`, `select`, `option`, `button`, `badge`                 | Every element of that kind                          |
| `quality`, `quality-label`, `quality-text`, `quality-select`, `quality-playing` | The quality menu, and the rendition decoding now    |
| `tracks`, `audio-label`, `audio-text`, `audio-select`                           | The audio menu                                      |
| `text-label`, `text-text`, `text-select`                                        | The subtitle menu                                   |
| `live`, `live-badge`, `live-latency`, `live-edge-button`                        | The live badge                                      |
| `at-edge`                                                                       | On the live panel while the playhead is at the edge |
| `drm`, `drm-text`, `drm-key-system`                                             | The DRM indicator                                   |
| `error`, `error-category`, `error-code`, `error-retry`                          | The error surface                                   |

State rides the part name because `::part()` takes no attribute selector:
`mattebox-player::part(at-edge)` is how a page styles the edge state.

Part names are public API. New ones are added freely; existing ones are not
renamed without a major version.

For the tokens that cross every panel there are custom properties, which also
work on browsers older than `::part()`: `--mbx-surface`, `--mbx-text`,
`--mbx-muted`, `--mbx-accent`, `--mbx-error`, `--mbx-radius`, `--mbx-gap`,
`--mbx-pad`, `--mbx-font`.

The shadow root is open, so a page that needs more than `::part()` reaches
past it: `player.shadowRoot.append(style)` on any browser, or
`adoptedStyleSheets` on a modern one.

The `<video>` is in light DOM, so the page styles it directly.

## Browser support

The element is a custom element, so it needs Custom Elements v1: Chrome 54,
Safari 10.1, Firefox 63, Edge 79. Shadow DOM v1 lands at or before that on
every engine, so it costs nothing extra. `::part()` needs Chrome 73,
Safari 13.1, Firefox 72; below it the custom properties above still apply.

The engine's own floor is lower, ES2015. An integrator below the element's
floor takes `@mattebox/player-core` and brings their own UI, which is what
the two packages are for.

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
