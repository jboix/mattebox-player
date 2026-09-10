/**
 * <mbx-diagnostics> from outside the player package, the way a page gets
 * it: the player and its bar from `@mattebox/player`, the element from
 * this package, a native session over a WAV, and a fake engine where the
 * engine's pages need one.
 */
import type { PlayerHost } from '@mattebox/player';
import { MatteboxPlayerElement } from '@mattebox/player';
import type { Handler } from '@mattebox/player-core';
import { nativeHandler } from '@mattebox/player-core';
import type { MbxDiagnostics } from '@mattebox/player-diagnostics';
import { DIAGNOSTICS } from '@mattebox/player-diagnostics';
import type { Mattebox } from 'mattebox';
import { afterEach, describe, expect, it } from 'vitest';

/** A valid WAV, 8-bit mono at 8 kHz, as a blob URL. */
function silence(seconds = 10): string {
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

function once(target: EventTarget, name: string): Promise<Event> {
  return new Promise((resolve) => {
    target.addEventListener(name, resolve, { once: true });
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** An engine of what the pages read: a kernel state, a ladder, tracks, a trace ring, and `trace` events. */
function fakeEngine(): Mattebox & { switched: boolean; emit: (entry: unknown) => void } {
  const traceListeners = new Set<(entry: unknown) => void>();
  // One ring, the same objects on every read, as the engine's is.
  const ring = [
    {
      t: performance.now() - 100,
      msg: { type: 'SEGMENT_LOADED', trackId: 'video:main', seq: 1, size: 500_000, rtt: 200 },
      effects: [],
      digest: 'a',
    },
    {
      t: performance.now() - 50,
      msg: { type: 'STALLED', at: 2 },
      effects: [{ kind: 'emit', event: 'recovery:nudge', payload: {} }],
      digest: 'b',
    },
  ];
  const low = {
    id: 'v-360',
    bitrate: 800_000,
    width: 640,
    height: 360,
    codecs: 'avc1.42e01e',
    mimeType: 'video/mp4',
    segments: [],
  };
  const high = {
    id: 'v-1080',
    bitrate: 4_500_000,
    width: 1920,
    height: 1080,
    codecs: 'avc1.640028',
    mimeType: 'video/mp4',
    segments: [],
  };
  const fake = {
    switched: false,
    emit(entry: unknown): void {
      for (const fn of traceListeners) fn(entry);
    },
    on: (event: string, fn: (payload: unknown) => void) => {
      if (event !== 'trace') return () => undefined;
      traceListeners.add(fn);
      return () => {
        traceListeners.delete(fn);
      };
    },
    capabilities: () => ['video:video/mp4', 'audio:audio/mp4'],
    error: null,
    quality: {
      renditions: [low, high],
      allowed: [low, high],
      get playing() {
        return fake.switched ? high : low;
      },
      active: high,
      pinned: null,
      constraints: new Map(),
      auto() {},
      pin() {},
    },
    tracks: {
      available: [
        {
          id: 'video:main',
          contentType: 'video',
          mimeType: 'video/mp4',
          protection: null,
          renditions: [low, high],
        },
        {
          id: 'audio:de',
          contentType: 'audio',
          mimeType: 'audio/mp4',
          lang: 'de',
          role: 'main',
          protection: null,
          renditions: [],
        },
      ],
      active: (type: string) =>
        type === 'audio'
          ? fake.tracks.available[1]
          : type === 'video'
            ? fake.tracks.available[0]
            : null,
      select() {},
      deselect() {},
    },
    stats: {
      throughput: 3_000_000,
      trace: () => ring,
      snapshot: () => ({
        lifecycle: { phase: 'ready' },
        presentation: { id: 'p', isLive: false, duration: 10, periods: [], couplings: [] },
        buffers: new Map([
          [
            'sb:video',
            { codecs: 'avc1.640028', ranges: [{ start: 0, end: 6 }], pendingAppends: 0 },
          ],
        ]),
        live: null,
        scheduling: {
          inflight: new Map([
            [
              't1',
              { token: 't1', trackId: 'video:main', seq: 4, url: 'https://cdn.example/4.m4s' },
            ],
          ]),
          bufferGoal: 30,
          tokenSeq: 1,
        },
        tracks: { active: new Map(), available: [] },
        quality: {
          version: 1,
          constraints: new Map(),
          pinned: null,
          active: 'v-1080',
          appendLog: [[{ start: 0, end: 6 }, 'v-360']],
        },
        stats: { throughputEwma: 3_000_000, throughputFastEwma: 2_500_000 },
        playback: { currentTime: 0, buffered: [], seeking: false },
      }),
    },
  };
  return fake as unknown as Mattebox & { switched: boolean; emit: (entry: unknown) => void };
}

/** A handler that plays the WAV natively and hands the element a fake engine. */
function fakeHandler(engine: Mattebox): Handler {
  return {
    name: 'fake',
    canHandle: () => 'probably',
    handle(source, video) {
      video.src = source.url;
      return Promise.resolve({
        handler: 'fake',
        engine,
        dispose(): Promise<void> {
          video.removeAttribute('src');
          video.load();
          return Promise.resolve();
        },
      });
    },
  };
}

interface Mounted {
  readonly player: MatteboxPlayerElement;
  readonly element: MbxDiagnostics;
}

/** A player with its own bar carrying the element, over a source, ready. */
async function mount(
  handlers: readonly Handler[],
  where: 'bar' | 'player' = 'bar',
): Promise<Mounted> {
  const player = new MatteboxPlayerElement({ handlers });
  player.setAttribute('controls', where === 'bar' ? 'custom' : 'native');
  player.setAttribute('muted', '');
  player.setAttribute('src', silence());
  const element = document.createElement(DIAGNOSTICS);
  if (where === 'bar') {
    const bar = document.createElement('mbx-control-bar');
    bar.append(document.createElement('mbx-play-button'), element);
    player.append(bar);
  } else {
    player.append(element);
  }
  document.body.append(player);
  await once(player.video, 'loadedmetadata');
  await expect.poll(() => player.player?.session ?? null).not.toBeNull();
  return { player, element };
}

function inside(node: HTMLElement, part: string): HTMLElement {
  return node.shadowRoot?.querySelector(`[part~="${part}"]`) as HTMLElement;
}

function rows(node: HTMLElement, page: string): Record<string, string> {
  const out: Record<string, string> = {};
  const keys = node.shadowRoot?.querySelectorAll(`[part~="page-${page}"] [part~="key"]`) ?? [];
  for (const key of keys) {
    out[key.textContent ?? ''] = key.nextElementSibling?.textContent ?? '';
  }
  return out;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('the element', () => {
  it('registers itself, and takes the contract of a control of the page', async () => {
    expect(customElements.get(DIAGNOSTICS)).toBeDefined();
    const { player, element } = await mount([nativeHandler()]);
    expect(element.parentElement?.localName).toBe('mbx-control-bar');
    expect(element.hasAttribute('inline')).toBe(false);
    const button = inside(element, 'button');
    expect(button.getAttribute('aria-label')).toBe('Diagnostics');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(inside(element, 'panel').hidden).toBe(true);
    // The report reads the player through the host surface alone.
    const report = element.report();
    expect(report.source.handler).toBe('native');
    expect(report.engine).toBeNull();
    expect(report.trace).toBeNull();
    expect(report.playback.duration).toBeCloseTo(10, 0);
    expect((player as PlayerHost).engine).toBeNull();
  });

  it('opens a panel from the button, carries open for the bar, and closes on Escape and outside', async () => {
    const { element } = await mount([nativeHandler()]);
    const button = inside(element, 'button');
    button.click();
    expect(inside(element, 'panel').hidden).toBe(false);
    expect(element.hasAttribute('open')).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(inside(element, 'tab-playback').getAttribute('aria-selected')).toBe('true');
    inside(element, 'panel').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(inside(element, 'panel').hidden).toBe(true);
    expect(element.hasAttribute('open')).toBe(false);
    button.click();
    expect(element.hasAttribute('open')).toBe(true);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    expect(element.hasAttribute('open')).toBe(false);
  });

  it('shows the video facts of a native session, and says the engine is not there', async () => {
    const { element } = await mount([nativeHandler()]);
    inside(element, 'button').click();
    const playback = rows(element, 'playback');
    expect(playback.handler).toBe('native');
    expect(playback.time).toBe('0:00 of 0:10');
    expect(playback.state).toContain('paused');
    expect(playback.throughput).toBeUndefined();
    inside(element, 'tab-engine').click();
    expect(inside(element, 'page-engine').textContent).toContain('native session');
  });

  it('shows the engine, its tracks and its ladder, and counts a switch', async () => {
    const engine = fakeEngine();
    const { element } = await mount([fakeHandler(engine)]);
    inside(element, 'button').click();
    const playback = rows(element, 'playback');
    expect(playback.handler).toBe('fake');
    expect(playback.phase).toBe('ready');
    expect(playback.throughput).toBe('slow 3.0 Mbps, fast 2.5 Mbps');
    expect(playback.playing).toBe('360p, 800 kbps');
    inside(element, 'tab-engine').click();
    const facts = rows(element, 'engine');
    expect(facts.capabilities).toBe('video:video/mp4, audio:audio/mp4');
    expect(facts['buffer goal']).toBe('30s');
    expect(facts['in flight']).toBe('video:main #4');
    expect(facts.live).toBe('VOD');
    expect(facts.video).toBe('avc1.640028: 0.0–6.0');
    expect(facts['audio ●']).toBe('audio:de (de · main), 0 renditions');
    expect(facts['v-360']).toBe('640×360, 800 kbps, avc1.42e01e [playing]');
    expect(facts['v-1080']).toBe('1920×1080, 4.5 Mbps, avc1.640028 [next]');
    // A switch is a poll's diff: one sample with the first rendition, then the flip.
    await wait(POLL_MS + 100);
    engine.switched = true;
    await wait(POLL_MS + 100);
    expect(rows(element, 'engine')['v-1080']).toBe('1920×1080, 4.5 Mbps, avc1.640028 [playing]');
    const report = element.report();
    expect(report.counters.switches).toBe(1);
    expect(report.marks.some((mark) => mark.kind === 'switch')).toBe(true);
    expect(report.marks.some((mark) => mark.kind === 'segment')).toBe(true);
    expect(report.marks.some((mark) => mark.kind === 'nudge')).toBe(true);
    expect(report.engine?.quality.playing).toBe('v-1080');
    expect(report.engine?.tracks.active.audio).toBe('audio:de');
    expect(report.trace?.length).toBe(2);
  });

  it('keeps its own slimmed history from the engine trace events, and never counts an entry twice', async () => {
    const engine = fakeEngine();
    const { element } = await mount([fakeHandler(engine)]);
    // The ring's two entries came in through the poll; the event adds a third.
    await wait(POLL_MS + 100);
    expect(element.report().trace?.length).toBe(2);
    const bytes = new Uint8Array(12).buffer;
    const loaded = {
      t: performance.now(),
      msg: { type: 'SEGMENT_LOADED', trackId: 'video:main', seq: 2, size: 12, rtt: 40, bytes },
      effects: [
        { kind: 'append', sbId: 'sb:video', data: bytes },
        {
          kind: 'schedule',
          token: 't',
          delayMs: 0,
          // biome-ignore lint/suspicious/noThenProperty: the schedule effect's field, as the engine names it
          then: {
            type: 'MANIFEST_LOADED',
            presentation: {
              id: 'p',
              isLive: false,
              periods: [{ id: 'a', start: 0, tracks: [] }],
              couplings: [],
            },
          },
        },
      ],
      digest: 'c',
    };
    engine.emit(loaded);
    engine.emit(loaded);
    const report = element.report();
    expect(report.trace?.length).toBe(3);
    const entry = report.trace?.[2] as {
      msg: { bytes: unknown };
      effects: Array<Record<string, unknown>>;
    };
    expect(entry.msg.bytes).toBe(12);
    expect(entry.effects[0]?.data).toBe(12);
    const scheduled = entry.effects[1] as { then: { presentation: { periods: unknown[] } } };
    expect(scheduled.then.presentation.periods.length).toBe(1);
    expect(report.marks.filter((mark) => mark.kind === 'segment').length).toBe(2);
    // A new session starts a new history.
    engine.emit({
      t: performance.now(),
      msg: { type: 'STALLED', at: 5 },
      effects: [],
      digest: 'd',
    });
    expect(element.report().trace?.length).toBe(4);
  });

  it('draws the charts on its canvas, one tab at a time, over the window chosen', async () => {
    const { element } = await mount([fakeHandler(fakeEngine())]);
    inside(element, 'button').click();
    inside(element, 'tab-charts').click();
    await wait(DRAW_MS * 2);
    const canvas = inside(element, 'chart') as HTMLCanvasElement;
    expect(canvas.width).toBeGreaterThan(0);
    expect(inside(element, 'chart-tab-buffer').getAttribute('aria-selected')).toBe('true');
    expect(inside(element, 'readout').textContent).toContain('buffered ahead');
    inside(element, 'chart-tab-throughput').click();
    expect(inside(element, 'readout').textContent).toContain('Mbps');
    inside(element, 'chart-tab-stalls').click();
    expect(inside(element, 'readout').textContent).toContain('stalls');
    inside(element, 'chart-tab-frames').click();
    expect(inside(element, 'readout').textContent).toContain('decoded');
    inside(element, 'chart-tab-switches').click();
    expect(inside(element, 'readout').textContent).toContain('switches this session');
    element.setAttribute('window', '30');
    expect((inside(element, 'window') as HTMLSelectElement).value).toBe('30');
  });

  it('says a native session has no throughput or switches to chart', async () => {
    const { element } = await mount([nativeHandler()]);
    inside(element, 'button').click();
    inside(element, 'tab-charts').click();
    inside(element, 'chart-tab-throughput').click();
    expect(inside(element, 'readout').textContent).toContain('native session');
  });

  it('probes the browser once its page is shown, and lists the platform, the codecs and the key systems', async () => {
    const { element } = await mount([nativeHandler()]);
    inside(element, 'button').click();
    inside(element, 'tab-browser').click();
    expect(inside(element, 'page-browser').textContent).toContain('Probing');
    await expect
      .poll(() => element.shadowRoot?.querySelectorAll('[part~="page-browser"] table').length, {
        timeout: 20_000,
      })
      .toBe(3);
    const text = inside(element, 'page-browser').textContent ?? '';
    expect(text).toContain('MediaSource');
    expect(text).toContain('H.264 High 4.0');
    expect(text).toContain('Widevine');
    expect(text).toContain('ClearKey');
    expect(element.report().support?.codecs.length).toBe(11);
  });

  it('dispatches the report on a fatal error, bubbling through the player', async () => {
    const { player, element } = await mount([nativeHandler()]);
    let received: unknown = null;
    player.addEventListener('report', (event) => {
      received = (event as CustomEvent).detail;
    });
    player.dispatchEvent(
      new CustomEvent('error', {
        detail: {
          category: 'media',
          code: 'MEDIA_DECODE_ERROR',
          fatal: false,
          recoverable: true,
          handler: 'native',
        },
        bubbles: true,
        composed: true,
      }),
    );
    expect(received).toBeNull();
    player.dispatchEvent(
      new CustomEvent('error', {
        detail: {
          category: 'media',
          code: 'MEDIA_DECODE_ERROR',
          fatal: true,
          recoverable: false,
          handler: 'native',
        },
        bubbles: true,
        composed: true,
      }),
    );
    expect(received).not.toBeNull();
    expect((received as { source: { handler: string } }).source.handler).toBe('native');
    expect(element.report().at).toBeDefined();
  });

  it('takes its words from attributes', async () => {
    const { element } = await mount([nativeHandler()]);
    element.setAttribute('label', 'Diagnòstics');
    element.setAttribute('label-copy', 'Copia l’informe');
    expect(inside(element, 'button').getAttribute('aria-label')).toBe('Diagnòstics');
    expect(inside(element, 'copy').textContent).toBe('Copia l’informe');
  });

  it('is the panel itself, open and in flow, when it is not in a bar', async () => {
    const { player, element } = await mount([nativeHandler()], 'player');
    expect(element.hasAttribute('inline')).toBe(true);
    expect(inside(element, 'panel').hidden).toBe(false);
    expect(element.hasAttribute('open')).toBe(false);
    // In the stage's slot beside the video, under the picture.
    expect(element.assignedSlot?.parentElement?.getAttribute('part')).toBe('stage');
    expect(rows(element, 'playback').handler).toBe('native');
    expect(player.querySelector('mbx-panels')).not.toBeNull();
  });

  it('stops sampling and closes when removed, and starts again when put back', async () => {
    const { player, element } = await mount([nativeHandler()]);
    inside(element, 'button').click();
    expect(element.hasAttribute('open')).toBe(true);
    element.remove();
    expect(element.hasAttribute('open')).toBe(false);
    expect(() => element.report()).toThrow();
    player.querySelector('mbx-control-bar')?.append(element);
    await expect
      .poll(() => {
        try {
          return element.report().source.handler;
        } catch {
          return null;
        }
      })
      .toBe('native');
  });
});

const POLL_MS = 500;
const DRAW_MS = 250;
