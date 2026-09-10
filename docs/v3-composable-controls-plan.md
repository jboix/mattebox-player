# v3 composable controls: the plan

v2 built the bar as one fixed set of controls behind a `layout` string. This
plan replaces it with elements: every control is a custom element the page
places inside `<mattebox-player>`, carrying its own attributes, its own
labels, and its own icon slots. The player element keeps the video, the
session and the `controls` attribute. Nothing in `@mattebox/player-core`
changes.

Each phase is one pull request on a `v3` branch with every gate green. The
branch merges to `main` when phase 5 lands, and ships as a major.

## Why

The `layout` string is a template language of one line, and it is the only
way to say which controls a page gets. Everything an integrator asked for in
the feasibility review sits behind it: which controls, in what order, with
what parameters, with what glyphs, with what names. Elements answer all five
with the one language every framework speaks, and they replace a bar the
page configures with a bar the page writes.

```html
<mattebox-player src="…" controls="custom">
  <mbx-control-bar>
    <mbx-play-button label-play="Reproduir" label-pause="Pausa"></mbx-play-button>
    <mbx-skip-button seconds="-15"></mbx-skip-button>
    <mbx-seek-bar></mbx-seek-bar>
    <mbx-spacer></mbx-spacer>
    <mbx-fullscreen-button>
      <svg slot="icon-enter">…</svg>
    </mbx-fullscreen-button>
  </mbx-control-bar>
</mattebox-player>
```

## Decisions

| #  | Decision            | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | Prefix              | `mbx-`, the same as the custom properties. `mattebox-player` keeps its name.                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2  | Where children live | Light DOM, inside `<mattebox-player>`, beside the video. The stage's slot takes them, so they sit over the picture and inside fullscreen. The page's stylesheet reaches every element by tag and its internals by `::part()`.                                                                                                                                                                                                                                                     |
| 3  | Finding the player  | A child walks up through parents and shadow hosts to the nearest `mattebox-player`, awaits `customElements.whenDefined` for it, and reads `video`, `engine`, `player` and `error`, and listens to `sourcechange`. Nothing else. A child that needs more is a gap in the player's public API, logged the way engine gaps are.                                                                                                                                                      |
| 4  | Lifetimes           | `connectedCallback` builds and subscribes, `disconnectedCallback` tears down. A child that reads the engine rebuilds on every `sourcechange`, and hides while the session has no engine or no namespace for it. This replaces the bar's `attach` and `detach`.                                                                                                                                                                                                                    |
| 5  | State               | Attributes on `mattebox-player`. The player reflects the video's own state, `paused`, `playing`, `ended` and `muted`, in every mode; the element that owns a state the video does not have sets it: `fullscreen` and `idle` from the bar, `pip` from the picture-in-picture button, `live` and `seekable` from the seek row. The bar carries `idle` on itself too, for its own fade. A page styles `mattebox-player[playing] mbx-play-button`. This replaces state on part names. |
| 6  | The default bar     | Under `controls="custom"`, a player with no `mbx-control-bar` child appends the default composition to its light DOM, so the one-line integration stays and the page can inspect what it got. A page that renders its own children through a framework gets no default, which is what it asked for.                                                                                                                                                                               |
| 7  | Parameters          | On the element that uses them. `seconds` on a skip button, `step`, `page` and `live-window` on the seek bar, `idle-ms` and `seek-step` on the bar. `MatteboxPlayerOptions.controls`, `ControlsOptions`, `LAYOUT` and every knob attribute on the player are removed. `handlers` and `stages` stay.                                                                                                                                                                                |
| 8  | Labels              | Every fixed string an element shows or names itself with is an attribute of that element, and the English default is the value when the attribute is absent. One name per state: `label-play`, `label-pause`, `label-replay`. Strings with a value carry a placeholder: `label="Back {seconds} seconds"`. The DRM tooltip's plural is two attributes, `label-key` and `label-keys`. The player ships no locales and no string table; translation is the page's.                   |
| 9  | Glyphs              | A named slot per state, `icon-play`, `icon-pause`, `icon-replay`, with the default glyph as the slot's fallback content. A page drops its own SVG in. The icon table and its notice stay.                                                                                                                                                                                                                                                                                         |
| 10 | Parts               | Kept, scoped to each element, and shorter: the inner button is `button`, the glyph is `icon`, a slider's layers are `track`, `fill`, `thumb`. State leaves the part name (decision 5), with one exception: a menu's chosen item carries `checked` on its part, because an item inside a shadow root has no other seam a page can style. The v2 parts table is replaced, which is the breaking change.                                                                             |
| 11 | Coordination        | Through attributes the bar can query. A menu sets `open` on itself while its popup shows, and the bar's idle timer holds while any descendant carries it. The seek bar sets `seekable` on the player, which the live button reads.                                                                                                                                                                                                                                                |
| 12 | Custom elements     | Any element inside the bar is a control. The contract is decision 3, decision 11, and a real `<button>` for anything Space should reach. No factory, no registry, no `Control` type in the public API.                                                                                                                                                                                                                                                                            |
| 13 | Native mode         | Untouched through phase 5. Phase 6 replaces the panels row with `<mbx-panels>`, the same menu elements in a row under the video, appended by default under `native` and `none`, and deletes `panels/`. The error surface stays in the element's shadow root for those modes.                                                                                                                                                                                                      |
| 14 | Loading             | The root entry registers every element, as today. Phase 7 adds `@mattebox/player/element`, the player alone, and `@mattebox/player/elements/<name>`, one entry per control that registers the control and the player, so a page on a bundler carries only what it composes. The CDN bundle stays one file.                                                                                                                                                                        |
| 15 | Size                | The 30 kB CDN budget holds through phase 5. Registration and lifecycle for fifteen elements is estimated at 2 to 4 kB over today's 22.38 kB. A raise, if one is needed, comes with the measurement in the commit body.                                                                                                                                                                                                                                                            |
| 16 | Rules               | AGENTS.md rule 6 is rewritten: no player-level registry, no plugin API, no skin system; the browser's element registry is the extension point. `docs/v2-custom-controls.md` gets a line saying this plan supersedes its "fixed set of controls".                                                                                                                                                                                                                                  |

## Rules that bind every phase

- **No wrapping.** A child reads and writes `player.video` from outside, the
  way a page would. No element forwards a media member.
- **No class fields.** `declare` plus constructor assignment, as
  `element.ts` does. One small base class carries the player lookup and the
  subscription list; it is not exported.
- **Every element has its own shadow root and stylesheet.** Tokens cross
  through the `--mbx-*` custom properties, which inherit through light DOM.
  Nothing carries `!important`.
- **Engine reads are feature-tested** through `namespaces()`. Every element
  works in full with a native session, or hides.
- **Accessibility ships with the element.** Role, name, keyboard, and a test
  for each, in the same pull request. The floor is what v2 has.
- **Native mode is untouched** until phase 6, with the v2 test that proves it.

## The elements

| Element                 | Attributes                    | Labels                                                                                                                                        | Icon slots                               | Reads and writes                                                                                                                                |
| ----------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `mbx-control-bar`       | `idle-ms`, `seek-step`        |                                                                                                                                               |                                          | Idle timer, shortcuts, click to toggle, the cue lift                                                                                            |
| `mbx-spacer`            |                               |                                                                                                                                               |                                          | Pushes what follows to the right                                                                                                                |
| `mbx-play-button`       |                               | `label-play`, `label-pause`, `label-replay`                                                                                                   | `icon-play`, `icon-pause`, `icon-replay` | `paused`, `ended`; `play()`, `pause()`                                                                                                          |
| `mbx-mute-button`       |                               | `label-mute`, `label-unmute`                                                                                                                  | `icon-mute`, `icon-low`, `icon-high`     | `muted`, `volume`; `muted`                                                                                                                      |
| `mbx-volume-slider`     | `step`                        | `label`                                                                                                                                       |                                          | `volume`, `muted`; `volume`                                                                                                                     |
| `mbx-volume`            |                               |                                                                                                                                               |                                          | The mute button and the slider as its children, the slider unfolding on hover or focus, both filled in when empty                               |
| `mbx-skip-button`       | `seconds`, negative for back  | `label` with `{seconds}`                                                                                                                      | `icon`                                   | `currentTime`, `seekable`; `currentTime`                                                                                                        |
| `mbx-current-time`      |                               |                                                                                                                                               |                                          | `currentTime`, `seekable`, `live`, `pdt`; the wall clock or the distance behind the edge on live                                                |
| `mbx-duration`          |                               |                                                                                                                                               |                                          | `duration`; hidden on live                                                                                                                      |
| `mbx-seek-bar`          | `step`, `page`, `live-window` | `label`, `label-of` with `{current}` and `{duration}`, `label-behind` with `{time}`                                                           |                                          | `currentTime`, `buffered`, `seekable`, `live`, `pdt`, `thumbnails`; `currentTime`. Sets `live` and `seekable` on the player, carries `dragging` |
| `mbx-live-button`       |                               | `label-live`, `label-at-edge`, `text`                                                                                                         |                                          | `live.edge`, `live.atEdge`; `live.seekToEdge()`. Carries `at-edge`                                                                              |
| `mbx-speed-menu`        | `rates`, space-separated      | `label`, `label-normal`, `label-back` with `{page}`                                                                                           | `icon`                                   | `playbackRate`; `playbackRate`. Carries `open` while the popup shows, as every menu does                                                        |
| `mbx-quality-menu`      |                               | `label`, `label-auto`, `label-back`                                                                                                           | `icon`                                   | `quality`                                                                                                                                       |
| `mbx-audio-menu`        |                               | `label`, `label-back`                                                                                                                         | `icon`                                   | `tracks`                                                                                                                                        |
| `mbx-subtitles-menu`    |                               | `label`, `label-back`, `label-off`, `label-track`, `label-settings`, `label-size`, `label-background`, and one per size and background choice | `icon`, `icon-on`                        | `tracks`; `subtitle-size` and `subtitle-background` on the player                                                                               |
| `mbx-drm-badge`         |                               | `label` with `{system}` and `{keys}`, `label-key` and `label-keys` with `{count}` and `{statuses}`, `label-no-key`                            | `icon`                                   | `drm`                                                                                                                                           |
| `mbx-pip-button`        |                               | `label-enter`, `label-exit`                                                                                                                   | `icon-enter`, `icon-exit`                | Picture-in-Picture on the video                                                                                                                 |
| `mbx-fullscreen-button` |                               | `label-enter`, `label-exit`                                                                                                                   | `icon-enter`, `icon-exit`                | Fullscreen on the stage                                                                                                                         |
| `mbx-start-button`      |                               | `label-play`, `label-replay`                                                                                                                  | `icon-play`, `icon-replay`               | `paused`, `ended`; `play()`. Over the picture, not in the bar                                                                                   |
| `mbx-error-screen`      |                               | `label-title`, `label-retry`                                                                                                                  |                                          | The player's `error` event; the retry reloads                                                                                                   |

The default composition, appended when the page writes none:

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
  <mbx-subtitles-menu></mbx-subtitles-menu>
  <mbx-audio-menu></mbx-audio-menu>
  <mbx-quality-menu></mbx-quality-menu>
  <mbx-pip-button></mbx-pip-button>
  <mbx-fullscreen-button></mbx-fullscreen-button>
</mbx-control-bar>
```

The bar lays its children out in two rows, the seek row over the buttons
row. A child with `slot="seek"` sits in the seek row; everything else in the
buttons row, in its order. The time, the seek bar and the live button set
`slot="seek"` on themselves unless the page wrote a `slot` of its own. This
keeps the two-row look of v2 without a wrapper element per row, through
the platform's own slot assignment.

## Phases

| Phase | Delivers                                                                                                                                                                                                                                                                                                                                                                                                                            | Tests                                                                                                                                                                                                                                                                                                 |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | This document, the AGENTS.md rewrite (decision 16), the supersession note in the v2 doc, and the `v3` branch.                                                                                                                                                                                                                                                                                                                       | `docs:check`.                                                                                                                                                                                                                                                                                         |
| 1     | The foundation. The base class with the player lookup (decision 3). State attributes on the player (decision 5). `mbx-control-bar` with the overlay, the idle timer, the shortcuts, click to toggle, the cue lift, and the row layout. `mbx-spacer`. `mbx-play-button` in full, with labels and icon slots. The default composition (decision 6), carrying the play button alone. The old `controlBar()` and its files are deleted. | Browser: a child finds its player before and after upgrade, and when moved. Every state attribute. The bar's idle rules, ported from v2. The play button's states, labels and slots. The default composition appears when absent and not when present. Native mode untouched. Node: label templating. |
| 2     | The buttons: `mbx-mute-button`, `mbx-volume-slider`, `mbx-skip-button`, `mbx-pip-button`, `mbx-fullscreen-button`, `mbx-start-button`, `mbx-error-screen`. The slider primitive becomes an internal helper both sliders share. Both join the default composition.                                                                                                                                                                   | Browser: each control's v2 tests ported to the element, plus its labels and slots. The error screen clears on the next load, as in v2.                                                                                                                                                                |
| 3     | The seek row: `mbx-current-time`, `mbx-duration`, `mbx-seek-bar` with the preview, `mbx-live-button`. `seekable` and `live` on the player.                                                                                                                                                                                                                                                                                          | Browser: the v2 seek, preview, live window and live button tests ported. The live button reads `seekable` from the player.                                                                                                                                                                            |
| 4     | The menus: the menu primitive as an internal helper, `mbx-speed-menu`, `mbx-quality-menu`, `mbx-audio-menu`, `mbx-subtitles-menu`, `mbx-drm-badge`. Each rebuilds on `sourcechange` and hides without its namespace. `open` holds the bar.                                                                                                                                                                                          | Browser: the v2 menu tests ported, including the arrow walk inside the shadow root. A menu survives a source change and hides on a native session.                                                                                                                                                    |
| 5     | Docs and demo. The guide's element chapter rewritten around the table above: attributes, labels, slots, parts, state attributes, the custom element contract. The demo's layout builder becomes a markup editor over the default composition, with a second-language preset that sets every label attribute. The size measurement and the budget line. The integrator log entries the phases added. Merge to `main`, release major. | `verify` and `test:e2e` green. The e2e spec covers the default bar, a custom composition, and the translated preset.                                                                                                                                                                                  |
| 6     | Native mode: the panels row replaced by the same menu elements in a row under the video, `panels/` deleted.                                                                                                                                                                                                                                                                                                                         | Browser: the element tests for native mode ported to the new row.                                                                                                                                                                                                                                     |
| 7     | If asked: per-element subpath entries, `@mattebox/player/elements/play-button`, with the exports map, `attw` and `publint` green.                                                                                                                                                                                                                                                                                                   | `check:package`.                                                                                                                                                                                                                                                                                      |

## What breaks

- The `layout` attribute and option, `LAYOUT`, `ControlsOptions`, and the
  knob attributes on the player: `idle-ms`, `seek-step`, `seek-page`,
  `skip-back`, `skip-forward`, `start`, `live-window`.
- Every part name in the v2 table, and state on part names.
- `define({ controls })`. `define({ handlers })` and `define({ stages })`
  stay.

## Open questions for the review

1. Decision 6 puts the default composition in light DOM. A framework that
   owns the player's children sees elements it did not render. The
   alternative is the player's shadow root, which keeps the page's
   stylesheet out of the default bar. Light DOM is recommended.
2. Decision 8 makes the subtitles menu carry about twelve label attributes.
   The alternative is a `strings` property on the player as a fallback the
   attributes override. Attributes alone are recommended, and the property
   is added only if a page asks.
3. One bar with a `seek` slot (two rows) against two bar elements
   (`mbx-seek-row` and `mbx-control-bar`). One bar is recommended: the idle
   timer and the shortcuts have one owner.
