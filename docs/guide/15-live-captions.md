# 15 Live captions

`@mattebox/player-live-captions` writes what is said in the video over the
picture, as it is said. The browser's speech recognition hears the video's
sound. It runs on the device: no sound leaves it unless you allow a server.

## The element

```html
<mattebox-player src="https://example.com/vod/master.m3u8" controls="custom">
  <mbx-live-captions></mbx-live-captions>
  <mbx-control-bar>
    <mbx-subtitles-menu></mbx-subtitles-menu>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import '@mattebox/player';
  import '@mattebox/player-live-captions';
</script>
```

| Element              | What it does                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `mbx-live-captions`  | Recognizes the speech and draws the words over the video. Place it inside the player, next to the video                  |
| `mbx-subtitles-menu` | The player's own menu. It lists Live captions after Off while the player offers them, and the viewer turns them on there |

The menu marks Live captions with a sparkle badge, "Generated automatically
from speech", so no viewer takes the words for a person's.

The words roll up in lines of five words: the newest at the bottom, two
lines at most. A full line does not change again, so only the last line
moves while the recognizer revises what it heard. Words in
progress change until the recognizer settles them. The words go after six
seconds of silence. They sit above the bar while it shows.

## How the player knows

`<mbx-live-captions>` sets `live-captions` on the player where the browser
can recognize speech from the video.

| Value    | Meaning                                                               |
| -------- | --------------------------------------------------------------------- |
| (absent) | Not offered: no element, a browser without support, or `hide` (below) |
| `off`    | Available and off                                                     |
| `on`     | On. Set it yourself to turn them on                                   |

Choosing Live captions in the subtitles menu turns the selected subtitles
off. Choosing a subtitle track or Off turns live captions off.

## A choice in a language

Live captions are a subtitle choice in a language: live captions in
German, say. While they run, the player carries
`live-captions-language="de"`, the language the viewer turned them on in.
It stays on the player from one source to the next:

| The next source                     | What happens                                                     |
| ----------------------------------- | ---------------------------------------------------------------- |
| Has subtitles in that language      | They show instead, because a person wrote them                   |
| Has no subtitles, audio in that one | Live captions turn on by themselves                              |
| Has its audio in another language   | Live captions turn off, as subtitles do without a matching track |

The viewer's own Off removes `live-captions-language`. Live captions only
start by themselves in a language the device already has, since a download
needs the viewer's click (see [The first time](#the-first-time)).

Set `live-captions-language` yourself to ask for live captions in a
language at the next source. `<mbx-preferences>` does this to keep the
choice from one visit to the next (chapter 08). The two packages do not
import each other: they share the player's attribute.

## Attributes

| Attribute                | On                   | What it does                                                                                                                                               |
| ------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `language`               | `mbx-live-captions`  | The spoken language, which wins over the stream's. See [The language](#the-language)                                                                       |
| `cloud`                  | `mbx-live-captions`  | Lets the browser send the sound to a server when the device cannot recognize the language                                                                  |
| `hide`                   | `mbx-live-captions`  | Takes the offer back in the states it names, `unavailable`, `covered` or both. See [When live captions should not run](#when-live-captions-should-not-run) |
| `live-captions-language` | the player           | The language the viewer wants live captions in. See [A choice in a language](#a-choice-in-a-language)                                                      |
| `label-*`                | `mbx-live-captions`  | `label-preparing`, `label-language`, `label-download`, `label-source`, `label-error`: the notices                                                          |
| `label-*`                | `mbx-subtitles-menu` | `label-live` names the item, and `label-generated` is the words of its badge                                                                               |

The size and the background follow `subtitle-size` and
`subtitle-background` on the player, which the subtitles menu writes.

## The language

The element picks the spoken language in this order:

1. Its `language` attribute.
2. The playing audio track's language, as the stream labels it. A new audio
   track restarts recognition in its language.
3. The page's `<html lang>`.
4. The viewer's browser language.

It waits for the stream to say which audio plays before it falls back to
the page. A three-letter code, such as `deu` or `ger`, becomes its
two-letter one, `de`.

The browser decides which languages it recognizes, and on which devices.
No list is published: the element asks with
[`SpeechRecognition.available()`](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).
See MDN's [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
page for which browsers support it.

## When live captions should not run

The element says why in its own `unavailable` attribute, which you can
read in the browser's developer tools, and in an `unavailable` event, which
bubbles to the player.

| `unavailable` | Why                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `browser`     | The browser cannot recognize speech from a video. The menu never offers live captions              |
| `language`    | The browser cannot recognize the spoken language. Set `language`, or `cloud`, if it is wrong       |
| `source`      | The browser may not capture this source: another site's media without `crossorigin` and CORS       |
| `covered`     | The source has subtitles in the spoken language. Live captions still work if the viewer picks them |

By default, the subtitles menu offers live captions wherever the browser
supports them. Picking them where they cannot work shows why, and they
turn off. `hide` takes the offer back instead:

| `hide`                | The menu leaves live captions out                     |
| --------------------- | ----------------------------------------------------- |
| `unavailable`         | While they cannot work: `language` or `source`        |
| `covered`             | While the source has subtitles in the spoken language |
| `unavailable covered` | In both cases                                         |

```js
player.addEventListener('unavailable', (event) => {
  console.warn('Live captions should not run here:', event.detail.reason);
});
```

## The transcript

Each phrase the recognizer settles is a `transcript` event on
`<mbx-live-captions>`. It bubbles to the player.

```js
player.addEventListener('transcript', (event) => {
  console.log(event.detail.time, event.detail.text);
});
```

`time` is the media time when the phrase settled, a moment after it was said.

## The first time

The first time a viewer turns live captions on for a language, the browser
downloads it. The element shows "Preparing live captions" meanwhile. The
download needs the viewer's click, so live captions cannot start by
themselves the first time.

## Limits

- Chrome is the one browser that recognizes speech from a video's sound
  today. Elsewhere the menu item does not show.
- The element hears the sound through `captureStream()`, which leaves
  playback alone. A muted video still gets captions.
- A video from another origin needs `crossorigin` and CORS. Without them
  the browser refuses the capture, and the element says it cannot listen.
- A stream with DRM gives the page no sound, so it gets no captions.
- The words arrive a moment after they are said. They are not cues: seeking
  back does not show them again, and a seek clears them.

## Languages

The package's words come in the same languages as the player's. Load them
with the player's:

```js
import { MatteboxPlayerElement } from '@mattebox/player';
import fr from '@mattebox/player/locales/fr';
import liveFr from '@mattebox/player-live-captions/locales/fr';

MatteboxPlayerElement.addLocale('fr', fr, liveFr);
```
