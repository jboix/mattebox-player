# Architecture

The Mattebox player is four packages over the `mattebox` engine. This
document lists what each package owns and the rules between the packages.
The [guide](guide/README.md) explains how to use them.

## The packages

| Package                        | Owns                                                                             | Imports                                          |
| ------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------ |
| `@mattebox/player-core`        | Source resolution, the handler chain, the two handlers, the unified error event  | The engine (peer)                                |
| `@mattebox/player`             | `<mattebox-player>`, the controls over the engine's namespaces                   | The core, the engine (peer)                      |
| `@mattebox/player-diagnostics` | `<mbx-diagnostics>`, the stats, the charts, the browser's support and the report | The player (peer, types only), the engine (peer) |
| `@mattebox/player-cast`        | `<mbx-cast-button>` and `<mbx-cast-screen>`, Chromecast over Google's sender SDK | The player (peer, types only), the engine (peer) |

The packages follow four rules:

- The core never imports the UI. A page with its own UI takes the core alone.
- The UI never asks the engine which source to play. It asks the core.
- The video stays native. No package forwards or wraps an `HTMLMediaElement` member.
- The diagnostics element uses the player's public types only, like a control of the page's own. The player never imports it.

## The core

The core has three concepts, in `packages/core/src/types.ts`.

| Concept   | What it is                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Source`  | A URL and, when known, a MIME type                                                                                        |
| `Handler` | A name, a `canHandle` that answers like `canPlayType`, and a `handle` that returns a session                              |
| `Session` | The name of the handler that plays the source, the engine that feeds the video (null for a native session), and `dispose` |

`createPlayer(video, { handlers })` returns one `Player` per video. `load`
reads the type from the URL's extension when none is given. It then asks
the handlers in order. The first handler with a non-empty `canHandle` plays
the source.

The order of the handlers is the page's policy. A `probably` from a later
handler does not win over a `maybe` from an earlier handler.

The core ships two handlers:

| Handler    | `canHandle`                                                                                 | `handle`                                                                                |
| ---------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `mattebox` | Returns `engine.accepts(type)`. Returns empty without `MediaSource` or `ManagedMediaSource` | Attaches the engine and calls `load(url, { mimeType })`. `dispose` unloads and detaches |
| `native`   | Returns `video.canPlayType(type)`                                                           | Disposes whatever holds the video, then assigns `src`                                   |

The engine can report `MANIFEST_UNSUPPORTED` after the mattebox handler
took the source. The core then disposes the session and asks the next
handler. Any other fatal error is the session's error.

## The element

`<mattebox-player>` creates a real `<video>` as a child in light DOM, so
the page can reach it. It draws its error surface in shadow DOM. The video
shows its native controls by default.

The controls are custom elements placed inside the player, next to the
video. Under `controls="custom"` the bar and the screens show over the
picture. The player appends nothing in any mode: `native` is the video with
the browser's controls and nothing else, and `none` hides every child but
the video.

Each control finds the nearest player above it. It reads `video`, `engine`,
`player` and `error` from the player, and listens to `sourcechange`. It
uses nothing else. A page's own element inside the bar is a control in the
same way.

Each control tests for its namespace on `session.engine`, and hides for a
native session. The player reflects its state as attributes on itself. A
control takes its parameters and its labels as attributes, and its icon
through a slot.

| Control                                                               | What it reads                                                                                               |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `mbx-quality-menu`                                                    | `engine.quality`                                                                                            |
| `mbx-audio-menu`, `mbx-subtitles-menu`                                | `engine.tracks`                                                                                             |
| `mbx-live-button`, `mbx-seek-bar`, `mbx-current-time`, `mbx-duration` | `engine.live`, `engine.pdt`                                                                                 |
| `mbx-drm-badge`                                                       | `engine.drm`                                                                                                |
| `mbx-seek-bar`                                                        | `engine.thumbnails`                                                                                         |
| `mbx-seek-bar`, `mbx-chapters-menu`                                   | The chapters track of the video. No namespace                                                               |
| `mbx-diagnostics`                                                     | `engine.stats`, `engine.quality`, `engine.tracks`, `engine.capabilities()`, `engine.live`, `engine.drm`     |
| `mbx-airplay-button`                                                  | The WebKit AirPlay API of the video. No namespace                                                           |
| `mbx-cast-button`, `mbx-cast-screen` (`@mattebox/player-cast`)        | The Cast sender SDK on the page, and `engine.suspend()` and `engine.resume()` for the handoff. No namespace |
| `mbx-error-screen`, the error surface                                 | The `error` event of the core                                                                               |
| `mbx-title`, `mbx-spinner`                                            | The events of the video. No namespace                                                                       |

## Builds

Every package has the same builds as the engine:

- Modern ESM under `dist/`, from `tsc`.
- ES2015 ESM under `dist/es2015/`, from Rolldown. This is the default export condition.
- A minified IIFE under `dist/cdn/`, for the element, the diagnostics and the cast.

The IIFE globals are `matteboxPlayer`, `matteboxPlayerDiagnostics` and
`matteboxPlayerCast`.

The player's CDN bundle contains the core and reads the engine from the
`mattebox` global. The page picks the engine bundle, and with it the size
of the engine.

## Deliverables

The player was built in five deliverables:

1. The workspace with both packages, and every gate passing on an empty core.
2. The core with the two handlers and the fallthrough, tested in three browsers.
3. The element with native controls and the menus over the engine's namespaces, with its tests.
4. The demo page, which plays every kind of source and shows which handler played each one.
5. The engine gaps: a list of every place where the engine's API forced a workaround in the player, ordered by cost.

Later work added:

- Custom controls, first as one fixed bar and then, in v3, as the elements above. Guide chapter 03 covers them.
- The chapters and the diagnostics. Guide chapter 05 covers the diagnostics.
- Three findings from the theme editor, a repository of its own (`mattebox-player-editor`): an element for the time left, a bar that collapses its buttons by priority, and a black box that centres and contains the picture outside fullscreen too.
