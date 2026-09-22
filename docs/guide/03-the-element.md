# 03 The element

This chapter explains `<mattebox-player>`: its attributes, its properties
and its events. It then explains the controls placed inside it, which show
over the picture under `controls="custom"`.

## Attributes

| Attribute             | What it does                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src`                 | Sets the source URL. A new value loads the new source. The same value again loads it again                                                                                  |
| `type`                | Sets the MIME type of the source. Optional when the extension is known                                                                                                      |
| `preset`              | Names the engine preset. The default is `full`                                                                                                                              |
| `license-url`         | Sets the DRM license URL. The player gives it to `engine.drm.setLicenseUrl`                                                                                                 |
| `thumbnails`          | Sets a thumbnail track URL. The player gives it to `engine.thumbnails.load`                                                                                                 |
| `chapters`            | Sets a WebVTT chapters track URL. The player adds a hidden `<track kind="chapters">` to the video, which the seek bar and the chapters menu read. Changing it never reloads |
| `controls`            | Selects the controls: `native` (the default), `custom` for the control elements inside the player, or `none` to hide every child but the video. Changing it never reloads   |
| `subtitle-size`       | Sets the subtitle size: `small`, `medium`, `large` or `xlarge`. The subtitles menu writes it. The default is `medium`                                                       |
| `subtitle-background` | Sets the subtitle background: `none`, `dark` or `solid`. The default is `dark`                                                                                              |
| `playsinline`         | Plays inline on an iPhone. On by default. `playsinline="false"` lets the iPhone go to fullscreen on play. Changing it never reloads                                         |
| `autoplay`            | Copied onto the video as an attribute                                                                                                                                       |
| `muted`               | Copied onto the video, as an attribute and as the muted state. The player also writes the video's muted state back to it                                                    |
| `poster`              | Copied onto the video as an attribute                                                                                                                                       |
| `crossorigin`         | Copied onto the video as an attribute. A chapters track from another origin needs it                                                                                        |

The player reports its state as attributes on itself, for the page's
stylesheet and for the controls. `mattebox-player[playing]` matches while
the video plays.

| State attribute              | Set by                        | While                                                           |
| ---------------------------- | ----------------------------- | --------------------------------------------------------------- |
| `paused`, `playing`, `ended` | The player                    | The video is in that state                                      |
| `muted`                      | The player                    | The video is muted                                              |
| `audio`                      | The player                    | The source has no picture                                       |
| `started`                    | The player                    | The video has played once since its source was set              |
| `waiting`                    | The player                    | The video waits for data                                        |
| `fullscreen`                 | The bar, the button           | The player is the fullscreen element                            |
| `pip`                        | The picture-in-picture button | The video is in the floating window                             |
| `airplay`                    | The AirPlay button            | The video plays on an AirPlay target                            |
| `casting`                    | `@mattebox/player-cast`       | A Chromecast receiver plays the source, and the video is paused |
| `idle`                       | The bar                       | The bar is hidden after a time without input                    |
| `live`                       | The seek bar                  | The stream has an availability window                           |
| `seekable`                   | The seek bar                  | The viewer can seek: VOD, or a live window that is wide enough  |

`audio` comes from the type of the source until the metadata arrives: the
`type` attribute, or the URL's extension. After that it comes from the size
of the video. Zero by zero means sound only. The attribute follows a stream
that moves to or from an audio-only rendition.

The player only reports `audio`. The box stays at 16:9 until the page
changes it, for example with
`mattebox-player[audio] video { aspect-ratio: auto; height: 0; }`.

## Properties

| Property | What it is                                                                               |
| -------- | ---------------------------------------------------------------------------------------- |
| `player` | The `Player` of the core                                                                 |
| `engine` | The engine of the current session, or null                                               |
| `video`  | The `<video>` inside, in light DOM                                                       |
| `error`  | The fatal error of the current load. Null after a load starts and after playback resumes |

## Events

The player dispatches the core's `sourcechange` and `error` again as
`CustomEvent`s on itself. They bubble and they are composed. `detail` is
the core's payload. When `sourcechange` fires, `engine` already returns the
engine of the new session.

```ts
player.addEventListener('error', (event) => {
  console.error(event.detail.code);
});
```

`castload` comes from the button of `@mattebox/player-cast`. It fires
before the request goes to the receiver. It bubbles, it is composed, and it
is cancelable. Its `detail` is the load request of the sender SDK. The page
sets `customData` on it for its receiver, or cancels the load. See
[Casting](#casting).

## Stages

With attributes only, the player uses the preset the `preset` attribute
names, and `full` by default. `full` has every stage the engine ships, so
every control has its namespace and the player plays every kind of source.

A smaller preset or a list of stages downloads fewer bytes, and loses the
features of the stages left out. The engine's guide, chapter 02, has the
matrix.

From JavaScript, the constructor and the static `define()` take a handler
list or a stage list. The page then decides which stages the engine has.

```ts
import { MatteboxPlayerElement } from '@mattebox/player';
import hlsCmaf from 'mattebox/protocols/hls-cmaf';
import abr from 'mattebox/stages/abr';

MatteboxPlayerElement.define({ stages: [hlsCmaf(), abr()] });
```

`config` tunes the kernel in the same way. It works with a preset from the
attribute and with a stage list. `traceCapacity` makes the engine keep its
trace for `engine.error`, and `bufferGoalSeconds` sets the buffer goal.
Every member of the engine's `KernelConfig` is accepted. With a handler
list, the config goes on the handler.

```ts
MatteboxPlayerElement.define({ config: { traceCapacity: 500 } });
```

## The controls

`controls="custom"` removes the browser's controls from the video. The
controls are then elements placed inside the player, next to the video.

The bar shows its children in their order. A control left out does not
appear. Each control takes its parameters and its labels as attributes, and
its icon through a slot.

```html
<mattebox-player src="…" controls="custom">
  <mbx-title></mbx-title>
  <mbx-start-button></mbx-start-button>
  <mbx-error-screen></mbx-error-screen>
  <mbx-spinner></mbx-spinner>
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

The player appends nothing under `custom`. A player with no controls
inside stays empty, so the composition is always the page's. A composition
to start from, with most of the controls:

```html
<mbx-title></mbx-title>
<mbx-start-button></mbx-start-button>
<mbx-error-screen></mbx-error-screen>
<mbx-spinner></mbx-spinner>
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
  <mbx-airplay-button></mbx-airplay-button>
  <mbx-pip-button></mbx-pip-button>
  <mbx-fullscreen-button></mbx-fullscreen-button>
</mbx-control-bar>
```

The bar has two rows: the seek row above the buttons row.

- A child with `slot="seek"` goes in the seek row.
- The times, the seek bar and the live button go in the seek row by themselves, unless the page wrote a `slot` on them.
- Every other child goes in the buttons row, in its order.
- `<mbx-spacer>` pushes the controls after it to the right.

### Import only what you use

The root entry registers every element, and the CDN bundle contains them
all. A page on a bundler imports the player alone and one entry per control
it places. The bundle then contains only those controls.

```ts
import '@mattebox/player/element';
import '@mattebox/player/elements/control-bar';
import '@mattebox/player/elements/play-button';
import '@mattebox/player/elements/seek-bar';
```

Each control entry registers its element and the player.

An element the page did not import renders nothing.

### The elements

Each element reads and writes the video from outside, as a page would. It
reads the engine's namespaces through the player.

An element that reads a namespace hides while the session has none. A
native session shows no quality menu, no audio menu, no subtitles menu and
no live button.

| Element                 | Attributes                                | Labels                                                                                                                                                                                                         | Icon slots                               | What it does                                                                                                                                                                                                                                                              |
| ----------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mbx-control-bar`       | `idle-ms`, `seek-step`                    |                                                                                                                                                                                                                |                                          | Lays out the controls over the picture. It fades, handles the shortcuts and the click on the video, and moves the subtitles above itself                                                                                                                                  |
| `mbx-spacer`            |                                           |                                                                                                                                                                                                                |                                          | Takes the free room in a row                                                                                                                                                                                                                                              |
| `mbx-play-button`       |                                           | `label-play`, `label-pause`, `label-replay`                                                                                                                                                                    | `icon-play`, `icon-pause`, `icon-replay` | Plays and pauses. Replays after the end                                                                                                                                                                                                                                   |
| `mbx-mute-button`       |                                           | `label-mute`, `label-unmute`                                                                                                                                                                                   | `icon-mute`, `icon-low`, `icon-high`     | Mutes and unmutes. The icon shows the level. Sets `aria-pressed`                                                                                                                                                                                                          |
| `mbx-volume-slider`     | `step`, `page`                            | `label`                                                                                                                                                                                                        |                                          | Sets the volume. It shows zero while muted, and a level above zero unmutes. Has `dragging` during a drag                                                                                                                                                                  |
| `mbx-volume`            |                                           |                                                                                                                                                                                                                |                                          | Groups the mute button with a slider that unfolds under the pointer or on focus. It fills itself with both when left empty                                                                                                                                                |
| `mbx-skip-button`       | `seconds`, negative for back              | `label` with `{seconds}`                                                                                                                                                                                       | `icon`                                   | Moves the playhead by `seconds`, within the range the video can seek                                                                                                                                                                                                      |
| `mbx-current-time`      |                                           |                                                                                                                                                                                                                |                                          | Shows the position, such as "1:23". On live, it shows the wall clock or the distance behind the edge. Hidden on a live stream that is not seekable                                                                                                                        |
| `mbx-duration`          |                                           |                                                                                                                                                                                                                |                                          | Shows the duration, such as "4:56". Hidden on live                                                                                                                                                                                                                        |
| `mbx-remaining-time`    |                                           |                                                                                                                                                                                                                |                                          | Shows the time left, such as "-4:53". Hidden on live. The one for a bar that shows a single number                                                                                                                                                                        |
| `mbx-seek-bar`          | `step`, `page`, `live-window`, `chapters` | `label`, `label-of` with `{current}` and `{duration}`, `label-behind` with `{time}`                                                                                                                            |                                          | Shows the position, the buffered ranges, the live window and its edge, and the preview. It is divided at the chapters, and the preview names the chapter. `chapters="none"` removes the divisions. Sets `live` and `seekable` on the player. Has `dragging` during a drag |
| `mbx-live-button`       |                                           | `text`, `label-live`, `label-at-edge`                                                                                                                                                                          |                                          | Shows on a live stream and seeks to the edge. Disabled at the edge, where it has `at-edge`                                                                                                                                                                                |
| `mbx-speed-menu`        | `rates`, space-separated                  | `label`, `label-normal`, `label-back` with `{page}`                                                                                                                                                            | `icon`                                   | Sets `video.playbackRate`. Works for every session                                                                                                                                                                                                                        |
| `mbx-chapters-menu`     |                                           | `label`, `label-back`                                                                                                                                                                                          | `icon`                                   | Lists the chapters of the video with their start times, and checks the current one. A choice seeks. Hidden without chapters. Works for every session                                                                                                                      |
| `mbx-quality-menu`      |                                           | `label`, `label-auto`, `label-back`                                                                                                                                                                            | `icon`                                   | Pins a rendition through `engine.quality`. Auto means no pin                                                                                                                                                                                                              |
| `mbx-audio-menu`        |                                           | `label`, `label-back`                                                                                                                                                                                          | `icon`                                   | Selects the audio track through `engine.tracks`. Shown when there is more than one                                                                                                                                                                                        |
| `mbx-subtitles-menu`    |                                           | `label`, `label-back`, `label-off`, `label-track`, `label-settings`, `label-size`, `label-background`, `label-small`, `label-medium`, `label-large`, `label-xlarge`, `label-none`, `label-dark`, `label-solid` | `icon`, `icon-on`                        | Selects the text track, or off. Its Settings page sets the size and the background, and writes `subtitle-size` and `subtitle-background` on the player                                                                                                                    |
| `mbx-drm-badge`         |                                           | `label` with `{system}` and `{keys}`, `label-key` and `label-keys` with `{count}` and `{statuses}`, `label-no-key`                                                                                             | `icon`                                   | Shows a lock for `engine.drm`, with a tooltip on hover and on focus                                                                                                                                                                                                       |
| `mbx-airplay-button`    |                                           | `label`, `label-active`                                                                                                                                                                                        | `icon`, `icon-active`                    | Opens Safari's AirPlay picker. Hidden without AirPlay and while the video offers no target. Sets `airplay` on the player                                                                                                                                                  |
| `mbx-pip-button`        |                                           | `label-enter`, `label-exit`                                                                                                                                                                                    | `icon-enter`, `icon-exit`                | Toggles picture in picture. Hidden without the API. Sets `pip` on the player                                                                                                                                                                                              |
| `mbx-fullscreen-button` |                                           | `label-enter`, `label-exit`                                                                                                                                                                                    | `icon-enter`, `icon-exit`                | Toggles fullscreen on the player. Hidden without the API. Sets `fullscreen` on the player                                                                                                                                                                                 |
| `mbx-start-button`      |                                           | `label-play`, `label-replay`                                                                                                                                                                                   | `icon-play`, `icon-replay`               | Shows a large play button over the picture while paused, and a replay after the end. Hidden while playing, behind an error, and in a box too short to keep it above the bar                                                                                               |
| `mbx-error-screen`      |                                           | `label-title`, `label-retry`                                                                                                                                                                                   |                                          | Shows a fatal error over the picture, with the category, the code and a retry that loads `src` again                                                                                                                                                                      |
| `mbx-spinner`           |                                           | `label`                                                                                                                                                                                                        | `icon`                                   | Shows a turning ring in the place of the start button while the player has `waiting`                                                                                                                                                                                      |
| `mbx-title`             | `heading`, `subheading`, `artwork`        |                                                                                                                                                                                                                |                                          | Shows the artwork next to two lines of text, above the bar. Shown while the video is paused, including before the first play. Has `playing` for the page's own rule                                                                                                       |

The title's content comes from its attributes, because the stream has none
of it. It goes first among the screens, so its band paints under the start
button and the spinner.

CSS decides when the title shows. By default it shows while the video is
paused, which includes the time before the first play.

- `mattebox-player[started] mbx-title { display: none }` shows it only before the first play, like the poster.
- `mattebox-player:hover mbx-title { display: flex }` shows it again on hover.

Every menu has `open` on itself while its popup shows. The bar does not
fade while an element inside it has `open`.

A popup never leaves the picture. It uses the room above its button as its
height, and scrolls when it needs more.

### Casting

Chromecast is `@mattebox/player-cast`, a package of its own. Its button
loads Google's sender SDK onto the page, and the player never loads
third-party code for a page. The AirPlay button uses Safari's own API, so
it is part of the player.

Install the package and place its two elements, the way `<mbx-diagnostics>`
is placed.

```html
<mattebox-player src="…" controls="custom">
  <mbx-cast-screen></mbx-cast-screen>
  <mbx-control-bar>
    …
    <mbx-cast-button></mbx-cast-button>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import '@mattebox/player';
  import '@mattebox/player-cast';
</script>
```

`<mbx-cast-button>` starts and ends a Chromecast session.
`<mbx-cast-screen>` controls the receiver during the session.

The button loads the SDK from gstatic the first time it connects. It does
not load the SDK when the page already has it, or when the button has
`sdk="none"`. In that case the page loads the SDK.

`receiver` is the id of the receiver application. Without it, the button
uses the Default Media Receiver. The first button on the page decides the
receiver, because the SDK keeps one context per page.

| Element           | Attributes        | Labels                                                                           | Icon slots                |
| ----------------- | ----------------- | -------------------------------------------------------------------------------- | ------------------------- |
| `mbx-cast-button` | `receiver`, `sdk` | `label-start`, `label-stop`                                                      | `icon`, `icon-active`     |
| `mbx-cast-screen` |                   | `label` with `{device}`, `label-stop`, `label-play`, `label-pause`, `label-seek` | `icon-play`, `icon-pause` |

When a session starts, the player does this:

- It pauses the video.
- It suspends the engine, so the engine requests nothing during the cast.
- It sends the source of the session at the video's current time, with the subtitle tracks of the video, and `LIVE` for a live stream.
- It sets `casting` on itself. The default stylesheet then hides the bar and the start button, and the cast screen shows the receiver's controls.

When the session ends, the engine resumes. The video seeks to the time
where the receiver stopped, and plays if the receiver was playing. A live
stream returns to the live edge instead.

The receiver plays the URL by itself, so DRM and signed URLs are the page's
to arrange, in `castload`. The Default Media Receiver plays clear HLS and
DASH. A protected stream needs a receiver of the page's own, which reads
what the page put in `customData`.

```ts
button.addEventListener('castload', (event) => {
  event.detail.customData = { licenseUrl: 'https://drm.example/widevine' };
});
```

### Labels

Every text a control shows, and every name it gives itself, is an attribute
of that control. English is the value when the attribute is absent. Each
state has its own attribute: `label-play`, `label-pause`, `label-replay`.

A label can contain a value in braces: `label="Enrere {seconds} segons"`. A
name in braces the control does not know stays as written.

Translation is the page's, with whatever it uses for its strings. The
player ships no locales.

```html
<mbx-play-button label-play="Reproduir" label-pause="Pausa" label-replay="Torna a reproduir"></mbx-play-button>
<mbx-skip-button seconds="-10" label="Enrere {seconds} segons"></mbx-skip-button>
<mbx-seek-bar label="Cerca" label-of="{current} de {duration}"></mbx-seek-bar>
```

The audio and subtitles menus name a track by its language, then its role,
then its id, whichever the manifest gives. The quality menu names a
rendition by its height or its bitrate. These names come from the stream
and have no attribute.

### Icons

Every button has one named slot per state for its icon. The button shows
its own icon when the slot is empty.

A page puts its own SVG in the slot. The button keeps its name: the icon is
decoration with `aria-hidden`, and the name is on the button, where a
screen reader reads it.

```html
<mbx-play-button>
  <svg slot="icon-play" viewBox="0 0 24 24"><path d="…" /></svg>
  <svg slot="icon-pause" viewBox="0 0 24 24"><path d="…" /></svg>
</mbx-play-button>
```

The player's own icons come from Vidstack's media-icons, under the MIT
license. The package ships the notice as `NOTICE`.

### A control of your own

Any element inside the bar is a control. It shows in the row where the page
put it. It finds its player the way the player's own controls do:

- The nearest `mattebox-player` above it, through shadow hosts. Wait for `customElements.whenDefined('mattebox-player')` before reading it.
- `player.video` for playback, `player.engine` for the namespaces (null for a native session), `player.player` for the core, and `player.error`.
- `sourcechange` on the player for a new session, `error` for a failure.
- `open` on itself while it shows a popup, so the bar does not fade.
- A real `<button>` for anything Space must activate. The bar leaves Space to a focused button.

A control gets nothing else, and the player's own controls use nothing
else. A control of the player that needed more would be a bug in this API.

`@mattebox/player-diagnostics` and `@mattebox/player-cast` are controls
written this way, in packages of their own. Chapter 05 covers the
diagnostics, and [Casting](#casting) covers the cast.

### The bar

The bar fades on one timer. Any pointer movement or press, any key, and the
start of playback restart the timer for `idle-ms`. When the timer ends, the
bar hides, except in three cases:

- The video is paused.
- An element inside the bar has `open`.
- Keyboard focus is inside the bar.

The bar never tracks whether the pointer is over it. The fade respects
`prefers-reduced-motion`.

A narrow bar hides controls from its buttons row instead of overflowing.
Each child has a `priority`, and the bar hides the highest number first:

| Priority | Controls                                                               |
| -------- | ---------------------------------------------------------------------- |
| 5        | The volume slider                                                      |
| 4        | The diagnostics, the DRM lock, the speed and chapters menus            |
| 3        | The audio and quality menus, picture in picture                        |
| 2        | The skips                                                              |
| 1        | The subtitles menu, the mute button and the volume group               |
| 0        | Everything else. Never hidden: play and fullscreen stay at every width |

A `priority` attribute on a control replaces its default. A page's own
control in the bar starts at 0.

While the buttons need more room than the row has, minus a few pixels of
tolerance, the bar sets `collapsed` on the highest numbers, one at a time.
Among equal numbers it starts from the right. It removes the attribute
again when the bar gets wider.

The bar counts the folded volume slider at its unfolded width, so the row
has room for the slider when it unfolds. The slider is the first control to
go.

`collapsed` is an attribute, and one rule of the bar hides a collapsed
control. `mbx-speed-menu[collapsed]` is therefore the page's to style. A
page with its own breakpoints sets every priority to 0 and writes container
queries on the player.

Fullscreen goes on the player itself. Every control placed inside stays
visible, and `mattebox-player:fullscreen` matches. The player also sets
`fullscreen` on itself, for the Safari versions that only have the prefixed
API. `mattebox-player[fullscreen] > video` is where a page lifts a height
limit it set on the video.

The subtitles are the browser's own cues on the video. The bar moves the
active cues above itself while it shows, and moves them back when it hides.
It only moves a cue the author did not position. Two cues that show at once
stack, each by its measured height.

The bar styles the cues with a small stylesheet it adds to the document
once, with one rule per size and one per background. The stylesheet must be
in the document: `::cue` only accepts rules from the document that holds
the video, and it accepts no custom properties.

The sizes are percentages of the browser's own cue size, which follows the
height of the video. A page that wants more writes its own
`mattebox-player > video::cue` rule. That rule wins because it comes later.

On a live stream, the seek bar shows the availability window and marks the
edge. The live button seeks to the edge on a click. The time and the hover
preview show the wall clock when the stream has an anchor (a program date
time or an availability start). Otherwise they show the distance behind the
edge.

A window shorter than `live-window` buffer goals gets no seek bar, because
the viewer has no range to seek in. The live button then stays red and
disabled.

Every control is reachable with the keyboard, and every control has a name.
The sliders announce their value in words. While focus is inside the
player, these keys work from every control:

| Key                            | What it does                                                     |
| ------------------------------ | ---------------------------------------------------------------- |
| Space, `k`                     | Plays or pauses. Space on a focused button activates that button |
| `m`                            | Mutes or unmutes                                                 |
| `f`                            | Enters or leaves fullscreen                                      |
| Left, Right                    | Seeks by the `seek-step` of the bar                              |
| Up, Down, Page keys, Home, End | On a slider, moves it by its step, by its page, or to its end    |
| Up, Down, Home, End, Escape    | In a menu, moves the selection. Escape closes the menu           |

A click on the video plays or pauses. Under `custom` the player sets
`tabindex="0"` on itself, so the shortcuts still work after a click on the
video. A page that set its own `tabindex` keeps it.

## Native controls

Under `controls="native"`, the video shows the browser's own controls and
the player appends nothing. The quality, the tracks and the rest have no
control, because the browser's controls do not show them. A page that
wants them uses `controls="custom"`.

Under native controls, a fatal error shows in the player's own row under
the video, the error surface, with the category, the code and a retry.
Under `custom`, `<mbx-error-screen>` shows the error instead.

`controls="none"` takes the browser's controls off the video, appends
nothing, and hides every child but the video. A page keeps its composition
in place and turns it off with the one attribute. The bar's shortcuts still
listen while hidden, and the error surface still shows a fatal error.

The live button needs more than its namespace. `full` has both live stages,
so `engine.live` exists for a VOD stream too. A stream is live when it has
an availability window, so the button shows only after `edge` is set.

Native controls do not report the scrub position, so thumbnails have no
preview there.

- Under `controls="native"`, the `thumbnails` attribute loads the track and the player draws nothing. The app calls `engine.thumbnails.at(time)`.
- Under `controls="custom"`, the preview of the seek bar draws the tile above the pointer, scaled to `--mbx-preview-width`, 160px by default.

Chapters are a text track of kind `chapters` on the video. There are three
ways to add them:

- The `chapters` attribute with a WebVTT URL. The player adds a hidden `<track>`.
- A `<track>` on the video, written by the page.
- A track built with `addTextTrack`.

The seek bar leaves a gap at each chapter boundary and names the chapter in
the preview. `<mbx-chapters-menu>` lists the chapters. Chapters work for a
native session too.

```html
<mattebox-player src="https://example.com/vod/master.m3u8" chapters="/vod/chapters.vtt" controls="custom"></mattebox-player>
```

## Styling

The controls are elements in the page's own light DOM. The page's
stylesheet selects each one by its tag: `mbx-play-button { margin: 0 4px }`.

The inside of a control is in shadow DOM. `::part()` reaches it, and
accepts every CSS property. The state is an attribute on the element, so a
selector can read it.

```css
mbx-play-button::part(button) { border-radius: 50%; }
mattebox-player[playing] mbx-play-button::part(icon) { fill: rebeccapurple; }
mbx-quality-menu::part(item):hover { background: rebeccapurple; }
mbx-live-button[at-edge]::part(dot) { box-shadow: none; }
mbx-control-bar { background: #000; }
```

Two rules make this work:

- No stylesheet of the player uses `!important`. For normal declarations, a rule from the page wins over a rule from the shadow tree, whatever its specificity. An `!important` inside the shadow tree would reverse that.
- Every element a control draws has a `part`, because `::part()` cannot select the descendants of a part.

| Element                             | Parts                                                                                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mattebox-player`                   | `stage`, and the error surface: `error`, `error-category`, `error-code`, `error-retry`, `value`, `button`                                                       |
| `mbx-control-bar`                   | `row`, `seek-row`, `buttons-row`                                                                                                                                |
| Every button control                | `button`, `icon`                                                                                                                                                |
| `mbx-volume-slider`, `mbx-seek-bar` | `slider`, `rail`, `track`, `fill`, `thumb`                                                                                                                      |
| `mbx-seek-bar`                      | `buffered`, `buffered-range`, `hover`, `edge`, `preview`, `preview-image`, `preview-tile`, `preview-title`, `preview-time`                                      |
| `mbx-live-button`                   | `button`, `dot`, `text`                                                                                                                                         |
| Every menu                          | `button`, `icon`, `popup`, `section`, `section-label`, `item`, `item-detail`, `page-item`, `back-item`, and `<name>-item` and `<name>-section` per group        |
| The chosen item of a menu           | `checked`, added to the part of the item. It is the only state in a part name, because a page cannot otherwise select the state of an item inside a shadow root |
| `mbx-drm-badge`                     | `icon`, `tooltip`, `tooltip-title`, `tooltip-text`                                                                                                              |
| `mbx-error-screen`                  | `box`, `title`, `detail`, `category`, `separator`, `code`, `retry`                                                                                              |

Part names are public API. A release can add names. A name is only renamed
in a major version.

Custom properties set on the player are inherited by every control:
`--mbx-surface`, `--mbx-text`, `--mbx-muted`, `--mbx-accent`, `--mbx-error`,
`--mbx-radius`, `--mbx-gap`, `--mbx-pad`, `--mbx-font`, `--mbx-live`,
`--mbx-preview-width`.

The shadow roots are open. When `::part()` is not enough, a page adds a
stylesheet inside a control: `control.shadowRoot.append(style)` in every
browser, or `adoptedStyleSheets` in a modern one.

The `<video>` is in light DOM, so the page styles it directly. By default
it takes the full width at 16:9 until the media's own ratio is known, so
the box does not change size when the metadata arrives. A page that knows
the ratio of its media sets `aspect-ratio` on the video.

The box of the player is black, and the picture is centred in it.

- With a height or an `aspect-ratio` on the player, `object-fit: contain` letterboxes or pillarboxes the picture inside the box. The bar stays at the bottom of the box, as in fullscreen.
- Without a height, the box is as tall as the picture and no black shows.
- `mattebox-player { background: … }` changes the colour.

## Browser support

The player is a custom element, so it needs Custom Elements v1: Chrome 54,
Safari 10.1, Firefox 63, Edge 79. Every browser has Shadow DOM v1 at or
before those versions.

`::part()` needs Chrome 73, Safari 13.1, Firefox 72. An older browser still
applies the custom properties above.

The engine supports older browsers than the player: it needs ES2015 only.
A page for a browser the player does not support takes
`@mattebox/player-core` and writes its own UI.

## Lifecycle

`disconnectedCallback` disposes the session. Reconnecting loads `src`
again.

A control attaches when it is connected inside a player, and detaches when
it is removed. A framework that reorders or replaces children is therefore
safe.

## Example

A player with its own bar in Catalan, its own play icons, and a control the
page wrote.

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
