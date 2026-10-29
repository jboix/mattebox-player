import { MatteboxPlayerElement } from '@mattebox/player';
import type { Break } from 'mattebox/stages/interstitials';
import { afterEach, describe, expect, it } from 'vitest';
import { type AdsOptions, ads, adsOf } from '../../src/index.js';

type Handler = (payload: unknown) => void;

/** The engine's interstitials surface, enough for the controller: breaks, events, skip. */
function fakeEngine(breaks: Partial<Break>[]) {
  const handlers = new Map<string, Set<Handler>>();
  const chapters: { start: number; end?: number; title: string }[][] = [];
  let skipped = 0;
  const full = breaks.map((entry) => ({ assets: [], covers: 0, start: 0, ...entry }) as Break);
  return {
    chapters,
    skipped: () => skipped,
    emit(name: string, payload: unknown): void {
      for (const fn of handlers.get(name) ?? []) fn(payload);
    },
    engine: {
      on(name: string, fn: Handler): () => void {
        const set = handlers.get(name) ?? new Set<Handler>();
        handlers.set(name, set);
        set.add(fn);
        return () => set.delete(fn);
      },
      interstitials: {
        breaks: full,
        playing: null,
        primary: { currentTime: 12, duration: 600 },
        skip: () => {
          skipped += 1;
        },
        schedule: () => {},
        cancel: () => {},
      },
      chapters: {
        source: 'none',
        set: (list: { start: number; end?: number; title: string }[]) => chapters.push(list),
      },
    },
    break: (id: string) => full.find((entry) => entry.id === id),
  };
}

function mount(breaks: Partial<Break>[], options: AdsOptions = {}) {
  const player = new MatteboxPlayerElement({ addons: [ads(options)] });
  player.setAttribute('controls', 'custom');
  player.append(
    document.createElement('mbx-ad-info'),
    document.createElement('mbx-ad-skip-button'),
    document.createElement('mbx-ad-progress'),
  );
  document.body.append(player);
  const fake = fakeEngine(breaks);
  Object.defineProperty(player, 'engine', { configurable: true, get: () => fake.engine });
  player.dispatchEvent(new Event('sourcechange'));
  return { player, fake };
}

const part = (host: Element | null, name: string): HTMLElement | null =>
  host?.shadowRoot?.querySelector<HTMLElement>(`[part~="${name}"]`) ?? null;

afterEach(() => {
  document.body.replaceChildren();
});

describe('a break the stream plays itself', () => {
  it('keeps the controls and skips at once when it sets no rule', async () => {
    const { player, fake } = mount([{ id: 'cue-out-1', start: 10, covers: 30 }]);
    fake.emit('interstitials:break-start', { break: fake.break('cue-out-1'), stitched: true });
    expect(player.getAttribute('ad')).toBe('stitched');
    const state = adsOf(player)?.state;
    expect(state?.free).toBe(true);
    expect(state?.skipIn).toBe(0);
    const info = player.querySelector('mbx-ad-info');
    expect((part(info, 'line') as HTMLElement).hidden).toBe(false);
    expect(player.querySelector<HTMLElement>('mbx-ad-progress')?.hidden).toBe(true);
    const button = player.querySelector('mbx-ad-skip-button')?.shadowRoot?.querySelector('button');
    expect(button?.disabled).toBe(false);
    expect(button?.textContent).toBe('Skip ad');
    // The stream plays the ad itself: the skip is a seek past it, not the engine's.
    let skips = 0;
    player.addEventListener('adskip', () => {
      skips += 1;
    });
    button?.click();
    expect(skips).toBe(1);
    expect(fake.skipped()).toBe(0);
  });

  it('takes the controls under stitched: strict', () => {
    const { player, fake } = mount([{ id: 'cue-out-1', start: 10, covers: 30 }], {
      stitched: 'strict',
    });
    fake.emit('interstitials:break-start', { break: fake.break('cue-out-1'), stitched: true });
    expect(player.getAttribute('ad')).toBe('');
    expect(adsOf(player)?.state?.free).toBe(false);
    expect(player.querySelector<HTMLElement>('mbx-ad-skip-button')?.hidden).toBe(true);
    expect((part(player.querySelector('mbx-ad-info'), 'line') as HTMLElement).hidden).toBe(true);
  });

  it('keeps a rule the stream states, in free mode too', () => {
    const { player, fake } = mount([{ id: 'cue-out-1', start: 10, covers: 30, noJump: true }]);
    fake.emit('interstitials:break-start', { break: fake.break('cue-out-1'), stitched: true });
    expect(player.getAttribute('ad')).toBe('');
    expect(adsOf(player)?.state?.free).toBe(false);
  });

  it('names a promo as a promo', () => {
    const { player, fake } = mount([{ id: 'p', start: 10, covers: 20, role: 'promo' }]);
    fake.emit('interstitials:break-start', { break: fake.break('p'), stitched: true });
    expect(part(player.querySelector('mbx-ad-info'), 'label')?.textContent).toBe('Promo');
    const button = player.querySelector('mbx-ad-skip-button')?.shadowRoot?.querySelector('button');
    expect(button?.textContent).toBe('Skip promo');
  });

  it('gives credits as markers beside the page markers, and chapters to the chapter menu', () => {
    const { player, fake } = mount([
      { id: 'a', start: 0, covers: 30, role: 'opening-credits' },
      { id: 'b', start: 30, covers: 500, role: 'chapter' },
      { id: 'c', start: 560, covers: 40, role: 'closing-credits' },
    ]);
    expect(player.markers.list.map((m) => [m.kind, m.start, m.end])).toEqual([
      ['opening-credits', 0, 30],
      ['closing-credits', 560, 600],
    ]);
    expect(player.breaks.list).toEqual([]);
    expect(fake.chapters[fake.chapters.length - 1]).toEqual([{ start: 30, end: 530, title: '1' }]);
    // The page sets its own markers: the credits come back beside them.
    player.markers.set([{ start: 100, end: 110, kind: 'recap' }]);
    expect(player.markers.list.map((m) => m.kind)).toEqual([
      'opening-credits',
      'recap',
      'closing-credits',
    ]);
  });
});
