# 03 The element

This chapter covers `<mattebox-player>`: its attributes, properties, events,
and the panels it draws over the engine's namespaces.

## Attributes

| Attribute             | Is                                                                                                                                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src`                 | The source URL. Changing it loads the new source.                                                                                                                                                                                                    |
| `type`                | The source's MIME type. Optional when the extension is known.                                                                                                                                                                                        |
| `preset`              | The engine preset by name, default `full`.                                                                                                                                                                                                           |
| `license-url`         | The DRM license URL, given to `engine.drm.setLicenseUrl`.                                                                                                                                                                                            |
| `thumbnails`          | A thumbnail track URL, given to `engine.thumbnails.load`.                                                                                                                                                                                            |
| `controls`            | `native` (the default), `custom` for the element's own bar, or `none` for a page that draws its own. Changing it never reloads.                                                                                                                      |
| `idle-ms`             | Milliseconds of pointer stillness before the bar hides while playing. Default 3000.                                                                                                                                                                  |
| `seek-step`           | Seconds an arrow key moves the playhead on the seek bar. Default 5.                                                                                                                                                                                  |
| `seek-page`           | Seconds Page Up and Page Down move it. Default 30.                                                                                                                                                                                                   |
| `skip-back`           | Seconds the skip-back button moves the playhead. Default 10; 0 leaves that button out.                                                                                                                                                               |
| `skip-forward`        | Seconds the skip-forward button moves it. Default 10; 0 leaves that button out.                                                                                                                                                                      |
| `start`               | Whether the large play sits over the picture while paused. Default 1; 0 leaves it out.                                                                                                                                                               |
| `live-window`         | How many forward buffer goals long a live window must be to get a seek bar. Default 3; 0 makes every live stream seekable.                                                                                                                           |
| `layout`              | Which controls the buttons row carries, by name and in order, with `\|` between the left and the right cluster. A name left out is a control left out. Default `skip-back play skip-forward volume \| speed subtitles audio quality pip fullscreen`. |
| `subtitle-size`       | `small`, `medium`, `large` or `xlarge`, as the subtitles menu sets it. Default medium.                                                                                                                                                               |
| `subtitle-background` | `none`, `dark` or `solid`. Default dark.                                                                                                                                                                                                             |
| `autoplay`            | Forwarded onto the video, as an attribute.                                                                                                                                                                                                           |
| `muted`               | Forwarded onto the video, as an attribute and into its muted state, which the attribute alone sets only at creation.                                                                                                                                 |
| `poster`              | Forwarded onto the video, as an attribute.                                                                                                                                                                                                           |

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
list or a stage list, so the page decides what the engine carries, and a
`controls` object with the bar's knobs, which the attributes of the same
names in kebab-case override.

```ts
import { MatteboxPlayerElement } from '@mattebox/player';
import hlsCmaf from 'mattebox/protocols/hls-cmaf';
import abr from 'mattebox/stages/abr';

MatteboxPlayerElement.define({
  stages: [hlsCmaf(), abr()],
  controls: { skipBack: 15, skipForward: 30, liveWindow: 2 },
});
```

## The panels

Under native controls the video carries playback and the panels, in a row
under it, cover only what the video cannot show. Each one feature-tests its
namespace and renders nothing for a native session. Under `controls="custom"`
the row is hidden and the bar carries the same choices as menus: quality,
audio and subtitles, with a live button and a lock for DRM.

| Panel      | Shows                                                     | Namespace           |
| ---------- | --------------------------------------------------------- | ------------------- |
| Quality    | The renditions, with "auto" meaning no pin                | `engine.quality`    |
| Tracks     | Audio and text track selectors                            | `engine.tracks`     |
| Live       | A badge with the latency and a go-to-edge button          | `engine.live`       |
| DRM        | The key system in use                                     | `engine.drm`        |
| Thumbnails | The tile in the seek bar's preview, under custom controls | `engine.thumbnails` |
| Error      | The category and code, with a retry                       | the `error` event   |

The live badge needs more than its namespace. `full` composes both live
adapters, so `engine.live` is there for a VOD stream too; what makes a stream
live is an availability window, so the badge shows only once `edge` is set.

Thumbnails have no panel. Native controls expose no scrub position, so under
`controls="native"` the `thumbnails` attribute loads the track and
`engine.thumbnails.at(time)` answers for the app, and nothing is drawn. Under
`controls="custom"` the seek bar's preview draws the tile above the pointer,
scaled to `--mbx-preview-width`, 160px unless the page says otherwise.

## The bar

`controls="custom"` takes the browser's controls off the video and draws the
element's own bar over it: the time, the seek bar and the duration, then
skip back, play, skip forward, the volume, and on the right the menus and
picture in picture and fullscreen. The panels row is hidden, and the bar
carries its choices as menus. The bar fades on one timer: any pointer movement or press, any key,
or playback starting re-arms it for `idle-ms`, and when it fires the bar
hides unless the video is paused, a menu is open, or keyboard focus is
inside it. Whether the pointer is over the element is never tracked. The
fade honours `prefers-reduced-motion`.

For live, the seek bar maps the availability window and marks the edge, and
a dot, red at the edge and grey behind it, seeks to the edge on a click. The
time and the hover preview read the wall clock when the stream carries an
anchor, program date time or an availability start, and the distance behind
the edge otherwise. A window under `live-window` buffer goals gets no bar,
since there is nowhere to go, and then the dot stays red and the button
inert, since there is nowhere to come back from either.

Fullscreen goes on the stage, the video and the bar and nothing else. The
stage is in shadow DOM and `:fullscreen` does not match the element for it,
so the element reflects the state as a `fullscreen` attribute on itself:
`mattebox-player[fullscreen] > video` is how a page styles the video in
that state, and lifts any height it capped it at.

The hover preview shows the time and, given a `thumbnails` track, the tile.

The subtitles menu carries the track, and a Settings page behind it with a
size and a background, which the element reflects as `subtitle-size` and
`subtitle-background` on itself, so a page can set them in markup and
persist them as it likes. The speed menu writes `video.playbackRate`. A
menu never leaves the picture: it takes the room above its button as its
height and scrolls past that.

Subtitles are the browser's own cues on the video, so while the bar shows,
every active cue the author left unpositioned is moved above it, and put
back when the bar hides. Two cues shown at once stack, each by its measured
height. Their look is a small sheet the bar puts in the document, once,
with one rule per size and per background: `::cue` can only be styled from
the document that holds the video, and it takes no custom properties. The
sizes are percentages of the browser's own cue size, which follows the
video's height. A page that wants more writes its own
`mattebox-player > video::cue` rule, which wins by coming later.

Every control is keyboard reachable and named, and the sliders read their
value in words. While focus is inside the element, these keys work from
anywhere in it:

| Key                            | Does                                                      |
| ------------------------------ | --------------------------------------------------------- |
| Space, `k`                     | Play or pause. Space on a button is that button's         |
| `m`                            | Mute or unmute                                            |
| `f`                            | Enter or leave fullscreen                                 |
| Left, Right                    | Seek by `seek-step`                                       |
| Up, Down, Page keys, Home, End | On a slider, move it by its step, its page, or to its end |
| Up, Down, Home, End, Escape    | In a menu, move, and close                                |

The `layout` attribute, or the `layout` option, says which of these the
buttons row carries and in what order: `skip-back`, `play`, `skip-forward`,
`volume`, `speed`, `subtitles`, `audio`, `quality`, `drm`, `pip` and
`fullscreen`, with `|` between the left and the right cluster. The seek row
is not part of it. The package exports the default as `LAYOUT`; `drm`, the
lock, is not in it.

Over the picture, a large play shows while the video is paused and a replay
once it has ended, and a fatal error takes the whole picture with the
category, the code and a retry, in place of the row under the video that
native mode uses.

A click on the video toggles play. Under `custom` the element gives itself
`tabindex="0"` so a click on the video leaves the shortcuts somewhere to
listen; a page that set its own `tabindex` keeps it.

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

| Part                                                                                                                                            | Is                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `stage`                                                                                                                                         | Wraps the video, and holds the bar over it                                                             |
| `controls`                                                                                                                                      | The bar, while `controls="custom"`                                                                     |
| `idle`                                                                                                                                          | On the bar while it is hidden for stillness                                                            |
| `playing`, `muted`, `fullscreen`                                                                                                                | On the bar while the video is in that state                                                            |
| `row`, `seek-row`, `buttons`                                                                                                                    | The bar's rows: the time, the bar, the duration and the live button; then the buttons                  |
| `group`, `volume-group`, `cluster`                                                                                                              | The mute button with its slider, which unfolds under the pointer or focus; and the right-hand cluster  |
| `skip-back-button`, `skip-forward-button`                                                                                                       | The skip buttons                                                                                       |
| `seek-backward-icon`, `seek-forward-icon`, and the `-10` and `-30` forms                                                                        | Their glyphs                                                                                           |
| `seekable`                                                                                                                                      | On the bar while the stream can be seeked: always for VOD, and for live once the window is wide enough |
| `seek`, `seek-track`, `seek-fill`, `seek-thumb`                                                                                                 | The seek bar and its layers                                                                            |
| `buffered`, `buffered-range`, `seek-buffered`, `seek-buffered-range`                                                                            | The buffered ranges on the track                                                                       |
| `hover`, `seek-hover`, `preview`, `seek-preview`                                                                                                | The hover position, and the box above it                                                               |
| `preview-image`, `preview-tile`, `preview-time`, and the `seek-` forms                                                                          | The tile and the time inside the preview                                                               |
| `edge`, `seek-edge`                                                                                                                             | The live edge on the track                                                                             |
| `live-button`, `live-dot`, `live-text`                                                                                                          | The live button, its dot and its word; the button and the dot carry `at-edge` at the edge              |
| `slot`, `subtitles-slot`, `audio-slot`, `quality-slot`, `drm-slot`                                                                              | Where a per-session menu sits in the row, empty for a native session                                   |
| `menu`, `quality-menu`, `audio-menu`, `text-menu`                                                                                               | A menu: its button and its popup                                                                       |
| `quality-button`, `audio-button`, `text-button`                                                                                                 | The button that opens a menu                                                                           |
| `popup`, `quality-popup`, `audio-popup`, `text-popup`, `speed-popup`                                                                            | The list above the button                                                                              |
| `section`, `section-label`, and the `text-track-section`, `text-size-section`, `text-background-section` forms                                  | A section of a list and its heading                                                                    |
| `speed-menu`, `speed-button`, `speed-item`, `playback-speed-icon`                                                                               | The speed menu                                                                                         |
| `item`, `quality-item`, `audio-item`, `text-item`                                                                                               | One choice in a list                                                                                   |
| `page-item`, `text-settings-item`, `back-item`, `text-back-item`                                                                                | An entry that opens a page, and the Back at a page's top                                               |
| `open`                                                                                                                                          | On a menu while its popup shows                                                                        |
| `checked`                                                                                                                                       | On the chosen item                                                                                     |
| `drm-badge`                                                                                                                                     | The lock, named for the key system and its keys                                                        |
| `tooltip`, `drm-tooltip`, `tooltip-title`, `tooltip-text`                                                                                       | What the lock shows on hover or focus: the key system and the key statuses                             |
| `settings-icon`, `music-icon`, `closed-captions-icon`, `closed-captions-on-icon`, `lock-closed-icon`                                            | The glyphs of the menus and the lock                                                                   |
| `live`                                                                                                                                          | On the bar while the stream has an availability window                                                 |
| `control`, `play-button`, `mute-button`, `pip-button`, `fullscreen-button`                                                                      | The bar's buttons                                                                                      |
| `start-button`                                                                                                                                  | The large play over the picture while paused, a replay once ended                                      |
| `paused`                                                                                                                                        | On the bar while the video is paused                                                                   |
| `error-screen`, `error-box`, `error-title`, `error-detail`, `error-separator`, `error-retry`                                                    | The error over the picture under custom controls; `error-category` and `error-code` as in the row      |
| `pip`                                                                                                                                           | On the bar while the video is in picture in picture                                                    |
| `picture-in-picture-icon`, `picture-in-picture-exit-icon`                                                                                       | The picture-in-picture glyphs                                                                          |
| `icon`, `play-icon`, `pause-icon`, `replay-icon`, `mute-icon`, `volume-low-icon`, `volume-high-icon`, `fullscreen-icon`, `fullscreen-exit-icon` | The glyph inside a button, by what it shows                                                            |
| `slider`, `rail`, `track`, `fill`, `thumb`                                                                                                      | Every slider and its layers; the rail is the track's extent, inset so the thumb is whole at either end |
| `volume`, `volume-track`, `volume-fill`, `volume-thumb`                                                                                         | The volume slider                                                                                      |
| `dragging`                                                                                                                                      | On a slider while a pointer holds it                                                                   |
| `at-edge`                                                                                                                                       | On the live button, as on the live panel, while the playhead is at the edge                            |
| `time`, `current-time`, `time-separator`, `duration`                                                                                            | The time display                                                                                       |
| `panels`                                                                                                                                        | The bar holding the panels                                                                             |
| `panel`                                                                                                                                         | Every panel root, and the error surface                                                                |
| `label`, `text`, `value`, `select`, `option`, `button`, `badge`                                                                                 | Every element of that kind                                                                             |
| `quality`, `quality-label`, `quality-text`, `quality-select`, `quality-playing`                                                                 | The quality menu, and the rendition decoding now                                                       |
| `tracks`, `audio-label`, `audio-text`, `audio-select`                                                                                           | The audio menu                                                                                         |
| `text-label`, `text-text`, `text-select`                                                                                                        | The subtitle menu                                                                                      |
| `live`, `live-badge`, `live-latency`, `live-edge-button`                                                                                        | The live badge                                                                                         |
| `at-edge`                                                                                                                                       | On the live panel while the playhead is at the edge                                                    |
| `drm`, `drm-text`, `drm-key-system`                                                                                                             | The DRM indicator                                                                                      |
| `error`, `error-category`, `error-code`, `error-retry`                                                                                          | The error surface                                                                                      |

State rides the part name because `::part()` takes no attribute selector:
`mattebox-player::part(at-edge)` is how a page styles the edge state.

Part names are public API. New ones are added freely; existing ones are not
renamed without a major version.

For the tokens that cross every panel there are custom properties, which also
work on browsers older than `::part()`: `--mbx-surface`, `--mbx-text`,
`--mbx-muted`, `--mbx-accent`, `--mbx-error`, `--mbx-radius`, `--mbx-gap`,
`--mbx-pad`, `--mbx-font`, `--mbx-live`, `--mbx-preview-width`.

The shadow root is open, so a page that needs more than `::part()` reaches
past it: `player.shadowRoot.append(style)` on any browser, or
`adoptedStyleSheets` on a modern one.

The `<video>` is in light DOM, so the page styles it directly. Its default
from the element is full width at 16:9 until the media's own ratio is known,
so the box does not jump when the metadata arrives; a page that knows its
media sets `aspect-ratio` on the video itself.

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
