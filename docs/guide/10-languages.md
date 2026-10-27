# 10 Languages

The controls of every package speak your viewer's language. You import the
languages your page offers, register them once, and the players follow the
page's `lang` or their own `language` attribute.

## Register a language

Each package ships its words in 11 languages besides English: `ar`, `ca`,
`de`, `es`, `fr`, `hi`, `it`, `ja`, `ko`, `pt` (European) and `zh`
(Simplified). Each language is an entry of its own, so a page downloads only
the languages it imports. You register a language once for every player on
the page:

```ts
import { MatteboxPlayerElement } from '@mattebox/player';
import words from '@mattebox/player/locales/de';
import playlistWords from '@mattebox/player-playlist/locales/de';

MatteboxPlayerElement.addLocale('de', words, playlistWords);
```

A source can also be a function that loads the words. It runs only when a
player shows that language, so a page registers every language it offers
and downloads one:

```ts
MatteboxPlayerElement.addLocale('fr', () => import('@mattebox/player/locales/fr'));
```

A player shows, from the first that applies:

1. A control's `label-*` attribute. See [Labels](03-the-element.md#labels).
2. The words of its `language` attribute, such as `language="fr"`.
3. The words of the nearest `lang` attribute: on the player, an ancestor,
   or `<html>`.
4. English, which the controls carry themselves.

- A tag with a region falls back to its language: `de-CH` takes `de`.
- A word a language lacks stays English.
- Changing `language`, or `lang` on `<html>` or on the player, changes
  every word at once, without a reload. A change of `lang` on another
  ancestor is read at the next connect; set `language` instead.
- A later `addLocale` for a language goes over the earlier one, so you
  change one word with `addLocale('de', { play: 'Abspielen' })`.
- The ids and their English are in the `PlayerMessages` type, and in
  `PlaylistMessages`, `CastMessages` and `DiagnosticsMessages` for the
  packages. A word set that misses an id fails to compile with
  `satisfies PlayerMessages`.
- A control of your own reads a word with `player.message(id)`, and
  renders again on `localechange`.

The shipped words are machine drafts that no native speaker has reviewed
yet.

## Words of your own

The words a page gives the player itself, such as the reason for a block or
a marker's label, take a string or the same words by language tag. The
player reads them in its own language, with the same fallback as the
controls: see [chapter 11](11-blocks-and-markers.md#blocks).

## Example

A page in French that offers German, loading each language only when a
player shows it:

```html
<html lang="fr">
  <mattebox-player controls="custom" src="vod/master.m3u8">
    <mbx-control-bar>
      <mbx-play-button></mbx-play-button>
      <mbx-seek-bar></mbx-seek-bar>
      <mbx-subtitles-menu></mbx-subtitles-menu>
    </mbx-control-bar>
  </mattebox-player>

  <script type="module">
    import { MatteboxPlayerElement } from '@mattebox/player';

    MatteboxPlayerElement.addLocale('fr', () => import('@mattebox/player/locales/fr'));
    MatteboxPlayerElement.addLocale('de', () => import('@mattebox/player/locales/de'));

    // A language switch of the page's own.
    document.querySelector('#german').addEventListener('click', () => {
      document.querySelector('mattebox-player').language = 'de';
    });
  </script>
</html>
```
