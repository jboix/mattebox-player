# 13 Trackers

A tracker follows each programme the player plays. You add the trackers
your page needs and remove them when it no longer may use them. The player
only starts and stops them.

Trackers are part of `<mattebox-player>`. A tracker reads the programme a
[connector](09-connectors.md) resolved, or the source a plain load gave.

## A tracker

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

## Add and remove trackers

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

## What a tracker reads

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

- A drag on the seek bar pauses the video, seeks at each frame and plays
  again at the release. The player carries `scrubbing` through the drag,
  so a tracker skips those events and counts one seek.
- A click on the seek bar seeks once.

## Session and device ids

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

The demo's log tracker lists what a media analytics tracker would send,
and sends nothing: play, pause, seek, end, stop, and a heartbeat every 30
seconds, as pillarbox-apple's Commanders Act tracker sends them. It also
shows the labels it would map from the SRG SSR and SVT data.

## Example

A page that adds its tracker once the viewer agreed:

```html
<mattebox-player controls="custom" src="ep-1042" type="example/episode">
  <mbx-title></mbx-title>
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
</script>
```
