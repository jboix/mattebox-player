# 01 Getting started

This chapter goes from install to a playing stream, with the element first
and then with the core alone.

## Requirements

The player runs in every browser with a `<video>` element.

- The engine plays HLS and DASH in browsers with Media Source Extensions. On an iPhone it needs iOS 17.1 or later, which has ManagedMediaSource.
- Sources the engine does not parse, such as a progressive mp4 or an mp3, play through the video's native path.

Every package is ESM. The one runtime dependency is the engine, `mattebox`.
It is a peer dependency: install it next to the player.

## Install

```sh
npm install @mattebox/player mattebox
```

Install the core alone for a UI of your own:

```sh
npm install @mattebox/player-core mattebox
```

## The element

Import the package once. The import registers `<mattebox-player>`.

```html
<mattebox-player src="https://example.com/vod/master.m3u8"></mattebox-player>

<script type="module">
  import '@mattebox/player';
</script>
```

The element creates a real `<video>` inside itself, in light DOM, with
native controls. Reach it as `player.video` or with a query. Everything the
browser already does stays on the video.

| Need                       | Use                                              |
| -------------------------- | ------------------------------------------------ |
| Play, pause, seek, volume  | `player.video`                                   |
| Native controls            | Nothing. The player sets `controls` on the video |
| The element's own controls | `controls="custom"`, chapter 03                  |
| Which source is loaded     | `player.player.session`                          |
| The engine's namespaces    | `player.engine`, null for a native session       |

## The core

The core is the same handler chain without the UI. The handler order is
your policy: the first handler with a non-empty answer plays the source.

```ts
import { createPlayer, matteboxHandler, nativeHandler } from '@mattebox/player-core';
import full from 'mattebox/presets/full';

const video = document.querySelector('video');
const player = createPlayer(video, {
  handlers: [matteboxHandler({ preset: full }), nativeHandler()],
});

player.on('error', (error) => console.error(error.code));

const session = await player.load({ url: 'https://example.com/vod/master.m3u8' });
console.log(session.handler); // 'mattebox'
```

`session.engine` is the engine that feeds the video, or null when the
native handler plays the source. Test for a namespace the way the engine's
guide says: `'live' in engine`.

## Unload

`unload` disposes the session. The engine unloads and detaches, or the
native `src` is cleared.

```ts
await player.unload();
```

`load` disposes the current session before it loads the next source. A
player that switches streams only calls `load`.

The element unloads in its `disconnectedCallback`. A single-page app
therefore leaves no engine running after a navigation.

Next: [02 Handlers](02-handlers.md).
