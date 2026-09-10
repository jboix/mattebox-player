# Architecture

The Mattebox player is two packages over the `mattebox` engine. This
document lists what each package owns and the rules between them. For
usage, read the [guide](guide/README.md).

## The packages

| Package                 | Owns                                                                            | Imports                     |
| ----------------------- | ------------------------------------------------------------------------------- | --------------------------- |
| `@mattebox/player-core` | Source resolution, the handler chain, the two handlers, the unified error event | The engine (peer)           |
| `@mattebox/player`      | `<mattebox-player>`, the panels over the engine's namespaces                    | The core, the engine (peer) |

Three rules:

- The core never imports the UI. An integrator with their own UI takes the core alone.
- The UI never bypasses the core to talk to the engine about source selection.
- The element stays native. Nothing forwards or wraps an `HTMLMediaElement` member.

## The core

Three concepts and nothing else, in `packages/core/src/types.ts`.

| Concept   | Is                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------- |
| `Source`  | A URL and, when known, a MIME type                                                                |
| `Handler` | A name, `canHandle` with the three-tier answer of `canPlayType`, and `handle` returning a session |
| `Session` | The handler that won, the engine feeding the element or null for native, and `dispose`            |

`createPlayer(video, { handlers })` returns a `Player` per element. `load`
resolves the source's type from its extension when absent, runs the handlers
in order, and the first non-empty `canHandle` wins. A `probably` from a later
handler does not beat a `maybe` from an earlier one; order is the
integrator's policy.

Two handlers ship:

| Handler    | `canHandle`                                                            | `handle`                                                        |
| ---------- | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| `mattebox` | `engine.accepts(type)`, gated on `MediaSource` or `ManagedMediaSource` | Attach, `load(url, { mimeType })`, dispose unloads and detaches |
| `native`   | `video.canPlayType(type)`                                              | Dispose whatever holds the element, then assign `src`           |

When the mattebox handler's engine reports `MANIFEST_UNSUPPORTED`, the core
treats the handler as having declined, disposes the session, and tries the
next handler. Any other fatal error is the session's error.

## The element

`<mattebox-player>` renders a real `<video>` as a light-DOM child, so the
integrator can reach it, and its error surface in shadow DOM. Native
controls carry playback by default.

The controls are custom elements the page places inside the player, beside
the video: under `controls="custom"` the bar and the screens over the
picture, otherwise `<mbx-panels>`, a row under it with only what the video
cannot show. Each finds the nearest player above it and reads `video`,
`engine`, `player` and `error`, and listens to `sourcechange`; nothing
else. A page's own element inside the bar is a control the same way. Each
one feature-tests its namespace on `session.engine` and hides for a native
session. The element reflects state as attributes on itself, and every
control carries its parameters and its words as attributes and takes a
page's glyph through a slot. `docs/v3-composable-controls-plan.md` records
the decisions.

| Control                                                               | Namespace                   |
| --------------------------------------------------------------------- | --------------------------- |
| `mbx-quality-menu`                                                    | `engine.quality`            |
| `mbx-audio-menu`, `mbx-subtitles-menu`                                | `engine.tracks`             |
| `mbx-live-button`, `mbx-seek-bar`, `mbx-current-time`, `mbx-duration` | `engine.live`, `engine.pdt` |
| `mbx-drm-badge`                                                       | `engine.drm`                |
| `mbx-seek-bar`                                                        | `engine.thumbnails`         |
| `mbx-error-screen`, the error surface                                 | the core's `error` event    |

## Builds

Each package builds three ways, the same as the engine: modern ESM from
`tsc` under `dist/`, ES2015 ESM from Rolldown under `dist/es2015/` (the
default export condition), and, for the element only, a minified IIFE under
`dist/cdn/` behind the `matteboxPlayer` global. The CDN bundle carries the
core and reads the engine from the `mattebox` global, so the page picks the
engine bundle and the size story stays the engine's.

## Deliverables

1. The workspace with both packages, gates green on an empty core.
2. The core with the two handlers and the fallthrough, its tests passing in three browsers.
3. The element with native controls and the namespace panels, its tests passing.
4. The demo page: every source kind, each row stating which handler won.
5. The integrator log: every place the engine's API made the player reach
   around it, ordered by how much each entry hurt.

Custom controls came after those five, first as one fixed bar and then, in
v3, as the elements above. Guide chapter 03 covers them.
