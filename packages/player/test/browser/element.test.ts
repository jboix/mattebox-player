import { MatteboxPlayerElement } from '@mattebox/player';
import type { Handler, PlayerError, Source } from '@mattebox/player-core';
import { matteboxHandler, nativeHandler } from '@mattebox/player-core';
import type { Mattebox, Stage, TransportConfig } from 'mattebox';
import { mattebox } from 'mattebox';
import full from 'mattebox/presets/full';
import dashCmaf from 'mattebox/protocols/dash-cmaf';
import hlsCmaf from 'mattebox/protocols/hls-cmaf';
import emeCore from 'mattebox/stages/eme-core';
import emeFairplay from 'mattebox/stages/eme-fairplay';
import { afterEach, describe, expect, it } from 'vitest';
import { compose, silence } from './helpers.js';

const HLS_MASTER = `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-STREAM-INF:BANDWIDTH=300000,CODECS="avc1.42c015",RESOLUTION=480x270
v1.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=800000,CODECS="avc1.42c01e",RESOLUTION=1280x720
v2.m3u8
`;

const HLS_MEDIA = `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:4
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-MAP:URI="init.mp4"
#EXTINF:4.0,
seg1.m4s
#EXT-X-ENDLIST
`;

const HLS_ALT = `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aac",NAME="English",LANGUAGE="en",DEFAULT=YES,AUTOSELECT=YES,URI="a-en.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aac",NAME="French",LANGUAGE="fr",URI="a-fr.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=300000,CODECS="avc1.42c015,mp4a.40.2",RESOLUTION=480x270,AUDIO="aac"
v1.m3u8
`;

const ROUTES: Readonly<Record<string, readonly [string, string]>> = {
  '/hls/master.m3u8': [HLS_MASTER, 'application/vnd.apple.mpegurl'],
  '/hls/alt.m3u8': [HLS_ALT, 'application/vnd.apple.mpegurl'],
  '/hls/a-en.m3u8': [HLS_MEDIA, 'application/vnd.apple.mpegurl'],
  '/hls/a-fr.m3u8': [HLS_MEDIA, 'application/vnd.apple.mpegurl'],
  '/hls/v1.m3u8': [HLS_MEDIA, 'application/vnd.apple.mpegurl'],
  '/hls/v2.m3u8': [HLS_MEDIA, 'application/vnd.apple.mpegurl'],
};

const transport: TransportConfig = {
  fetchImpl: (url: string) => {
    const route = ROUTES[new URL(url).pathname];
    if (route === undefined) return Promise.resolve(new Response(null, { status: 404 }));
    return Promise.resolve(
      new Response(route[0], { status: 200, headers: { 'content-type': route[1] } }),
    );
  },
  retry: { maxAttempts: 1 },
};

/** eme-core tears down through an unguarded setMediaKeys. */
const DRM_TIER = ['eme-core', 'eme-cenc', 'eme-fairplay'];
const EME = 'setMediaKeys' in HTMLMediaElement.prototype;

function chain(): Handler[] {
  return [
    matteboxHandler({ preset: full, transport, ...(EME ? {} : { without: DRM_TIER }) }),
    nativeHandler(),
  ];
}

/** The element with its chain supplied, the JS route. */
function mount(attributes: Readonly<Record<string, string>> = {}): MatteboxPlayerElement {
  const player = new MatteboxPlayerElement({ handlers: chain() });
  for (const [name, value] of Object.entries(attributes)) player.setAttribute(name, value);
  document.body.append(player);
  return player;
}

/**
 * The element over a native chain alone, with no `type`: the source is
 * the browser's whatever its URL, so only its metadata says what it is.
 */
function native(src: string): MatteboxPlayerElement {
  const player = new MatteboxPlayerElement({ handlers: [nativeHandler()] });
  player.setAttribute('muted', '');
  player.setAttribute('src', src);
  document.body.append(player);
  return player;
}

/** The composition arrives a microtask after the connect. */
function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The menus in the bar that are on screen, by tag. */
function shown(player: MatteboxPlayerElement): string[] {
  return [...player.querySelectorAll('mbx-control-bar > *')]
    .filter((node) => node.localName.endsWith('-menu') && !(node as HTMLElement).hidden)
    .map((node) => node.localName);
}

/** The element under custom controls with a composition of every control, over `src`. */
function composed(src: string): MatteboxPlayerElement {
  const player = mount({ controls: 'custom', src });
  player.append(...compose());
  // Wide enough for every button: at the test page's width the bar
  // collapses its menus.
  player.style.width = '800px';
  return player;
}

/** Every item of a menu's popup, by text. */
function texts(node: Element | null | undefined): string[] {
  return [...(node?.shadowRoot?.querySelectorAll('[part~="popup"] button') ?? [])].map(
    (item) => item.textContent ?? '',
  );
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('<mattebox-player>', () => {
  it('is registered on import', () => {
    expect(customElements.get('mattebox-player')).toBe(MatteboxPlayerElement);
  });

  it('upgrades with a native video in light DOM and its own shadow root', () => {
    document.body.innerHTML = '<mattebox-player></mattebox-player>';
    const player = document.querySelector('mattebox-player');
    expect(player).toBeInstanceOf(MatteboxPlayerElement);
    const video = player?.querySelector('video');
    expect(video).toBeInstanceOf(HTMLVideoElement);
    expect(video?.controls).toBe(true);
    expect((player as MatteboxPlayerElement).video).toBe(video);
    expect(player?.shadowRoot).not.toBeNull();
  });

  it('creates the video inline, so an iPhone does not take it to fullscreen on play', () => {
    document.body.innerHTML = '<mattebox-player></mattebox-player>';
    const player = document.querySelector('mattebox-player') as MatteboxPlayerElement;
    expect(player.video.hasAttribute('playsinline')).toBe(true);
    // On until told otherwise, like `spellcheck`: only "false" turns it off,
    // and off is the attribute absent, because the video's is a boolean.
    player.setAttribute('playsinline', 'false');
    expect(player.video.hasAttribute('playsinline')).toBe(false);
    player.setAttribute('playsinline', '');
    expect(player.video.hasAttribute('playsinline')).toBe(true);
    player.setAttribute('playsinline', 'false');
    player.removeAttribute('playsinline');
    expect(player.video.hasAttribute('playsinline')).toBe(true);
  });

  it('reads playsinline="false" from the markup', () => {
    document.body.innerHTML = '<mattebox-player playsinline="false"></mattebox-player>';
    const player = document.querySelector('mattebox-player') as MatteboxPlayerElement;
    expect(player.video.hasAttribute('playsinline')).toBe(false);
  });

  it('loads once when its attributes are set before it is connected', async () => {
    const player = new MatteboxPlayerElement({ handlers: chain() });
    let changes = 0;
    player.addEventListener('sourcechange', () => {
      changes += 1;
    });
    player.setAttribute('src', silence());
    player.setAttribute('type', 'audio/wav');
    player.setAttribute('muted', '');
    document.body.append(player);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(changes).toBe(1);
  });

  it('forwards autoplay, muted and poster as attributes', () => {
    document.body.innerHTML = '<mattebox-player muted poster="p.png"></mattebox-player>';
    const player = document.querySelector('mattebox-player') as MatteboxPlayerElement;
    expect(player.video.getAttribute('muted')).toBe('');
    // The attribute alone would not do: a video reads `muted` into its state
    // only when it is created, and this one was created before the attribute
    // reached it. Muted autoplay depends on the state, not the attribute.
    expect(player.video.muted).toBe(true);
    expect(player.video.getAttribute('poster')).toBe('p.png');
    player.setAttribute('autoplay', '');
    expect(player.video.hasAttribute('autoplay')).toBe(true);
    player.removeAttribute('poster');
    expect(player.video.hasAttribute('poster')).toBe(false);
  });

  it('reflects started after the first play, and waiting while data is awaited', () => {
    document.body.innerHTML =
      '<mattebox-player muted src="https://cdn.test/show.mp4"></mattebox-player>';
    const player = document.querySelector('mattebox-player') as MatteboxPlayerElement;
    const video = player.video;
    expect(player.hasAttribute('started')).toBe(false);
    expect(player.hasAttribute('waiting')).toBe(false);
    video.dispatchEvent(new Event('waiting'));
    expect(player.hasAttribute('waiting')).toBe(true);
    video.dispatchEvent(new Event('playing'));
    expect(player.hasAttribute('started')).toBe(true);
    expect(player.hasAttribute('waiting')).toBe(false);
    // A paused video with a full buffer fires stalled: it is no wait.
    video.dispatchEvent(new Event('stalled'));
    expect(player.hasAttribute('waiting')).toBe(false);
    video.dispatchEvent(new Event('waiting'));
    video.dispatchEvent(new Event('canplay'));
    expect(player.hasAttribute('waiting')).toBe(false);
    // A new source starts over.
    video.dispatchEvent(new Event('emptied'));
    expect(player.hasAttribute('started')).toBe(false);
  });

  it('reflects audio from the source type before the metadata arrives', () => {
    document.body.innerHTML =
      '<mattebox-player muted src="https://cdn.test/show.mp3?token=1"></mattebox-player>';
    const player = document.querySelector('mattebox-player') as MatteboxPlayerElement;
    expect(player.hasAttribute('audio')).toBe(true);
    // The hint leaves the page's own attributes alone.
    expect(player.hasAttribute('muted')).toBe(true);
    player.setAttribute('type', 'video/mp4');
    expect(player.hasAttribute('audio')).toBe(false);
    player.removeAttribute('type');
    player.setAttribute('src', 'https://cdn.test/hls/master.m3u8');
    expect(player.hasAttribute('audio')).toBe(false);
  });

  it('reflects audio from the metadata of a source with no picture', async () => {
    // A blob URL carries no extension, so only the metadata can tell.
    const url = silence();
    const player = native(url);
    expect(player.hasAttribute('audio')).toBe(false);
    await expect.poll(() => player.hasAttribute('audio')).toBe(true);
    URL.revokeObjectURL(url);
  });

  it('follows a picture that appears or goes away mid-stream', async () => {
    const url = silence();
    const player = native(url);
    await expect.poll(() => player.hasAttribute('audio')).toBe(true);
    // A rendition switch changes the size and fires `resize`.
    let width = 1280;
    let height = 720;
    Object.defineProperty(player.video, 'videoWidth', { get: () => width });
    Object.defineProperty(player.video, 'videoHeight', { get: () => height });
    player.video.dispatchEvent(new Event('resize'));
    expect(player.hasAttribute('audio')).toBe(false);
    width = 0;
    height = 0;
    player.video.dispatchEvent(new Event('resize'));
    expect(player.hasAttribute('audio')).toBe(true);
    URL.revokeObjectURL(url);
  });

  it('define() is idempotent', () => {
    expect(() => {
      MatteboxPlayerElement.define();
    }).not.toThrow();
  });

  it('appends nothing in any mode: native is the video alone', async () => {
    const player = mount({ src: 'https://cdn.test/hls/master.m3u8' });
    await settled();
    const children = (): string[] => [...player.children].map((node) => node.localName);
    expect(children()).toEqual(['video']);
    expect(player.video.hasAttribute('controls')).toBe(true);
    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();
    expect(children()).toEqual(['video']);
    for (const mode of ['custom', 'none', 'native']) {
      player.setAttribute('controls', mode);
      await settled();
      expect(children()).toEqual(['video']);
      expect(player.video.hasAttribute('controls')).toBe(mode === 'native');
    }
  });

  it('shows the menus its namespaces support, and hides the rest', async () => {
    const player = composed('https://cdn.test/hls/master.m3u8');
    await settled();
    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();
    await expect.poll(() => shown(player)).toContain('mbx-quality-menu');
    // The manifest declares one muxed track, so there is nothing to choose
    // between, and there is no text. The speed menu needs no namespace.
    expect(shown(player)).toEqual(['mbx-speed-menu', 'mbx-quality-menu']);
  });

  it('offers auto plus every rendition in the quality menu', async () => {
    const player = composed('https://cdn.test/hls/master.m3u8');
    await settled();
    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();
    const quality = player.querySelector('mbx-quality-menu');
    await expect.poll(() => texts(quality)).toEqual(['Auto', '720p', '270p']);
  });

  it('shows the audio menu when the manifest carries alternate audio', async () => {
    const player = composed('https://cdn.test/hls/alt.m3u8');
    await settled();
    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();
    await expect.poll(() => shown(player)).toContain('mbx-audio-menu');
    expect(texts(player.querySelector('mbx-audio-menu'))).toEqual(['English', 'French']);
  });

  it('shows no error for a native source', async () => {
    const url = silence();
    const player = mount({ src: url, type: 'audio/wav' });
    await settled();
    await expect.poll(() => player.player?.session?.handler).toBe('native');
    await expect.poll(() => player.video.readyState).toBeGreaterThan(0);
    expect(player.engine).toBeNull();
    expect(player.shadowRoot?.querySelector<HTMLElement>('[part~="error"]')?.hidden).toBe(true);
    URL.revokeObjectURL(url);
  });

  it('shows the error surface with the code when no handler claims the source', async () => {
    const player = mount({ src: 'https://cdn.test/a.m3u8', type: 'application/x-nonsense' });
    const surface = player.shadowRoot?.querySelector<HTMLElement>('[part~="error"]');
    await expect.poll(() => surface?.hidden).toBe(false);
    const code = player.shadowRoot?.querySelector('[part~="error-code"]');
    expect(code?.textContent).toBe('MANIFEST_UNSUPPORTED');
    const category = player.shadowRoot?.querySelector('[part~="error-category"]');
    expect(category?.textContent).toBe('manifest');
  });

  it('re-dispatches sourcechange and error as composed, bubbling events', async () => {
    const player = mount();
    const seen: string[] = [];
    document.addEventListener('sourcechange', () => seen.push('sourcechange'));
    document.addEventListener('error', () => seen.push('error'), true);

    player.setAttribute('src', 'https://cdn.test/hls/master.m3u8');
    await expect.poll(() => seen).toContain('sourcechange');
  });

  it('detaches on disconnect, so an SPA navigation leaks no pipeline', async () => {
    const player = mount({ src: 'https://cdn.test/hls/master.m3u8' });
    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();
    const video = player.video;
    expect(mattebox.from(video)).not.toBeNull();

    player.remove();

    await expect.poll(() => mattebox.from(video)).toBeNull();
  });

  it('reloads the source when it is reconnected', async () => {
    const player = mount({ src: 'https://cdn.test/hls/master.m3u8' });
    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();

    player.remove();
    await expect.poll(() => mattebox.from(player.video)).toBeNull();
    document.body.append(player);

    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();
  });

  it('keeps the source it loads when it moves in the page, in the task it got the source', async () => {
    // A page that moves the player into place and gives it a source at once,
    // as a feed does: a move is no removal, so nothing tears the load down.
    const player = mount();
    const slot = document.createElement('div');
    document.body.append(slot);
    const programmes: unknown[] = [];
    player.addEventListener('sourcechange', (event) =>
      programmes.push((event as CustomEvent).detail),
    );
    slot.prepend(player);
    player.setAttribute('src', 'https://cdn.test/hls/master.m3u8');
    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(player.player?.session).not.toBeNull();
    expect(programmes.filter((detail) => detail === null)).toEqual([]);
  });

  it('hands the element from the native handler to the engine on a source change', async () => {
    const url = silence();
    const player = mount({ src: url, type: 'audio/wav' });
    await expect.poll(() => player.player?.session?.handler).toBe('native');
    expect(player.video.getAttribute('src')).toBe(url);

    // `type` is authoritative, so it goes when the source it described goes.
    player.removeAttribute('type');
    player.setAttribute('src', 'https://cdn.test/hls/master.m3u8');

    await expect.poll(() => player.player?.session?.handler).toBe('mattebox');
    // The engine holds the element now: the native src is gone, replaced by
    // whatever the engine attached through.
    expect(player.video.getAttribute('src')).not.toBe(url);
    expect(mattebox.from(player.video)).toBe(player.engine);
    URL.revokeObjectURL(url);
  });

  it('names every element it draws, so a page can reach it with ::part()', async () => {
    const player = mount({ src: 'https://cdn.test/hls/master.m3u8' });
    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();

    const root = player.shadowRoot;
    const named = [...(root?.querySelectorAll('*') ?? [])].filter(
      (node) => node.tagName !== 'STYLE' && node.tagName !== 'SLOT',
    );
    expect(named.length).toBeGreaterThan(0);
    for (const node of named) expect(node.getAttribute('part')).not.toBeNull();
  });
});

describe('the menus over an engine session', () => {
  /** The composition arrives a microtask after the connect. */
  function settled(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  async function engineReady(url: string): Promise<MatteboxPlayerElement> {
    const player = mount({ controls: 'custom', src: url });
    player.append(...compose());
    // Wide enough for every button: at the test page's width the bar
    // collapses its menus, and these tests open them.
    player.style.width = '800px';
    await settled();
    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();
    return player;
  }

  function control<K extends keyof HTMLElementTagNameMap>(
    player: MatteboxPlayerElement,
    tag: K,
  ): HTMLElementTagNameMap[K] {
    const node = player.querySelector(tag);
    if (node === null) throw new Error(`no ${tag}`);
    return node;
  }

  function items(node: HTMLElement): HTMLButtonElement[] {
    return [
      ...(node.shadowRoot?.querySelectorAll<HTMLButtonElement>('[part~="popup"] button') ?? []),
    ];
  }

  function texts(node: HTMLElement): string[] {
    return items(node).map((item) => item.textContent ?? '');
  }

  function button(node: HTMLElement): HTMLButtonElement {
    return node.shadowRoot?.querySelector('[part~="button"]') as HTMLButtonElement;
  }

  function popup(node: HTMLElement): HTMLElement {
    return node.shadowRoot?.querySelector('[part~="popup"]') as HTMLElement;
  }

  it('says an audio switch in the live region, by the name of the track', async () => {
    const player = await engineReady('https://cdn.test/hls/alt.m3u8');
    const engine = player.engine as Mattebox;
    await expect.poll(() => engine.tracks.active('audio')?.name).toBe('English');
    // The region speaks once the video has played; this one has no media to play.
    player.video.dispatchEvent(new Event('playing'));
    const french = engine.tracks.available.find((track) => track.name === 'French');
    engine.tracks.select(french?.id as string);
    const region = player.shadowRoot?.querySelector('[part~="announcer"]');
    await expect.poll(() => region?.textContent).toBe('Audio: French');
  });

  it('carries the quality menu, and hides the audio and subtitles menus without a choice', async () => {
    const player = await engineReady('https://cdn.test/hls/master.m3u8');
    const quality = control(player, 'mbx-quality-menu');
    await expect.poll(() => quality.hidden).toBe(false);
    expect(texts(quality)).toEqual(['Auto', '720p', '270p']);
    // One audio track is no choice, and there is no text.
    expect(control(player, 'mbx-audio-menu').hidden).toBe(true);
    expect(control(player, 'mbx-subtitles-menu').hidden).toBe(true);
  });

  it('opens the quality menu, pins a rendition on a choice, and closes', async () => {
    const player = await engineReady('https://cdn.test/hls/master.m3u8');
    const quality = control(player, 'mbx-quality-menu');
    await expect.poll(() => quality.hidden).toBe(false);
    expect(popup(quality).hidden).toBe(true);
    expect(button(quality).getAttribute('aria-expanded')).toBe('false');

    button(quality).click();
    expect(popup(quality).hidden).toBe(false);
    expect(button(quality).getAttribute('aria-expanded')).toBe('true');
    expect(quality.hasAttribute('open')).toBe(true);

    const choice = items(quality).find((item) => item.textContent === '720p');
    choice?.click();
    expect(popup(quality).hidden).toBe(true);
    expect(player.engine?.quality.pinned).toBe(choice?.value);
    button(quality).click();
    const checked = popup(quality).querySelector('[aria-checked="true"]');
    expect(checked?.textContent).toBe('720p');
  });

  it('walks the quality menu with the arrows inside the shadow root', async () => {
    const player = await engineReady('https://cdn.test/hls/master.m3u8');
    const quality = control(player, 'mbx-quality-menu');
    // The menu shows from its first rendition, and the engine may list the second later.
    await expect.poll(() => items(quality).length).toBe(3);
    expect(quality.hidden).toBe(false);
    button(quality).click();
    const options = items(quality);
    const focused = () => quality.shadowRoot?.activeElement ?? null;
    expect(focused()).toBe(options[0]);
    const press = (key: string) =>
      popup(quality).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }),
      );
    press('ArrowDown');
    expect(focused()).toBe(options[1]);
    press('ArrowDown');
    expect(focused()).toBe(options[2]);
    press('ArrowUp');
    expect(focused()).toBe(options[1]);
    press('Escape');
    expect(popup(quality).hidden).toBe(true);
    expect(focused()).toBe(button(quality));
  });

  it('shows the audio menu when the manifest carries alternate audio', async () => {
    const player = await engineReady('https://cdn.test/hls/alt.m3u8');
    const audio = control(player, 'mbx-audio-menu');
    await expect.poll(() => audio.hidden).toBe(false);
    expect(texts(audio)).toEqual(['English', 'French']);
  });

  it('hides the menus with the session', async () => {
    const player = await engineReady('https://cdn.test/hls/master.m3u8');
    const quality = control(player, 'mbx-quality-menu');
    await expect.poll(() => quality.hidden).toBe(false);
    // Typed, so the chain sends it straight to native instead of asking the
    // engine to sniff a blob the stubbed transport cannot serve.
    player.setAttribute('type', 'audio/wav');
    player.setAttribute('src', silence());
    await expect.poll(() => player.player?.session?.handler).toBe('native');
    expect(quality.hidden).toBe(true);
  });
});

describe('the config option', () => {
  it('reaches the engine the element builds from a stage list', async () => {
    // Over the test server: the stages path has no transport hook to route
    // through, and the manifest is all the session needs to exist.
    const player = new MatteboxPlayerElement({
      stages: [hlsCmaf()],
      config: { bufferGoalSeconds: 45 },
    });
    player.setAttribute('muted', '');
    player.setAttribute('src', new URL('./fixtures/hls/master.m3u8', import.meta.url).href);
    document.body.append(player);
    await expect.poll(() => player.engine, { timeout: 10_000 }).not.toBeNull();
    expect(player.engine?.stats.snapshot().scheduling.bufferGoal).toBe(45);
  });
});

describe('the layout attribute', () => {
  /** The real button inside a control's shadow root. */
  function inner(control: HTMLElement): HTMLElement {
    return control.shadowRoot?.querySelector('button') as HTMLElement;
  }

  function sized(width: number, height: number): MatteboxPlayerElement {
    const player = new MatteboxPlayerElement({ handlers: [nativeHandler()] });
    player.setAttribute('controls', 'custom');
    player.style.width = `${width}px`;
    player.style.height = `${height}px`;
    player.innerHTML = '<mbx-control-bar><mbx-play-button></mbx-play-button></mbx-control-bar>';
    document.body.append(player);
    return player;
  }

  it('follows the size of the player, and reaches its controls', async () => {
    const player = sized(390, 219);
    const button = player.querySelector('mbx-play-button') as HTMLElement;
    await expect.poll(() => player.getAttribute('layout')).toBe('compact');
    await expect.poll(() => button.getAttribute('layout')).toBe('compact');

    const seen: string[] = [];
    player.addEventListener('layoutchange', (event) => {
      seen.push((event as CustomEvent<string>).detail);
    });
    player.style.width = '800px';
    player.style.height = '450px';
    await expect.poll(() => player.getAttribute('layout')).toBe('regular');
    expect(button.getAttribute('layout')).toBe('regular');

    player.style.width = '1600px';
    player.style.height = '900px';
    await expect.poll(() => player.getAttribute('layout')).toBe('wide');
    expect(seen).toEqual(['regular', 'wide']);
  });

  it('sizes every control from the one font size of its tier', async () => {
    const player = sized(800, 450);
    const button = player.querySelector('mbx-play-button') as HTMLElement;
    await expect.poll(() => player.getAttribute('layout')).toBe('regular');
    expect(inner(button).getBoundingClientRect().width).toBeCloseTo(40, 0);

    player.style.width = '1600px';
    player.style.height = '900px';
    await expect.poll(() => player.getAttribute('layout')).toBe('wide');
    expect(inner(button).getBoundingClientRect().width).toBeCloseTo(50, 0);

    // A page's own size wins over the tier's.
    player.style.fontSize = '32px';
    expect(inner(button).getBoundingClientRect().width).toBeCloseTo(80, 0);
  });

  it('stays what the page wrote, and goes back to the size once removed', async () => {
    const player = sized(800, 450);
    await expect.poll(() => player.getAttribute('layout')).toBe('regular');
    player.setAttribute('layout', 'compact');
    player.style.width = '1600px';
    player.style.height = '900px';
    // Two frames: a resize observation would have landed by then.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(player.getAttribute('layout')).toBe('compact');

    player.removeAttribute('layout');
    expect(player.getAttribute('layout')).toBe('wide');
  });
});

describe('the options of define()', () => {
  afterEach(() => {
    MatteboxPlayerElement.define({});
  });

  it('reach a player that exists before the call', async () => {
    // As on a page with the player in its markup: the import registers the
    // element and the parser's player is constructed, then the page calls
    // define() with its stages.
    const player = document.createElement('mattebox-player') as MatteboxPlayerElement;
    player.setAttribute('muted', '');
    player.setAttribute('src', new URL('./fixtures/hls/master.m3u8', import.meta.url).href);
    document.body.append(player);
    MatteboxPlayerElement.define({ stages: [hlsCmaf()], config: { bufferGoalSeconds: 45 } });

    await expect.poll(() => player.engine, { timeout: 10_000 }).not.toBeNull();
    expect(player.engine?.stats.snapshot().scheduling.bufferGoal).toBe(45);
  });

  it('do not replace the options a player was constructed with', async () => {
    const player = new MatteboxPlayerElement({
      stages: [hlsCmaf()],
      config: { bufferGoalSeconds: 45 },
    });
    player.setAttribute('muted', '');
    player.setAttribute('src', new URL('./fixtures/hls/master.m3u8', import.meta.url).href);
    document.body.append(player);
    MatteboxPlayerElement.define({ stages: [hlsCmaf()], config: { bufferGoalSeconds: 20 } });

    await expect.poll(() => player.engine, { timeout: 10_000 }).not.toBeNull();
    expect(player.engine?.stats.snapshot().scheduling.bufferGoal).toBe(45);
  });
});

describe('native HLS on Apple WebKit', () => {
  const HLS = new URL('./fixtures/hls/master.m3u8', import.meta.url).href;
  const DASH = new URL('./fixtures/dash/manifest.mpd', import.meta.url).href;

  afterEach(() => {
    // The instance property shadows the prototype's getter; deleting it restores the browser's.
    delete (navigator as { vendor?: string }).vendor;
  });

  /**
   * The element over the stage list, with its video answering for HLS as
   * Safari's does. No browser in the test matrix plays HLS natively and
   * reports Apple's vendor at once: Playwright's WebKit on Linux answers
   * nothing for HLS, and Chromium answers `maybe` with Google's vendor.
   */
  function safari(
    src: string,
    attributes: Readonly<Record<string, string>> = {},
    stages: readonly Stage[] = [hlsCmaf(), dashCmaf()],
  ) {
    Object.defineProperty(navigator, 'vendor', {
      value: 'Apple Computer, Inc.',
      configurable: true,
    });
    const player = new MatteboxPlayerElement({ stages });
    player.video.canPlayType = (type: string) => (type.includes('mpegurl') ? 'maybe' : '');
    player.setAttribute('muted', '');
    for (const [name, value] of Object.entries(attributes)) player.setAttribute(name, value);
    player.setAttribute('src', src);
    document.body.append(player);
    return player;
  }

  it('plays HLS natively where Safari would', async () => {
    const player = safari(HLS);
    await expect.poll(() => player.player?.session?.handler, { timeout: 10_000 }).toBe('native');
    expect(player.engine).toBeNull();
  });

  it("attaches the stack's key systems and the license URL to a native session", async () => {
    const player = safari(HLS, { 'license-url': 'https://drm.test/fps' }, [
      hlsCmaf(),
      emeCore(),
      emeFairplay({ certificateUrl: 'https://drm.test/fps.cer' }),
    ]);
    await expect.poll(() => player.player?.session?.handler, { timeout: 10_000 }).toBe('native');
    // As for the engine, no DRM on a browser without EME: Playwright's WebKit on Linux.
    expect(player.player?.session?.eme !== undefined).toBe(EME);
    expect(player.player?.session?.eme?.drm.keySystem ?? null).toBeNull();
  });

  it('attaches no DRM to a native session without key systems or a license URL', async () => {
    const player = safari(HLS);
    await expect.poll(() => player.player?.session?.handler, { timeout: 10_000 }).toBe('native');
    expect(player.player?.session?.eme).toBeUndefined();
  });

  it('keeps HLS on the engine with native-hls="off"', async () => {
    const player = safari(HLS, { 'native-hls': 'off' });
    await expect.poll(() => player.player?.session?.handler, { timeout: 10_000 }).toBe('mattebox');
  });

  it('keeps DASH on the engine', async () => {
    const player = safari(DASH);
    await expect.poll(() => player.player?.session?.handler, { timeout: 10_000 }).toBe('mattebox');
  });

  it("keeps HLS on the engine with the browser's own vendor and canPlayType", async () => {
    // Chromium answers `maybe` for HLS, and its vendor keeps it on the engine.
    // Only meaningful where the browser has MediaSource, which all three do.
    const player = new MatteboxPlayerElement({ stages: [hlsCmaf()] });
    player.setAttribute('muted', '');
    player.setAttribute('src', HLS);
    document.body.append(player);
    const expected =
      navigator.vendor.startsWith('Apple') &&
      player.video.canPlayType('application/vnd.apple.mpegurl') !== ''
        ? 'native'
        : 'mattebox';
    await expect.poll(() => player.player?.session?.handler, { timeout: 10_000 }).toBe(expected);
  });
});

describe('several sources', () => {
  const HLS_TYPE = 'application/vnd.apple.mpegurl';
  const DASH_TYPE = 'application/dash+xml';

  /** A handler that takes DASH alone and records the sources it was given. */
  function dashOnly(): { readonly handler: Handler; readonly seen: Source[] } {
    const seen: Source[] = [];
    const handler: Handler = {
      name: 'stub',
      canHandle: (source) => (source.type === DASH_TYPE ? 'probably' : ''),
      handle: async (source) => {
        seen.push(source);
        return { handler: 'stub', engine: null, dispose: async () => undefined };
      },
    };
    return { handler, seen };
  }

  function child(attributes: Readonly<Record<string, string>>): HTMLSourceElement {
    const source = document.createElement('source');
    for (const [name, value] of Object.entries(attributes)) source.setAttribute(name, value);
    return source;
  }

  it('tries the source children in their order, each with its own DRM servers', async () => {
    const { handler, seen } = dashOnly();
    const player = new MatteboxPlayerElement({ handlers: [handler] });
    const errors: PlayerError[] = [];
    player.addEventListener('error', (event) => {
      errors.push((event as CustomEvent<PlayerError>).detail);
    });
    player.append(
      child({ src: 'a.m3u8', type: HLS_TYPE, 'certificate-url': 'https://drm.test/fps.cer' }),
      child({ src: 'a.mpd', type: DASH_TYPE, 'license-url': 'https://drm.test/widevine' }),
    );
    document.body.append(player);

    await expect.poll(() => player.player?.session?.source.url).toBe('a.mpd');
    expect(seen).toEqual([
      {
        url: 'a.mpd',
        type: DASH_TYPE,
        ...(EME ? { drm: { licenseUrl: 'https://drm.test/widevine' } } : {}),
      },
    ]);
    expect(errors.map((error) => [error.code, error.fatal, error.source?.url])).toEqual([
      ['MANIFEST_UNSUPPORTED', false, 'a.m3u8'],
    ]);
    expect(player.error).toBeNull();
  });

  it('reads the src attribute before the children, and the sources property before them too', async () => {
    const { handler, seen } = dashOnly();
    const player = new MatteboxPlayerElement({ handlers: [handler] });
    player.append(child({ src: 'child.mpd', type: DASH_TYPE }));
    player.setAttribute('src', 'attribute.mpd');
    document.body.append(player);
    await expect.poll(() => player.player?.session?.source.url).toBe('attribute.mpd');

    player.sources = [{ url: 'property.mpd' }];
    await settled();
    expect(player.player?.session?.source.url).toBe('attribute.mpd');

    player.removeAttribute('src');
    await expect.poll(() => player.player?.session?.source.url).toBe('property.mpd');

    player.sources = null;
    await expect.poll(() => player.player?.session?.source.url).toBe('child.mpd');
    expect(seen.map((source) => source.url)).toEqual([
      'attribute.mpd',
      'attribute.mpd',
      'property.mpd',
      'child.mpd',
    ]);
  });

  it('starts a load when a source child arrives and nothing is loaded', async () => {
    const { handler, seen } = dashOnly();
    const player = new MatteboxPlayerElement({ handlers: [handler] });
    document.body.append(player);
    await settled();
    expect(player.player).toBeNull();

    player.append(child({ src: 'late.mpd', type: DASH_TYPE }));

    await expect.poll(() => player.player?.session?.source.url).toBe('late.mpd');
    expect(seen).toHaveLength(1);
  });

  it('keeps the session when a source child arrives during playback', async () => {
    const { handler, seen } = dashOnly();
    const player = new MatteboxPlayerElement({ handlers: [handler] });
    player.append(child({ src: 'first.mpd', type: DASH_TYPE }));
    document.body.append(player);
    await expect.poll(() => player.player?.session?.source.url).toBe('first.mpd');

    player.append(child({ src: 'second.mpd', type: DASH_TYPE }));
    await settled();
    await settled();

    expect(seen.map((source) => source.url)).toEqual(['first.mpd']);
  });

  it('draws nothing for a source child', async () => {
    const player = new MatteboxPlayerElement({ handlers: [dashOnly().handler] });
    const source = child({ src: 'a.mpd', type: DASH_TYPE });
    player.append(source);
    document.body.append(player);
    expect(getComputedStyle(source).display).toBe('none');
  });
});
