<h1>
  <img src="docs/logo.svg" width="44" height="44" align="absmiddle" alt="">
  Mattebox player
</h1>

[![Quality](https://github.com/jboix/mattebox-player/actions/workflows/quality.yml/badge.svg)](https://github.com/jboix/mattebox-player/actions/workflows/quality.yml)
[![@mattebox/player](https://img.shields.io/npm/v/@mattebox/player?label=%40mattebox%2Fplayer)](https://www.npmjs.com/package/@mattebox/player)
[![@mattebox/player-core](https://img.shields.io/npm/v/@mattebox/player-core?label=%40mattebox%2Fplayer-core)](https://www.npmjs.com/package/@mattebox/player-core)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

The Mattebox player is two packages over the [mattebox](https://github.com/jboix/mattebox)
engine. The engine feeds a MediaSource and never sets the element's `src`.
The player is everything above that: deciding who feeds the element, and a
UI on top.

| Package                 | What it is                                                                     | Side effects                    |
| ----------------------- | ------------------------------------------------------------------------------ | ------------------------------- |
| `@mattebox/player-core` | The headless layer: source resolution and the handler chain. About a kilobyte. | none                            |
| `@mattebox/player`      | The `<mattebox-player>` custom element over the core, framework-free.          | registers the element on import |

An integrator with their own UI takes only the core. The engine is a peer
dependency of both.

## Quick start

Install the element and the engine:

```sh
npm install @mattebox/player mattebox --save
```

Import the package once and use the element. The `type` is optional when
the URL has a known extension.

```html
<mattebox-player src="https://example.com/vod/master.m3u8"></mattebox-player>

<script type="module">
  import '@mattebox/player';
</script>
```

The video inside keeps its native API and controls. The element adds only
what the browser cannot show: quality, tracks, live, DRM, and errors, each
present exactly when the engine's namespace is. Every element it draws
carries a `part`, so the page styles all of it with `::part()`.

With your own UI, take the core and choose the handler order:

```ts
import { createPlayer, matteboxHandler, nativeHandler } from '@mattebox/player-core';
import full from 'mattebox/presets/full';

const player = createPlayer(video, {
  handlers: [matteboxHandler({ preset: full }), nativeHandler()],
});

const session = await player.load({ url: 'https://example.com/vod/master.m3u8' });
session.engine?.quality.pin('720p');
```

The [guide](docs/guide/README.md) covers the rest, starting with
[Getting started](docs/guide/01-getting-started.md).

## Status

The workspace is bootstrapped and the gates are green. The core's types and
the type table ship; the handler chain, the two handlers, and the element's
panels are the next deliverables, in the order the
[architecture](docs/architecture.md) lists.

## Documentation

- [Guide](docs/guide/README.md): how to use the two packages, one chapter per topic.
- [Architecture](docs/architecture.md): the two packages, the boundary between them, and the handler chain.
- [Integrator log](docs/integrator-log.md): every place the engine's API made the player reach around it.
- [Demo](https://jboix.github.io/mattebox-player/): every source kind, with the handler that won.

## Contributing

See the [contributing guide](docs/CONTRIBUTING.md). Participation is governed
by the [Code of Conduct](docs/CODE_OF_CONDUCT.md). Vulnerabilities go through
[SECURITY.md](docs/SECURITY.md).

## License

MIT, see [LICENSE](LICENSE).
