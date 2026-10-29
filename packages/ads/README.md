<h1>
  <img src="https://raw.githubusercontent.com/jboix/mattebox-player/main/docs/logo.svg" width="44" height="44" align="absmiddle" alt="">
  @mattebox/player-ads
</h1>

Ads for the [Mattebox player](https://github.com/jboix/mattebox-player).

- It adds the engine's `interstitials` stage to every player: HLS interstitials, DASH alternative MPD events and SCTE-35 cue-outs play and show as ads.
- It reads VAST 2 to 4.3 and VMAP 1.0.1, follows wrappers, plays pods, and sends every beacon.
- `<mbx-ad-info>`, `<mbx-ad-skip-button>` and `<mbx-ad-link>` show the ad, its countdown, the skip and the advertiser's page.
- An ad with an HLS or DASH file plays on the player's own video. An ad with only an MP4 plays over it.

```sh
npm install @mattebox/player-ads @mattebox/player mattebox
```

```html
<mattebox-player controls="custom" src="https://example.com/vod/master.m3u8"
  ad-schedule="https://ads.example.com/vmap.xml">
  <mbx-ad-info></mbx-ad-info>
  <mbx-ad-skip-button></mbx-ad-skip-button>
  <mbx-ad-link></mbx-ad-link>
  <mbx-control-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-seek-bar></mbx-seek-bar>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import { MatteboxPlayerElement } from '@mattebox/player';
  import { ads } from '@mattebox/player-ads';

  MatteboxPlayerElement.define({ addons: [ads()] });
</script>
```

The [player guide, chapter 14](https://github.com/jboix/mattebox-player/blob/main/docs/guide/14-ads.md) explains the schedule, the beacons and the events.
