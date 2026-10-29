/**
 * The ads demo: a player with the ads add-on and its three elements, a
 * choice of examples, the breaks the seek bar draws, and a log of the ad
 * events and of every beacon the ads would send. The demo logs the beacons
 * instead of sending them. The markup that builds the same player is
 * written out under it.
 */
import { MatteboxPlayerElement } from '@mattebox/player';
import { ads, adsOf } from '@mattebox/player-ads';
import logoUrl from '../../docs/logo.svg';
import { eventLog } from './event-log.js';
import { wireTheme } from './theme.js';

for (const img of document.querySelectorAll<HTMLImageElement>('img.logo')) img.src = logoUrl;
for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')) {
  link.href = logoUrl;
}

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`no #${id}`);
  return node as T;
}

const log = eventLog(byId<HTMLElement>('log'), 'Events and beacons');

// Before the player's first load: the add-on adds the engine's stage.
MatteboxPlayerElement.define({
  addons: [ads({ beacon: (url) => log.write('beacon', url.replace(/^https?:\/\//, '')) })],
});

/**
 * The engine's generated corpus: the dev server serves it from the engine's
 * repository beside this one, and the hosted demo reads the engine's site.
 */
const ENGINE = import.meta.env.DEV ? '/engine-streams' : 'https://engine.mattebox.ch/streams';
const PROGRAMME =
  'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8';

interface Example {
  readonly group: string;
  readonly label: string;
  readonly src: string;
  readonly schedule?: string;
  /** The VAST that fills each SCTE-35 cue-out of the stream, as `onOpportunity` answers. */
  readonly fill?: string;
  readonly note: string;
}

const EXAMPLES: readonly Example[] = [
  {
    group: 'Breaks in the stream',
    label: 'HLS interstitials: pre-roll, insert at 20 s, replace at 40 s, post-roll',
    src: `${ENGINE}/h264-interstitials/master.m3u8`,
    note: 'The replace at 40 s takes no skip and no jump: a seek past it plays it first. The engine’s generated streams.',
  },
  {
    group: 'Breaks in the stream',
    label: 'HLS interstitial asset list: two ads at 20 s',
    src: `${ENGINE}/h264-interstitials/master-list.m3u8`,
    note: 'X-ASSET-LIST: the break asks a JSON list for its ads when it comes near.',
  },
  {
    group: 'SCTE-35',
    label: 'HLS EXT-X-CUE-OUT from 24 to 32 s',
    src: `${ENGINE}/h264-interstitials/master-cue.m3u8`,
    note: 'A SCTE-35 cue-out: the stream plays its own ad, the player shows it as one.',
  },
  {
    group: 'SCTE-35',
    label: 'HLS EXT-X-DATERANGE with SCTE35-OUT from 24 to 32 s',
    src: `${ENGINE}/h264-interstitials/master-scte35.m3u8`,
    note: 'The standard HLS carriage of a SCTE-35 time_signal: the stream plays its own ad, the player shows it as one.',
  },
  {
    group: 'SCTE-35',
    label: 'DASH-IF livesim2: SCTE-35 in the MPD, a break every minute, live',
    src: 'https://livesim2.dashif.org/livesim2/scte35_p60:20@10;mpd=bin;emsg=0/testpic_2s/Manifest.mpd',
    note: 'An EventStream urn:scte:scte35:2014:xml+bin: a 20 s splice_insert 10 s after every full minute.',
  },
  {
    group: 'SCTE-35',
    label: 'DASH-IF livesim2: SCTE-35 in emsg, a break every minute, live',
    src: 'https://livesim2.dashif.org/livesim2/scte35_p60:20@10/testpic_2s/Manifest.mpd',
    note: 'The same cues in the media: an emsg urn:scte:scte35:2013:bin in the segments before each break.',
  },
  {
    group: 'SCTE-35',
    label: 'DASH-IF livesim2: each SCTE-35 cue-out filled with a VAST ad, live',
    src: 'https://livesim2.dashif.org/livesim2/scte35_p60:20@10/testpic_2s/Manifest.mpd',
    fill: 'ads/vast-stream.xml',
    note: 'Client-side insertion: onOpportunity answers each cue with a VAST, whose ad plays in the span. The broadcast resumes where the span ends.',
  },
  {
    group: 'Breaks in the stream',
    label: 'DASH alternative MPD: insert at 20 s, replace at 40 s',
    src: `${ENGINE}/h264-dash/manifest-interstitials.mpd`,
    note: 'The DASH events urn:mpeg:dash:event:alternativeMPD:insert and :replace.',
  },
  {
    group: 'Breaks in the stream',
    label: 'DASH-IF livesim2: an ad server’s replace every minute, live',
    src: 'https://livesim2.dashif.org/livesim2/sgai_p60:20/testpic_2s/Manifest.mpd?sessionId=mattebox&interests=travel,sailing',
    note: 'A 20 s break at every full minute: its List MPD names the ads and their callback beacons.',
  },
  {
    group: 'Breaks in the stream',
    label: 'DASH-IF livesim2: SVTA2053 ad creatives every minute, live',
    src: 'https://livesim2.dashif.org/livesim2/svta_p60:20;ads=2;click=1;skip=5/testpic_2s/Manifest.mpd?sessionId=mattebox',
    note: 'The stream plays two creatives each minute and describes them: their beacons, a skip after 5 s, a page to visit.',
  },
  {
    group: 'Breaks in the stream',
    label: 'Shaka: an HLS interstitial at the start, no jump',
    src: 'https://storage.googleapis.com/shaka-demo-assets/hls-interstitials/interstitial.m3u8',
    note: 'CUE="ONCE" and X-RESTRICT="JUMP".',
  },
  {
    group: 'An ad server over a programme',
    label: 'VAST pre-roll, a DASH ad',
    src: PROGRAMME,
    schedule: 'ads/vast-stream.xml',
    note: 'The ad plays through the engine. Tears of Steel after it.',
  },
  {
    group: 'An ad server over a programme',
    label: 'VAST pre-roll, an MP4 ad, skip after 5 s',
    src: PROGRAMME,
    schedule: 'ads/vast-mp4.xml',
    note: 'Google’s IMA sample clip, on the player’s own video.',
  },
  {
    group: 'An ad server over a programme',
    label: 'VMAP: a DASH pre-roll, an MP4 mid-roll at 30 s, a DASH post-roll',
    src: PROGRAMME,
    schedule: 'ads/vmap.xml',
    note: 'Each break plays once: a seek back or a replay plays no ad again.',
  },
];

const player = byId<MatteboxPlayerElement>('player');
const select = byId<HTMLSelectElement>('example');
const note = byId<HTMLElement>('note');
const code = byId<HTMLElement>('code');
const status = byId<HTMLElement>('status');
const breaks = byId<HTMLOListElement>('breaks');

for (const group of [...new Set(EXAMPLES.map((example) => example.group))]) {
  const optgroup = document.createElement('optgroup');
  optgroup.label = group;
  EXAMPLES.forEach((example, index) => {
    if (example.group === group) optgroup.append(new Option(example.label, String(index)));
  });
  select.append(optgroup);
}

const KEY = 'mattebox.demo.ads.example';
function remembered(): number {
  try {
    const value = Number(localStorage.getItem(KEY));
    return Number.isInteger(value) && EXAMPLES[value] !== undefined ? value : 0;
  } catch {
    return 0;
  }
}

function markup(example: Example): string {
  const schedule = example.schedule === undefined ? '' : `\n  ad-schedule="${example.schedule}"`;
  const fill =
    example.fill === undefined
      ? ''
      : `\n\n  // Each SCTE-35 cue-out of the stream asks this VAST for its ads.\n  adsOf(document.querySelector('mattebox-player')).onOpportunity = () => '${example.fill}';`;
  return `<mattebox-player controls="custom" muted
  src="${example.src}"${schedule}>
  <mbx-ad-info></mbx-ad-info>
  <mbx-ad-skip-button></mbx-ad-skip-button>
  <mbx-ad-link></mbx-ad-link>
  <mbx-control-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-seek-bar></mbx-seek-bar>
    <mbx-ad-progress></mbx-ad-progress>
    <mbx-volume></mbx-volume>
    <mbx-fullscreen-button></mbx-fullscreen-button>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import { MatteboxPlayerElement } from '@mattebox/player';
  import { ads${example.fill === undefined ? '' : ', adsOf'} } from '@mattebox/player-ads';

  MatteboxPlayerElement.define({ addons: [ads()] });${fill}
</script>`;
}

function choose(index: number): void {
  const example = EXAMPLES[index] ?? EXAMPLES[0];
  if (example === undefined) return;
  try {
    localStorage.setItem(KEY, String(index));
  } catch {
    // A browser that keeps nothing still plays the example.
  }
  note.textContent = example.note;
  code.textContent = markup(example);
  log.clear();
  const fill = example.fill;
  adsOf(player).onOpportunity = fill === undefined ? null : () => fill;
  if (example.schedule === undefined) player.removeAttribute('ad-schedule');
  else player.setAttribute('ad-schedule', example.schedule);
  player.setAttribute('src', example.src);
}

select.value = String(remembered());
select.addEventListener('change', () => choose(Number(select.value)));
choose(Number(select.value));

const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

player.addEventListener('breakschange', () => {
  breaks.replaceChildren(
    ...player.breaks.list.map((mark) => {
      const item = document.createElement('li');
      const span = mark.end === undefined ? '' : ` to ${clock(mark.end)}`;
      item.textContent = `${clock(mark.start)}${span}${mark.played === true ? ', played' : ''}`;
      return item;
    }),
  );
});

for (const name of [
  'adbreakstart',
  'adstart',
  'adprogress',
  'adskip',
  'adclick',
  'adend',
  'adbreakend',
  'aderror',
]) {
  player.addEventListener(name, (event) => {
    const detail = (
      event as CustomEvent<{
        index?: number;
        quartile?: number;
        code?: number;
        ad?: { title?: string } | null;
        stitched?: boolean;
      }>
    ).detail;
    const parts = [
      detail.ad?.title,
      detail.quartile === undefined ? undefined : `quartile ${detail.quartile}`,
      detail.code === undefined ? undefined : `code ${detail.code}`,
      detail.stitched === true ? 'in the stream' : undefined,
    ].filter((part) => part !== undefined);
    log.write(name, parts.join(', '), name === 'aderror' ? 'warn' : 'info');
  });
}
player.addEventListener('error', (event) => {
  const detail = (event as CustomEvent<{ code?: string }>).detail;
  status.textContent = `error: ${detail.code ?? ''}`;
});
player.addEventListener('sourcechange', () => {
  status.textContent = '';
});

byId<HTMLButtonElement>('copy-code').addEventListener('click', () => {
  void navigator.clipboard?.writeText(code.textContent ?? '');
});

wireTheme(byId<HTMLButtonElement>('theme-toggle'));
