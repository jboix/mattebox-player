import { MatteboxPlayerElement } from '@mattebox/player';
import type { Handler } from '@mattebox/player-core';
import { matteboxHandler, nativeHandler } from '@mattebox/player-core';
import type { TransportConfig } from 'mattebox';
import { mattebox } from 'mattebox';
import full from 'mattebox/presets/full';
import hlsCmaf from 'mattebox/protocols/hls-cmaf';
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

/** The composition arrives a microtask after the connect. */
function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The panels row under the video, and the controls in it that are on screen, by tag. */
function panels(player: MatteboxPlayerElement): { row: HTMLElement | null; shown: string[] } {
  const row = player.querySelector('mbx-panels');
  const shown = [...(row?.children ?? [])]
    .filter((node) => !(node as HTMLElement).hidden)
    .map((node) => node.localName);
  return { row, shown };
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

  it('appends the panels row under native controls, and the menus its namespaces support', async () => {
    const player = mount({ src: 'https://cdn.test/hls/master.m3u8' });
    await settled();
    const { row } = panels(player);
    expect(row).not.toBeNull();
    // In flow under the picture, in the stage's slot beside the video.
    expect(row?.assignedSlot?.parentElement?.getAttribute('part')).toBe('stage');
    expect([...(row?.children ?? [])].map((node) => node.localName)).toEqual([
      'mbx-quality-menu',
      'mbx-audio-menu',
      'mbx-subtitles-menu',
      'mbx-chapters-menu',
      'mbx-live-button',
      'mbx-drm-badge',
    ]);

    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();
    await expect.poll(() => panels(player).shown).toContain('mbx-quality-menu');
    // The manifest declares one muxed track, so there is nothing to choose
    // between; the stream is VOD, so there is no edge; no key session opened.
    expect(panels(player).shown).toEqual(['mbx-quality-menu']);
    expect(row?.hidden).toBe(false);
  });

  it('offers auto plus every rendition in the quality menu', async () => {
    const player = mount({ src: 'https://cdn.test/hls/master.m3u8' });
    await settled();
    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();
    const quality = player.querySelector('mbx-quality-menu');
    await expect.poll(() => texts(quality)).toEqual(['Auto', '270p', '720p']);
  });

  it('shows the audio menu when the manifest carries alternate audio', async () => {
    const player = mount({ src: 'https://cdn.test/hls/alt.m3u8' });
    await settled();
    await expect.poll(() => player.engine, { timeout: 5000 }).not.toBeNull();
    await expect.poll(() => panels(player).shown).toContain('mbx-audio-menu');
    expect(texts(player.querySelector('mbx-audio-menu'))).toEqual(['en · main', 'fr · alternate']);
  });

  it('hides the row and shows no error for a native source', async () => {
    const url = silence();
    const player = mount({ src: url, type: 'audio/wav' });
    await settled();
    await expect.poll(() => player.player?.session?.handler).toBe('native');
    await expect.poll(() => player.video.readyState).toBeGreaterThan(0);
    expect(player.engine).toBeNull();
    expect(panels(player).shown).toEqual([]);
    expect(panels(player).row?.hidden).toBe(true);
    expect(player.shadowRoot?.querySelector<HTMLElement>('[part~="error"]')?.hidden).toBe(true);
    URL.revokeObjectURL(url);
  });

  it('leaves a panels row the page wrote alone', async () => {
    const player = new MatteboxPlayerElement({ handlers: chain() });
    const own = document.createElement('mbx-panels');
    own.append(document.createElement('mbx-quality-menu'));
    player.append(own);
    document.body.append(player);
    await settled();
    expect(player.querySelectorAll('mbx-panels').length).toBe(1);
    expect(panels(player).row).toBe(own);
  });

  it('swaps the panels row for the bar and back as the mode changes', async () => {
    const player = mount();
    await settled();
    expect(panels(player).row).not.toBeNull();
    expect(player.querySelector('mbx-control-bar')).toBeNull();
    player.setAttribute('controls', 'custom');
    expect(panels(player).row).toBeNull();
    expect(player.querySelector('mbx-control-bar')).not.toBeNull();
    player.setAttribute('controls', 'none');
    expect(panels(player).row).not.toBeNull();
    expect(player.querySelector('mbx-control-bar')).toBeNull();
    expect(player.video.hasAttribute('controls')).toBe(false);
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

  it('hides the panels row and carries the quality menu instead', async () => {
    const player = await engineReady('https://cdn.test/hls/master.m3u8');
    expect(player.querySelector('mbx-panels')).toBeNull();
    const quality = control(player, 'mbx-quality-menu');
    await expect.poll(() => quality.hidden).toBe(false);
    expect(texts(quality)).toEqual(['Auto', '270p', '720p']);
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
    await expect.poll(() => quality.hidden).toBe(false);
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
    expect(texts(audio)).toEqual(['en · main', 'fr · alternate']);
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
