import { MatteboxPlayerElement } from '@mattebox/player';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ads, adsOf } from '../../src/index.js';

/** A WAV of silence, which every browser plays: the programme and the ad of these tests. */
function silence(seconds: number): string {
  const samples = Math.round(seconds * 8000);
  const bytes = new Uint8Array(44 + samples).fill(128, 44);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  ascii(36, 'data');
  view.setUint32(40, samples, true);
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
}

const once = (target: EventTarget, name: string): Promise<Event> =>
  new Promise((resolve) => target.addEventListener(name, resolve, { once: true }));

/** A VAST pre-roll with one progressive file, as a URL the controller fetches. */
function preroll(media: string, skipoffset?: string): string {
  const xml = `<VAST version="4.2"><Ad id="a1"><InLine>
  <AdSystem>Test</AdSystem><AdTitle>Silence</AdTitle>
  <Impression><![CDATA[https://t.example/impression?cb=[CACHEBUSTING]]]></Impression>
  <Creatives><Creative><Linear${skipoffset === undefined ? '' : ` skipoffset="${skipoffset}"`}>
    <Duration>00:00:01.000</Duration>
    <TrackingEvents>
      <Tracking event="start"><![CDATA[https://t.example/start]]></Tracking>
      <Tracking event="complete"><![CDATA[https://t.example/complete]]></Tracking>
      <Tracking event="skip"><![CDATA[https://t.example/skip]]></Tracking>
    </TrackingEvents>
    <VideoClicks><ClickThrough><![CDATA[https://brand.example/]]></ClickThrough></VideoClicks>
    <MediaFiles><MediaFile delivery="progressive" type="audio/wav"><![CDATA[${media}]]></MediaFile></MediaFiles>
  </Linear></Creative></Creatives>
</InLine></Ad></VAST>`;
  return URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
}

let sent: string[] = [];
const original = window.fetch;

beforeEach(() => {
  sent = [];
  window.fetch = (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith('https://t.example/')) {
      sent.push(url.split('?')[0] ?? url);
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return original(input, init);
  };
});

afterEach(() => {
  window.fetch = original;
  document.body.replaceChildren();
});

/** A player with the add-on and the three ad elements, its pre-roll scheduled by attribute. */
function mount(schedule: string): MatteboxPlayerElement {
  const player = new MatteboxPlayerElement({ addons: [ads()] });
  player.setAttribute('controls', 'custom');
  player.setAttribute('muted', '');
  player.setAttribute('ad-schedule', schedule);
  player.append(
    document.createElement('mbx-ad-info'),
    document.createElement('mbx-ad-skip-button'),
    document.createElement('mbx-ad-link'),
  );
  document.body.append(player);
  player.setAttribute('src', silence(3));
  player.setAttribute('type', 'audio/wav');
  return player;
}

describe('@mattebox/player-ads', () => {
  it('holds the programme for a VAST pre-roll, plays the ad on its video, then the programme', async () => {
    const player = mount(preroll(silence(1)));
    const started = once(player, 'adstart');
    await once(player, 'sourcechange');
    player.video.muted = true;
    void player.video.play().catch(() => {});
    await started;
    expect(player.getAttribute('ad')).toBe('');
    expect(player.interrupted).toBe(true);
    // The ad plays on the player's own video, so its controls drive the ad.
    expect(player.querySelector('video[part~="ad-video"]')).toBeNull();
    const info = player.querySelector('mbx-ad-info');
    expect(info?.hidden).toBe(false);
    expect(info?.shadowRoot?.querySelector('[part~="label"]')?.textContent).toBe('Ad');
    // No skip offset: the ad cannot be skipped, and the button stays hidden.
    expect(player.querySelector('mbx-ad-skip-button')?.hidden).toBe(true);
    expect(player.querySelector('mbx-ad-link')?.hidden).toBe(false);
    expect(sent).toContain('https://t.example/impression');
    expect(sent).toContain('https://t.example/start');

    await once(player, 'adbreakend');
    expect(player.hasAttribute('ad')).toBe(false);
    expect(sent).toContain('https://t.example/complete');
    // The programme again, from where it stopped, playing.
    await expect.poll(() => player.interrupted).toBe(false);
    await expect.poll(() => player.video.currentSrc).toBe(player.getAttribute('src'));
    await expect.poll(() => player.video.paused).toBe(false);
    expect(adsOf(player).state).toBeNull();
  });

  it('attaches through define() when the player was on the page before it, as the demo does', async () => {
    const player = document.createElement('mattebox-player') as MatteboxPlayerElement;
    player.setAttribute('controls', 'custom');
    player.setAttribute('muted', '');
    player.setAttribute('ad-schedule', preroll(silence(1)));
    player.append(document.createElement('mbx-ad-info'));
    document.body.append(player);
    MatteboxPlayerElement.define({ addons: [ads()] });
    const started = once(player, 'adstart');
    player.setAttribute('type', 'audio/wav');
    player.setAttribute('src', silence(3));
    await once(player, 'sourcechange');
    void player.video.play().catch(() => {});
    await started;
    expect(player.getAttribute('ad')).toBe('');
    expect(player.interrupted).toBe(true);
    MatteboxPlayerElement.define({});
  });

  it('plays a progressive pre-roll whose VAST arrived before the viewer pressed play', async () => {
    const player = mount(preroll(silence(1)));
    await once(player, 'sourcechange');
    // Long enough for the VAST to be read while the programme waits for a play.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(player.hasAttribute('ad')).toBe(false);
    const started = once(player, 'adstart');
    void player.video.play().catch(() => {});
    await started;
    expect(player.getAttribute('ad')).toBe('');
    expect(player.interrupted).toBe(true);
  });

  it('reads a VMAP from a relative ad-schedule, its ad tags relative to it', async () => {
    const dir = `vmap-${Math.random().toString(36).slice(2)}`;
    const vast = preroll(silence(1));
    const vmap = `<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">
  <vmap:AdBreak timeOffset="start" breakType="linear" breakId="pre">
    <vmap:AdSource><vmap:AdTagURI><![CDATA[${vast}]]></vmap:AdTagURI></vmap:AdSource>
  </vmap:AdBreak>
</vmap:VMAP>`;
    // A relative URL the test's server answers through the fetcher option.
    const relative = `${dir}/vmap.xml`;
    const player = new MatteboxPlayerElement({
      addons: [
        ads({
          fetch: async (url) => {
            if (url.endsWith(relative)) return vmap;
            const response = await original(url);
            return response.text();
          },
        }),
      ],
    });
    player.setAttribute('controls', 'custom');
    player.setAttribute('muted', '');
    player.setAttribute('ad-schedule', relative);
    document.body.append(player);
    player.setAttribute('type', 'audio/wav');
    player.setAttribute('src', silence(3));
    const started = once(player, 'adstart');
    await once(player, 'sourcechange');
    void player.video.play().catch(() => {});
    await started;
    expect(player.getAttribute('ad')).toBe('');
    expect(player.interrupted).toBe(true);
  });

  it('shows the ad as a progress bar, the link as an info button, and takes no seeking key', async () => {
    const player = mount(preroll(silence(4)));
    const progress = document.createElement('mbx-ad-progress');
    player.append(progress);
    const started = once(player, 'adstart');
    await once(player, 'sourcechange');
    void player.video.play().catch(() => {});
    await started;
    expect(progress.hidden).toBe(false);
    const fill = progress.shadowRoot?.querySelector<HTMLElement>('[part~="fill"]');
    await expect.poll(() => Number.parseFloat(fill?.style.width ?? '0')).toBeGreaterThan(0);
    const link = player.querySelector('mbx-ad-link')?.shadowRoot?.querySelector('button');
    expect(link?.getAttribute('aria-label')).toBe('Learn more');
    expect(link?.querySelector('svg')).not.toBeNull();
    // ArrowRight would seek the bar's step: during the ad it goes nowhere.
    const before = player.video.currentTime;
    const key = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    player.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
    expect(player.video.currentTime).toBeCloseTo(before, 0);
  });

  it('skips the ad from its skip offset, and reports the skip', async () => {
    const player = mount(preroll(silence(5), '00:00:00.000'));
    const started = once(player, 'adstart');
    await once(player, 'sourcechange');
    void player.video.play().catch(() => {});
    await started;
    const button = player.querySelector('mbx-ad-skip-button');
    expect(button?.hidden).toBe(false);
    const inner = button?.shadowRoot?.querySelector('button');
    expect(inner?.disabled).toBe(false);
    expect(inner?.textContent).toBe('Skip ad');
    const ended = once(player, 'adbreakend');
    inner?.click();
    await ended;
    expect(sent).toContain('https://t.example/skip');
    expect(sent).not.toContain('https://t.example/complete');
  });
});
