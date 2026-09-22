# 05 Diagnostics

This chapter explains `<mbx-diagnostics>`, from
`@mattebox/player-diagnostics`. The element shows, inside the player, what
the session is doing and what the browser supports. It also builds a report
a page sends when playback fails.

## Install

```sh
npm install @mattebox/player-diagnostics @mattebox/player mattebox
```

`@mattebox/player` is a peer dependency of the package. The package uses
the player's public types only, like a control of the page's own in
chapter 03. The import registers `<mbx-diagnostics>` and nothing else.

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

Inside the bar, the element is a button that opens a panel above it. The
panel fits under the top of the picture and within the width of the player.

The element has `open` while the panel shows, so the bar does not fade.
Escape closes the panel, and so does a pointer press outside it.

## Under the video

Anywhere else inside the player, the element is the panel itself: open,
and in the flow of the page. Under native controls, that puts it under the
picture:

```html
<mattebox-player src="https://example.com/vod/master.m3u8">
  <mbx-diagnostics></mbx-diagnostics>
</mattebox-player>
```

The element has `inline` in that position.

## The pages

| Page     | What it shows                                                                                                                                                                                                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playback | The source, its type and the handler that plays it. The position, the state, the rate, the picture size, the frames decoded and dropped, the buffer ahead and the stalls. With an engine, also the throughput, the rendition that plays and the switches                                            |
| Charts   | The buffer per source buffer over media time. Over wall time: the throughput, the stalls, the frames and the switches. One canvas shows one chart at a time, over a window of 30 seconds to 10 minutes                                                                                              |
| Engine   | The capabilities, the phase, the buffer goal, the requests in flight, the live window and the trace. The source buffers with their codecs and ranges. The tracks, with the active ones. The ladder, with what plays, what comes next, and what is pinned or capped. The DRM key system and its keys |
| Browser  | The platform APIs. The codecs through MSE, the video and Media Capabilities. The DRM key systems with their security level, schemes, persistence, identifier and output protection                                                                                                                  |

The browser page probes once, the first time it opens. The key-system
probes take time, and Firefox asks the viewer about a DRM module that is
not enabled. `probeSupport()` is exported for a page that wants the answer
without the panel.

The sampler runs twice a second while the element is attached, panel open
or closed. The counts therefore cover the whole session.

A native session has no engine, and the element does not invent one. The
playback page and the buffer, stall and frame charts read the video. The
other pages and charts say that there is no engine.

## The report

`element.report()` returns one plain object with:

- The source.
- The playback.
- The state of the engine.
- The counters.
- The last two minutes of samples and marks.
- The browser's support, when the element probed it.
- The trace of the session, as the element kept it.

The Copy button puts the same report on the clipboard.

The element keeps its own history of the engine's trace entries, up to five
hundred. It reads them from the `trace` events the engine emits. With an
engine that emits none, it reads them from the engine's ring. It never
counts an entry twice.

The element makes each entry smaller before it keeps it:

- A manifest becomes a summary of its tracks and renditions, with segment counts.
- A playlist refresh becomes a count.
- The bytes of a segment become their length.

A history is then a few hundred kilobytes at most. The raw entries can be
megabytes on HLS. `slimEntry()` is exported for a page that keeps a history
of its own.

Every fatal error dispatches the report as a `report` event on the element.
The event bubbles and is composed, so a listener on the player receives it:

```ts
player.addEventListener('report', (event) => {
  navigator.sendBeacon('/diagnostics', JSON.stringify(event.detail));
});
```

## Attributes, parts, tokens

| Attribute      | What it does                                                                          |
| -------------- | ------------------------------------------------------------------------------------- |
| `label`        | Sets the name of the button and of the panel. The default is "Diagnostics"            |
| `label-copy`   | Sets the text of the copy button. The default is "Copy report"                        |
| `label-copied` | Sets the text of the copy button after a copy. The default is "Copied"                |
| `window`       | Sets the window of the charts in seconds: 30, 60, 120, 300 or 600. The default is 120 |

The keys on the pages and the names of the tabs are technical English, with
no attribute. The panel is for an integrator, and a viewer never opens it.

The icon is the `icon` slot. The element shows its own icon when the slot
is empty.

| Part                                                                                                            | What it is                                             |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `button`, `icon`                                                                                                | The button in the bar and its icon                     |
| `panel`, `head`, `body`, `tab`, `tab-<page>`, `page`, `page-<page>`, `copy`, `close`                            | The panel, its tabs and its pages                      |
| `heading`, `rows`, `key`, `value`, `note`                                                                       | The sections and the rows of a page                    |
| `chart`, `chart-tabs`, `chart-tab`, `chart-tab-<chart>`, `window`, `legend`, `legend-item`, `swatch`, `readout` | The charts page                                        |
| `table`, `cell`, `label`, `ok`, `bad`, `na`, `maybe`                                                            | The tables of the browser page and the state of a cell |

The panel reads the `--mbx-*` custom properties of the player. It adds
`--mbx-chart-1` to `--mbx-chart-5` for the series of the charts, with
defaults a page overrides on the element or on the player.

## Example

A bar with the diagnostics at its end, and every fatal error sent to a
server with its report.

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
