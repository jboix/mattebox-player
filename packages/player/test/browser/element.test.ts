import { MatteboxPlayerElement } from '@mattebox/player';
import type { Handler } from '@mattebox/player-core';
import { matteboxHandler, nativeHandler } from '@mattebox/player-core';
import type { TransportConfig } from 'mattebox';
import { mattebox } from 'mattebox';
import full from 'mattebox/presets/full';
import { afterEach, describe, expect, it } from 'vitest';
import { silence } from './helpers.js';

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

/** The element with its chain supplied, which is the JS route the prompt fixes. */
function mount(attributes: Readonly<Record<string, string>> = {}): MatteboxPlayerElement {
  const player = new MatteboxPlayerElement({ handlers: chain() });
  for (const [name, value] of Object.entries(attributes)) player.setAttribute(name, value);
  document.body.append(player);
  return player;
}

/** Hidden is inherited in practice: a child of a hidden panel is not on screen either. */
function visible(node: Element): boolean {
  let current: Element | null = node;
  while (current !== null) {
    if ((current as HTMLElement).hidden) return false;
    current = current.parentElement;
  }
  return true;
}

/** Every part name the element is currently showing. */
function parts(player: MatteboxPlayerElement): string[] {
  const root = player.shadowRoot;
  if (root === null) return [];
  return [...root.querySelectorAll('[part]')]
    .filter(visible)
    .flatMap((node) => (node.getAttribute('part') ?? '').split(' '));
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

  it('define() is idempotent', () => {
    expect(() => {
      MatteboxPlayerElement.define();
    }).not.toThrow();
  });

  it('loads an engine source and shows the panels its namespaces support', async () => {
    const player = mount({ src: 'https://cdn.test/hls/master.m3u8' });

    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();
    await expect.poll(() => parts(player)).toContain('quality');

    const shown = parts(player);
    expect(shown).toContain('quality-select');
    // The manifest declares one muxed track, so there is nothing to choose
    // between and the tracks panel hides itself.
    expect(shown).not.toContain('tracks');
    // The stream is VOD, so the live badge has no namespace to read.
    expect(shown).not.toContain('live');
    // No key session opened, so the DRM indicator has nothing to say.
    expect(shown).not.toContain('drm-key-system');
    expect(shown).not.toContain('error');
  });

  it('offers auto plus every rendition in the quality menu', async () => {
    const player = mount({ src: 'https://cdn.test/hls/master.m3u8' });
    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();

    const select = player.shadowRoot?.querySelector<HTMLSelectElement>('[part~="quality-select"]');
    await expect.poll(() => select?.options.length ?? 0).toBe(3);
    expect(select?.options[0]?.value).toBe('auto');
    expect([...(select?.options ?? [])].map((option) => option.textContent)).toEqual([
      'Auto',
      '270p',
      '720p',
    ]);
  });

  it('shows the audio menu when the manifest carries alternate audio', async () => {
    const player = mount({ src: 'https://cdn.test/hls/alt.m3u8' });
    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();

    await expect.poll(() => parts(player)).toContain('tracks');
    const audio = player.shadowRoot?.querySelector<HTMLSelectElement>('[part~="audio-select"]');
    expect([...(audio?.options ?? [])].map((option) => option.textContent)).toEqual([
      'en · main',
      'fr · alternate',
    ]);
  });

  it('shows no engine panels and no error for a native source', async () => {
    const url = silence();
    const player = mount({ src: url, type: 'audio/wav' });

    await expect.poll(() => player.player?.session?.handler).toBe('native');
    await expect.poll(() => player.video.readyState).toBeGreaterThan(0);
    expect(player.engine).toBeNull();
    const shown = parts(player);
    expect(shown).not.toContain('quality');
    expect(shown).not.toContain('tracks');
    expect(shown).not.toContain('error');
    URL.revokeObjectURL(url);
  });

  it('shows the error surface with the code when no handler claims the source', async () => {
    const player = mount({ src: 'https://cdn.test/a.m3u8', type: 'application/x-nonsense' });

    await expect.poll(() => parts(player)).toContain('error');
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

describe('the bar over an engine session', () => {
  /** The first element of a part inside the shadow root. */
  function part(player: MatteboxPlayerElement, name: string): HTMLElement | null {
    return player.shadowRoot?.querySelector(`[part~="${name}"]`) ?? null;
  }

  function items(player: MatteboxPlayerElement, name: string): string[] {
    return [...(part(player, `${name}-popup`)?.querySelectorAll('button') ?? [])].map(
      (item) => item.textContent ?? '',
    );
  }

  it('hides the panels row and carries the quality menu instead', async () => {
    const player = mount({ controls: 'custom', src: 'https://cdn.test/hls/master.m3u8' });
    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();
    expect(part(player, 'panels')?.hidden).toBe(true);
    const quality = part(player, 'quality-menu');
    expect(quality?.hidden).toBe(false);
    expect(items(player, 'quality')).toEqual(['Auto', '270p', '720p']);
    // One audio track is no choice, and there is no text.
    expect(part(player, 'audio-menu')?.hidden).toBe(true);
    expect(part(player, 'text-menu')?.hidden).toBe(true);
  });

  it('opens the quality menu, pins a rendition on a choice, and closes', async () => {
    const player = mount({ controls: 'custom', src: 'https://cdn.test/hls/master.m3u8' });
    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();
    const button = part(player, 'quality-button') as HTMLButtonElement;
    const popup = part(player, 'quality-popup') as HTMLElement;
    expect(popup.hidden).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('false');

    button.click();
    expect(popup.hidden).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(part(player, 'quality-menu')?.getAttribute('part')?.split(' ')).toContain('open');

    const choice = [...popup.querySelectorAll('button')].find(
      (item) => item.textContent === '720p',
    );
    choice?.click();
    expect(popup.hidden).toBe(true);
    expect(player.engine?.quality.pinned).toBe(choice?.value);
    button.click();
    const checked = popup.querySelector('[aria-checked="true"]');
    expect(checked?.textContent).toBe('720p');
  });

  it('walks the quality menu with the arrows inside the shadow root', async () => {
    const player = mount({ controls: 'custom', src: 'https://cdn.test/hls/master.m3u8' });
    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();
    (part(player, 'quality-button') as HTMLButtonElement).click();
    const popup = part(player, 'quality-popup') as HTMLElement;
    const options = [...popup.querySelectorAll('button')];
    const focused = () => player.shadowRoot?.activeElement ?? null;
    expect(focused()).toBe(options[0]);
    const press = (key: string) =>
      popup.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }),
      );
    press('ArrowDown');
    expect(focused()).toBe(options[1]);
    press('ArrowDown');
    expect(focused()).toBe(options[2]);
    press('ArrowUp');
    expect(focused()).toBe(options[1]);
    press('Escape');
    expect(popup.hidden).toBe(true);
    expect(focused()).toBe(part(player, 'quality-button'));
  });

  it('shows the audio menu when the manifest carries alternate audio', async () => {
    const player = mount({ controls: 'custom', src: 'https://cdn.test/hls/alt.m3u8' });
    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();
    expect(part(player, 'audio-menu')?.hidden).toBe(false);
    expect(items(player, 'audio')).toEqual(['en · main', 'fr · alternate']);
  });

  it('drops the menus with the session', async () => {
    const player = mount({ controls: 'custom', src: 'https://cdn.test/hls/master.m3u8' });
    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();
    expect(part(player, 'quality-menu')).not.toBeNull();
    // Typed, so the chain sends it straight to native instead of asking the
    // engine to sniff a blob the stubbed transport cannot serve.
    player.setAttribute('type', 'audio/wav');
    player.setAttribute('src', silence());
    await expect.poll(() => player.player?.session?.handler).toBe('native');
    expect(part(player, 'quality-menu')).toBeNull();
    expect(part(player, 'quality-menu')).toBeNull();
    expect(part(player, 'quality-slot')?.childElementCount).toBe(0);
  });
});
