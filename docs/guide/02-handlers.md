# 02 Handlers

This chapter explains the handler chain: how the core decides the type of
a source, how a handler takes a source, and what happens when the engine
refuses one.

## A source

A source is a URL and, when known, a MIME type.

```ts
interface Source {
  url: string;
  type?: string;
}
```

Without a type, the core reads the URL's extension, with this table. An
unknown extension gives no type. The core never sends a HEAD request.

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

`inferType(url)` is exported for a page that resolves sources itself.

## The chain

The core asks the handlers in order. A handler answers `canHandle` like
`canPlayType`: `probably`, `maybe`, or the empty string. The first handler
with a non-empty answer plays the source.

The order is the page's policy. A `probably` from a later handler does not
win over a `maybe` from an earlier handler.

A handler can take a source and then find that it cannot play it. It throws
`Declined` from `handle`. The chain treats that as an empty `canHandle` and
asks the next handler.

```ts
interface Handler {
  name: string;
  canHandle(source: Source, env: { video: HTMLMediaElement; mse: boolean }): 'probably' | 'maybe' | '';
  handle(source: Source, video: HTMLMediaElement): Promise<HandlerSession>;
}
```

A handler returns three things: its name, the engine that feeds the video
or null, and `dispose`. The chain adds `source`: the URL and the type it
resolved. The result is the `Session` that the player holds and that
`sourcechange` carries.

A control reads what is playing from `session.source`. The `src` attribute
of the element is the page's input, and it has no type.

## The two handlers

| Handler           | `canHandle`                                                                               | `handle`                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `matteboxHandler` | Returns `engine.accepts(type)`, or empty without MSE support. Returns `maybe` for no type | Attaches the engine and loads with `mimeType`. `dispose` unloads and detaches |
| `nativeHandler`   | Returns `video.canPlayType(type)`. Returns `maybe` for no type                            | Disposes whatever holds the video, then assigns `src`                         |

The mattebox handler takes a preset or a list of stages. Start with `full`.
It has every stage the engine ships, so it plays every kind of source and
has every namespace.

A smaller preset or a list of stages downloads fewer bytes, and loses the
features of the stages left out.

```ts
import full from 'mattebox/presets/full';
import hlsCmaf from 'mattebox/protocols/hls-cmaf';
import abr from 'mattebox/stages/abr';

matteboxHandler({ preset: full });
matteboxHandler({ stages: [hlsCmaf(), abr()] });
```

| Option      | What it does                                                                         |
| ----------- | ------------------------------------------------------------------------------------ |
| `preset`    | Sets the preset factory. Without a preset, `stages` is the whole engine              |
| `stages`    | Adds stages. With a preset, the handler merges them with the preset's stages by name |
| `config`    | Tunes the kernel. The handler passes it to the engine                                |
| `transport` | Sets network hooks and overrides. The handler passes it to the engine                |
| `without`   | Lists the names of the preset stages to leave out. Ignored without a preset          |
| `airplay`   | Gives the engine an AirPlay source alternative. The default is true                  |

The handler builds one engine and keeps it for every load. `unload` and
`detach` return the kernel to its initial state.

The handler builds the engine at the first `canHandle`, because `accepts`
is a method of the engine instance. That first call therefore builds every
stage.

## AirPlay

An HLS source in Safari has an AirPlay target by default.

Safari opens a ManagedMediaSource only when remote playback is disabled or
when the video has an AirPlay source alternative. An engine session
therefore has no AirPlay target unless it has that alternative.

The handler gives the engine the source's own URL as the alternative when
the browser can also play the source itself. For HLS, only Safari can.
Safari then plays the MediaSource, and the target the viewer picks plays
the URL.

`airplay: false` turns this off. The handler then attaches with remote
playback disabled.

The target must play the URL without the engine. A FairPlay stream does not
play on the target: the key session the engine opens does not answer the
target's own key request.

## Fallthrough

The engine reports `MANIFEST_UNSUPPORTED` in three cases:

- No stage of the engine accepts the type.
- The manifest response has an audio or video Content-Type.
- The response contains bytes no stage recognizes.

The core then treats the mattebox handler as if it had refused the source.
It disposes the session and asks the next handler. A signed URL with no
extension costs one request for the headers before the native handler
plays it.

Any other fatal error is the session's error. The core does not ask the
next handler.

When no handler takes the source, `load` rejects. The `error` event also
fires, with `MANIFEST_UNSUPPORTED` and the URL. A UI that shows the event
does not need to catch the rejection.

## Loading replaces

`load` disposes the current session before it runs the chain. A player
that switches streams only calls `load`.

Loads run one at a time and settle in the order of the calls. A second
`load` before the first has finished does not change that: the first
resolves first, with its own session, already disposed. The second session
is the one `player.session` returns.

Read `player.session`, not the resolved value, when two loads can overlap.

## Errors

Every error arrives on one event with one shape: the engine's errors and
the `MediaError` of the video.

The core maps a `MediaError` to `MEDIA_DECODE_ERROR` or
`MEDIA_CODEC_UNSUPPORTED`, as the engine does. A native session reports no
other error.

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
