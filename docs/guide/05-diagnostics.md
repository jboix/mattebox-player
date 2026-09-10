# 05 Diagnostics

This chapter covers `<mbx-diagnostics>`, from `@mattebox/player-diagnostics`:
what the session is doing and what the browser can do, inside the player,
and the report a page sends when something goes wrong.

## Install

```sh
npm install @mattebox/player-diagnostics @mattebox/player mattebox
```

The package is a peer of `@mattebox/player`: it takes the player's public
types and nothing from its internals, the way a control of your own does
(chapter 03). Importing it registers `<mbx-diagnostics>` and nothing else.

## In the bar

```html
<mattebox-player src="https://example.com/vod/master.m3u8" controls="custom">
  <mbx-control-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-seek-bar></mbx-seek-bar>
    <mbx-spacer></mbx-spacer>
    <mbx-diagnostics></mbx-diagnostics>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import '@mattebox/player';
  import '@mattebox/player-diagnostics';
</script>
```

Inside the bar the element is a button. It opens a panel above it, fitted
under the top of the picture and within the player's width, and carries
`open` while the panel shows, so the bar holds its fade. Escape and a
pointer outside close it.

## Under the video

Anywhere else inside the player the element is the panel itself, open, in
flow. Under native controls that puts it under the picture:

```html
<mattebox-player src="https://example.com/vod/master.m3u8">
  <mbx-diagnostics></mbx-diagnostics>
</mattebox-player>
```

The element carries `inline` in that placement.

## The pages

| Page     | Shows                                                                                                                                                                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Playback | The source, its type and the handler that won; the position, the state, the rate, the picture size, the frames decoded and dropped, the buffer ahead, the stalls; with an engine, the throughput, the rendition playing and the switches                                                   |
| Charts   | The buffer per source buffer over media time, and over wall time the throughput, the stalls, the frames and the switches, on one canvas, one at a time, over a window of 30 seconds to 10 minutes                                                                                          |
| Engine   | The capabilities, the phase, the buffer goal, the requests in flight, the live window, the trace; the source buffers with their codecs and ranges; the tracks with the active ones; the ladder with what plays, what comes next, what is pinned or capped; the DRM key system and its keys |
| Browser  | The platform APIs, the codecs through MSE, the element and Media Capabilities, and the DRM key systems with their security level, schemes, persistence, identifier and output protection                                                                                                   |

The browser page probes once, the first time it is shown: the key-system
probes are not free, and Firefox asks the viewer about a DRM module it has
not enabled. `probeSupport()` is exported for a page that wants the answer
without the panel.

The sampler runs while the element is attached, panel open or not, twice a
second, so the counts cover the session. A native session has no engine,
and the element invents none: the playback page and the buffer, stall and
frame charts read the video, and the rest says there is no engine.

## The report

`element.report()` returns one plain object: the source, the playback, the
engine's state, the counters, the last two minutes of samples and marks,
the browser's support when it was probed, and the session's trace as the
element kept it. The element keeps its own history of the engine's trace
entries, up to five hundred, from the `trace` events the engine emits as
they happen, or off the engine's ring where it emits none, and never
counts one twice. Each entry is slimmed on the way in: a manifest is a
summary of its tracks and renditions with segment counts, a playlist
refresh a count, the bytes of a segment their length, so a history is a
few hundred kilobytes at most where the raw entries run to megabytes on
HLS. `slimEntry()` is exported for a page that keeps a history of its own. The Copy button puts the same report on the clipboard.

Every fatal error dispatches the report as a `report` event on the element,
bubbling and composed, so a listener on the player sees it:

```ts
player.addEventListener('report', (event) => {
  navigator.sendBeacon('/diagnostics', JSON.stringify(event.detail));
});
```

## Attributes, parts, tokens

| Attribute      | Is                                                                  |
| -------------- | ------------------------------------------------------------------- |
| `label`        | The button's and the panel's name. Default "Diagnostics"            |
| `label-copy`   | The copy button's text. Default "Copy report"                       |
| `label-copied` | The copy button's text after a copy. Default "Copied"               |
| `window`       | The charts' window in seconds, 30, 60, 120, 300 or 600. Default 120 |

The pages' keys and the tab names are technical English and have no
attributes: the panel is for an integrator, and a viewer never opens it.

The glyph is the `icon` slot, with the element's own as the fallback.

| Part                                                                                                            | Is                                                |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `button`, `icon`                                                                                                | The button in the bar and its glyph               |
| `panel`, `head`, `body`, `tab`, `tab-<page>`, `page`, `page-<page>`, `copy`, `close`                            | The panel, its tabs and its pages                 |
| `heading`, `rows`, `key`, `value`, `note`                                                                       | A page's sections and rows                        |
| `chart`, `chart-tabs`, `chart-tab`, `chart-tab-<chart>`, `window`, `legend`, `legend-item`, `swatch`, `readout` | The charts page                                   |
| `table`, `cell`, `label`, `ok`, `bad`, `na`, `maybe`                                                            | The browser page's tables and the state of a cell |

The panel reads the player's `--mbx-*` tokens, and adds `--mbx-chart-1` to
`--mbx-chart-5` for the charts' series, with defaults a page overrides on
the element or the player.

## Example

The default bar with the diagnostics at its end, and every fatal error
sent on with its report:

```html
<mattebox-player id="player" src="https://example.com/vod/master.m3u8" controls="custom">
  <mbx-control-bar>
    <mbx-current-time></mbx-current-time>
    <mbx-seek-bar></mbx-seek-bar>
    <mbx-duration></mbx-duration>
    <mbx-play-button></mbx-play-button>
    <mbx-volume></mbx-volume>
    <mbx-spacer></mbx-spacer>
    <mbx-quality-menu></mbx-quality-menu>
    <mbx-fullscreen-button></mbx-fullscreen-button>
    <mbx-diagnostics label="Stats"></mbx-diagnostics>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import '@mattebox/player';
  import '@mattebox/player-diagnostics';

  document.getElementById('player').addEventListener('report', (event) => {
    fetch('/diagnostics', { method: 'POST', body: JSON.stringify(event.detail) });
  });
</script>
```
