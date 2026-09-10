# 03 The element

This chapter covers `<mattebox-player>`: its attributes, properties and
events, and the controls that go inside it, over the picture under
`controls="custom"` and in a row under it otherwise.

## Attributes

| Attribute             | Is                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src`                 | The source URL. Changing it loads the new source. Setting it to its own value loads it again.                                                           |
| `type`                | The source's MIME type. Optional when the extension is known.                                                                                           |
| `preset`              | The engine preset by name, default `full`.                                                                                                              |
| `license-url`         | The DRM license URL, given to `engine.drm.setLicenseUrl`.                                                                                               |
| `thumbnails`          | A thumbnail track URL, given to `engine.thumbnails.load`.                                                                                               |
| `chapters`            | A WebVTT chapters track URL. A hidden `<track kind="chapters">` on the video, which the seek bar and the chapters menu read. Changing it never reloads. |
| `controls`            | `native` (the default), `custom` for the controls elements inside the player, or `none` for a page that draws its own. Changing it never reloads.       |
| `subtitle-size`       | `small`, `medium`, `large` or `xlarge`, as the subtitles menu sets it. Default medium.                                                                  |
| `subtitle-background` | `none`, `dark` or `solid`. Default dark.                                                                                                                |
| `autoplay`            | Forwarded onto the video, as an attribute.                                                                                                              |
| `muted`               | Forwarded onto the video, as an attribute and into its muted state. The element also reflects the video's muted state back into it.                     |
| `poster`              | Forwarded onto the video, as an attribute.                                                                                                              |
| `crossorigin`         | Forwarded onto the video, as an attribute. A chapters track from another origin loads only with it.                                                     |

The element reflects state as attributes on itself, for the page's
stylesheet and for the controls alike. `mattebox-player[playing]` is how a
page styles the playing state.

| State attribute              | Set by                        | While                                                       |
| ---------------------------- | ----------------------------- | ----------------------------------------------------------- |
| `paused`, `playing`, `ended` | The element                   | The video is in that state                                  |
| `muted`                      | The element                   | The video is muted                                          |
| `fullscreen`                 | The bar, the button           | The player is the fullscreen element                        |
| `pip`                        | The picture-in-picture button | The video is in the floating window                         |
| `idle`                       | The bar                       | The bar is hidden for stillness                             |
| `live`                       | The seek bar                  | The stream has an availability window                       |
| `seekable`                   | The seek bar                  | The stream can be seeked: VOD, or a live window wide enough |

## Properties

| Property | Is                                                                                  |
| -------- | ----------------------------------------------------------------------------------- |
| `player` | The core's `Player`                                                                 |
| `engine` | The current session's engine, or null                                               |
| `video`  | The `<video>` inside, in light DOM                                                  |
| `error`  | The fatal error of the current load, or null once a load starts or playback resumes |

## Events

The core's `sourcechange` and `error` are re-dispatched as `CustomEvent`s on
the element, composed and bubbling, with the core's payload as `detail`.
When `sourcechange` fires, `engine` already answers for the new session.

```ts
player.addEventListener('error', (event) => {
  console.error(event.detail.code);
});
```

## Stages come from the integrator

Attribute-only usage gets the named preset, `full` unless the attribute says
otherwise. `full` composes every stage the engine ships, so every control has
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

Kernel tuning goes the same way, as `config`, with a preset from the
attribute or with a stage list: `traceCapacity` for a page that wants the
engine to keep its trace for `engine.error`, `bufferGoalSeconds` and the
rest of the engine's `KernelConfig`. A handler list carries its own.

```ts
MatteboxPlayerElement.define({ config: { traceCapacity: 500 } });
```

## The controls

`controls="custom"` takes the browser's controls off the video, and the
controls are elements the page places inside the player, beside the video.
The bar lays its children out in its order; a control the page leaves out
is a control left out. Every control carries its parameters and its words
as attributes, and takes a page's own glyph through a slot.

```html
<mattebox-player src="…" controls="custom">
  <mbx-start-button></mbx-start-button>
  <mbx-error-screen></mbx-error-screen>
  <mbx-control-bar>
    <mbx-current-time></mbx-current-time>
    <mbx-seek-bar></mbx-seek-bar>
    <mbx-duration></mbx-duration>
    <mbx-play-button label-play="Reproduir" label-pause="Pausa"></mbx-play-button>
    <mbx-skip-button seconds="15"></mbx-skip-button>
    <mbx-spacer></mbx-spacer>
    <mbx-fullscreen-button>
      <svg slot="icon-enter" viewBox="0 0 32 32">…</svg>
    </mbx-fullscreen-button>
  </mbx-control-bar>
</mattebox-player>
```

A player under `controls="custom"` with no `<mbx-control-bar>` child gets
the default composition appended to its own light DOM, once its children
are all in: the document parsed, or the microtask after a scripted
connect. It is this, and a page can start from it:

```html
<mbx-start-button></mbx-start-button>
<mbx-error-screen></mbx-error-screen>
<mbx-control-bar>
  <mbx-current-time></mbx-current-time>
  <mbx-seek-bar></mbx-seek-bar>
  <mbx-duration></mbx-duration>
  <mbx-live-button></mbx-live-button>
  <mbx-skip-button seconds="-10"></mbx-skip-button>
  <mbx-play-button></mbx-play-button>
  <mbx-skip-button seconds="10"></mbx-skip-button>
  <mbx-volume></mbx-volume>
  <mbx-spacer></mbx-spacer>
  <mbx-speed-menu></mbx-speed-menu>
  <mbx-chapters-menu></mbx-chapters-menu>
  <mbx-subtitles-menu></mbx-subtitles-menu>
  <mbx-audio-menu></mbx-audio-menu>
  <mbx-quality-menu></mbx-quality-menu>
  <mbx-pip-button></mbx-pip-button>
  <mbx-fullscreen-button></mbx-fullscreen-button>
</mbx-control-bar>
```

The bar has two rows: the seek row over the buttons row. A child with
`slot="seek"` sits in the seek row; the times, the seek bar and the live
button put themselves there unless the page wrote a `slot` of its own.
Everything else sits in the buttons row, in its order, and `<mbx-spacer>`
pushes what follows to the right.

### Only what you compose

The root entry registers every element, and the CDN bundle carries them
all. A page on a bundler that composes its own bar takes the player alone
and one entry per control it writes, and carries only those:

```ts
import '@mattebox/player/element';
import '@mattebox/player/elements/control-bar';
import '@mattebox/player/elements/play-button';
import '@mattebox/player/elements/seek-bar';
```

Each control entry registers its element and the player with it. A page on
these entries writes its composition: the default one names elements the
page did not import, and an element the page did not import renders
nothing.

### The elements

Each element reads and writes the video from outside, the way a page would,
and reads the engine's namespaces through the player. One that reads a
namespace hides while the session has none: a native session shows no
quality, audio or subtitles menu and no live button.

| Element                 | Attributes                                | Labels                                                                                                                                                                                                         | Icon slots                               | Does                                                                                                                                                                                                              |
| ----------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mbx-control-bar`       | `idle-ms`, `seek-step`                    |                                                                                                                                                                                                                |                                          | The overlay, the fade, the shortcuts, the click on the video, and the subtitles lifted above it                                                                                                                   |
| `mbx-spacer`            |                                           |                                                                                                                                                                                                                |                                          | Takes the room in a row                                                                                                                                                                                           |
| `mbx-play-button`       |                                           | `label-play`, `label-pause`, `label-replay`                                                                                                                                                                    | `icon-play`, `icon-pause`, `icon-replay` | Play, pause, and replay once ended                                                                                                                                                                                |
| `mbx-mute-button`       |                                           | `label-mute`, `label-unmute`                                                                                                                                                                                   | `icon-mute`, `icon-low`, `icon-high`     | Mute and unmute, the level in the glyph, `aria-pressed`                                                                                                                                                           |
| `mbx-volume-slider`     | `step`, `page`                            | `label`                                                                                                                                                                                                        |                                          | The volume, zero while muted; a level above zero unmutes. Carries `dragging`                                                                                                                                      |
| `mbx-volume`            |                                           |                                                                                                                                                                                                                |                                          | The mute button with the slider unfolding from it under the pointer or focus; fills itself with both when empty                                                                                                   |
| `mbx-skip-button`       | `seconds`, negative for back              | `label` with `{seconds}`                                                                                                                                                                                       | `icon`                                   | Moves the playhead by the amount, within what the video can reach                                                                                                                                                 |
| `mbx-current-time`      |                                           |                                                                                                                                                                                                                |                                          | The position, "1:23"; on live the wall clock or the distance behind the edge, hidden while live and not seekable                                                                                                  |
| `mbx-duration`          |                                           |                                                                                                                                                                                                                |                                          | The duration, "4:56", hidden on live                                                                                                                                                                              |
| `mbx-seek-bar`          | `step`, `page`, `live-window`, `chapters` | `label`, `label-of` with `{current}` and `{duration}`, `label-behind` with `{time}`                                                                                                                            |                                          | The position, the buffered ranges, the live window and edge, and the preview. Divided at the chapters, which the preview names; `chapters="none"` leaves it whole. Sets `live` and `seekable`; carries `dragging` |
| `mbx-live-button`       |                                           | `text`, `label-live`, `label-at-edge`                                                                                                                                                                          |                                          | Shown on a live stream, seeks to the edge, disabled there. Carries `at-edge`                                                                                                                                      |
| `mbx-speed-menu`        | `rates`, space-separated                  | `label`, `label-normal`, `label-back` with `{page}`                                                                                                                                                            | `icon`                                   | `video.playbackRate`, for every session                                                                                                                                                                           |
| `mbx-chapters-menu`     |                                           | `label`, `label-back`                                                                                                                                                                                          | `icon`                                   | The video's chapters with their start times, the current one checked; a choice seeks. Hidden without chapters, for every session                                                                                  |
| `mbx-quality-menu`      |                                           | `label`, `label-auto`, `label-back`                                                                                                                                                                            | `icon`                                   | The pin over `engine.quality`, where auto means none                                                                                                                                                              |
| `mbx-audio-menu`        |                                           | `label`, `label-back`                                                                                                                                                                                          | `icon`                                   | The audio track over `engine.tracks`, shown when there is a choice                                                                                                                                                |
| `mbx-subtitles-menu`    |                                           | `label`, `label-back`, `label-off`, `label-track`, `label-settings`, `label-size`, `label-background`, `label-small`, `label-medium`, `label-large`, `label-xlarge`, `label-none`, `label-dark`, `label-solid` | `icon`, `icon-on`                        | The text track with off, and a Settings page with the size and the background, written to `subtitle-size` and `subtitle-background` on the player                                                                 |
| `mbx-drm-badge`         |                                           | `label` with `{system}` and `{keys}`, `label-key` and `label-keys` with `{count}` and `{statuses}`, `label-no-key`                                                                                             | `icon`                                   | A lock over `engine.drm`, its tooltip on hover and focus. Not in the default composition                                                                                                                          |
| `mbx-pip-button`        |                                           | `label-enter`, `label-exit`                                                                                                                                                                                    | `icon-enter`, `icon-exit`                | Picture in picture, hidden without an API. Sets `pip`                                                                                                                                                             |
| `mbx-fullscreen-button` |                                           | `label-enter`, `label-exit`                                                                                                                                                                                    | `icon-enter`, `icon-exit`                | Fullscreen on the player, hidden without an API. Sets `fullscreen`                                                                                                                                                |
| `mbx-start-button`      |                                           | `label-play`, `label-replay`                                                                                                                                                                                   | `icon-play`, `icon-replay`               | The large play over the picture while paused, a replay once ended, gone while playing and behind an error                                                                                                         |
| `mbx-error-screen`      |                                           | `label-title`, `label-retry`                                                                                                                                                                                   |                                          | A fatal error over the picture, with the category, the code and a retry that loads `src` again                                                                                                                    |
| `mbx-panels`            |                                           |                                                                                                                                                                                                                |                                          | The row under the video for native controls, hidden while every child is                                                                                                                                          |

Every menu carries `open` on itself while its popup shows, and the bar
holds its fade while any descendant does. A popup never leaves the picture:
it takes the room above its button as its height and scrolls past that.

### Words

Every word a control shows or names itself with is an attribute of that
control, and English is the value when the attribute is absent. One name
per state: `label-play`, `label-pause`, `label-replay`. A label with a value
carries it in braces, and a name the control has no value for stays as
written: `label="Enrere {seconds} segons"`. Translation is the page's, in
whatever way the page manages its strings; the element ships no locales.

```html
<mbx-play-button label-play="Reproduir" label-pause="Pausa" label-replay="Torna a reproduir"></mbx-play-button>
<mbx-skip-button seconds="-10" label="Enrere {seconds} segons"></mbx-skip-button>
<mbx-seek-bar label="Cerca" label-of="{current} de {duration}"></mbx-seek-bar>
```

A track's name in the audio and subtitles menus is the language, then the
role, then the id, whichever the manifest gave, and a rendition's is its
height or its bitrate. Those come from the stream and have no attribute.

### Glyphs

A button's glyph is a named slot per state, with the element's own glyph as
the fallback. A page drops its own SVG in, and the button keeps its name:
the glyph is decoration, `aria-hidden`, and the name is on the button where
a screen reader reads it.

```html
<mbx-play-button>
  <svg slot="icon-play" viewBox="0 0 24 24"><path d="…" /></svg>
  <svg slot="icon-pause" viewBox="0 0 24 24"><path d="…" /></svg>
</mbx-play-button>
```

The element's own glyphs come from Vidstack's media-icons, MIT, and the
notice ships in the package as `NOTICE`.

### A control of your own

Any element inside the bar is a control. It sits in the row where the page
put it, and it finds its player the way the element's own controls do:

- The nearest `mattebox-player` above it, through shadow hosts. Wait for
  `customElements.whenDefined('mattebox-player')` before reading it.
- `player.video` for playback, `player.engine` for the namespaces, null for
  a native session, `player.player` for the core, and `player.error`.
- `sourcechange` on the player for a new session, `error` for a failure.
- Set `open` on itself while it shows a popup, so the bar holds its fade.
- A real `<button>` for anything Space should reach: the bar leaves Space
  to a focused button.

That is the whole surface a control gets. Anything the element's own
controls need beyond it is a gap in this API, and the gap is the bug.

`@mattebox/player-diagnostics` is a control written this way, in a package
of its own, and chapter 05 covers it.

### The bar

The bar fades on one timer: any pointer movement or press, any key, or
playback starting re-arms it for `idle-ms`, and when it fires the bar hides
unless the video is paused, a descendant carries `open`, or keyboard focus
is inside it. Whether the pointer is over the element is never tracked. The
fade honours `prefers-reduced-motion`.

Fullscreen goes on the player itself, so every control the page placed
inside comes along, and `mattebox-player:fullscreen` matches. The player
reflects it as `fullscreen` too, for the Safari versions that have only the
prefixed API: `mattebox-player[fullscreen] > video` is how a page lifts any
height it capped the video at.

Subtitles are the browser's own cues on the video, so while the bar shows,
every active cue the author left unpositioned is moved above it, and put
back when the bar hides. Two cues shown at once stack, each by its measured
height. Their look is a small sheet the bar puts in the document, once,
with one rule per size and per background: `::cue` can only be styled from
the document that holds the video, and it takes no custom properties. The
sizes are percentages of the browser's own cue size, which follows the
video's height. A page that wants more writes its own
`mattebox-player > video::cue` rule, which wins by coming later.

For live, the seek bar maps the availability window and marks the edge, and
the live button seeks to the edge on a click. The time and the hover
preview read the wall clock when the stream carries an anchor, program date
time or an availability start, and the distance behind the edge otherwise.
A window under `live-window` buffer goals gets no bar, since there is
nowhere to go, and then the live button stays red and inert, since there is
nowhere to come back from either.

Every control is keyboard reachable and named, and the sliders read their
value in words. While focus is inside the element, these keys work from
anywhere in it:

| Key                            | Does                                                      |
| ------------------------------ | --------------------------------------------------------- |
| Space, `k`                     | Play or pause. Space on a button is that button's         |
| `m`                            | Mute or unmute                                            |
| `f`                            | Enter or leave fullscreen                                 |
| Left, Right                    | Seek by the bar's `seek-step`                             |
| Up, Down, Page keys, Home, End | On a slider, move it by its step, its page, or to its end |
| Up, Down, Home, End, Escape    | In a menu, move, and close                                |

A click on the video toggles play. Under `custom` the element gives itself
`tabindex="0"` so a click on the video leaves the shortcuts somewhere to
listen; a page that set its own `tabindex` keeps it.

## The panels

Under `controls="native"` and `none` the video carries playback, and a row
under it covers only what the video cannot show: the same menu elements the
bar carries, in `<mbx-panels>`, appended by default when the page wrote none.
Each one feature-tests its namespace and hides for a native session, and the
row hides with the last of them.

```html
<mbx-panels>
  <mbx-quality-menu></mbx-quality-menu>
  <mbx-audio-menu></mbx-audio-menu>
  <mbx-subtitles-menu></mbx-subtitles-menu>
  <mbx-chapters-menu></mbx-chapters-menu>
  <mbx-live-button></mbx-live-button>
  <mbx-drm-badge></mbx-drm-badge>
</mbx-panels>
```

A fatal error under native controls goes in the element's own row under the
video, the error surface, with the category, the code and a retry; under
`custom` the error screen element carries it instead.

The live button needs more than its namespace. `full` composes both live
adapters, so `engine.live` is there for a VOD stream too; what makes a stream
live is an availability window, so the button shows only once `edge` is set.

Thumbnails have no panel. Native controls expose no scrub position, so under
`controls="native"` the `thumbnails` attribute loads the track and
`engine.thumbnails.at(time)` answers for the app, and nothing is drawn. Under
`controls="custom"` the seek bar's preview draws the tile above the pointer,
scaled to `--mbx-preview-width`, 160px unless the page says otherwise.

Chapters are the video's own text track of kind `chapters`: the `chapters`
attribute puts a hidden `<track>` there from a WebVTT URL, and a page can
put one there itself, or build one with `addTextTrack`. The seek bar cuts
a gap at each boundary and names the chapter in the preview, and
`<mbx-chapters-menu>` lists them, in the bar and in the panels row alike,
because a native session has chapters the same way.

```html
<mattebox-player src="https://example.com/vod/master.m3u8" chapters="/vod/chapters.vtt" controls="custom"></mattebox-player>
```

## Styling

The controls are elements in the page's own light DOM, so the page's
stylesheet reaches each one by its tag: `mbx-play-button { margin: 0 4px }`.
Their insides are in shadow DOM, reached on purpose through `::part()`,
which carries every CSS property, and state on the element itself is an
attribute the selector can read.

```css
mbx-play-button::part(button) { border-radius: 50%; }
mattebox-player[playing] mbx-play-button::part(icon) { fill: rebeccapurple; }
mbx-quality-menu::part(item):hover { background: rebeccapurple; }
mbx-live-button[at-edge]::part(dot) { box-shadow: none; }
mbx-panels { background: #000; }
```

Two rules make that work, and neither is optional. Nothing in the element's
own stylesheets carries `!important`: for normal declarations the outer tree
wins over the shadow tree, so a page's `::part()` rule beats the default
whatever its specificity, and an `!important` inside would invert that. And
every element the controls draw carries a `part`, because `::part()` cannot
descend.

| Element                             | Parts                                                                                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mattebox-player`                   | `stage`, and the error surface: `error`, `error-category`, `error-code`, `error-retry`, `value`, `button`                                                |
| `mbx-control-bar`                   | `row`, `seek-row`, `buttons-row`                                                                                                                         |
| Every button control                | `button`, `icon`                                                                                                                                         |
| `mbx-volume-slider`, `mbx-seek-bar` | `slider`, `rail`, `track`, `fill`, `thumb`                                                                                                               |
| `mbx-seek-bar`                      | `buffered`, `buffered-range`, `hover`, `edge`, `preview`, `preview-image`, `preview-tile`, `preview-title`, `preview-time`                               |
| `mbx-live-button`                   | `button`, `dot`, `text`                                                                                                                                  |
| Every menu                          | `button`, `icon`, `popup`, `section`, `section-label`, `item`, `item-detail`, `page-item`, `back-item`, and `<name>-item` and `<name>-section` per group |
| A menu's chosen item                | `checked`, on the item's part: the one state that rides a part name, because an item inside a shadow root has no other seam                              |
| `mbx-drm-badge`                     | `icon`, `tooltip`, `tooltip-title`, `tooltip-text`                                                                                                       |
| `mbx-error-screen`                  | `box`, `title`, `detail`, `category`, `separator`, `code`, `retry`                                                                                       |

Part names are public API. New ones are added freely; existing ones are not
renamed without a major version.

For the tokens that cross every control there are custom properties, set on
the player and inherited into every control: `--mbx-surface`, `--mbx-text`,
`--mbx-muted`, `--mbx-accent`, `--mbx-error`, `--mbx-radius`, `--mbx-gap`,
`--mbx-pad`, `--mbx-font`, `--mbx-live`, `--mbx-preview-width`.

The shadow roots are open, so a page that needs more than `::part()` reaches
past them: `control.shadowRoot.append(style)` on any browser, or
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
A control attaches when it is connected inside a player and detaches when it
is removed, so a framework that reorders or replaces children is safe.

## Example

A player with its own bar in Catalan, its own play glyphs, and a control of
the page's own.

```html
<mattebox-player src="https://example.com/vod/master.m3u8" controls="custom">
  <mbx-start-button label-play="Reproduir"></mbx-start-button>
  <mbx-error-screen label-title="Error de reproducció" label-retry="Torna-ho a provar"></mbx-error-screen>
  <mbx-control-bar>
    <mbx-current-time></mbx-current-time>
    <mbx-seek-bar label="Cerca" label-of="{current} de {duration}"></mbx-seek-bar>
    <mbx-play-button label-play="Reproduir" label-pause="Pausa">
      <svg slot="icon-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
      <svg slot="icon-pause" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
    </mbx-play-button>
    <mbx-volume>
      <mbx-mute-button label-mute="Silencia" label-unmute="Activa el so"></mbx-mute-button>
      <mbx-volume-slider label="Volum"></mbx-volume-slider>
    </mbx-volume>
    <mbx-spacer></mbx-spacer>
    <my-share-button></my-share-button>
    <mbx-fullscreen-button label-enter="Pantalla completa" label-exit="Surt"></mbx-fullscreen-button>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import '@mattebox/player';

  class MyShareButton extends HTMLElement {
    async connectedCallback() {
      await customElements.whenDefined('mattebox-player');
      const player = this.closest('mattebox-player');
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', 'Comparteix');
      button.textContent = '↗';
      button.addEventListener('click', () => {
        navigator.share({ url: player.getAttribute('src') });
      });
      this.append(button);
    }
  }
  customElements.define('my-share-button', MyShareButton);
</script>
```
