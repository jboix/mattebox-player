import { MatteboxPlayerElement } from '@mattebox/player';
import type { Handler } from '@mattebox/player-core';
import type { MbxPreferences } from '@mattebox/player-preferences';
import { preferences, preferencesOf } from '@mattebox/player-preferences';
import type { Mattebox } from 'mattebox';
import { afterEach, describe, expect, it } from 'vitest';

interface Listed {
  readonly id: string;
  readonly contentType: 'audio' | 'text';
  readonly lang: string;
  readonly characteristics?: readonly string[];
  readonly forced?: boolean;
}

const DESCRIBES = 'public.accessibility.describes-video';
const SDH = [
  'public.accessibility.transcribes-spoken-dialog',
  'public.accessibility.describes-music-and-sound',
];

/** An engine with tracks and renditions, whose selections fire `tracks:selected` as the engine's do. */
function engineWith(listed: readonly Listed[], heights: readonly number[] = []) {
  const listeners = new Map<string, Set<() => void>>();
  const emit = (name: string): void => {
    for (const fn of listeners.get(name) ?? []) fn();
  };
  const available = listed.map((track) => ({ renditions: [], ...track }));
  const renditions = heights.map((height) => ({ id: `r${height}`, height }));
  const state = {
    audio: available.find((track) => track.contentType === 'audio')?.id ?? null,
    text: null as string | null,
    pinned: null as string | null,
  };
  const fake = {
    on(name: string, fn: () => void) {
      const set = listeners.get(name) ?? new Set();
      listeners.set(name, set);
      set.add(fn);
      return () => {
        set.delete(fn);
      };
    },
    emit,
    quality: {
      renditions,
      selectable: renditions,
      get pinned() {
        return state.pinned;
      },
      pin(id: string) {
        state.pinned = id;
      },
      auto() {
        state.pinned = null;
      },
    },
    tracks: {
      available,
      active: (type: 'audio' | 'text') =>
        available.find((track) => track.id === state[type]) ?? null,
      selectable: () => true,
      select(id: string) {
        const track = available.find((each) => each.id === id);
        if (track === undefined) return;
        state[track.contentType] = id;
        emit('tracks:selected');
      },
      deselect() {
        state.text = null;
        emit('tracks:selected');
      },
    },
  };
  return fake;
}

type FakeEngine = ReturnType<typeof engineWith>;

function handler(engine: FakeEngine): Handler {
  return {
    name: 'fake',
    canHandle: () => 'probably',
    handle: () =>
      Promise.resolve({
        handler: 'fake',
        engine: engine as unknown as Mattebox,
        dispose: () => Promise.resolve(),
      }),
  };
}

let keys = 0;

/** A key no other test used, so each test starts with an empty store. */
function freshKey(): string {
  keys += 1;
  return `mbx-test-${Date.now()}-${keys}`;
}

/** A player over `engine` with `<mbx-preferences>` inside, once the session is in. */
async function mount(
  engine: FakeEngine,
  attributes: Readonly<Record<string, string>> = {},
  player: Readonly<Record<string, string>> = {},
): Promise<MatteboxPlayerElement> {
  const element = new MatteboxPlayerElement({ handlers: [handler(engine)] });
  for (const [name, value] of Object.entries(player)) element.setAttribute(name, value);
  const prefs = document.createElement('mbx-preferences');
  for (const [name, value] of Object.entries(attributes)) prefs.setAttribute(name, value);
  element.append(prefs);
  element.setAttribute('src', 'https://cdn.test/vod.m3u8');
  document.body.append(element);
  await expect.poll(() => element.engine).not.toBeNull();
  return element;
}

/** The load the element sees: the video's own events, which the fake handler does not cause. */
function load(player: MatteboxPlayerElement): void {
  player.video.dispatchEvent(new Event('loadstart'));
  player.video.dispatchEvent(new Event('loadedmetadata'));
}

afterEach(() => {
  document.body.replaceChildren();
});

const tracks: Listed[] = [
  { id: 'a-fr', contentType: 'audio', lang: 'fr' },
  { id: 'a-de', contentType: 'audio', lang: 'de' },
  { id: 'a-de-ad', contentType: 'audio', lang: 'de', characteristics: [DESCRIBES] },
  { id: 'a-it-ad', contentType: 'audio', lang: 'it', characteristics: [DESCRIBES] },
  { id: 't-de', contentType: 'text', lang: 'de' },
  { id: 't-de-sdh', contentType: 'text', lang: 'de', characteristics: SDH },
  { id: 't-fr-forced', contentType: 'text', lang: 'fr', forced: true },
];

describe('<mbx-preferences>', () => {
  it('saves the tracks the viewer picks, and picks the same language and kind on the next load', async () => {
    const key = freshKey();
    const first = await mount(engineWith(tracks), { 'storage-key': key });
    const engine = first.engine as unknown as FakeEngine;
    engine.tracks.select('a-de-ad');
    engine.tracks.select('t-de-sdh');
    const store = preferences({ key });
    expect(store.get('audio')).toEqual({ language: 'de', kind: 'description' });
    expect(store.get('subtitles')).toEqual({ language: 'de', kind: 'captions' });
    expect(JSON.parse(localStorage.getItem(key) as string).values.audio.kind).toBe('description');

    document.body.replaceChildren();
    const next = await mount(engineWith(tracks), { 'storage-key': key });
    expect(next.engine?.tracks.active('audio')?.id).toBe('a-de-ad');
    expect(next.engine?.tracks.active('text')?.id).toBe('t-de-sdh');
    localStorage.removeItem(key);
  });

  it('keeps an audio description over the language, and keeps the stored language too', async () => {
    const key = freshKey();
    preferences({ key }).set('audio', { language: 'en', kind: 'description' });
    const player = await mount(engineWith(tracks), { 'storage-key': key });
    expect(player.engine?.tracks.active('audio')?.id).toBe('a-de-ad');
    // What the element put back itself is not the viewer's choice.
    expect(preferences({ key }).get('audio')).toEqual({ language: 'en', kind: 'description' });
    localStorage.removeItem(key);
  });

  it('saves subtitles off, puts them off, and leaves a forced track to the engine', async () => {
    const key = freshKey();
    const first = await mount(engineWith(tracks), { 'storage-key': key });
    const engine = first.engine as unknown as FakeEngine;
    engine.tracks.select('t-de');
    engine.tracks.deselect();
    // The forced-subtitles stage then selects a forced track on its own.
    engine.tracks.select('t-fr-forced');
    expect(preferences({ key }).get('subtitles')).toBeNull();

    document.body.replaceChildren();
    const fresh = engineWith(tracks);
    fresh.tracks.select('t-de');
    const next = await mount(fresh, { 'storage-key': key });
    expect(next.engine?.tracks.active('text')).toBeNull();
    localStorage.removeItem(key);
  });

  it('keeps the volume and the mute, but not the mute of a page that autoplays', async () => {
    const key = freshKey();
    const first = await mount(engineWith(tracks), { 'storage-key': key });
    first.video.volume = 0.25;
    first.video.muted = true;
    await expect.poll(() => preferences({ key }).get('muted')).toBe(true);
    expect(preferences({ key }).get('volume')).toBe(0.25);
    first.video.muted = false;
    await expect.poll(() => preferences({ key }).get('muted')).toBe(false);

    document.body.replaceChildren();
    const autoplay = await mount(engineWith(tracks), { 'storage-key': key }, { muted: '' });
    expect(autoplay.video.volume).toBe(0.25);
    autoplay.video.muted = true;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(preferences({ key }).get('muted')).toBe(false);
    localStorage.removeItem(key);
  });

  it('keeps the rate the viewer sets, and not the reset of a load or a scan', async () => {
    const key = freshKey();
    const player = await mount(engineWith(tracks), { 'storage-key': key });
    load(player);
    player.video.playbackRate = 1.5;
    await expect.poll(() => preferences({ key }).get('rate')).toBe(1.5);

    // A scan moves the rate through the trick play namespace.
    const engine = player.engine as unknown as FakeEngine & { trick?: unknown };
    engine.trick = { rate: 8, scrubbing: false };
    player.video.playbackRate = 2;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(preferences({ key }).get('rate')).toBe(1.5);
    engine.trick = undefined;

    player.video.dispatchEvent(new Event('loadstart'));
    player.video.playbackRate = 1;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(preferences({ key }).get('rate')).toBe(1.5);
    player.video.dispatchEvent(new Event('loadedmetadata'));
    expect(player.video.playbackRate).toBe(1.5);
    localStorage.removeItem(key);
  });

  it('keeps the pinned quality as a height, and pins the nearest under it', async () => {
    const key = freshKey();
    const first = await mount(engineWith(tracks, [360, 720, 1080]), { 'storage-key': key });
    first.engine?.quality.pin('r720');
    first.click();
    await expect.poll(() => preferences({ key }).get('quality')).toBe(720);

    document.body.replaceChildren();
    const next = await mount(engineWith(tracks, [480, 540, 1080]), { 'storage-key': key });
    expect(next.engine?.quality.pinned).toBe('r540');
    next.engine?.quality.auto();
    next.click();
    await expect.poll(() => preferences({ key }).get('quality')).toBeNull();
    localStorage.removeItem(key);
  });

  it('keeps the subtitle look', async () => {
    const key = freshKey();
    const first = await mount(engineWith(tracks), { 'storage-key': key });
    first.setAttribute('subtitle-size', 'large');
    first.setAttribute('subtitle-background', 'solid');
    await expect
      .poll(() => preferences({ key }).get('subtitle-look'))
      .toEqual({ size: 'large', background: 'solid' });

    document.body.replaceChildren();
    const next = await mount(engineWith(tracks), { 'storage-key': key });
    expect(next.getAttribute('subtitle-size')).toBe('large');
    expect(next.getAttribute('subtitle-background')).toBe('solid');
    localStorage.removeItem(key);
  });

  it('keeps choices in memory without a key, and stores them once the key arrives', async () => {
    const before = localStorage.length;
    const player = await mount(engineWith(tracks));
    const prefs = player.querySelector('mbx-preferences') as MbxPreferences;
    expect(preferencesOf(player)).toBe(preferences());
    (player.engine as unknown as FakeEngine).tracks.select('a-de');
    expect(localStorage.length).toBe(before);

    const key = freshKey();
    prefs.setAttribute('storage-key', key);
    expect(preferencesOf(player)).toBe(preferences({ key }));
    expect(JSON.parse(localStorage.getItem(key) as string).values.audio).toEqual({
      language: 'de',
      kind: 'main',
    });
    localStorage.removeItem(key);
  });

  it('leaves the keys of except alone', async () => {
    const key = freshKey();
    preferences({ key }).set('audio', { language: 'de', kind: 'main' });
    const player = await mount(engineWith(tracks), { 'storage-key': key, except: 'audio volume' });
    expect(player.engine?.tracks.active('audio')?.id).toBe('a-fr');
    player.video.volume = 0.5;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(preferences({ key }).get('volume')).toBeUndefined();
    localStorage.removeItem(key);
  });

  it('picks and saves the tracks of a native session, as Safari lists them', async () => {
    const key = freshKey();
    preferences({ key }).set('audio', { language: 'de', kind: 'description' });
    preferences({ key }).set('subtitles', { language: 'de', kind: 'captions' });
    const player = new MatteboxPlayerElement({ handlers: [] });
    const audio = Object.assign(new EventTarget(), {
      0: { kind: 'main', language: 'de', enabled: true },
      1: { kind: 'main-desc', language: 'de', enabled: false },
      length: 2,
    });
    Object.defineProperty(player.video, 'audioTracks', { value: audio });
    const plain = player.video.addTextTrack('subtitles', 'Deutsch', 'de');
    const captions = player.video.addTextTrack('captions', 'Deutsch (SDH)', 'de');
    const prefs = document.createElement('mbx-preferences');
    prefs.setAttribute('storage-key', key);
    player.append(prefs);
    document.body.append(player);
    load(player);
    expect([audio[0].enabled, audio[1].enabled]).toEqual([false, true]);
    expect([plain.mode, captions.mode]).toEqual(['disabled', 'showing']);

    captions.mode = 'disabled';
    plain.mode = 'showing';
    player.video.textTracks.dispatchEvent(new Event('change'));
    expect(preferences({ key }).get('subtitles')).toEqual({ language: 'de', kind: 'subtitles' });
    localStorage.removeItem(key);
  });
});
