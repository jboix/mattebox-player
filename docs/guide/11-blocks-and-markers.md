# 11 Blocks and markers

Your content API knows things a stream does not carry: where the credits
are, which parts must not play, and why a programme does not play at all.
Markers name ranges of a programme. A block replaces the whole programme
with the reason, in the viewer's language.

A [connector](09-connectors.md) can return both, and the player
applies them for you.

## Markers

Markers are ranges of the media that you name from your own content API:
the opening and closing credits, a recap, or a part that must not play.
No stream format carries credits as a standard, so the page sets them.
They work the same for an engine session and a native one.

```ts
player.markers.set([
  { start: 0, end: 52, kind: 'opening-credits' },
  { start: 600, end: 630, kind: 'blocked', label: 'Not available for legal reasons' },
  { start: 1380, end: 1440, kind: 'closing-credits' },
]);
```

| `kind`            | What happens                                                                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `opening-credits` | `<mbx-marker-button>` shows "Skip intro" inside the range                                                                                                             |
| `closing-credits` | `<mbx-marker-button>` shows "Skip credits" inside the range, unless the player carries `upnext`                                                                       |
| `blocked`         | Playback never enters the range: the player moves past its end. The seek bar shows a hollow in the track there, and its preview shows the `label`, or "Not available" |
| Any other word    | `<mbx-marker-button>` shows "Skip" and the marker's `label`                                                                                                           |

- Set the markers after `src`: a new source clears them.
- `player.markers.list` gives them by start, and `player.markers.within(time)`
  the ones that hold a time.
- `markerschange` fires when the list changes, with the list as `detail`.
- `blocked` fires each time the player moves past a blocked range, with
  the marker as `detail`. Show a notice there if your viewers need one.
- A `label` can be given by language, as a block's words are: see
  [Blocks](#blocks).

## Blocks

`block()` shows why the programme does not play, such as a geographic or an
age restriction, and stops the load. Your content API gives the reason, and
you give the player its words:

```ts
player.block({
  title: { en: 'Not available', de: 'Nicht verfügbar', fr: 'Non disponible' },
  message: {
    en: 'This content is not available outside Switzerland.',
    de: 'Dieser Inhalt ist ausserhalb der Schweiz nicht verfügbar.',
    fr: 'Ce contenu n’est pas disponible hors de Suisse.',
  },
});
```

- `<mbx-error-screen>` shows the title and the message, with no retry.
  Under native controls, the row under the video shows them.
- Each text is a string, or the same words by language tag. The player
  reads them in its own language: the tag, then its language alone, then
  `en`, then the first entry. They change with `language`, as the
  controls' words do.
- Without a `title`, the title is the player's word for "Not available",
  in the player's language.
- A new `src` or `sources` clears the block, as it clears the markers.
  `unblock()` clears it too. Nothing plays until a source loads: set one,
  or call `retry()`.
- `player.blocked` is the block, or null, and `blockchange` fires when it
  changes.
- The live region says the title and the message, unless an
  `<mbx-error-screen>` in the player says them.

## Example

A page that asks its API about an episode, and either blocks it or plays it
with its credits:

```ts
const player = document.querySelector('mattebox-player');
const episode = await fetch('/api/episodes/ep-1042').then((r) => r.json());

if (episode.blockReason === 'GEOBLOCK') {
  player.block({
    message: {
      en: 'This programme is only available in Switzerland.',
      de: 'Diese Sendung ist nur in der Schweiz verfügbar.',
    },
  });
} else {
  player.setAttribute('src', episode.hls);
  // After the source: a new source clears the markers.
  player.markers.set([
    { start: 0, end: episode.introEnd, kind: 'opening-credits' },
    { start: episode.creditsStart, end: episode.duration, kind: 'closing-credits' },
  ]);
}
```
