# 14 Ads

`@mattebox/player-ads` plays ads in the player. It reads the breaks the
stream signals and the ones your ad server schedules, shows the ad controls,
and sends the beacons advertisers count.

## The add-on

You add `ads()` to every player of the page, then the three ad elements to
the players that show ads:

```html
<mattebox-player controls="custom" src="https://example.com/vod/master.m3u8"
  ad-schedule="https://ads.example.com/vmap.xml">
  <mbx-ad-info></mbx-ad-info>
  <mbx-ad-skip-button></mbx-ad-skip-button>
  <mbx-ad-link></mbx-ad-link>
  <mbx-control-bar>…</mbx-control-bar>
</mattebox-player>

<script type="module">
  import { MatteboxPlayerElement } from '@mattebox/player';
  import { ads } from '@mattebox/player-ads';

  MatteboxPlayerElement.define({ addons: [ads()] });
</script>
```

- `ads()` adds the engine's `interstitials` stage to the stack, whatever
  the preset or the stages you give.
- `addons` is an option of the player. A package of your own can use it:
  `{ name, stages?(), attach?(player), engine? }`, where `attach` returns
  what to run when the player leaves the page.
- On Safari, `ads()` keeps HLS on the engine (ManagedMediaSource on iOS
  17.1 and later): Safari's own HLS plays interstitials itself and reports
  nothing, so no ad controls and no beacons. An older iOS stays native.

## Where the ads come from

| Source                                  | What you do                                             |
| --------------------------------------- | ------------------------------------------------------- |
| HLS interstitials, DASH alternative MPD | Nothing: the stream schedules them                      |
| A VMAP                                  | `ad-schedule="vmap.xml"`, or `adsOf(player).load(url)`  |
| One VAST as a pre-roll                  | `ad-schedule="vast.xml"`                                |
| Your own times                          | `adsOf(player).schedule([{ offset: 600, vast: url }])`  |
| A SCTE-35 cue-out of a live stream      | `adsOf(player).onOpportunity`, which returns a VAST URL |

- A new programme clears the schedule. Set `ad-schedule` with `src`, or
  call `schedule` after `sourcechange`.
- `offset` is `'start'`, `'end'`, seconds, or a VMAP time such as
  `'00:10:00'` or `'50%'`.
- The VAST of a break is fetched 10 seconds before it, so it is fresh.
- A pre-roll holds the programme while its ad server answers.

```ts
import { adsOf } from '@mattebox/player-ads';

const player = document.querySelector('mattebox-player');
player.addEventListener('sourcechange', () => {
  adsOf(player).schedule([
    { offset: 'start', vast: 'https://ads.example.com/pre.xml' },
    { offset: '50%', vast: 'https://ads.example.com/mid.xml' },
  ]);
});
adsOf(player).onOpportunity = ({ duration }) => `https://ads.example.com/live.xml?d=${duration}`;
```

## How an ad plays

| The ad has                    | It plays                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| An HLS or DASH file           | On the player's own video, through the engine. The programme loads again after it                               |
| A progressive file only (MP4) | On the player's own video too, through `player.interrupt`. The programme loads again after it, where it stopped |
| No file the browser plays     | Not at all: the ad's error beacons go with code 403                                                             |

- An HLS or DASH file comes first, then the progressive file closest above
  the player's height.
- Every ad plays on the player's own video, so its controls drive the ad
  and a TV with one decoder plays it. `ads({ progressive: 'skip' })` skips
  the progressive ads.
- `player.interrupt(source)` plays a source in the programme's place and
  `player.resume()` plays the programme again, from where it stopped. No
  `sourcechange` fires, and the programme, its markers and its trackers
  stay. A package of your own can use them.
- A VPAID or SIMID creative is not played.

## While an ad plays

- The player carries `ad`, or `ad="stitched"` for a break the stream plays
  itself that keeps the controls (see below).
- The seek bar, the times, the menus, the title and the up next card hide.
  Play, pause, volume and fullscreen stay, and drive the ad.
- Outside an ad, the seek bar shows a tick at each mid-roll, and a span
  where a break replaces a part of the programme, faded once played.
- A post-roll plays at the end, then the programme comes back on its last
  frame, paused. A playlist moves to its next item after the post-roll.
- No seek reaches an ad, and the seeking keys do nothing. Play, pause,
  mute and fullscreen keys work. A seek past a break of the schedule plays it
  first when its ads play through the engine.
- A break of a VAST or a VMAP plays once per programme, as Google's IMA SDK
  plays a VMAP: a seek back or a replay plays no ad again. A break the
  stream signals plays as the stream says, with HLS `CUE="ONCE"` or DASH
  `executeOnce`.

| Element                | What it shows                                                                                     | Attributes                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `<mbx-ad-progress>`    | How far the ad has played, a bar in the seek bar's place. Put it beside the seek bar              |                                                                           |
| `<mbx-ad-info>`        | "Ad", "Ad 2 of 3" or "Promo", and the time left in the break                                      | `label`, `label-count`, `label-promo`, `label-promo-count`, `label-break` |
| `<mbx-ad-skip-button>` | "Skip in 5", then "Skip ad" or "Skip promo". Hidden for an ad that cannot be skipped              | `label`, `label-promo`, `label-wait`                                      |
| `<mbx-ad-link>`        | An info button: opens the advertiser's page, pauses the ad, reports the click. Named "Learn more" | `label`                                                                   |

## A break the stream plays itself

A SCTE-35 cue-out, or an HLS cue the stream plays with no asset, is a
break in the programme's own segments. The add-on shows it as an ad.

| `stitched` option  | The break                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `'free'` (default) | Keeps the programme's controls, the seek bar and the seeking keys. "Skip ad" shows at once and seeks past it |
| `'strict'`         | Plays as any other ad: no seek, and no skip                                                                  |

- A rule the stream states wins in both modes: HLS `X-RESTRICT`, DASH
  `noJump`, and a creative's skip offset.
- Under `free`, a line under the label shows how far the break has played,
  and `<mbx-ad-progress>` stays hidden.
- `ads({ stitched: 'strict' })` sets the mode.

The SCTE-35 `segmentation_type_id` of a span sets what it is:

| Type                          | The player shows                                                      |
| ----------------------------- | --------------------------------------------------------------------- |
| Ad, placement and provider ad | An ad                                                                 |
| Promo (`0x3C`, `0x3E`)        | "Promo" and "Skip promo", in the ad's colour                          |
| Opening credits (`0x24`)      | A marker: the player shows "Skip intro"                               |
| Closing credits (`0x26`)      | A marker: the player shows "Skip credits"                             |
| Chapter (`0x20`)              | A chapter in the chapter menu, when the stream and the page give none |

The credits markers sit beside the page's own markers, and come back when
the page sets its markers again.

## Words

A screen reader hears "Ad break, 30 seconds" when a break starts. The words
come in the 11 languages of the player: register them with
`MatteboxPlayerElement.addLocale('fr', () => import('@mattebox/player-ads/locales/fr'))`.

## Beacons

The add-on sends each beacon once, with `fetch` in `no-cors` mode:

- `Impression`, `creativeView` and `start` when the ad starts.
- `firstQuartile`, `midpoint`, `thirdQuartile`, `complete`, and each
  `progress` at its offset.
- `pause`, `resume`, `mute`, `unmute`, `skip` and `ClickTracking`.
- `Viewable` once half the player is in view for two seconds, else
  `NotViewable` (the MRC rule).
- `Error` with `[ERRORCODE]`: 100 for no VAST, 301 for a timeout, 302 past
  five wrappers, 303 for no ad, 403 for no file to play, 405 for a file that
  failed.
- VMAP `breakStart`, `breakEnd` and `error`.
- For an ad the stream signals, the callback events of a DASH List MPD.

The macros `[CACHEBUSTING]`, `[TIMESTAMP]`, `[ERRORCODE]`,
`[MEDIAPLAYHEAD]`, `[CONTENTPLAYHEAD]`, `[ADPLAYHEAD]`, `[ASSETURI]`,
`[BREAKPOSITION]` and `[PLAYERSIZE]` are filled. Another becomes `-1`.

## Events

The player fires these, with `{ breakId, index, ad, stitched }` as
`detail`:

| Event          | When                                        |
| -------------- | ------------------------------------------- |
| `adbreakstart` | A break starts                              |
| `adstart`      | An ad starts                                |
| `adprogress`   | An ad reaches a quarter, with `quartile`    |
| `adviewable`   | An ad was in view for two seconds           |
| `adskip`       | The viewer skipped an ad                    |
| `adclick`      | The viewer opened the advertiser's page     |
| `adend`        | An ad ends                                  |
| `adbreakend`   | The programme resumes                       |
| `aderror`      | An ad or a schedule failed, with its `code` |

- A tracker listens to them as to the video's events. An ad never fires
  `sourcechange` or `programmechange`, so a tracker's session goes on.
- `adsOf(player).state` gives the ad that plays: `index`, `total`,
  `currentTime`, `duration`, `remaining`, `skipIn`, `clickThrough` and the
  VAST `ad`, with its `verifications` and `companions` for a page that
  loads a verification script or draws a banner.

## In the demo

The demo's Ads page plays the breaks the streams signal (HLS
interstitials, DASH alternative MPD, cue-outs, SVTA2053) and an ad server's
VAST and VMAP over a programme. It lists the breaks, the ad events and each
beacon the ads would send.

## Example

A page that shows a pre-roll and a mid-roll from its own ad server, and
counts them:

```html
<mattebox-player controls="custom" src="https://example.com/vod/master.m3u8">
  <mbx-ad-info></mbx-ad-info>
  <mbx-ad-skip-button></mbx-ad-skip-button>
  <mbx-ad-link></mbx-ad-link>
  <mbx-control-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-seek-bar></mbx-seek-bar>
    <mbx-ad-progress></mbx-ad-progress>
    <mbx-mute-button></mbx-mute-button>
    <mbx-fullscreen-button></mbx-fullscreen-button>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import { MatteboxPlayerElement } from '@mattebox/player';
  import { ads, adsOf } from '@mattebox/player-ads';

  MatteboxPlayerElement.define({ addons: [ads()] });

  const player = document.querySelector('mattebox-player');
  player.addEventListener('sourcechange', () => {
    adsOf(player).schedule([
      { offset: 'start', vast: 'https://ads.example.com/pre.xml' },
      { offset: 300, vast: 'https://ads.example.com/mid.xml' },
    ]);
  });
  player.addEventListener('adstart', (event) => {
    console.log('ad', event.detail.index, event.detail.ad?.title);
  });
</script>
```
