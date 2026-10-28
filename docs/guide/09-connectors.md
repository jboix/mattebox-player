# 09 Connectors

A connector turns the id of a programme into what plays: the sources, the
title and pictures, the chapters and markers, or the reason it does not
play. You register one per source type, and you then load a programme by
its id, or by the data you already have.

Connectors are part of `@mattebox/player-core`. The core fetches and
resolves the programme, and `<mattebox-player>` shows what the resolution
says. You can use them with the core alone or through the element.

## A connector

A connector is an object with a type, an optional `fetch` and a `resolve`:

```ts
import type { Connector } from '@mattebox/player-core';

interface Episode {
  readonly title: string;
  readonly show: string;
  readonly hls: string;
  readonly image: string;
  readonly region?: string;
}

export const tv: Connector<Episode> = {
  type: 'example/episode',
  async fetch(id, signal) {
    const response = await fetch(`https://api.example.com/episodes/${id}`, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
  resolve(episode) {
    const metadata = { title: episode.title, subtitle: episode.show, image: episode.image };
    if (episode.region === 'CH') {
      return { sources: [], block: { message: 'Only available in Switzerland.' }, metadata };
    }
    return { sources: [{ url: episode.hls }], metadata };
  },
};
```

| Member                  | What it does                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `type`                  | The source type the connector takes, such as `srgssr/urn`. Use your own words, with a slash |
| `fetch(id, signal)`     | Fetches the programme's data from your content API. Optional: without it, you give the data |
| `resolve(data, signal)` | Turns the data into a resolution. It may fetch what each playback needs, such as a token    |

A resolution has three fields:

| Field      | What it is                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| `sources`  | The sources to try in order, as a `sources` list. Each can carry `drm` and `videoTracks`                          |
| `block`    | Why the programme does not play. A block wins: nothing loads                                                      |
| `metadata` | What your API says of the programme: `title`, `subtitle`, `description`, `image`, `poster`, `chapters`, `markers` |

## With the core

You pass the connectors to `createPlayer`, and you load a programme by
its type and id:

```ts
import { createPlayer, matteboxHandler, nativeHandler } from '@mattebox/player-core';
import { tv } from './connectors/tv.js';

const player = createPlayer(video, {
  handlers: [matteboxHandler(), nativeHandler()],
  connectors: [tv],
});

player.on('programme', (programme) => {
  heading.textContent = programme?.metadata?.title ?? '';
});
await player.load({ type: 'example/episode', id: 'ep-1042' });
```

- `load` calls `fetch`, then `resolve`, then plays the sources.
- `player.programme` is what the load resolved: the sources, the metadata
  and the block, and the type, id and data of the connector source. It is
  null before a load and after an unload.
- The `programme` event fires when a load resolves, and with null at an
  unload.
- A blocked programme loads nothing, and `load` rejects with `Blocked`.

## With the element

You pass the same list in the element's options, once for every player of
the page:

```ts
import { MatteboxPlayerElement } from '@mattebox/player';

MatteboxPlayerElement.define({ connectors: [tv] });
```

You then give the id as `src` and the connector's type as `type`:

```html
<mattebox-player controls="custom" src="ep-1042" type="example/episode"></mattebox-player>
```

From script, you set the same in `sources`:

```ts
player.sources = [{ type: 'example/episode', id: 'ep-1042' }];
```

- `new MatteboxPlayerElement({ connectors: [tv] })` gives them to one player.
- A player reads its options at its first load. Call `define()` before
  then, at the top of your module.
- `player.programme` and the `programmechange` event are the core's
  programme and `programme` event. `programmechange` fires before
  `sourcechange`.

The element applies the resolution before the session starts:

| Field of `metadata`    | Where it goes                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `title`, `subtitle`    | `<mbx-title>`, for each attribute the page leaves out: `heading`, `subheading`                     |
| `poster`               | The video's poster, unless the player has a `poster` attribute                                     |
| `chapters`             | `engine.chapters.set`, unless the player has a `chapters` attribute. An engine session only        |
| `markers`              | `player.markers`, as [chapter 11](11-blocks-and-markers.md) describes                              |
| `image`, `description` | Nothing. Read them from `player.programme`. Set `artwork` on `<mbx-title>` to show the image there |

A `block` shows on the error screen as `block()` shows it: see
[chapter 11](11-blocks-and-markers.md).

## Load with data you already have

You give the data instead of the id. The core calls `resolve` alone, and
no request goes to your API:

```ts
const episode = await myCache.get('ep-1042');
player.sources = [{ type: 'example/episode', id: 'ep-1042', data: episode }];
```

- Use this when your page already fetched the data, for a list or a page
  rendered on your server, or when your tests use fixtures.
- The id is optional with data. Give it to name the programme to your
  trackers.
- A connector without `fetch` takes data only.
- A connector is never required. A source of another type, or a plain URL,
  loads as before.

## Preload the next programme

`preload` resolves a connector source ahead of its load: the connector
fetches and resolves the programme, and the core preloads its first
source. The next load of the same programme takes that resolution and
asks your API nothing:

```ts
const next = { type: 'example/episode', id: 'ep-1043' };
// During the closing credits of the programme that plays.
await player.player?.preload(next);
upNext.textContent = player.player?.preloaded?.metadata?.title ?? '';
// At the end.
player.sources = [next];
```

- The load takes the preload of the same type and id, or of the same data
  object.
- The core keeps one preload, for `keepSeconds`: 30 seconds by default, as
  long as the engine keeps a preloaded manifest. A resolution can carry a
  token that expires, so an older one resolves again.
- A load takes a preload once. A second load of the programme, such as a
  retry, asks your API again.
- When the preload failed, the load asks the connector again and reports
  what it says then.
- `preloaded` is the programme the last preload resolved, such as the
  title an up next card shows. A blocked programme preloads none of its
  sources, and `preloaded` carries its block.
- The playlist preloads its next item this way: see
  [chapter 07](07-playlist.md).

## Errors

A connector's failure is a fatal `error` of category `connector`:

| `code`                | When                                                   |
| --------------------- | ------------------------------------------------------ |
| `CONNECTOR_UNKNOWN`   | No connector is registered for the source's type       |
| `CONNECTOR_FAILED`    | `fetch` or `resolve` threw. `context.message` says why |
| `CONNECTOR_NO_SOURCE` | The resolution has neither sources nor a block         |

The context carries the `type` and the `id`. A programme that failed still
fires `programme`, with no sources, so a tracker sees the error.

## Rules

- A new load aborts the fetch in flight: the `signal` your `fetch` and
  `resolve` get fires. Pass it to your own requests.
- A list can mix plain sources and connector sources. Each connector
  source resolves in its place, and the first one names the programme.
- A connector runs in the page, so the browser's CORS rules apply to
  every request it makes.

## In the demo

The demo's "Broadcasters" tab has a connector for each public broadcaster
whose API answers other sites: SRG SSR, SVT, ARD, 3Cat and DW. SRG SSR
and ARD have a search, 3Cat and DW list their latest videos, and SVT has
a fixed list, because its listings answer no other site. Each one maps
its broadcaster's data to a resolution, and its block reasons to words.
"Show the data" fetches the data and lets you edit it, and "Play this
data" plays it without a second fetch.

The SRG SSR connector probes the browser's key systems the way
pillarbox-web does, and sends them to the IL as `drmPlayerCapabilities`.
The IL then lists only the resources this browser can decrypt.

The connectors live in `demo/src/connectors/`. They are examples, not
published packages.

## Example

A page that plays an episode by id, and preloads the next one during the
credits, so it starts with no request to the content API:

```html
<mattebox-player controls="custom" src="ep-1042" type="example/episode">
  <mbx-title></mbx-title>
  <mbx-error-screen></mbx-error-screen>
  <mbx-control-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-seek-bar></mbx-seek-bar>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import { MatteboxPlayerElement } from '@mattebox/player';
  import { tv } from './connectors/tv.js';

  MatteboxPlayerElement.define({ connectors: [tv] });

  const player = document.querySelector('mattebox-player');
  const next = { type: 'example/episode', id: 'ep-1043' };
  let asked = false;

  player.video.addEventListener('timeupdate', () => {
    const credits = player.markers
      .within(player.video.currentTime)
      .some((marker) => marker.kind === 'closing-credits');
    if (credits && !asked) {
      asked = true;
      player.player?.preload(next);
    }
  });
  player.video.addEventListener('ended', () => {
    player.sources = [next];
  });
</script>
```

A list of programmes is shorter with the playlist, which preloads each
next item itself:

```ts
import { createPlaylist } from '@mattebox/player-playlist';

createPlaylist(player).load([
  { src: 'ep-1042', type: 'example/episode' },
  { src: 'ep-1043', type: 'example/episode' },
]);
```
