# 02 Handlers

This chapter covers the handler chain: how a source's type is decided, how
a handler claims a source, and what happens when the engine declines one.

## A source

A source is a URL and, when known, a MIME type.

```ts
interface Source {
  url: string;
  type?: string;
}
```

Without a type, the extension decides, from a small table. An unknown
extension leaves the type undefined. The core never sends a HEAD request.

| Extension | Type                            |
| --------- | ------------------------------- |
| `m3u8`    | `application/vnd.apple.mpegurl` |
| `mpd`     | `application/dash+xml`          |
| `mp4`     | `video/mp4`                     |
| `m4v`     | `video/mp4`                     |
| `webm`    | `video/webm`                    |
| `mp3`     | `audio/mpeg`                    |
| `m4a`     | `audio/mp4`                     |
| `aac`     | `audio/aac`                     |
| `ogg`     | `audio/ogg`                     |
| `wav`     | `audio/wav`                     |

`inferType(url)` is exported for integrators who resolve sources themselves.

## The chain

Handlers run in order. The first non-empty `canHandle` wins, with the
three-tier answer of `canPlayType`: `probably`, `maybe`, or the empty string.
A `probably` from a later handler does not beat a `maybe` from an earlier
one. Order is the integrator's policy.

A handler that claimed a source and then found it was not its own throws
`Declined` from `handle`. The chain reads that as an empty `canHandle` and
tries the next handler.

```ts
interface Handler {
  name: string;
  canHandle(source: Source, env: { video: HTMLMediaElement; mse: boolean }): 'probably' | 'maybe' | '';
  handle(source: Source, video: HTMLMediaElement): Promise<Session>;
}
```

## The two handlers

| Handler           | `canHandle`                                                                | `handle`                                                       |
| ----------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `matteboxHandler` | `engine.accepts(type)`, gated on MSE support. An undefined type is `maybe` | Attaches, loads with `mimeType`, disposes by unload and detach |
| `nativeHandler`   | `video.canPlayType(type)`. An undefined type is `maybe`                    | Disposes whatever holds the element, then assigns `src`        |

The mattebox handler takes a preset or a stage list. Start with `full`: it
composes every stage the engine ships, so no source kind is missing an
adapter and no namespace is missing. A narrower preset or an explicit stage
list trades features for bytes, which is optimization work.

```ts
import full from 'mattebox/presets/full';
import hlsCmaf from 'mattebox/protocols/hls-cmaf';
import abr from 'mattebox/stages/abr';

matteboxHandler({ preset: full });
matteboxHandler({ stages: [hlsCmaf(), abr()] });
```

| Option      | Is                                                             |
| ----------- | -------------------------------------------------------------- |
| `preset`    | A preset factory. Without one, `stages` are the whole stack.   |
| `stages`    | Stages to compose. With a preset they merge by name.           |
| `config`    | Kernel tuning overrides, passed through.                       |
| `transport` | Network hooks and overrides, passed through.                   |
| `without`   | Names of preset stages to leave out. Ignored without a preset. |

The handler builds one engine on first use and keeps it across loads:
`unload` and `detach` return the kernel to its initial state. It is built
lazily because `accepts` is an instance method, so the first routing question
composes the whole stack.

## Fallthrough

The engine reports `MANIFEST_UNSUPPORTED` when no composed adapter declares
the type, when the manifest response carries an audio or video Content-Type,
or when bytes no adapter recognizes arrive. On that code the core treats the
mattebox handler as having declined: it disposes the session and tries the
next handler. A signed URL with no extension costs one round of headers
before landing on native.

Any other fatal error is the session's error, not a fallthrough.

When no handler claims the source, `load` rejects and the `error` event
carries `MANIFEST_UNSUPPORTED` with the URL, so a UI showing the event does
not also need to catch the rejection.

## Loading replaces

`load` disposes the current session before running the chain, so a player
that switches streams only ever calls `load`.

Loads run one at a time and settle in the order they were called. When a
second `load` arrives while the first is still running, the first still
resolves first, with its own session, already disposed; the second wins and
is what `player.session` returns. Read `player.session`, not the resolved
value, when two loads may overlap.

## Errors

The engine's error payloads and the element's `MediaError` arrive on one
event with one shape. A `MediaError` maps to `MEDIA_DECODE_ERROR` or
`MEDIA_CODEC_UNSUPPORTED`, the engine's own mapping. Native sessions have no
other diagnostics.

```ts
player.on('error', ({ category, code, fatal, handler }) => {
  console.error(handler, category, code, fatal);
});
```

## Example

```ts
import { createPlayer, matteboxHandler, nativeHandler } from '@mattebox/player-core';
import full from 'mattebox/presets/full';

const player = createPlayer(video, {
  handlers: [matteboxHandler({ preset: full }), nativeHandler()],
});

for (const url of ['vod/master.m3u8', 'clip.mp4', 'signed/12345']) {
  const session = await player.load({ url });
  console.log(url, session.handler);
}
```

Next: [03 The element](03-the-element.md).
