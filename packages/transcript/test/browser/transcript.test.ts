/**
 * The transcript in a real player, over an engine a test holds: the tracks
 * it offers and the cues it answers. The video is the player's own, made
 * deterministic, so no stream loads and no clock runs.
 */
import { MatteboxPlayerElement } from '@mattebox/player';
import { nativeHandler } from '@mattebox/player-core';
import { afterEach, describe, expect, it } from 'vitest';
import { violations } from '../../../../test/browser/axe.js';
import { fakeMedia } from '../../../player/test/browser/helpers.js';
import { type MbxTranscript, type TranscriptSearch, transcript } from '../../src/index.js';

interface Cue {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

interface FakeTrack {
  readonly id: string;
  readonly contentType: 'text';
  readonly lang: string;
  readonly name: string;
  readonly forced?: boolean;
}

/** One cue every five seconds for two minutes, three of them about a train. */
function english(): Cue[] {
  const special: Record<number, string> = {
    1: '<v Anna>The first train leaves.',
    4: 'A <i>café</i> by the station.',
    10: 'The train climbs for an hour.',
    20: 'The last train is at night.',
  };
  return Array.from({ length: 24 }, (_, i) => ({
    start: i * 5 + 1,
    end: i * 5 + 4,
    text: special[i] ?? `Nothing is said in part ${i}.`,
  }));
}

const EN: FakeTrack = { id: 'subs:en', contentType: 'text', lang: 'en', name: 'English' };
const FR: FakeTrack = { id: 'subs:fr', contentType: 'text', lang: 'fr', name: 'Français' };
const FORCED: FakeTrack = {
  id: 'subs:forced',
  contentType: 'text',
  lang: 'en',
  name: 'English (forced)',
  forced: true,
};

/** What the panel reads of an engine, with what a test moves and what it was asked. */
function fakeEngine(options: {
  tracks?: readonly FakeTrack[];
  cues?: Readonly<Record<string, readonly Cue[]>>;
  live?: boolean;
}) {
  const tracks = options.tracks ?? [EN];
  const cues = options.cues ?? { 'subs:en': english() };
  const listeners = new Map<string, Set<() => void>>();
  const asked: Array<{ id: string; start: number; end: number }> = [];
  const selects: string[] = [];
  let showing: string | null = null;
  const engine = {
    on(name: string, listener: () => void): () => void {
      const set = listeners.get(name) ?? new Set();
      listeners.set(name, set);
      set.add(listener);
      return () => set.delete(listener);
    },
    tracks: {
      available: tracks,
      active: (type: string) =>
        type === 'text' ? (tracks.find((track) => track.id === showing) ?? null) : null,
      select(id: string): void {
        selects.push(id);
      },
    },
    transcript: {
      tracks: tracks.map((track) => track.id),
      async cues(id: string, range: { start?: number; end?: number } = {}): Promise<Cue[]> {
        const start = range.start ?? 0;
        const end = range.end ?? Number.POSITIVE_INFINITY;
        asked.push({ id, start, end });
        await Promise.resolve();
        return (cues[id] ?? []).filter((cue) => cue.start < end && cue.end > start);
      },
    },
    ...(options.live === true ? { live: { edge: 100 } } : {}),
  };
  return {
    engine,
    asked,
    selects,
    /** The viewer picks subtitles in the player's own menu. */
    show(id: string | null): void {
      showing = id;
      for (const listener of listeners.get('tracks:selected') ?? []) listener();
    },
  };
}

type Fake = ReturnType<typeof fakeEngine>;

interface Mounted {
  readonly player: MatteboxPlayerElement;
  readonly panel: MbxTranscript;
  readonly button: HTMLElement;
  /** Another source plays on `fake`, or natively with null. */
  source(fake: Fake | null, seconds?: number): Promise<void>;
}

/** A player with the panel and its button, playing a two-minute programme on `fake`. */
async function mount(fake: Fake | null, seconds = 120): Promise<Mounted> {
  const player = new MatteboxPlayerElement({
    handlers: [nativeHandler()],
    addons: [transcript()],
  });
  player.setAttribute('controls', 'custom');
  player.style.cssText = 'display: block; width: 960px; height: 540px;';
  const media = fakeMedia(player.media);
  let current = fake;
  // The session's engine is the core's to make. The test stands in for it.
  Object.defineProperty(player, 'engine', {
    configurable: true,
    get: () => current?.engine ?? null,
  });
  const panel = document.createElement('mbx-transcript') as MbxTranscript;
  const button = document.createElement('mbx-transcript-button');
  player.append(panel, button);
  document.body.append(player);
  await customElements.whenDefined('mbx-transcript');
  await expect
    .poll(() => button.shadowRoot?.querySelector('button')?.hasAttribute('aria-label'))
    .toBe(true);
  await media.metadata(seconds);
  return {
    player,
    panel,
    button,
    async source(next, length = seconds) {
      current = next;
      player.dispatchEvent(new CustomEvent('sourcechange'));
      await media.metadata(length);
    },
  };
}

const root = (panel: MbxTranscript): ShadowRoot => panel.shadowRoot as ShadowRoot;
const part = <T extends HTMLElement = HTMLElement>(panel: MbxTranscript, name: string): T =>
  root(panel).querySelector(`[part~="${name}"]`) as T;
const lines = (panel: MbxTranscript): string[] =>
  [...root(panel).querySelectorAll('[part~="line"]')].map((line) => line.textContent ?? '');
const count = (panel: MbxTranscript): string => part(panel, 'count').textContent ?? '';
const items = (panel: MbxTranscript): string[] =>
  [...root(panel).querySelectorAll('[part~="item"]')].map(
    (item) => `${item.getAttribute('aria-checked') === 'true' ? '*' : ''}${item.textContent}`,
  );

/** The viewer types `text` in the search field. */
function type(panel: MbxTranscript, text: string): void {
  const field = part<HTMLInputElement>(panel, 'field');
  field.value = text;
  field.dispatchEvent(new Event('input'));
}

/** The viewer presses `key` in the search field. */
function press(panel: MbxTranscript, key: string, shiftKey = false): void {
  part(panel, 'field').dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      shiftKey,
      bubbles: true,
      composed: true,
      cancelable: true,
    }),
  );
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('<mbx-transcript>', () => {
  it('lists the lines around the playhead when it opens, and seeks on a press', async () => {
    const fake = fakeEngine({});
    const { player, panel, button } = await mount(fake);
    expect(panel.hasAttribute('unavailable')).toBe(false);
    expect(button.hidden).toBe(false);
    // Nothing is read before the viewer opens the panel.
    expect(fake.asked).toEqual([]);

    const toggle = button.shadowRoot?.querySelector('button') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    expect(panel.hasAttribute('open')).toBe(true);
    await expect.poll(() => toggle.getAttribute('aria-expanded')).toBe('true');
    await expect.poll(() => lines(panel).length).toBeGreaterThanOrEqual(18);
    expect(fake.asked[0]).toEqual({ id: 'subs:en', start: 0, end: 90 });
    // A cue's tags are not text, and its voice is the speaker.
    expect(lines(panel)[1]).toBe('0:06Anna The first train leaves.');
    expect(lines(panel)[4]).toBe('0:21A café by the station.');

    // The line that is spoken is the current one.
    player.media.currentTime = 52;
    await expect
      .poll(() => root(panel).querySelector('[aria-current="true"]')?.textContent)
      .toBe('0:51The train climbs for an hour.');

    // A press on a line plays from it.
    const fourth = root(panel).querySelectorAll<HTMLElement>('[part~="line"]')[4];
    fourth?.click();
    expect(player.media.currentTime).toBe(21);
    await expect
      .poll(() => root(panel).querySelector('[aria-current="true"]')?.textContent)
      .toBe('0:21A café by the station.');

    expect(await violations(player)).toEqual([]);

    part(panel, 'close').click();
    expect(panel.hasAttribute('open')).toBe(false);
  });

  it('searches every line without regard to case or accents, and marks the seek bar', async () => {
    const fake = fakeEngine({});
    const { player, panel } = await mount(fake);
    panel.setAttribute('open', '');
    await expect.poll(() => lines(panel).length).toBeGreaterThanOrEqual(18);

    type(panel, 'TRAIN');
    // The third match is past the part loaded at first: the search loads the rest.
    await expect.poll(() => count(panel)).toBe('1 of 3');
    expect(lines(panel)).toHaveLength(24);
    expect(player.spots.list).toEqual([{ time: 6, current: true }, { time: 51 }, { time: 101 }]);
    expect([...root(panel).querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual([
      'train',
      'train',
      'train',
    ]);

    press(panel, 'Enter');
    expect(count(panel)).toBe('2 of 3');
    expect(player.spots.list[1]).toEqual({ time: 51, current: true });
    // A step through the matches does not seek.
    expect(player.media.currentTime).toBe(0);
    press(panel, 'Enter', true);
    expect(count(panel)).toBe('1 of 3');

    type(panel, 'cafe');
    await expect.poll(() => count(panel)).toBe('1 of 1');
    expect(root(panel).querySelector('mark')?.textContent).toBe('café');

    type(panel, 'zeppelin');
    await expect.poll(() => count(panel)).toBe('No match');
    expect(player.spots.list).toEqual([]);

    // Escape clears the search first, then closes the panel.
    type(panel, 'train');
    press(panel, 'Escape');
    expect(part<HTMLInputElement>(panel, 'field').value).toBe('');
    expect(count(panel)).toBe('');
    expect(panel.hasAttribute('open')).toBe(true);
    press(panel, 'Escape');
    expect(panel.hasAttribute('open')).toBe(false);
  });

  it('follows the subtitles, and leaves them alone when the viewer picks in the panel', async () => {
    const french = english().map((cue) => ({ ...cue, text: `FR ${cue.start}` }));
    const fake = fakeEngine({
      tracks: [EN, FR, FORCED],
      cues: { 'subs:en': english(), 'subs:fr': french, 'subs:forced': [] },
    });
    const { panel } = await mount(fake);
    panel.setAttribute('open', '');
    // No subtitles show: the browser's language, and no forced track on offer.
    await expect.poll(() => part(panel, 'chosen').textContent).toBe('English');
    expect(items(panel)).toEqual(['*English', 'Français', 'None']);

    part(panel, 'chooser').click();
    root(panel).querySelectorAll<HTMLElement>('[part~="item"]')[1]?.click();
    expect(part(panel, 'chosen').textContent).toBe('Français');
    await expect.poll(() => lines(panel)[0]).toBe('0:01FR 1');
    expect(fake.selects).toEqual([]);

    // The viewer turns the English subtitles on: the panel follows them again.
    fake.show('subs:en');
    expect(part(panel, 'chosen').textContent).toBe('English');
    expect(items(panel)).toEqual(['*EnglishSubtitles', 'Français', 'None']);
    await expect.poll(() => lines(panel)[1]).toBe('0:06Anna The first train leaves.');

    // No language: no lines, and a word on what to do.
    root(panel).querySelectorAll<HTMLElement>('[part~="item"]')[2]?.click();
    expect(part(panel, 'chosen').textContent).toBe('None');
    expect(lines(panel)).toEqual([]);
    expect(part(panel, 'note').textContent).toBe('Choose a language to read the transcript.');
  });

  it('shows one row for a range that must not play, and never its words', async () => {
    const fake = fakeEngine({});
    const { player, panel } = await mount(fake);
    player.markers.set([{ start: 20, end: 60, kind: 'blocked' }]);
    panel.setAttribute('open', '');
    await expect.poll(() => lines(panel).length).toBeGreaterThan(0);

    const blocked = root(panel).querySelectorAll('[part~="blocked"]');
    expect(blocked).toHaveLength(1);
    expect(blocked[0]?.textContent).toBe('This part is not available0:20 to 1:00');
    const text = part(panel, 'list').textContent ?? '';
    expect(text).not.toContain('café');
    expect(text).not.toContain('climbs');

    // The search does not see the range.
    type(panel, 'train');
    await expect.poll(() => count(panel)).toBe('1 of 2');
    expect(player.spots.list.map((spot) => spot.time)).toEqual([6, 101]);
  });

  it("asks a page's own search once the viewer stops typing", async () => {
    const fake = fakeEngine({});
    const { player, panel } = await mount(fake);
    player.markers.set([{ start: 28, end: 34, kind: 'blocked' }]);
    panel.setAttribute('open', '');
    await expect.poll(() => lines(panel).length).toBeGreaterThanOrEqual(16);

    const calls: string[] = [];
    const search: TranscriptSearch = async (query, context) => {
      calls.push(`${query}|${context.language}`);
      if (query === 'boom') throw new Error('the server is down');
      if (query === 'climbs') return context.local();
      // 31 s is in a range that must not play, and the panel drops it.
      return [{ time: 51 }, { time: 6 }, { time: 31 }, { time: Number.NaN }];
    };
    panel.search = search;
    expect(panel.search).toBe(search);

    type(panel, 't');
    type(panel, 'tr');
    type(panel, 'train');
    await expect.poll(() => count(panel), { timeout: 3000 }).toBe('1 of 2');
    expect(calls).toEqual(['train|en']);
    expect(player.spots.list).toEqual([{ time: 6, current: true }, { time: 51 }]);

    // What the viewer typed is not in a line the server named: the whole line is marked.
    type(panel, 'railway');
    await expect.poll(() => calls.length, { timeout: 3000 }).toBe(2);
    await expect.poll(() => root(panel).querySelectorAll('[part~="hit"]').length).toBe(2);

    type(panel, 'boom');
    await expect.poll(() => count(panel), { timeout: 3000 }).toBe('Search is not available');

    type(panel, 'climbs');
    await expect.poll(() => count(panel), { timeout: 3000 }).toBe('1 of 1');

    // Without it, the panel searches the lines itself again.
    panel.search = null;
    await expect.poll(() => count(panel)).toBe('1 of 1');
    expect(calls).toHaveLength(4);
  });

  it('is not offered without subtitles it can read, on a live stream, or without an engine', async () => {
    const { panel, button, source } = await mount(fakeEngine({ tracks: [] }));
    expect(panel.hasAttribute('unavailable')).toBe(true);
    await expect.poll(() => button.hidden).toBe(true);

    await source(fakeEngine({ tracks: [FORCED], cues: {} }));
    expect(panel.hasAttribute('unavailable')).toBe(true);

    await source(fakeEngine({}));
    expect(panel.hasAttribute('unavailable')).toBe(false);
    await expect.poll(() => button.hidden).toBe(false);
    panel.setAttribute('open', '');
    await expect.poll(() => lines(panel).length).toBeGreaterThan(0);

    // A live stream takes the open panel away.
    await source(fakeEngine({ live: true }));
    expect(panel.hasAttribute('unavailable')).toBe(true);
    expect(panel.hasAttribute('open')).toBe(false);

    // Safari's own HLS: no engine reads the cues.
    await source(null);
    expect(panel.hasAttribute('unavailable')).toBe(true);
    await expect.poll(() => button.hidden).toBe(true);
  });

  it('keeps nothing of the last source', async () => {
    const { player, panel, source } = await mount(fakeEngine({}));
    panel.setAttribute('open', '');
    await expect.poll(() => lines(panel).length).toBeGreaterThan(0);
    type(panel, 'train');
    await expect.poll(() => count(panel)).toBe('1 of 3');

    const other = fakeEngine({
      cues: { 'subs:en': [{ start: 2, end: 5, text: 'Another film.' }] },
    });
    await source(other, 60);
    await expect.poll(() => lines(panel)).toEqual(['0:02Another film.']);
    expect(part<HTMLInputElement>(panel, 'field').value).toBe('');
    expect(count(panel)).toBe('');
    expect(player.spots.list).toEqual([]);
  });

  it("says its words in the page's own, by attribute", async () => {
    const { panel, button } = await mount(fakeEngine({}));
    panel.setAttribute('label', 'Transcripció');
    panel.setAttribute('label-search', 'Cerca');
    panel.setAttribute('label-count', '{at} de {count}');
    button.setAttribute('label', 'Transcripció');
    panel.setAttribute('open', '');
    await expect.poll(() => lines(panel).length).toBeGreaterThan(0);
    expect(part(panel, 'heading').textContent).toBe('Transcripció');
    expect(part<HTMLInputElement>(panel, 'field').placeholder).toBe('Cerca');
    expect(button.shadowRoot?.querySelector('button')?.getAttribute('aria-label')).toBe(
      'Transcripció',
    );
    type(panel, 'train');
    await expect.poll(() => count(panel)).toBe('1 de 3');
  });
});

describe('transcript()', () => {
  it("adds the engine's transcript stage, and keeps the engine in Safari when asked", () => {
    const addon = transcript();
    expect(addon.name).toBe('transcript');
    expect(addon.stages?.().map((stage) => stage.name)).toEqual(['transcript']);
    expect(addon.engine).toBeUndefined();
    expect(transcript({ engine: true }).engine).toBe(true);
  });
});
