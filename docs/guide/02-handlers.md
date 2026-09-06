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

The mattebox handler takes a preset or a stage list:

```ts
import dual from 'mattebox/presets/dual';
import hlsCmaf from 'mattebox/protocols/hls-cmaf';
import abr from 'mattebox/stages/abr';

matteboxHandler({ preset: dual });
matteboxHandler({ stages: [hlsCmaf(), abr()] });
```

## Fallthrough

The engine reports `MANIFEST_UNSUPPORTED` when no composed adapter declares
the type, when the manifest response carries an audio or video Content-Type,
or when bytes no adapter recognizes arrive. On that code the core treats the
mattebox handler as having declined: it disposes the session and tries the
next handler. A signed URL with no extension costs one round of headers
before landing on native.

Any other fatal error is the session's error, not a fallthrough.

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
import dual from 'mattebox/presets/dual';

const player = createPlayer(video, {
  handlers: [matteboxHandler({ preset: dual }), nativeHandler()],
});

for (const url of ['vod/master.m3u8', 'clip.mp4', 'signed/12345']) {
  const session = await player.load({ url });
  console.log(url, session.handler);
}
```

Next: [03 The element](03-the-element.md).
