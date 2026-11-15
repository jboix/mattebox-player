/**
 * <mbx-live-captions> from outside the
 * player package, the way a page gets them, over a fake SpeechRecognition,
 * so every browser runs the suite. Chrome's own recognizer needs a language
 * download and real speech; what is asserted here is the offer, the
 * handoff to the recognizer, the words on screen and the transcript.
 *
 * The package detects support once per page, in a detached frame. The fake
 * is installed on this window, and the frame's window is this one while
 * the first player attaches.
 */
import { MatteboxPlayerElement } from '@mattebox/player';
import { nativeHandler } from '@mattebox/player-core';
import type { MbxLiveCaptions, TranscriptDetail } from '@mattebox/player-live-captions';
import '@mattebox/player-live-captions';
import { afterEach, describe, expect, it } from 'vitest';
import { violations } from '../../../../test/browser/axe.js';
import { once, silence } from './helpers.js';

type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

/** What the fake recognizer was given, and how the page drives it. */
const ctx = {
  availability: 'available' as Availability,
  installs: 0,
  instances: [] as FakeRecognition[],
};

class FakeRecognition extends EventTarget {
  lang = '';
  continuous = false;
  interimResults = false;
  processLocally = false;
  track: MediaStreamTrack | null = null;
  aborted = false;

  static async available(): Promise<Availability> {
    return ctx.availability;
  }

  static async install(): Promise<boolean> {
    ctx.installs += 1;
    return ctx.availability === 'downloadable';
  }

  start(track: MediaStreamTrack): void {
    // As Chrome: an argument that is not a track is a TypeError.
    if (!(track instanceof MediaStreamTrack)) throw new TypeError('not a MediaStreamTrack');
    this.track = track;
    ctx.instances.push(this);
  }

  stop(): void {}

  abort(): void {
    this.aborted = true;
  }

  /** The recognizer heard `phrases`, as a `result` event carries them. */
  hear(phrases: ReadonlyArray<readonly [string, boolean]>): void {
    const results = phrases.map(([transcript, isFinal]) =>
      Object.assign([{ transcript }], { isFinal }),
    );
    this.dispatchEvent(Object.assign(new Event('result'), { results }));
  }
}

(globalThis as { SpeechRecognition?: unknown }).SpeechRecognition = FakeRecognition;
// WebKit has no captureStream(): a stand-in carries a silent audio track, so its run tests the rest.
if (!('captureStream' in HTMLMediaElement.prototype)) {
  Object.defineProperty(HTMLMediaElement.prototype, 'captureStream', {
    configurable: true,
    writable: true,
    value: () => new AudioContext().createMediaStreamDestination().stream,
  });
}
// The detection reads the class of a detached frame; while it runs, that frame's window is this one.
const frameWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
  configurable: true,
  get: () => window,
});

afterEach(() => {
  for (const node of document.querySelectorAll('mattebox-player')) node.remove();
  ctx.availability = 'available';
  ctx.installs = 0;
  ctx.instances = [];
});

interface Mounted {
  readonly player: MatteboxPlayerElement;
  readonly captions: MbxLiveCaptions;
  /** The subtitles menu in the bar. */
  readonly menu: HTMLElement;
  /** Picks an item of the subtitles menu, as a viewer does: Live captions, or Off. */
  pick(item: 'Live captions' | 'Off'): Promise<void>;
  /** The lines on screen, joined by " / ". */
  words(): string;
}

/** A player under custom controls, with the captions over the video and the subtitles menu in the bar. */
async function mount(attributes: Record<string, string> = {}): Promise<Mounted> {
  const player = new MatteboxPlayerElement({ handlers: [nativeHandler()] });
  player.setAttribute('controls', 'custom');
  // A blob URL has no extension, so the type is the page's to give.
  player.setAttribute('type', 'audio/wav');
  const captions = document.createElement('mbx-live-captions');
  for (const [name, value] of Object.entries(attributes)) captions.setAttribute(name, value);
  const bar = document.createElement('mbx-control-bar');
  const menu = document.createElement('mbx-subtitles-menu');
  bar.append(menu);
  player.append(captions, bar);
  player.style.width = '640px';
  const loaded = once(player, 'sourcechange');
  player.setAttribute('src', silence(2));
  document.body.append(player);
  await loaded;
  if (frameWindow !== undefined) {
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', frameWindow);
  }
  // Playing, so the capture carries an audio track; muted, which a capture still hears.
  player.media.muted = true;
  await player.media.play();
  return {
    player,
    captions,
    menu,
    async pick(name) {
      await expect.poll(() => menu.hidden).toBe(false);
      menu.shadowRoot?.querySelector('button')?.click();
      const item = menuItem(menu, name);
      if (item === undefined) throw new Error(`no ${name} item`);
      item.click();
    },
    words: () =>
      [...(captions.shadowRoot?.querySelectorAll('[part~="text"]') ?? [])]
        .map((line) => line.textContent)
        .join(' / '),
  };
}

/** The subtitles menu's item whose text starts with `name`, while the popup is open. */
function menuItem(menu: HTMLElement, name: string): HTMLButtonElement | undefined {
  return [
    ...(menu.shadowRoot?.querySelectorAll<HTMLButtonElement>('[part~="popup"] button') ?? []),
  ].find((item) => item.textContent?.startsWith(name));
}

/** A subtitle track in `language` on the player's video, as a source that has subtitles lists it. */
function subtitles(player: MatteboxPlayerElement, language: string): TextTrack {
  const video = player.querySelector('video') as HTMLVideoElement;
  return video.addTextTrack('subtitles', language, language);
}

/** A new source on the player, playing, muted, once its metadata is in. */
async function source(player: MatteboxPlayerElement): Promise<void> {
  const loaded = once(player.media, 'loadedmetadata');
  player.setAttribute('src', silence(3));
  await loaded;
  await player.media.play();
}

/** The recognizer the last start made, once `prepare` resolved. */
async function recognizer(): Promise<FakeRecognition> {
  await expect.poll(() => ctx.instances.length).toBeGreaterThan(0);
  const last = ctx.instances[ctx.instances.length - 1];
  if (last === undefined) throw new Error('no recognizer');
  return last;
}

describe('<mbx-live-captions>', () => {
  it('offers live captions to the player, and the subtitles menu lists them with a generated badge', async () => {
    const { player, menu } = await mount();
    expect(player.getAttribute('live-captions')).toBe('off');
    await expect.poll(() => menu.hidden).toBe(false);
    menu.shadowRoot?.querySelector('button')?.click();
    const live = menuItem(menu, 'Live captions');
    expect(live?.getAttribute('aria-checked')).toBe('false');
    // The badge is a glyph; its words stay for a screen reader and as its tooltip.
    expect(live?.querySelector('[part~="item-badge"] svg')).not.toBeNull();
    expect(live?.textContent).toContain('Generated automatically from speech');
    expect(await violations(player)).toEqual([]);
  });

  it('recognizes the video’s sound in the language given, and writes the words as they come', async () => {
    const { player, captions, pick, words } = await mount({ language: 'de' });
    const transcript: TranscriptDetail[] = [];
    player.addEventListener('transcript', (event) => {
      transcript.push((event as CustomEvent<TranscriptDetail>).detail);
    });
    await pick('Live captions');
    expect(player.getAttribute('live-captions')).toBe('on');
    const recognition = await recognizer();
    expect(recognition.lang).toBe('de');
    expect(recognition.continuous).toBe(true);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.processLocally).toBe(true);
    expect(recognition.track?.kind).toBe('audio');
    // Muted: the capture hears the sound anyway, so nothing asks to turn it on.
    expect(player.media.muted).toBe(true);

    recognition.hear([['Guten', false]]);
    expect(words()).toBe('Guten');
    expect(captions.hidden).toBe(false);
    recognition.hear([['Guten Abend', true]]);
    recognition.hear([
      ['Guten Abend', true],
      [' und willkommen', false],
    ]);
    expect(words()).toBe('Guten Abend und willkommen');
    expect(transcript.map((entry) => entry.text)).toEqual(['Guten Abend']);

    // Turned off: the recognizer stops and the words go.
    await pick('Off');
    await expect.poll(() => recognition.aborted).toBe(true);
    expect(captions.hidden).toBe(true);
    expect(player.getAttribute('live-captions')).toBe('off');
  });

  it('writes five words a line, two lines at most', async () => {
    const { player, words } = await mount({ language: 'en' });
    player.setAttribute('live-captions', 'on');
    const recognition = await recognizer();
    recognition.hear([['one two three four five six seven', false]]);
    expect(words()).toBe('one two three four five / six seven');
    recognition.hear([['one two three four five six seven eight nine ten eleven', false]]);
    expect(words()).toBe('six seven eight nine ten / eleven');
  });

  it('starts the next session when one ends, keeping its words', async () => {
    const { player, words } = await mount({ language: 'en' });
    player.setAttribute('live-captions', 'on');
    const first = await recognizer();
    first.hear([['Good evening', true]]);
    first.dispatchEvent(new Event('end'));
    await expect.poll(() => ctx.instances.length).toBe(2);
    const second = await recognizer();
    second.hear([['and welcome', false]]);
    expect(words()).toBe('Good evening and welcome');
  });

  it('starts empty after a seek, though the session sends its old words again', async () => {
    const { player, words } = await mount({ language: 'en' });
    player.setAttribute('live-captions', 'on');
    const recognition = await recognizer();
    recognition.hear([['Good evening', true]]);
    expect(words()).toBe('Good evening');
    player.media.currentTime = 0.5;
    await expect.poll(() => words()).toBe('');
    recognition.hear([
      ['Good evening', true],
      ['and welcome', false],
    ]);
    expect(words()).toBe('and welcome');
  });

  it('keeps one capture while it runs, and takes a fresh one for a new source', async () => {
    // A new capture takes the sound from the one before, so a probe must not take one while recognition runs.
    const prototype = HTMLMediaElement.prototype as HTMLMediaElement & {
      captureStream(): MediaStream;
    };
    const original = prototype.captureStream;
    let captures = 0;
    prototype.captureStream = function (this: HTMLMediaElement) {
      captures += 1;
      return original.call(this);
    };
    try {
      const { player, captions, words } = await mount({ language: 'en' });
      player.setAttribute('live-captions', 'on');
      const first = await recognizer();
      const before = captures;
      // An attribute change probes again, as a new engine track does.
      captions.setAttribute('hide', 'unavailable');
      const seeked = once(player.media, 'seeked');
      player.media.currentTime = 0.5;
      await seeked;
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(captures).toBe(before);
      expect(first.aborted).toBe(false);

      // A new source: the run starts over on one new capture, and its words.
      const loaded = once(player.media, 'loadedmetadata');
      player.setAttribute('src', silence(3));
      await loaded;
      await player.media.play();
      // Firefox's capture adds another audio track once the media plays, and the recognizer moves to it.
      await expect.poll(() => ctx.instances.length).toBeGreaterThanOrEqual(2);
      expect(captures).toBe(before + 1);
      expect(first.aborted).toBe(true);
      expect(player.getAttribute('live-captions')).toBe('on');
      const second = await recognizer();
      second.hear([['Good evening', false]]);
      expect(words()).toBe('Good evening');
    } finally {
      prototype.captureStream = original;
    }
  });

  it('follows the subtitle size and background the menu sets', async () => {
    const { player, captions } = await mount({ language: 'en' });
    player.setAttribute('live-captions', 'on');
    (await recognizer()).hear([['Hello', false]]);
    expect(captions.getAttribute('background')).toBe('dark');
    const size = () =>
      Number.parseFloat(captions.style.getPropertyValue('--mbx-live-captions-size'));
    const medium = size();
    player.setAttribute('subtitle-background', 'solid');
    player.setAttribute('subtitle-size', 'large');
    await expect.poll(() => captions.getAttribute('background')).toBe('solid');
    expect(size()).toBeCloseTo(medium * 1.5, 0);
  });

  it('says so and turns off when the browser refuses to capture the source', async () => {
    const { player, captions, words } = await mount({ language: 'en' });
    const node = player.querySelector('video') as HTMLVideoElement & { captureStream(): unknown };
    // As Chrome for another site's media served without CORS.
    node.captureStream = () => {
      throw new DOMException('cross-origin', 'SecurityError');
    };
    player.setAttribute('live-captions', 'on');
    await expect.poll(() => player.getAttribute('live-captions')).toBe('off');
    expect(words()).toBe('Live captions cannot listen to this video');
    expect(captions.getAttribute('unavailable')).toBe('source');
    expect(ctx.instances).toEqual([]);
  });

  it('downloads a language the device does not have yet', async () => {
    ctx.availability = 'downloadable';
    const { player, pick } = await mount({ language: 'fr' });
    await pick('Live captions');
    await recognizer();
    expect(ctx.installs).toBe(1);
    expect(player.getAttribute('live-captions')).toBe('on');
  });

  it('says so and turns off for a language the device cannot recognize', async () => {
    ctx.availability = 'unavailable';
    const { player, words } = await mount({ language: 'rm' });
    player.setAttribute('live-captions', 'on');
    await expect.poll(() => player.getAttribute('live-captions')).toBe('off');
    expect(words()).toBe('Live captions are not available in this language');
    expect(ctx.instances).toEqual([]);
  });

  it('offers live captions for a language the device lacks, and says why on the element', async () => {
    ctx.availability = 'unavailable';
    const reasons: string[] = [];
    const heard = (event: Event): void => {
      reasons.push((event as CustomEvent<{ reason: string }>).detail.reason);
    };
    // On the document: the probe can answer before mount returns the player.
    document.addEventListener('unavailable', heard);
    const { player, captions } = await mount({ language: 'rm' });
    await expect.poll(() => captions.getAttribute('unavailable')).toBe('language');
    document.removeEventListener('unavailable', heard);
    expect(reasons).toContain('language');
    // Offered all the same: a click explains, rather than the item missing without a word.
    expect(player.getAttribute('live-captions')).toBe('off');
  });

  it('takes the offer back for a language the device lacks under hide="unavailable"', async () => {
    ctx.availability = 'unavailable';
    const { player, captions } = await mount({ language: 'rm', hide: 'unavailable' });
    await expect.poll(() => player.hasAttribute('live-captions')).toBe(false);
    expect(captions.getAttribute('unavailable')).toBe('language');
    // A language it has offers them again.
    ctx.availability = 'available';
    captions.setAttribute('language', 'de');
    await expect.poll(() => player.getAttribute('live-captions')).toBe('off');
    expect(captions.hasAttribute('unavailable')).toBe(false);
  });

  it('says the source covers the language when it has subtitles in it, and still offers them', async () => {
    const { player, captions } = await mount({ language: 'en' });
    subtitles(player, 'en');
    // A new track is a probe away: the element hears the attribute it watches.
    captions.setAttribute('cloud', '');
    captions.removeAttribute('cloud');
    await expect.poll(() => captions.getAttribute('unavailable')).toBe('covered');
    expect(player.getAttribute('live-captions')).toBe('off');
    captions.setAttribute('hide', 'covered');
    await expect.poll(() => player.hasAttribute('live-captions')).toBe(false);
    // `unavailable` alone leaves a covered source offered.
    captions.setAttribute('hide', 'unavailable');
    await expect.poll(() => player.getAttribute('live-captions')).toBe('off');
  });

  it('remembers the language the viewer turned them on in, through a new source', async () => {
    const { player, pick } = await mount({ language: 'en' });
    await pick('Live captions');
    await recognizer();
    await expect.poll(() => player.getAttribute('live-captions-language')).toBe('en');
    await source(player);
    await expect.poll(() => ctx.instances.length).toBeGreaterThanOrEqual(2);
    expect(player.getAttribute('live-captions')).toBe('on');
    // The viewer's off: no language wants them any more.
    await pick('Off');
    await expect.poll(() => player.hasAttribute('live-captions-language')).toBe(false);
  });

  it('turns off for a source in another language, and keeps the viewer’s language', async () => {
    const { player, captions } = await mount({ language: 'en' });
    player.setAttribute('live-captions', 'on');
    await recognizer();
    await expect.poll(() => player.getAttribute('live-captions-language')).toBe('en');
    captions.setAttribute('language', 'de');
    await source(player);
    await expect.poll(() => player.getAttribute('live-captions')).toBe('off');
    expect(player.getAttribute('live-captions-language')).toBe('en');
    // Back in English: on again by themselves.
    captions.setAttribute('language', 'en');
    await source(player);
    await expect.poll(() => player.getAttribute('live-captions')).toBe('on');
  });

  it('turns on by itself for the language a page asks for, when the device has it', async () => {
    const { player } = await mount({ language: 'en' });
    player.setAttribute('live-captions-language', 'en');
    await expect.poll(() => player.getAttribute('live-captions')).toBe('on');
    await recognizer();
  });

  it('waits for a click when the language a page asks for needs a download', async () => {
    ctx.availability = 'downloadable';
    const { player } = await mount({ language: 'en' });
    player.setAttribute('live-captions-language', 'en');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(player.getAttribute('live-captions')).toBe('off');
    expect(ctx.installs).toBe(0);
  });

  it('shows the source’s subtitles instead, when it has them in the viewer’s language', async () => {
    const { player } = await mount({ language: 'en' });
    const track = subtitles(player, 'en');
    player.setAttribute('live-captions-language', 'en');
    await expect.poll(() => track.mode).toBe('showing');
    expect(player.getAttribute('live-captions')).toBe('off');
    expect(ctx.instances).toHaveLength(0);
  });

  it('asks for the two-letter tag when the language is a three-letter code', async () => {
    const { player } = await mount({ language: 'deu' });
    player.setAttribute('live-captions', 'on');
    expect((await recognizer()).lang).toBe('de');
  });

  it('takes its offer back when it leaves the player', async () => {
    const { player, captions, menu } = await mount();
    expect(player.getAttribute('live-captions')).toBe('off');
    captions.remove();
    expect(player.hasAttribute('live-captions')).toBe(false);
    // The test's video has no subtitles, so the menu has nothing left to offer.
    await expect.poll(() => menu.hidden).toBe(true);
  });
});
