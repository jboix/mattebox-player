# 01 Getting started

This chapter goes from install to a playing stream, with the element and
with the core alone.

## Requirements

The player runs wherever the engine does: browsers with Media Source
Extensions, and Safari on iOS 17.1 or later through ManagedMediaSource.
Sources the engine does not parse, a progressive mp4 or an mp3, play through
the element's native path, so the player runs on every browser with a
`<video>` element. Both packages are ESM. Their one runtime dependency is
the engine, `mattebox`, a peer you install alongside.

## Install

```sh
npm install @mattebox/player mattebox
```

Take the core alone when you bring your own UI:

```sh
npm install @mattebox/player-core mattebox
```

## The element

Import the package once. It registers `<mattebox-player>`.

```html
<mattebox-player src="https://example.com/vod/master.m3u8"></mattebox-player>

<script type="module">
  import '@mattebox/player';
</script>
```

The element puts a real `<video>` inside itself, in light DOM, with native
controls. Reach it as `player.video` or with a query. Everything the browser
already does stays on the video.

| Need                       | Use                                   |
| -------------------------- | ------------------------------------- |
| Play, pause, seek, volume  | `player.video`                        |
| Native controls            | The video's `controls` attribute, set |
| The element's own controls | `controls="custom"`, chapter 03       |
| Which source is loaded     | `player.player.session`               |
| The engine's namespaces    | `player.engine`, null for native      |

## The core

The core is the same chain without the UI. Pick the handler order, which
is your policy: the first non-empty answer wins.

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

`session.engine` is the engine feeding the element, or null when the native
handler won. Feature-test its namespaces the way the engine's guide says:
`'live' in engine`.

## Unload

Unload disposes the session: the engine unloads and detaches, or the native
`src` is cleared. Loading another source disposes the current session first,
so a player that switches streams only ever calls `load`.

```ts
await player.unload();
```

The element does this on `disconnectedCallback`, so a single-page app never
leaks a pipeline per navigation.

Next: [02 Handlers](02-handlers.md).
