# @mattebox/player-core

The headless layer of the [Mattebox player](https://github.com/jboix/mattebox-player):
source resolution and the handler chain over the
[mattebox](https://github.com/jboix/mattebox) engine. No DOM writes except
assigning `src` in the native handler. No side effects on import.

```sh
npm install @mattebox/player-core mattebox
```

```ts
import { createPlayer, matteboxHandler, nativeHandler } from '@mattebox/player-core';
import dual from 'mattebox/presets/dual';

const player = createPlayer(video, {
  handlers: [matteboxHandler({ preset: dual }), nativeHandler()],
});

const session = await player.load({ url: 'https://example.com/vod/master.m3u8' });
```

The [guide](https://github.com/jboix/mattebox-player/blob/main/docs/guide/README.md)
covers the rest.
