<h1>
  <img src="https://raw.githubusercontent.com/jboix/mattebox-player/main/docs/logo.svg" width="44" height="44" align="absmiddle" alt="">
  @mattebox/player-core
</h1>

The layer of the
[Mattebox player](https://github.com/jboix/mattebox-player) without a UI:
source resolution and the handler chain over the
[mattebox](https://github.com/jboix/mattebox) engine. For a page with its
own UI. No DOM writes, except that the native handler assigns `src`. No
side effects on import.

```sh
npm install @mattebox/player-core mattebox
```

```ts
import { createPlayer, matteboxHandler, nativeHandler } from '@mattebox/player-core';
import full from 'mattebox/presets/full';

const player = createPlayer(video, {
  handlers: [matteboxHandler({ preset: full }), nativeHandler()],
});

const session = await player.load({ url: 'https://example.com/vod/master.m3u8' });
```

The [guide](https://github.com/jboix/mattebox-player/blob/main/docs/guide/README.md)
explains the rest.
