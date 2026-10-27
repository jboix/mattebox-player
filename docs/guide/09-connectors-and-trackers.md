# 09 Connectors and trackers

A connector turns the id of a programme into what plays: the sources, the
title and pictures, the chapters and markers, or the reason it does not
play. You register one per source type, and you then load a programme by
its id, or by the data you already have.

A tracker follows each programme the player plays. You add the trackers
your page needs and remove them when it no longer may use them. The player
only starts and stops them.

## Connectors

A connector is an object with a type, an optional `fetch` and a `resolve`:

```ts
import type { Connector } from '@mattebox/player';

interface Episode {
  readonly title: string;
  readonly show: string;
  readonly hls: string;
  readonly image: string;
  readonly region?: string;
}

const tv: Connector<Episode> = {
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

| Field      | What it is                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------- |
| `sources`  | The sources to try in order, as a `sources` list. Each can carry `drm` and `videoTracks`     |
| `block`    | Why the programme does not play. A block wins: nothing loads                                 |
| `metadata` | What your API says of the programme: see [What the player applies](#what-the-player-applies) |

### Register connectors

You pass the connectors in the player's options, once for every player of
the page:

```ts
import { MatteboxPlayerElement } from '@mattebox/player';

MatteboxPlayerElement.define({ connectors: [tv] });
```

- `new MatteboxPlayerElement({ connectors: [tv] })` gives them to one player.
- Without the element, `createPlayer(video, { handlers, connectors })` from
  `@mattebox/player-core` takes the same list.
- A player reads its options at its first load. Call `define()` before
  then, at the top of your module.

### Load by id

You give the id as `src` and the connector's type as `type`. The player
calls `fetch`, then `resolve`, then plays the sources:

```html
<mattebox-player controls="custom" src="ep-1042" type="example/episode"></mattebox-player>
```

From script, you set the same in `sources`:

```ts
player.sources = [{ type: 'example/episode', id: 'ep-1042' }];
```

### Load with data you already have

You give the data instead of the id. The player calls `resolve` alone, and
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

### What the player applies

The player applies the resolution before the session starts:

| Field of `metadata`          | Where it goes                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `title`, `subtitle`, `image` | `<mbx-title>`, for each attribute the page leaves out: `heading`, `subheading`, `artwork`   |
| `poster`                     | The video's poster, unless the player has a `poster` attribute                              |
| `chapters`                   | `engine.chapters.set`, unless the player has a `chapters` attribute. An engine session only |
| `markers`                    | `player.markers`, as [Markers](03-the-element.md#markers) describes                         |
| `description`                | Nothing. Read it from `player.programme` for your page                                      |

- A `block` shows on the error screen as `block()` shows it: see
  [Blocks](03-the-element.md#blocks).
- `player.programme` is what the load resolved: the sources, the metadata
  and the block, and the type, id and data of the connector source. It is
  null before a load and after an unload.
- `programmechange` fires when a load resolves, before `sourcechange`, and
  with null at an unload.

### Errors

A connector's failure is a fatal `error` of category `connector`:

| `code`                | When                                                   |
| --------------------- | ------------------------------------------------------ |
| `CONNECTOR_UNKNOWN`   | No connector is registered for the source's type       |
| `CONNECTOR_FAILED`    | `fetch` or `resolve` threw. `context.message` says why |
| `CONNECTOR_NO_SOURCE` | The resolution has neither sources nor a block         |

The context carries the `type` and the `id`. A programme that failed still
fires `programmechange`, with no sources, so a tracker sees the error.

### Rules

- A new load aborts the fetch in flight: the `signal` your `fetch` and
  `resolve` get fires. Pass it to your own requests.
- A list can mix plain sources and connector sources. Each connector
  source resolves in its place, and the first one names the programme.
- `preload()` skips connector sources, because the load would fetch their
  data a second time. A page that preloads passes the data.
- A connector runs in the page, so the browser's CORS rules apply to
  every request it makes.

## Trackers

A tracker is an object with a name and two methods:

```ts
import type { Tracker } from '@mattebox/player';
import { deviceId, sessionId } from '@mattebox/player';

function audience(send: (event: object) => void): Tracker {
  let session: string | undefined;
  let off = (): void => undefined;
  return {
    name: 'audience',
    device: deviceId({ key: 'my-app.device' }),
    get session() {
      return session;
    },
    start(programme, player) {
      session = sessionId();
      const id = programme.id;
      const playing = (): void => send({ event: 'play', id, session, at: player.video.currentTime });
      player.video.addEventListener('playing', playing);
      off = () => player.video.removeEventListener('playing', playing);
    },
    stop() {
      off();
      send({ event: 'stop', session });
      session = undefined;
    },
  };
}
```

| Member                     | What it does                                                                    |
| -------------------------- | ------------------------------------------------------------------------------- |
| `name`                     | What the diagnostics panel calls the tracker                                    |
| `session`                  | The id of the tracker's current session. Optional; the panel shows it           |
| `device`                   | The id of the device the tracker reports. Optional; the panel shows it          |
| `start(programme, player)` | Runs at the start of each programme. Listen to the player and the video here    |
| `stop()`                   | Runs at the end of the programme, at an unload, and when you remove the tracker |

### Add and remove trackers

```ts
const tracker = audience(sendToMyServer);
player.trackers.add(tracker);
// Later, when your page may no longer track:
player.trackers.delete(tracker);
```

- A tracker added during a programme starts at once. One removed during a
  programme stops at once.
- `player.trackers.list` gives the trackers, and `has(tracker)` tells
  whether one is there.
- `trackerschange` fires when a tracker is added, removed, started or
  stopped. Its `detail` is the list.
- An error a tracker throws does not stop playback or the other trackers.
  It reaches the console on a task of its own.
- The player has no tracking switch and no consent logic. You decide when
  a tracker may run, and you add it then.

### What a tracker reads

`start` gets the programme and the player. The programme's `data` is what
your connector fetched or what you gave, so a tracker maps the labels your
analytics need from it:

```ts
start(programme, player) {
  if (programme.type === 'example/episode') {
    const episode = programme.data as Episode;
    send({ event: 'start', show: episode.show, title: episode.title });
  }
}
```

From there, a tracker listens to what it needs: the video's own events
(`playing`, `pause`, `seeking`, `ended`), the player's `error` and
`sourcechange`, and the engine's namespaces, such as `engine.qoe` when the
`qoe` stage is in the stack.

### Session and device ids

| Function                     | What it returns                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| `sessionId()`                | A random UUID, version 4. Call it at each `start` for a new session                        |
| `deviceId({ key, storage })` | The id stored under `key`, or a new one stored there. `storage` is localStorage by default |

- `deviceId` writes to storage. Call it only once your page may store an
  id on the viewer's device.
- The diagnostics panel lists each tracker with its session and device
  ids, and the report carries them as `trackers`. A viewer can give them
  to your support team, who find the session in your tracker's own data.

## In the demo

The demo's "Broadcasters" tab has a connector for each public broadcaster
whose API answers other sites: SRG SSR, SVT, ARD, RTVE and DW. Each one
maps its broadcaster's data to a resolution, and its block reasons to
words. "Show the data" fetches the data and lets you edit it, and "Play
this data" plays it without a second fetch. The log tracker lists what a
media analytics tracker would send, and sends nothing.

The connectors live in `demo/src/connectors/`. They are examples, not
published packages.

## Example

A page that plays an episode by id, then the next one from data it already
has, with a tracker it adds after the viewer agreed:

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
  import { audience } from './trackers/audience.js';

  MatteboxPlayerElement.define({ connectors: [tv] });

  const player = document.querySelector('mattebox-player');
  document.addEventListener('consent', () => {
    player.trackers.add(audience(sendToMyServer));
  });

  player.video.addEventListener('ended', async () => {
    const next = await fetch('/api/next?after=ep-1042').then((r) => r.json());
    player.sources = [{ type: 'example/episode', id: next.id, data: next }];
  });
</script>
```
