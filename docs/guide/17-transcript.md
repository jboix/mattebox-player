# 17 Transcript

`@mattebox/player-transcript` shows the subtitles of a programme as a list
of lines, in a panel over the player. The viewer reads along, searches the
lines, and presses a line to play from it.

## The add-on

You add `transcript()` to every player of the page, then the panel and its
button to the players that show a transcript:

```html
<mattebox-player controls="custom" src="https://example.com/vod/master.m3u8">
  <mbx-transcript></mbx-transcript>
  <mbx-control-bar>
    <mbx-seek-bar></mbx-seek-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-subtitles-menu></mbx-subtitles-menu>
    <mbx-transcript-button></mbx-transcript-button>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import { MatteboxPlayerElement } from '@mattebox/player';
  import { transcript } from '@mattebox/player-transcript';

  MatteboxPlayerElement.define({ addons: [transcript()] });
</script>
```

| Element                 | What it does                                                                   |
| ----------------------- | ------------------------------------------------------------------------------ |
| `mbx-transcript`        | The panel. Place it inside the player, next to the video                       |
| `mbx-transcript-button` | Opens and closes the panel. Place it in the bar. It hides where no panel works |

- `transcript()` adds the engine's `transcript` stage to the stack, whatever
  the preset or the stages you give. The stage reads the cues of a subtitle
  track apart from playback.
- The lines are kept in memory only. A new source clears them.

## The panel

The panel covers the right of the player, over its whole height.

- **One line per cue**, in time order, with its time and its speaker where
  the subtitles name one.
- **The spoken line is marked** and kept in view. The list stops following
  for five seconds after the viewer scrolls it, and while a search is typed.
- **A press on a line seeks to it.**
- **Escape closes the language menu, then clears the search, then closes
  the panel.** The close button closes it too.
- **Opening the panel closes an open playlist panel.**

The panel loads the lines around the playhead when it opens, and more as the
viewer scrolls. A part that is not loaded is one row, "Load more lines".

In a compact player the panel is a sheet at the foot of the player. With
`drawer` on the player it opens over the page (see
[chapter 03](03-the-element.md#the-drawer)).

## Where it is offered

The panel sets `unavailable` on itself where it cannot work, and the button
hides.

| Source                                          | Offered |
| ----------------------------------------------- | ------- |
| Subtitles with segments of their own, on demand | Yes     |
| No subtitles, or only forced subtitles          | No      |
| Only in-band captions (CEA-608, CEA-708)        | No      |
| A live stream                                   | No      |
| Safari's own HLS                                | No      |

Safari's own HLS has no engine, so nothing can read the cues there.
`transcript({ engine: true })` keeps HLS on the engine in Safari
(ManagedMediaSource on iOS 17.1 and later), as `ads()` does in
[chapter 14](14-ads.md#the-add-on). Set `native-hls="on"` on a player to
give Safari its own HLS back, without a transcript.

## The language

The header has a language menu. The panel picks a language in this order:

1. The subtitles that show.
2. The player's language.
3. The viewer's browser languages.
4. None: the panel asks the viewer to choose.

- A pick in the panel does not change the subtitles.
- The panel follows the subtitles menu again at the viewer's next change
  there.
- The menu marks the language the subtitles show in with "Subtitles".
- Forced subtitles are not listed.

## Search

The field searches the lines, ignoring case and accents.

- The count reads "2 of 9". Enter and the next button go to the next
  match, Shift+Enter and the previous button to the one before.
- Going to a match scrolls the list. It does not seek: a press on the line
  does.
- The seek bar shows a tick at each match, and a taller one at the current
  match.
- The first character loads every line of the programme, the part around
  the playhead first. Until the last part arrives, the panel says that the
  search covers the lines loaded so far.

## A search of your own

Set `search` on the panel to answer a search from your server. The panel
then does not load the whole programme for a search.

```js
const panel = document.querySelector('mbx-transcript');

panel.search = async (query, { language, signal }) => {
  const url = `/api/search?q=${encodeURIComponent(query)}&lang=${language}`;
  const response = await fetch(url, { signal });
  return response.json(); // [{ time: 62.4 }, { time: 318 }, …]
};
```

| Argument           | What it is                                                        |
| ------------------ | ----------------------------------------------------------------- |
| `query`            | What the viewer typed, trimmed                                    |
| `context.language` | The language tag of the track the panel shows, or an empty string |
| `context.signal`   | Aborts when the viewer types again or the panel closes            |
| `context.local()`  | The panel's own search over the lines, for a fallback of your own |

Each match is `{ time }`: the seconds where its line starts. The panel
highlights what the viewer typed where the line holds it, and the whole
line where it does not.

- The panel waits 300 ms after the last keystroke before it calls you.
- A late answer to an older query is dropped.
- A rejection shows "Search is not available". Return `context.local()`
  from your `catch` to search the lines instead.
- Set `search` to `null` for the panel's own search again.

## Ranges that must not play

A range the page marks as blocked (see
[chapter 11](11-blocks-and-markers.md)) is one row in the list, "This part
is not available", with its times.

- The lines of the range are dropped as they arrive. They are never in the
  page.
- A search skips the range. A match of your own search inside it is
  dropped too.

## Attributes

| Attribute     | On               | What it does                                                          |
| ------------- | ---------------- | --------------------------------------------------------------------- |
| `open`        | `mbx-transcript` | The panel shows. Set or remove it yourself to open or close           |
| `unavailable` | `mbx-transcript` | Set by the panel where no transcript can show. Read it, do not set it |
| `label`       | both             | The heading and the button's name, "Transcript"                       |
| `label-*`     | `mbx-transcript` | The other words, one attribute per word of the table below            |

## Words

The package has the words in the player's languages. Add them with the
player's own, as [chapter 10](10-languages.md) describes:

```js
MatteboxPlayerElement.addLocale(
  'de',
  () => import('@mattebox/player/locales/de'),
  () => import('@mattebox/player-transcript/locales/de'),
);
```

| Attribute             | English                                                      |
| --------------------- | ------------------------------------------------------------ |
| `label`               | Transcript                                                   |
| `label-close`         | Close                                                        |
| `label-language`      | Language                                                     |
| `label-subtitles`     | Subtitles                                                    |
| `label-none`          | None                                                         |
| `label-track`         | Track                                                        |
| `label-search`        | Search                                                       |
| `label-previous`      | Previous match                                               |
| `label-next`          | Next match                                                   |
| `label-count`         | {at} of {count}                                              |
| `label-no-match`      | No match                                                     |
| `label-search-failed` | Search is not available                                      |
| `label-blocked`       | This part is not available                                   |
| `label-range`         | {start} to {end}                                             |
| `label-more`          | Load more lines                                              |
| `label-loading`       | Loading more lines                                           |
| `label-partial`       | Loading more lines. A search covers the lines loaded so far. |
| `label-choose`        | Choose a language to read the transcript.                    |
| `label-empty`         | This language has no lines.                                  |

## Styling

The panel takes the player's tokens. Its parts:

| Part                                             | What it is                                           |
| ------------------------------------------------ | ---------------------------------------------------- |
| `header`, `heading`, `close`                     | The title bar                                        |
| `language`, `chooser`, `chosen`, `popup`, `item` | The language menu                                    |
| `tools`, `search`, `field`, `count`              | The search row                                       |
| `list`, `line`, `time`, `speaker`, `text`        | The lines                                            |
| `match`, `hit`                                   | The matched text in a line, and a line matched whole |
| `blocked`, `blocked-text`, `blocked-range`       | The row of a range that must not play                |
| `gap`, `more`, `note`, `status`                  | The parts not loaded and the notices                 |

The seek bar draws the matches as `spot` parts, in the colour of
`--mbx-spot`.

## Example

A player with a transcript that searches on your server and falls back to
the lines in the page.

```html
<mattebox-player controls="custom" src="https://example.com/vod/master.m3u8">
  <mbx-transcript></mbx-transcript>
  <mbx-control-bar>
    <mbx-seek-bar></mbx-seek-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-subtitles-menu></mbx-subtitles-menu>
    <mbx-transcript-button></mbx-transcript-button>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import { MatteboxPlayerElement } from '@mattebox/player';
  import { transcript } from '@mattebox/player-transcript';

  MatteboxPlayerElement.define({ addons: [transcript()] });

  document.querySelector('mbx-transcript').search = async (query, context) => {
    try {
      const url = `/api/search?q=${encodeURIComponent(query)}&lang=${context.language}`;
      const response = await fetch(url, { signal: context.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (context.signal.aborted) throw error;
      return context.local();
    }
  };
</script>
```
