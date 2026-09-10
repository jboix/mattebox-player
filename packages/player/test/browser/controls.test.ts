/**
 * The controls over a deterministic video, see `fakeMedia` in helpers.ts:
 * what a control draws for a state, and what it writes for a click or a
 * key, with no engine and no media pipeline in the way. Where a control
 * reads a session, a handler hands the element a fake engine. The
 * browser's own pipeline is media.test.ts's.
 */
import type { MbxControlBar, MbxPlayButton } from '@mattebox/player';
import { MatteboxPlayerElement } from '@mattebox/player';
import type { Handler } from '@mattebox/player-core';
import { nativeHandler } from '@mattebox/player-core';
import type { Mattebox } from 'mattebox';
import type { ThumbnailsApi } from 'mattebox/stages/thumbnails';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { icon } from '../../src/controls/icons.js';
import type { LiveApi, PdtApi } from '../../src/namespaces.js';
import { fakeMedia, media, once, silence } from './helpers.js';

const IDLE_MS = 3000;

/** A source for a handler that never reads it: the element loads on any `src`. */
const SOURCE = 'https://cdn.test/source';

/** The element over `handlers`, its video made deterministic before any control can read it. */
function build(
  handlers: readonly Handler[],
  attributes: Readonly<Record<string, string>> = {},
): MatteboxPlayerElement {
  const player = new MatteboxPlayerElement({ handlers });
  fakeMedia(player.video);
  for (const [name, value] of Object.entries(attributes)) player.setAttribute(name, value);
  document.body.append(player);
  return player;
}

/** The element over the native handler alone: nothing here needs an engine. */
function mount(attributes: Readonly<Record<string, string>> = {}): MatteboxPlayerElement {
  return build([nativeHandler()], attributes);
}

/** The default composition arrives a microtask after the connect. */
function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The element under custom controls, with its default bar in. */
async function custom(
  attributes: Readonly<Record<string, string>> = {},
): Promise<MatteboxPlayerElement> {
  const player = mount({ controls: 'custom', ...attributes });
  await settled();
  return player;
}

/** The element under custom controls with the metadata of a clip `seconds` long in. */
async function loaded(
  attributes: Readonly<Record<string, string>> = {},
  seconds = 10,
): Promise<MatteboxPlayerElement> {
  const player = await custom(attributes);
  await media(player.video).metadata(seconds);
  return player;
}

/** The element ready to play: muted, as a page that autoplays has it. */
function ready(seconds = 10): Promise<MatteboxPlayerElement> {
  return loaded({ muted: '' }, seconds);
}

function bar(player: MatteboxPlayerElement): MbxControlBar | null {
  return player.querySelector('mbx-control-bar');
}

function playButton(player: MatteboxPlayerElement): MbxPlayButton {
  const button = player.querySelector('mbx-play-button');
  if (button === null) throw new Error('no play button');
  return button;
}

/** The real button inside a control's shadow root. */
function inner(control: HTMLElement): HTMLButtonElement {
  const button = control.shadowRoot?.querySelector('button');
  if (button === null || button === undefined) throw new Error('no button inside');
  return button;
}

/** The glyph slot a button shows, by its state. */
function shown(control: HTMLElement): string {
  const slots = [...(control.shadowRoot?.querySelectorAll('slot[name^="icon-"]') ?? [])];
  return slots.find((slot) => !(slot as HTMLSlotElement).hidden)?.getAttribute('name') ?? '';
}

function idle(player: MatteboxPlayerElement): boolean {
  return bar(player)?.hasAttribute('idle') ?? false;
}

/** A key as the browser sends it: cancelable, so a control's preventDefault reaches the host's listener. */
function press(target: EventTarget, key: string): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }),
  );
}

function move(target: EventTarget): void {
  target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, composed: true }));
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('the controls attribute', () => {
  it('keeps native controls on the video and draws no bar by default', async () => {
    const player = mount();
    await settled();
    expect(player.video.hasAttribute('controls')).toBe(true);
    expect(bar(player)).toBeNull();
  });

  it('keeps native controls with controls="native"', async () => {
    const player = mount({ controls: 'native' });
    await settled();
    expect(player.video.hasAttribute('controls')).toBe(true);
    expect(bar(player)).toBeNull();
  });

  it('removes native controls and appends the default composition with controls="custom"', async () => {
    const player = mount({ controls: 'custom' });
    expect(player.video.hasAttribute('controls')).toBe(false);
    // Not yet: the page's own children may still be on their way.
    expect(bar(player)).toBeNull();
    await settled();
    const root = bar(player);
    expect(root).not.toBeNull();
    expect(root?.parentElement).toBe(player);
    expect(root?.querySelector('mbx-play-button')).not.toBeNull();
    // Beside the video, and slotted into the stage over it.
    expect(root?.assignedSlot?.parentElement?.getAttribute('part')).toBe('stage');
  });

  it('removes native controls and draws no bar with controls="none"', async () => {
    const player = mount({ controls: 'none' });
    await settled();
    expect(player.video.hasAttribute('controls')).toBe(false);
    expect(bar(player)).toBeNull();
  });

  it('leaves a bar the page wrote alone, and appends nothing beside it', async () => {
    const player = new MatteboxPlayerElement({ handlers: [nativeHandler()] });
    player.setAttribute('controls', 'custom');
    const own = document.createElement('mbx-control-bar');
    player.append(own);
    document.body.append(player);
    await settled();
    expect(player.querySelectorAll('mbx-control-bar').length).toBe(1);
    expect(bar(player)).toBe(own);
    expect(own.querySelector('mbx-play-button')).toBeNull();
  });

  it('sees a bar appended in the same task as the connect', async () => {
    const player = mount({ controls: 'custom' });
    const own = document.createElement('mbx-control-bar');
    player.append(own);
    await settled();
    expect(player.querySelectorAll('mbx-control-bar').length).toBe(1);
    expect(bar(player)).toBe(own);
  });

  it('upgrades a whole tree from markup, the player first, with every control attached', async () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML =
      '<mattebox-player controls="custom"><mbx-control-bar><mbx-play-button></mbx-play-button></mbx-control-bar></mattebox-player>';
    document.body.append(wrapper);
    const player = wrapper.firstElementChild as MatteboxPlayerElement;
    await settled();
    expect(player.querySelectorAll('mbx-control-bar').length).toBe(1);
    expect(inner(playButton(player)).getAttribute('aria-label')).toBe('Play');
  });

  it('swaps the default bar in and out as the attribute changes, without reloading the source', async () => {
    const player = mount({ src: silence(), muted: '' });
    let changes = 0;
    player.addEventListener('sourcechange', () => {
      changes += 1;
    });
    await once(player, 'sourcechange');
    const loaded = player.video.getAttribute('src');

    player.setAttribute('controls', 'custom');
    expect(player.video.hasAttribute('controls')).toBe(false);
    expect(bar(player)).not.toBeNull();
    player.setAttribute('controls', 'none');
    expect(bar(player)).toBeNull();
    player.removeAttribute('controls');
    expect(player.video.hasAttribute('controls')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(changes).toBe(1);
    expect(player.video.getAttribute('src')).toBe(loaded);
  });

  it('takes back only the default it appended when the mode changes', async () => {
    const player = await custom();
    const own = document.createElement('mbx-play-button');
    player.append(own);
    player.setAttribute('controls', 'native');
    expect(bar(player)).toBeNull();
    expect(own.isConnected).toBe(true);
  });
});

describe('a control and its player', () => {
  it('is inert outside a player, and attaches once inside one', async () => {
    const button = document.createElement('mbx-play-button');
    document.body.append(button);
    expect(inner(button).getAttribute('aria-label')).toBeNull();
    const player = await custom();
    bar(player)?.append(button);
    expect(inner(button).getAttribute('aria-label')).toBe('Play');
  });

  it('lets go of the video when it is removed', async () => {
    const player = await ready();
    const button = playButton(player);
    button.remove();
    await player.video.play();
    expect(inner(button).getAttribute('aria-label')).toBe('Play');
  });

  it('follows the player it is moved to', async () => {
    const first = await ready(10);
    const second = await custom();
    const button = playButton(first);
    await first.video.play();
    expect(inner(button).getAttribute('aria-label')).toBe('Pause');
    bar(second)?.append(button);
    expect(inner(button).getAttribute('aria-label')).toBe('Play');
    // The first video's events no longer reach it.
    first.video.pause();
    await first.video.play();
    expect(inner(button).getAttribute('aria-label')).toBe('Play');
  });

  it('finds its player through a shadow root in between', async () => {
    const player = await custom();
    const wrap = document.createElement('div');
    const shadow = wrap.attachShadow({ mode: 'open' });
    const button = document.createElement('mbx-play-button');
    shadow.append(button);
    bar(player)?.append(wrap);
    expect(inner(button).getAttribute('aria-label')).toBe('Play');
  });
});

describe('the state attributes on the player', () => {
  it('reflect paused, playing and ended', async () => {
    const player = await ready();
    expect(player.hasAttribute('paused')).toBe(true);
    expect(player.hasAttribute('playing')).toBe(false);
    await player.video.play();
    expect(player.hasAttribute('playing')).toBe(true);
    expect(player.hasAttribute('paused')).toBe(false);
    await media(player.video).end();
    expect(player.hasAttribute('ended')).toBe(true);
    expect(player.hasAttribute('paused')).toBe(true);
  });

  it('reflect the video unmuting, and drop the forwarded attribute with it', async () => {
    const player = await ready();
    expect(player.hasAttribute('muted')).toBe(true);
    player.video.muted = false;
    await once(player.video, 'volumechange');
    expect(player.hasAttribute('muted')).toBe(false);
    // Reflection never writes to the video: its own attribute is the page's.
    expect(player.video.hasAttribute('muted')).toBe(true);
    expect(player.video.muted).toBe(false);
  });

  it('still forward the attribute the page sets onto the video', async () => {
    const player = await loaded();
    expect(player.video.muted).toBe(false);
    player.setAttribute('muted', '');
    await once(player.video, 'volumechange');
    expect(player.video.muted).toBe(true);
    expect(player.video.hasAttribute('muted')).toBe(true);
  });

  it('still forward the attribute the page removes', async () => {
    const player = await ready();
    player.removeAttribute('muted');
    await once(player.video, 'volumechange');
    expect(player.video.muted).toBe(false);
    expect(player.hasAttribute('muted')).toBe(false);
  });

  it('are there under native controls too', async () => {
    const player = mount();
    await settled();
    expect(player.hasAttribute('paused')).toBe(true);
  });
});

describe('the play button', () => {
  it('plays and pauses, swapping the glyph and the name', async () => {
    const player = await ready(10);
    const button = inner(playButton(player));
    expect(button.getAttribute('aria-label')).toBe('Play');
    expect(shown(playButton(player))).toBe('icon-play');
    button.click();
    await once(player.video, 'play');
    expect(button.getAttribute('aria-label')).toBe('Pause');
    expect(shown(playButton(player))).toBe('icon-pause');
    button.click();
    await once(player.video, 'pause');
    expect(button.getAttribute('aria-label')).toBe('Play');
  });

  it('offers replay once the media has ended', async () => {
    const player = await ready();
    await player.video.play();
    await media(player.video).end();
    expect(inner(playButton(player)).getAttribute('aria-label')).toBe('Replay');
    expect(shown(playButton(player))).toBe('icon-replay');
  });

  it('takes its names from the label attributes, and follows a change', async () => {
    const player = await ready();
    const control = playButton(player);
    control.setAttribute('label-play', 'Reproduir');
    control.setAttribute('label-pause', 'Pausa');
    expect(inner(control).getAttribute('aria-label')).toBe('Reproduir');
    await player.video.play();
    expect(inner(control).getAttribute('aria-label')).toBe('Pausa');
    control.removeAttribute('label-pause');
    expect(inner(control).getAttribute('aria-label')).toBe('Pause');
  });

  it('takes a glyph the page slots in, and hides its own from the accessibility tree', async () => {
    const player = await custom();
    const control = playButton(player);
    const own = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    own.setAttribute('slot', 'icon-play');
    control.append(own);
    const slot = control.shadowRoot?.querySelector('slot[name="icon-play"]') as HTMLSlotElement;
    expect(slot.assignedElements()).toEqual([own]);
    for (const svg of control.shadowRoot?.querySelectorAll('svg') ?? []) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('part')).toBe('icon');
    }
  });
});

describe('the rows of the bar', () => {
  it('puts a child with slot="seek" in the seek row and the rest in the buttons row, in order', async () => {
    const player = await custom();
    const root = bar(player) as MbxControlBar;
    const seek = document.createElement('div');
    seek.slot = 'seek';
    const spacer = document.createElement('mbx-spacer');
    const other = document.createElement('div');
    root.append(seek, spacer, other);
    const slots = root.shadowRoot?.querySelectorAll('slot') ?? [];
    const named = [...slots].find((slot) => slot.name === 'seek') as HTMLSlotElement;
    const rest = [...slots].find((slot) => slot.name === '') as HTMLSlotElement;
    expect(named.assignedElements().slice(-1)).toEqual([seek]);
    const buttons = rest.assignedElements();
    expect(buttons).toContain(playButton(player));
    expect(buttons.slice(-2)).toEqual([spacer, other]);
    expect(getComputedStyle(spacer).flexGrow).toBe('1');
  });
});

describe('the bar while idle', () => {
  it('hides after idle-ms of stillness while playing, and wakes on pointer movement', async () => {
    const player = await ready();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await player.video.play();
    expect(idle(player)).toBe(false);

    vi.advanceTimersByTime(IDLE_MS);
    expect(idle(player)).toBe(true);
    expect(player.hasAttribute('idle')).toBe(true);

    move(player.video);
    expect(idle(player)).toBe(false);
    expect(player.hasAttribute('idle')).toBe(false);
  });

  it('takes the delay from its idle-ms attribute', async () => {
    const player = await ready();
    bar(player)?.setAttribute('idle-ms', '500');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await player.video.play();
    vi.advanceTimersByTime(500);
    expect(idle(player)).toBe(true);
  });

  it('never hides while paused', async () => {
    const player = await custom();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    move(player.video);
    vi.advanceTimersByTime(IDLE_MS * 2);
    expect(idle(player)).toBe(false);
  });

  it('holds while keyboard focus is inside it, and lets go once a pointer takes over', async () => {
    const player = await ready();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await player.video.play();
    const play = inner(playButton(player));
    // A key, then focus inside: a keyboard user reading the bar.
    player.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    play.focus();
    vi.advanceTimersByTime(IDLE_MS * 2);
    expect(idle(player)).toBe(false);

    // A pointer press, with focus still on the button: a mouse user who clicked it.
    play.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    vi.advanceTimersByTime(IDLE_MS);
    expect(idle(player)).toBe(true);
  });

  it('is not held by the pointer leaving: the timer alone hides it', async () => {
    const player = await ready();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await player.video.play();
    move(player.video);
    player.dispatchEvent(new PointerEvent('pointerleave'));
    expect(idle(player)).toBe(false);
    vi.advanceTimersByTime(IDLE_MS);
    expect(idle(player)).toBe(true);
  });

  it('holds while a descendant carries open, and hides once it does not', async () => {
    const player = await ready();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await player.video.play();
    const popup = document.createElement('div');
    popup.setAttribute('open', '');
    bar(player)?.append(popup);
    vi.advanceTimersByTime(IDLE_MS * 2);
    expect(idle(player)).toBe(false);
    popup.removeAttribute('open');
    vi.advanceTimersByTime(IDLE_MS);
    expect(idle(player)).toBe(true);
  });

  it('stops listening once the bar is removed, and clears its state from the player', async () => {
    const player = await ready();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await player.video.play();
    vi.advanceTimersByTime(IDLE_MS);
    expect(player.hasAttribute('idle')).toBe(true);
    const root = bar(player) as MbxControlBar;
    root.remove();
    expect(player.hasAttribute('idle')).toBe(false);
    move(player.video);
    expect(root.hasAttribute('idle')).toBe(false);
  });
});

describe('the shortcuts', () => {
  it('gives the element a tabindex under custom controls, and takes it back', async () => {
    const player = mount();
    await settled();
    expect(player.hasAttribute('tabindex')).toBe(false);
    player.setAttribute('controls', 'custom');
    expect(player.getAttribute('tabindex')).toBe('0');
    player.setAttribute('controls', 'native');
    expect(player.hasAttribute('tabindex')).toBe(false);
    player.setAttribute('tabindex', '-1');
    player.setAttribute('controls', 'custom');
    expect(player.getAttribute('tabindex')).toBe('-1');
  });

  it('toggles play with k and Space, and unmutes with m, from anywhere inside', async () => {
    const player = await ready(10);
    press(player, 'k');
    await once(player.video, 'play');
    press(player.video, ' ');
    await once(player.video, 'pause');
    press(player, 'm');
    await once(player.video, 'volumechange');
    expect(player.video.muted).toBe(false);
  });

  it('mutes with m', async () => {
    const player = await loaded();
    press(player, 'm');
    await once(player.video, 'volumechange');
    expect(player.video.muted).toBe(true);
  });

  it('leaves Space to a focused button', async () => {
    const player = await ready();
    const button = inner(playButton(player));
    button.focus();
    press(button, ' ');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(player.video.paused).toBe(true);
  });

  it('seeks by the step with the arrows, from seek-step on the bar', async () => {
    const player = await ready(30);
    press(player, 'ArrowRight');
    expect(player.video.currentTime).toBe(5);
    bar(player)?.setAttribute('seek-step', '10');
    press(player, 'ArrowRight');
    expect(player.video.currentTime).toBe(15);
    press(player, 'ArrowLeft');
    expect(player.video.currentTime).toBe(5);
  });

  it('ignores keys with a modifier, and keys pressed outside the element', async () => {
    const player = await ready();
    player.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    press(document.body, 'k');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(player.video.paused).toBe(true);
  });

  it('asks the player for fullscreen on f', async () => {
    const player = mount({ muted: '' });
    let asked = 0;
    player.requestFullscreen = () => {
      asked += 1;
      return Promise.resolve();
    };
    player.setAttribute('controls', 'custom');
    await settled();
    press(player, 'f');
    expect(asked).toBe(1);
  });

  it('toggles play on a click on the video, and not on a click on the bar', async () => {
    const player = await ready(10);
    player.video.click();
    await once(player.video, 'play');
    (bar(player) as MbxControlBar).click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(player.video.paused).toBe(false);
    player.video.click();
    await once(player.video, 'pause');
  });
});

describe('the subtitles and the bar', () => {
  it('puts the cue rules in the document once, one per look the attributes can take', async () => {
    await custom();
    const styles = document.head.querySelectorAll('style[data-mattebox-cue]');
    expect(styles.length).toBe(1);
    const text = styles[0]?.textContent ?? '';
    expect(text).toContain('mattebox-player[subtitle-size="large"] > video::cue');
    // The background goes on the cue and on the backdrop Chromium and WebKit paint, both.
    expect(text).toContain(
      'mattebox-player[subtitle-background="none"] > video::-webkit-media-text-track-display-backdrop',
    );
    expect(text).toContain('mattebox-player[subtitle-background="none"] > video::cue');
    expect(text).not.toContain('@supports');
    // Percentages of the browser's own cue size, which follows the video's height.
    expect(text).toMatch(/subtitle-size="large"[^}]*font-size: 150%/);
    expect(text).not.toContain('var(');
    await custom();
    expect(document.head.querySelectorAll('style[data-mattebox-cue]').length).toBe(1);
  });
});

/** The first control of a tag inside the player. */
function control<K extends keyof HTMLElementTagNameMap>(
  player: MatteboxPlayerElement,
  tag: K,
): HTMLElementTagNameMap[K] {
  const node = player.querySelector(tag);
  if (node === null) throw new Error(`no ${tag}`);
  return node;
}

/** The path data of the glyph a slot falls back to. */
function fallbackGlyph(node: HTMLElement, slot: string): string {
  return node.shadowRoot?.querySelector(`slot[name="${slot}"] svg path`)?.getAttribute('d') ?? '';
}

describe('the default composition', () => {
  it('carries the screens and the bar with every button, in order', async () => {
    const player = await custom();
    expect([...player.children].map((node) => node.localName)).toEqual([
      'video',
      'mbx-start-button',
      'mbx-error-screen',
      'mbx-control-bar',
    ]);
    const root = bar(player) as MbxControlBar;
    expect([...root.children].map((node) => node.localName)).toEqual([
      'mbx-current-time',
      'mbx-seek-bar',
      'mbx-duration',
      'mbx-live-button',
      'mbx-skip-button',
      'mbx-play-button',
      'mbx-skip-button',
      'mbx-volume',
      'mbx-spacer',
      'mbx-speed-menu',
      'mbx-chapters-menu',
      'mbx-subtitles-menu',
      'mbx-audio-menu',
      'mbx-quality-menu',
      'mbx-pip-button',
      'mbx-fullscreen-button',
    ]);
    expect(root.children[4]?.getAttribute('seconds')).toBe('-10');
    expect(root.children[6]?.getAttribute('seconds')).toBe('10');
  });

  it('names every button, and hides every glyph from the accessibility tree', async () => {
    const player = await custom();
    for (const node of player.querySelectorAll('*')) {
      const shadow = node.shadowRoot;
      if (shadow === null) continue;
      for (const button of shadow.querySelectorAll('button')) {
        expect(button.getAttribute('aria-label') ?? button.textContent).not.toBe('');
      }
      for (const svg of shadow.querySelectorAll('svg')) {
        expect(svg.getAttribute('aria-hidden')).toBe('true');
        expect(svg.getAttribute('part')).toBe('icon');
      }
    }
  });
});

describe('the mute button', () => {
  it('mutes and unmutes, with the pressed state, the name and the glyph', async () => {
    const player = await custom();
    const mute = control(player, 'mbx-mute-button');
    const button = inner(mute);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Mute');
    expect(shown(mute)).toBe('icon-high');

    button.click();
    await once(player.video, 'volumechange');
    expect(player.video.muted).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Unmute');
    expect(shown(mute)).toBe('icon-mute');
    expect(player.hasAttribute('muted')).toBe(true);
  });

  it('draws the level in the glyph', async () => {
    const player = await custom();
    const mute = control(player, 'mbx-mute-button');
    player.video.volume = 0.3;
    await once(player.video, 'volumechange');
    expect(shown(mute)).toBe('icon-low');
    player.video.volume = 0;
    await once(player.video, 'volumechange');
    expect(shown(mute)).toBe('icon-mute');
    expect(inner(mute).getAttribute('aria-label')).toBe('Unmute');
  });

  it('brings the volume up when unmuting at zero', async () => {
    const player = await custom({ muted: '' });
    player.video.volume = 0;
    await once(player.video, 'volumechange');
    inner(control(player, 'mbx-mute-button')).click();
    await once(player.video, 'volumechange');
    expect(player.video.muted).toBe(false);
    expect(player.video.volume).toBe(1);
  });

  it('takes its names from the label attributes', async () => {
    const player = await custom();
    const mute = control(player, 'mbx-mute-button');
    mute.setAttribute('label-mute', 'Silenciar');
    expect(inner(mute).getAttribute('aria-label')).toBe('Silenciar');
  });
});

describe('the volume slider', () => {
  it('moves the volume with the keys and reads it back', async () => {
    const player = await custom();
    const volume = control(player, 'mbx-volume-slider');
    const knob = volume.shadowRoot?.querySelector('[role="slider"]') as HTMLElement;
    expect(knob.getAttribute('aria-label')).toBe('Volume');
    expect(knob.getAttribute('aria-valuenow')).toBe('1');

    press(knob, 'ArrowLeft');
    await once(player.video, 'volumechange');
    expect(player.video.volume).toBeCloseTo(0.95, 5);
    expect(knob.getAttribute('aria-valuenow')).toBe('0.95');
    expect(knob.getAttribute('aria-valuetext')).toBe('95%');

    press(knob, 'Home');
    await once(player.video, 'volumechange');
    expect(player.video.volume).toBe(0);
    press(knob, 'PageUp');
    await once(player.video, 'volumechange');
    expect(player.video.volume).toBeCloseTo(0.2, 5);

    volume.setAttribute('step', '0.5');
    press(knob, 'ArrowRight');
    await once(player.video, 'volumechange');
    expect(player.video.volume).toBeCloseTo(0.7, 5);
  });

  it('sets the volume where the pointer lands, unmutes, and carries dragging meanwhile', async () => {
    const player = await custom({ muted: '' });
    const volume = control(player, 'mbx-volume-slider');
    const knob = volume.shadowRoot?.querySelector('[role="slider"]') as HTMLElement;
    const rail = volume.shadowRoot?.querySelector('[part~="rail"]') as HTMLElement;
    // The slider unfolds from its group under the pointer or focus.
    inner(control(player, 'mbx-mute-button')).focus();
    await expect.poll(() => rail.getBoundingClientRect().width).toBeGreaterThan(40);
    const rect = rail.getBoundingClientRect();
    knob.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: rect.left + rect.width * 0.25,
        clientY: rect.top + rect.height / 2,
      }),
    );
    expect(volume.hasAttribute('dragging')).toBe(true);
    await once(player.video, 'volumechange');
    expect(player.video.volume).toBeCloseTo(0.25, 1);
    expect(player.video.muted).toBe(false);
    knob.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: rect.left }));
    expect(volume.hasAttribute('dragging')).toBe(false);
  });

  it('shows zero while muted, and takes its name from the label attribute', async () => {
    const player = await custom({ muted: '' });
    const volume = control(player, 'mbx-volume-slider');
    const knob = volume.shadowRoot?.querySelector('[role="slider"]') as HTMLElement;
    expect(knob.getAttribute('aria-valuenow')).toBe('0');
    volume.setAttribute('label', 'Volum');
    expect(knob.getAttribute('aria-label')).toBe('Volum');
  });
});

describe('the volume group', () => {
  it('fills itself with the mute button and the slider, and unfolds the slider on focus', async () => {
    const player = await custom();
    const group = control(player, 'mbx-volume');
    expect([...group.children].map((node) => node.localName)).toEqual([
      'mbx-mute-button',
      'mbx-volume-slider',
    ]);
    const slider = control(player, 'mbx-volume-slider');
    await expect.poll(() => slider.getBoundingClientRect().width).toBe(0);
    inner(control(player, 'mbx-mute-button')).focus();
    await expect.poll(() => slider.getBoundingClientRect().width).toBeGreaterThan(40);
    inner(control(player, 'mbx-mute-button')).blur();
    await expect.poll(() => slider.getBoundingClientRect().width).toBe(0);
  });

  it('stays folded after a click on the mute button, and unfolds again for the keyboard', async () => {
    const player = await custom();
    const mute = inner(control(player, 'mbx-mute-button'));
    const slider = control(player, 'mbx-volume-slider');
    // A click: the press, then the focus the browser gives the button.
    mute.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    mute.focus();
    mute.click();
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(slider.getBoundingClientRect().width).toBe(0);
    // A key with focus still inside: a keyboard user, and the slider is theirs to reach.
    mute.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true }));
    await expect.poll(() => slider.getBoundingClientRect().width).toBeGreaterThan(40);
    mute.blur();
    await expect.poll(() => slider.getBoundingClientRect().width).toBe(0);
  });

  it('leaves the parts a page wrote alone', async () => {
    const player = await custom();
    const group = document.createElement('mbx-volume');
    const own = document.createElement('mbx-volume-slider');
    own.setAttribute('label', 'Volum');
    group.append(own);
    bar(player)?.append(group);
    expect([...group.children]).toEqual([own]);
  });
});

describe('the skip buttons', () => {
  it('move the playhead by their seconds, back and forward', async () => {
    const player = await ready(30);
    const [back, forward] = [...player.querySelectorAll('mbx-skip-button')];
    expect(inner(back as HTMLElement).getAttribute('aria-label')).toBe('Back 10 seconds');
    expect(inner(forward as HTMLElement).getAttribute('aria-label')).toBe('Forward 10 seconds');
    inner(forward as HTMLElement).click();
    expect(player.video.currentTime).toBe(10);
    inner(forward as HTMLElement).click();
    expect(player.video.currentTime).toBe(20);
    inner(back as HTMLElement).click();
    expect(player.video.currentTime).toBe(10);
    // Never past the ends.
    inner(back as HTMLElement).click();
    inner(back as HTMLElement).click();
    expect(player.video.currentTime).toBe(0);
  });

  it('take the amount from the attribute, with a plain arrow for an amount the set has no glyph for', async () => {
    const player = await ready(30);
    const forward = player.querySelectorAll('mbx-skip-button')[1] as HTMLElement;
    expect(fallbackGlyph(forward, 'icon')).toBe(
      icon('seek-forward-10').firstElementChild?.getAttribute('d'),
    );
    forward.setAttribute('seconds', '30');
    expect(fallbackGlyph(forward, 'icon')).toBe(
      icon('seek-forward-30').firstElementChild?.getAttribute('d'),
    );
    expect(inner(forward).getAttribute('aria-label')).toBe('Forward 30 seconds');
    forward.setAttribute('seconds', '15');
    expect(fallbackGlyph(forward, 'icon')).toBe(
      icon('seek-forward').firstElementChild?.getAttribute('d'),
    );
    inner(forward).click();
    expect(player.video.currentTime).toBe(15);
  });

  it('fill the amount into a label the page wrote', async () => {
    const player = await custom();
    const back = control(player, 'mbx-skip-button');
    back.setAttribute('label', 'Enrere {seconds} segons');
    expect(inner(back).getAttribute('aria-label')).toBe('Enrere 10 segons');
  });
});

describe('the fullscreen button', () => {
  it('shows exactly when an API exists, and is named', async () => {
    const player = await custom();
    const button = control(player, 'mbx-fullscreen-button');
    const host: object = player;
    const video: object = player.video;
    const supported =
      'requestFullscreen' in host ||
      'webkitRequestFullscreen' in host ||
      'webkitEnterFullscreen' in video;
    expect(button.hidden).toBe(!supported);
    expect(inner(button).getAttribute('aria-label')).toBe('Enter fullscreen');
  });

  it('asks the player for fullscreen, and swaps its glyph and name with the state', async () => {
    const player = mount({ muted: '' });
    if (typeof player.requestFullscreen !== 'function') return;
    let inside = false;
    player.requestFullscreen = () => {
      inside = true;
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    };
    const matches = player.matches.bind(player);
    player.matches = (selector: string) =>
      selector === ':fullscreen' ? inside : matches(selector);
    player.setAttribute('controls', 'custom');
    await settled();
    const button = control(player, 'mbx-fullscreen-button');
    inner(button).click();
    expect(inside).toBe(true);
    expect(inner(button).getAttribute('aria-label')).toBe('Exit fullscreen');
    expect(shown(button)).toBe('icon-exit');
    expect(player.hasAttribute('fullscreen')).toBe(true);
  });
});

describe('the picture-in-picture button', () => {
  it('shows exactly when an API exists, and swaps its glyph and name with the state', async () => {
    const player = await custom();
    const button = control(player, 'mbx-pip-button');
    const video: object = player.video;
    const supported =
      ('requestPictureInPicture' in video && document.pictureInPictureEnabled) ||
      'webkitSetPresentationMode' in video;
    expect(button.hidden).toBe(!supported);
    expect(inner(button).getAttribute('aria-label')).toBe('Picture in picture');
    if (!('requestPictureInPicture' in video) || !document.pictureInPictureEnabled) return;

    // The standard API, stubbed: the request resolves and the video says it is in.
    let inside = false;
    Object.defineProperty(document, 'pictureInPictureElement', {
      configurable: true,
      get: () => (inside ? player.video : null),
    });
    player.video.requestPictureInPicture = () => {
      inside = true;
      player.video.dispatchEvent(new Event('enterpictureinpicture'));
      return Promise.resolve({} as PictureInPictureWindow);
    };
    inner(button).click();
    expect(inner(button).getAttribute('aria-label')).toBe('Leave picture in picture');
    expect(shown(button)).toBe('icon-exit');
    expect(player.hasAttribute('pip')).toBe(true);
    delete (document as { pictureInPictureElement?: unknown }).pictureInPictureElement;
  });
});

describe('the start button', () => {
  it('shows a large play while paused, and nothing while playing', async () => {
    const player = await ready(10);
    const start = control(player, 'mbx-start-button');
    expect(start.assignedSlot?.parentElement?.getAttribute('part')).toBe('stage');
    expect(start.hidden).toBe(false);
    expect(inner(start).getAttribute('aria-label')).toBe('Play');

    inner(start).click();
    await once(player.video, 'play');
    expect(start.hidden).toBe(true);
    player.video.pause();
    await once(player.video, 'pause');
    expect(start.hidden).toBe(false);
  });

  it('offers a replay once the media has ended', async () => {
    const player = await ready();
    const start = control(player, 'mbx-start-button');
    await player.video.play();
    await media(player.video).end();
    expect(start.hidden).toBe(false);
    expect(inner(start).getAttribute('aria-label')).toBe('Replay');
    expect(shown(start)).toBe('icon-replay');
  });

  it('takes its names from the label attributes', async () => {
    const player = await custom();
    const start = control(player, 'mbx-start-button');
    start.setAttribute('label-play', 'Reproduir');
    expect(inner(start).getAttribute('aria-label')).toBe('Reproduir');
  });
});

describe('the error screen', () => {
  const failing = { src: 'https://cdn.test/a.m3u8', type: 'application/x-nonsense' };

  function text(screen: HTMLElement, part: string): string {
    return screen.shadowRoot?.querySelector(`[part~="${part}"]`)?.textContent ?? '';
  }

  it('shows a fatal error over the picture, not in the row under it, and clears on the next load', async () => {
    const player = await custom(failing);
    const screen = control(player, 'mbx-error-screen');
    await expect.poll(() => screen.hidden).toBe(false);
    expect(screen.assignedSlot?.parentElement?.getAttribute('part')).toBe('stage');
    expect(screen.getAttribute('role')).toBe('alert');
    expect(text(screen, 'code')).toBe('MANIFEST_UNSUPPORTED');
    expect(text(screen, 'category')).toBe('manifest');
    expect(text(screen, 'title')).toBe('Playback failed');
    expect(text(screen, 'retry')).toBe('Retry');
    expect(control(player, 'mbx-start-button').hidden).toBe(true);
    expect(player.error?.code).toBe('MANIFEST_UNSUPPORTED');
    // The row under the video is the native mode's, and stays quiet.
    expect(player.shadowRoot?.querySelector<HTMLElement>('[part~="error"]')?.hidden).toBe(true);

    let loads = 0;
    player.addEventListener('sourcechange', () => {
      loads += 1;
    });
    player.setAttribute('type', 'audio/wav');
    player.setAttribute('src', silence());
    await expect.poll(() => loads).toBe(1);
    expect(screen.hidden).toBe(true);
    expect(player.error).toBeNull();
    expect(control(player, 'mbx-start-button').hidden).toBe(false);
  });

  it('shows an error that came before it did', async () => {
    const player = mount({ controls: 'custom', ...failing });
    await expect.poll(() => player.error).not.toBeNull();
    const screen = document.createElement('mbx-error-screen');
    player.append(screen);
    expect(screen.hidden).toBe(false);
    expect(text(screen, 'code')).toBe('MANIFEST_UNSUPPORTED');
  });

  it('clears when a source that plays follows one that failed, and shows again for one that fails', async () => {
    const player = await custom(failing);
    const screen = control(player, 'mbx-error-screen');
    await expect.poll(() => screen.hidden).toBe(false);

    // The demo clears the source, sets what describes the next one, then sets it.
    let loads = 0;
    player.addEventListener('sourcechange', () => {
      loads += 1;
    });
    player.removeAttribute('src');
    player.setAttribute('type', 'audio/wav');
    player.setAttribute('src', silence());
    await expect.poll(() => loads).toBe(1);
    expect(screen.hidden).toBe(true);

    player.removeAttribute('src');
    player.setAttribute('type', 'application/x-nonsense');
    player.setAttribute('src', 'https://cdn.test/b.m3u8');
    await expect.poll(() => screen.hidden).toBe(false);
    expect(text(screen, 'code')).toBe('MANIFEST_UNSUPPORTED');
  });

  it('loads the source again from the retry, and takes its texts from the label attributes', async () => {
    const player = await custom(failing);
    const screen = control(player, 'mbx-error-screen');
    await expect.poll(() => screen.hidden).toBe(false);
    screen.setAttribute('label-title', 'Error de reproducció');
    screen.setAttribute('label-retry', 'Torna-ho a provar');
    expect(text(screen, 'title')).toBe('Error de reproducció');
    expect(text(screen, 'retry')).toBe('Torna-ho a provar');
    let errors = 0;
    player.addEventListener('error', () => {
      errors += 1;
    });
    const retry = screen.shadowRoot?.querySelector('[part~="retry"]');
    if (!(retry instanceof HTMLButtonElement)) throw new Error('no retry');
    retry.click();
    await expect.poll(() => errors).toBe(1);
    expect(screen.hidden).toBe(false);
  });
});

/** A live namespace: the window is what the video reports seekable, zero to the duration. */
function liveApi(
  edge: number | null,
  atEdge = false,
): LiveApi & { seeks: number; atEdge: boolean } {
  const api = {
    edge,
    latency: null,
    atEdge,
    seeks: 0,
    seekToEdge(): void {
      api.seeks += 1;
    },
  };
  return api;
}

interface FakeParts {
  readonly live?: LiveApi;
  readonly pdt?: PdtApi;
  readonly thumbnails?: ThumbnailsApi;
  bufferGoal?: number;
}

/** An engine of the namespaces the row reads, and what the panels under native controls touch. */
function fakeEngine(parts: FakeParts): Mattebox {
  return {
    on: () => () => undefined,
    quality: { renditions: [], pinned: null, playing: null, auto() {}, pin() {} },
    tracks: { available: [], active: () => null, select() {} },
    stats: { snapshot: () => ({ scheduling: { bufferGoal: parts.bufferGoal ?? 30 } }) },
    ...(parts.live === undefined ? {} : { live: parts.live }),
    ...(parts.pdt === undefined ? {} : { pdt: parts.pdt }),
    ...(parts.thumbnails === undefined ? {} : { thumbnails: parts.thumbnails }),
  } as unknown as Mattebox;
}

/** A handler that claims the source and hands the element a fake engine, touching no video. */
function fakeHandler(engine: Mattebox): Handler {
  return {
    name: 'fake',
    canHandle: () => 'probably',
    handle: () => Promise.resolve({ handler: 'fake', engine, dispose: () => Promise.resolve() }),
  };
}

/** The element over `handlers` under custom controls, once the session is in. */
async function over(
  handlers: readonly Handler[],
  attributes: Readonly<Record<string, string>> = {},
): Promise<MatteboxPlayerElement> {
  const player = build(handlers, { controls: 'custom', src: SOURCE, ...attributes });
  await settled();
  await expect.poll(() => player.engine).not.toBeNull();
  return player;
}

/** The element over a fake engine session, with the metadata of a clip `seconds` long in. */
async function session(parts: FakeParts, seconds = 10): Promise<MatteboxPlayerElement> {
  const player = await over([fakeHandler(fakeEngine(parts))], { muted: '' });
  await media(player.video).metadata(seconds);
  return player;
}

/** Asks every reader of the row to look again, the way the clock does. */
function tickClock(player: MatteboxPlayerElement): void {
  player.video.dispatchEvent(new Event('timeupdate'));
}

function knob(node: HTMLElement): HTMLElement {
  return node.shadowRoot?.querySelector('[role="slider"]') as HTMLElement;
}

function inside(node: HTMLElement, part: string): HTMLElement {
  return node.shadowRoot?.querySelector(`[part~="${part}"]`) as HTMLElement;
}

describe('the seek row', () => {
  it('holds the times, the seek bar and the live button, in the seek row by default', async () => {
    const player = await custom();
    const root = bar(player) as MbxControlBar;
    const named = [...(root.shadowRoot?.querySelectorAll('slot') ?? [])].find(
      (slot) => slot.name === 'seek',
    ) as HTMLSlotElement;
    expect(named.assignedElements().map((node) => node.localName)).toEqual([
      'mbx-current-time',
      'mbx-seek-bar',
      'mbx-duration',
      'mbx-live-button',
    ]);
    // A page's own slot wins.
    const time = document.createElement('mbx-current-time');
    time.slot = '';
    root.append(time);
    expect(time.getAttribute('slot')).toBe('');
  });
});

describe('the times', () => {
  /** The readout alone: the shadow root holds the style too. */
  const text = (node: HTMLElement) =>
    [...(node.shadowRoot?.childNodes ?? [])]
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .map((child) => child.textContent ?? '')
      .join('')
      .trim();

  it('show the position and the duration once the metadata is in', async () => {
    const player = await ready(10);
    const current = control(player, 'mbx-current-time');
    const duration = control(player, 'mbx-duration');
    expect(text(current)).toBe('0:00');
    expect(text(duration)).toBe('0:10');
    expect(duration.hidden).toBe(false);
    player.video.currentTime = 3;
    await once(player.video, 'seeked');
    expect(text(current)).toBe('0:03');
  });

  it('read the distance behind the edge on a live stream, the wall clock when pdt can say it, and no duration', async () => {
    const player = await session({ live: liveApi(8), bufferGoal: 2 });
    expect(control(player, 'mbx-duration').hidden).toBe(true);
    expect(text(control(player, 'mbx-current-time'))).toBe('-0:10');

    const clocked = await session({
      live: liveApi(8),
      bufferGoal: 2,
      pdt: {
        toWallClock: (t: number) => 1_700_000_000 + t,
        toPresentationTime: (wall: number) => wall - 1_700_000_000,
      },
    });
    const expected = new Date(1_700_000_000 * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    expect(text(control(clocked, 'mbx-current-time'))).toBe(expected);
  });

  it('hide the position while the stream is live and not seekable', async () => {
    // Ten seconds over a 30 s goal: a third of one goal, nowhere to go.
    const player = await session({ live: liveApi(8), bufferGoal: 30 });
    await expect.poll(() => player.hasAttribute('seekable')).toBe(false);
    expect(control(player, 'mbx-current-time').hidden).toBe(true);
  });
});

describe('the seek bar', () => {
  it('maps the duration once the metadata is in, and reads the position', async () => {
    const player = await ready(10);
    const seek = knob(control(player, 'mbx-seek-bar'));
    expect(seek.getAttribute('aria-label')).toBe('Seek');
    expect(seek.getAttribute('aria-valuemin')).toBe('0');
    expect(seek.getAttribute('aria-valuemax')).toBe('10');
    expect(seek.getAttribute('aria-valuenow')).toBe('0');
    expect(seek.getAttribute('aria-valuetext')).toBe('0:00 of 0:10');
    expect(player.hasAttribute('seekable')).toBe(true);
    expect(player.hasAttribute('live')).toBe(false);
  });

  it('seeks with the keys, by step and page from the attributes', async () => {
    const player = await ready(30);
    const element = control(player, 'mbx-seek-bar');
    const seek = knob(element);
    press(seek, 'ArrowRight');
    await once(player.video, 'seeked');
    expect(player.video.currentTime).toBeCloseTo(5, 1);
    press(seek, 'PageUp');
    await once(player.video, 'seeked');
    expect(player.video.currentTime).toBeCloseTo(30, 1);
    press(seek, 'Home');
    await once(player.video, 'seeked');
    expect(player.video.currentTime).toBeCloseTo(0, 1);
    element.setAttribute('step', '10');
    press(seek, 'ArrowRight');
    await once(player.video, 'seeked');
    expect(player.video.currentTime).toBeCloseTo(10, 1);
  });

  it('seeks where the pointer lands, and the played layer follows the pointer meanwhile', async () => {
    const player = await ready(10);
    const element = control(player, 'mbx-seek-bar');
    const seek = knob(element);
    const rect = inside(element, 'rail').getBoundingClientRect();
    expect(rect.width).toBeGreaterThan(0);
    const y = rect.top + rect.height / 2;
    seek.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: rect.left + rect.width * 0.5,
        clientY: y,
      }),
    );
    expect(element.hasAttribute('dragging')).toBe(true);
    expect(inside(element, 'fill').style.width).toBe('50%');
    seek.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        clientX: rect.left + rect.width * 0.8,
        clientY: y,
      }),
    );
    expect(element.hasAttribute('dragging')).toBe(false);
    await once(player.video, 'seeked');
    expect(player.video.currentTime).toBeCloseTo(8, 0);
  });

  it('draws the buffered ranges on the track', async () => {
    const player = await ready(10);
    const element = control(player, 'mbx-seek-bar');
    expect(inside(element, 'buffered-range').style.width).toBe('100%');
    await media(player.video).buffer(6);
    expect(inside(element, 'buffered-range').style.width).toBe('60%');
  });

  it('shows the hover time above the pointer', async () => {
    const player = await ready(10);
    const element = control(player, 'mbx-seek-bar');
    const rect = inside(element, 'rail').getBoundingClientRect();
    knob(element).dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + rect.width * 0.25,
        clientY: rect.top + rect.height / 2,
      }),
    );
    expect(inside(element, 'hover').hidden).toBe(false);
    expect(inside(element, 'hover').style.left).toBe('25%');
    expect(inside(element, 'preview').hidden).toBe(false);
    expect(inside(element, 'preview-time').textContent).toBe('0:02');
    expect(inside(element, 'preview-image').hidden).toBe(true);
    knob(element).dispatchEvent(new PointerEvent('pointerleave'));
    expect(inside(element, 'hover').hidden).toBe(true);
    expect(inside(element, 'preview').hidden).toBe(true);
  });

  it('shows no live edge and no live button without a live session', async () => {
    const player = await ready(10);
    expect(inside(control(player, 'mbx-seek-bar'), 'edge').hidden).toBe(true);
    expect(control(player, 'mbx-live-button').hidden).toBe(true);
  });

  it('takes what a screen reader hears from the label attributes', async () => {
    const player = await ready(10);
    const element = control(player, 'mbx-seek-bar');
    element.setAttribute('label', 'Cerca');
    element.setAttribute('label-of', '{current} de {duration}');
    expect(knob(element).getAttribute('aria-label')).toBe('Cerca');
    expect(knob(element).getAttribute('aria-valuetext')).toBe('0:00 de 0:10');
  });
});

describe('the seek bar over a live session', () => {
  it('maps the seekable window, marks the edge, reads the distance behind it, and says so on the player', async () => {
    // A 10 s window over a 2 s goal is five goals: worth a bar.
    const player = await session({ live: liveApi(8), bufferGoal: 2 });
    const element = control(player, 'mbx-seek-bar');
    expect(player.hasAttribute('live')).toBe(true);
    expect(player.hasAttribute('seekable')).toBe(true);
    expect(element.hidden).toBe(false);
    expect(inside(element, 'edge').hidden).toBe(false);
    expect(inside(element, 'edge').style.left).toBe('80%');
    expect(knob(element).getAttribute('aria-valuetext')).toBe('0:10 behind live');
    element.setAttribute('label-behind', '{time} darrere del directe');
    expect(knob(element).getAttribute('aria-valuetext')).toBe('0:10 darrere del directe');
  });

  it('hides the bar while the window is under live-window goals, and shows it past it', async () => {
    const parts: FakeParts = { live: liveApi(8), bufferGoal: 30 };
    const player = await session(parts);
    const element = control(player, 'mbx-seek-bar');
    expect(player.hasAttribute('seekable')).toBe(false);
    expect(element.hidden).toBe(true);

    parts.bufferGoal = 3;
    tickClock(player);
    expect(player.hasAttribute('seekable')).toBe(true);
    expect(element.hidden).toBe(false);

    // At zero every live stream is seekable.
    parts.bufferGoal = 30;
    element.setAttribute('live-window', '0');
    expect(player.hasAttribute('seekable')).toBe(true);
  });

  it('drops live and seekable from the player when it leaves', async () => {
    const player = await session({ live: liveApi(8), bufferGoal: 2 });
    control(player, 'mbx-seek-bar').remove();
    expect(player.hasAttribute('live')).toBe(false);
    expect(player.hasAttribute('seekable')).toBe(false);
  });
});

describe('the live button', () => {
  it('shows once there is a window, disabled at the edge, seeking on click', async () => {
    const api = liveApi(null);
    const parts: FakeParts = { live: api, bufferGoal: 2 };
    const player = await session(parts);
    const button = control(player, 'mbx-live-button');
    expect(button.hidden).toBe(true);

    (api as { edge: number | null }).edge = 8;
    tickClock(player);
    expect(button.hidden).toBe(false);
    expect(inner(button).disabled).toBe(false);
    expect(inner(button).getAttribute('aria-label')).toBe('Go to the live edge');
    expect(inside(button, 'text').textContent).toBe('LIVE');
    inner(button).click();
    expect(api.seeks).toBe(1);

    api.atEdge = true;
    tickClock(player);
    expect(inner(button).disabled).toBe(true);
    expect(button.hasAttribute('at-edge')).toBe(true);
    expect(inner(button).getAttribute('aria-label')).toBe('At the live edge');
  });

  it('is red and inert without a seek bar to come back from', async () => {
    const player = await session({ live: liveApi(8), bufferGoal: 30 });
    const button = control(player, 'mbx-live-button');
    await expect.poll(() => button.hasAttribute('at-edge')).toBe(true);
    expect(inner(button).disabled).toBe(true);
  });

  it('takes its word and its names from the attributes', async () => {
    const player = await session({ live: liveApi(8), bufferGoal: 2 });
    const button = control(player, 'mbx-live-button');
    button.setAttribute('text', 'DIRECTE');
    button.setAttribute('label-live', 'Ves al directe');
    expect(inside(button, 'text').textContent).toBe('DIRECTE');
    expect(inner(button).getAttribute('aria-label')).toBe('Ves al directe');
  });
});

describe('the preview over a thumbnail track', () => {
  /** A track with one tile over the first ten seconds: a 320 by 180 rectangle at (320, 0) of a sprite. */
  function track(): ThumbnailsApi {
    const tile = {
      url: 'https://cdn.example/sprite.jpg',
      start: 0,
      end: 10,
      x: 320,
      y: 0,
      width: 320,
      height: 180,
    };
    return {
      load: () => Promise.resolve(1),
      at: (time: number) => (time >= 0 && time < 10 ? tile : null),
      all: [tile],
    };
  }

  function hover(element: HTMLElement, fraction: number): void {
    const rect = inside(element, 'rail').getBoundingClientRect();
    knob(element).dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + rect.width * fraction,
        clientY: rect.top + rect.height / 2,
      }),
    );
  }

  it('draws the tile above the pointer, scaled to the preview width', async () => {
    const player = await session({ thumbnails: track() });
    player.style.width = '600px';
    const element = control(player, 'mbx-seek-bar');
    hover(element, 0.5);
    const image = inside(element, 'preview-image');
    const tile = inside(element, 'preview-tile');
    expect(image.hidden).toBe(false);
    expect(image.style.width).toBe('160px');
    expect(image.style.height).toBe('90px');
    expect(tile.style.backgroundImage).toContain('sprite.jpg');
    expect(tile.style.backgroundPosition).toBe('-320px 0px');
    expect(tile.style.transform).toBe('scale(0.5)');
    expect(inside(element, 'preview-time').textContent).toBe('0:05');
  });

  it('honours --mbx-preview-width set on the player', async () => {
    const player = await session({ thumbnails: track() });
    player.style.setProperty('--mbx-preview-width', '320px');
    const element = control(player, 'mbx-seek-bar');
    hover(element, 0.5);
    expect(inside(element, 'preview-image').style.width).toBe('320px');
    expect(inside(element, 'preview-image').style.height).toBe('180px');
  });

  it('shows the time alone where the track has no tile', async () => {
    const player = await session({ thumbnails: track() }, 20);
    const element = control(player, 'mbx-seek-bar');
    hover(element, 0.75);
    expect(inside(element, 'preview-image').hidden).toBe(true);
    expect(inside(element, 'preview-time').textContent).toBe('0:15');
    hover(element, 0.25);
    expect(inside(element, 'preview-image').hidden).toBe(false);
  });
});

/** Every item of a menu's popup. */
function items(node: HTMLElement): HTMLButtonElement[] {
  return [
    ...(node.shadowRoot?.querySelectorAll<HTMLButtonElement>('[part~="popup"] button') ?? []),
  ];
}

function popup(node: HTMLElement): HTMLElement {
  return inside(node, 'popup');
}

describe('the speed menu', () => {
  it("offers the rates, marks the video's own, and writes a choice back", async () => {
    const player = await ready(10);
    const menu = control(player, 'mbx-speed-menu');
    expect(items(menu).map((item) => item.textContent)).toEqual([
      '0.5×',
      '0.75×',
      'Normal',
      '1.25×',
      '1.5×',
      '2×',
    ]);
    expect(items(menu).find((item) => item.getAttribute('aria-checked') === 'true')?.value).toBe(
      '1',
    );
    items(menu)
      .find((item) => item.value === '1.5')
      ?.click();
    await once(player.video, 'ratechange');
    expect(player.video.playbackRate).toBe(1.5);
    expect(items(menu).find((item) => item.getAttribute('aria-checked') === 'true')?.value).toBe(
      '1.5',
    );
  });

  it('takes the rates and the words from the attributes, and lists a rate of its own', async () => {
    const player = await ready(10);
    const menu = control(player, 'mbx-speed-menu');
    menu.setAttribute('rates', '1 2 4');
    menu.setAttribute('label-normal', 'Normal (1×)');
    menu.setAttribute('label', 'Velocitat');
    expect(items(menu).map((item) => item.textContent)).toEqual(['Normal (1×)', '2×', '4×']);
    expect(inner(menu).getAttribute('aria-label')).toBe('Velocitat');
    player.video.playbackRate = 3;
    await once(player.video, 'ratechange');
    expect(items(menu).map((item) => item.value)).toEqual(['1', '2', '4', '3']);
  });
});

describe('the menu primitive, through the speed menu', () => {
  it('names the button and the items the way a menu is named, and carries open while it shows', async () => {
    const player = await ready(10);
    const menu = control(player, 'mbx-speed-menu');
    const button = inner(menu);
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(popup(menu).getAttribute('role')).toBe('menu');
    expect(popup(menu).getAttribute('aria-label')).toBe('Playback speed');
    expect(items(menu).map((item) => item.getAttribute('role'))).toEqual(
      Array(6).fill('menuitemradio'),
    );
    expect(items(menu)[2]?.getAttribute('part')?.split(' ')).toContain('checked');
    // One tab stop: the checked item.
    expect(items(menu).map((item) => item.tabIndex)).toEqual([-1, -1, 0, -1, -1, -1]);

    button.click();
    expect(popup(menu).hidden).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(menu.hasAttribute('open')).toBe(true);
    expect(menu.shadowRoot?.activeElement).toBe(items(menu)[2]);
  });

  it('moves with the arrows, chooses on click, returns focus, and closes on Escape or a pointer elsewhere', async () => {
    const player = await ready(10);
    const menu = control(player, 'mbx-speed-menu');
    const button = inner(menu);
    const focused = () => menu.shadowRoot?.activeElement ?? null;
    button.click();
    press(popup(menu), 'ArrowDown');
    expect(focused()).toBe(items(menu)[3]);
    press(popup(menu), 'End');
    expect(focused()).toBe(items(menu)[5]);
    press(popup(menu), 'ArrowDown');
    expect(focused()).toBe(items(menu)[0]);
    (focused() as HTMLButtonElement).click();
    await once(player.video, 'ratechange');
    expect(player.video.playbackRate).toBe(0.5);
    expect(popup(menu).hidden).toBe(true);
    expect(menu.hasAttribute('open')).toBe(false);
    expect(focused()).toBe(button);

    button.click();
    press(popup(menu), 'Escape');
    expect(popup(menu).hidden).toBe(true);
    expect(focused()).toBe(button);

    button.click();
    expect(popup(menu).hidden).toBe(false);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(popup(menu).hidden).toBe(true);
  });

  it('holds the bar while open', async () => {
    const player = await ready(10);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await player.video.play();
    inner(control(player, 'mbx-speed-menu')).click();
    vi.advanceTimersByTime(IDLE_MS * 2);
    expect(idle(player)).toBe(false);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    vi.advanceTimersByTime(IDLE_MS);
    expect(idle(player)).toBe(true);
  });
});

/** An engine with tracks, and what the row and the panels read besides. */
function tracksEngine(
  available: ReadonlyArray<{ id: string; contentType: string; lang?: string; role?: string }>,
): Mattebox & { active: string | null; chosen: string[] } {
  const fake = {
    active: null as string | null,
    chosen: [] as string[],
    on: () => () => undefined,
    quality: { renditions: [], pinned: null, playing: null, auto() {}, pin() {} },
    stats: { snapshot: () => ({ scheduling: { bufferGoal: 30 } }) },
    tracks: {
      available,
      active: (contentType: string) =>
        available.find((track) => track.id === fake.active && track.contentType === contentType) ??
        null,
      select(id: string): void {
        fake.chosen.push(id);
        fake.active = id;
      },
      deselect(): void {
        fake.chosen.push('off');
        fake.active = null;
      },
    },
  };
  return fake as unknown as Mattebox & { active: string | null; chosen: string[] };
}

describe('the subtitles menu over a stubbed session', () => {
  const tracks = [
    { id: 'a-en', contentType: 'audio', lang: 'en', role: 'main' },
    { id: 't-en', contentType: 'text', lang: 'en' },
  ];

  it('offers off and the tracks under a heading, and a settings page behind them', async () => {
    const engine = tracksEngine(tracks);
    const player = await over([fakeHandler(engine)]);
    const menu = control(player, 'mbx-subtitles-menu');
    expect(menu.hidden).toBe(false);
    expect(shown(menu)).toBe('icon-off');
    const labels = () =>
      [...(menu.shadowRoot?.querySelectorAll('[part~="section-label"]') ?? [])].map(
        (node) => node.textContent,
      );
    expect(labels()).toEqual(['Track']);
    expect(items(menu).map((item) => item.textContent)).toEqual(['Off', 'en', 'Settings']);
    expect(items(menu)[2]?.getAttribute('aria-haspopup')).toBe('menu');

    inner(menu).click();
    items(menu)[1]?.click();
    expect(engine.chosen).toEqual(['t-en']);
    expect(shown(menu)).toBe('icon-on');

    // The looks sit on the Settings page behind the tracks, with a Back at its top.
    inner(menu).click();
    items(menu)[2]?.click();
    expect(labels()).toEqual(['Size', 'Background']);
    expect(items(menu)[0]?.getAttribute('part')?.split(' ')).toContain('back-item');
    expect(items(menu)[0]?.getAttribute('aria-label')).toBe('Back from Settings');
    const item = (group: string, value: string) =>
      items(menu).find(
        (node) =>
          node.getAttribute('part')?.split(' ').includes(`${group}-item`) && node.value === value,
      );
    expect(item('size', 'medium')?.getAttribute('aria-checked')).toBe('true');
    expect(item('background', 'dark')?.getAttribute('aria-checked')).toBe('true');
    item('size', 'large')?.click();
    expect(player.getAttribute('subtitle-size')).toBe('large');
    // A choice closes the menu back at its first page; the page shows the choice.
    inner(menu).click();
    items(menu)[2]?.click();
    expect(item('size', 'large')?.getAttribute('aria-checked')).toBe('true');
    item('background', 'none')?.click();
    expect(player.getAttribute('subtitle-background')).toBe('none');
  });

  it('reads a size the page set in markup, and every word from the attributes', async () => {
    const engine = tracksEngine(tracks);
    const player = await over([fakeHandler(engine)], { 'subtitle-size': 'xlarge' });
    const menu = control(player, 'mbx-subtitles-menu');
    menu.setAttribute('label-off', 'Cap');
    menu.setAttribute('label-settings', 'Opcions');
    menu.setAttribute('label-xlarge', 'Molt gran');
    menu.setAttribute('label-back', 'Torna de {page}');
    expect(items(menu).map((item) => item.textContent)).toEqual(['Cap', 'en', 'Opcions']);
    inner(menu).click();
    items(menu)[2]?.click();
    expect(items(menu)[0]?.getAttribute('aria-label')).toBe('Torna de Opcions');
    const checked = items(menu).find(
      (node) =>
        node.getAttribute('part')?.split(' ').includes('size-item') &&
        node.getAttribute('aria-checked') === 'true',
    );
    expect(checked?.value).toBe('xlarge');
    expect(checked?.textContent).toBe('Molt gran');
  });

  it('hides without text tracks, and the audio menu without a choice', async () => {
    const engine = tracksEngine([{ id: 'a-en', contentType: 'audio', lang: 'en' }]);
    const player = await over([fakeHandler(engine)]);
    expect(control(player, 'mbx-subtitles-menu').hidden).toBe(true);
    expect(control(player, 'mbx-audio-menu').hidden).toBe(true);
    expect(control(player, 'mbx-quality-menu').hidden).toBe(true);
  });

  it('hides for a native session', async () => {
    const player = mount({ controls: 'custom', muted: '', src: silence(), type: 'audio/wav' });
    await settled();
    await expect.poll(() => player.player?.session?.handler).toBe('native');
    expect(control(player, 'mbx-subtitles-menu').hidden).toBe(true);
    expect(control(player, 'mbx-audio-menu').hidden).toBe(true);
    expect(control(player, 'mbx-quality-menu').hidden).toBe(true);
    expect(control(player, 'mbx-speed-menu').hidden).toBe(false);
  });
});

describe('the DRM badge', () => {
  /** An engine with a DRM namespace, and what the rest of the composition reads. */
  function drmEngine(keySystem: string | null, sessions: Array<{ keyId: string; status: string }>) {
    const listeners: Array<() => void> = [];
    const fake = {
      drm: { keySystem, sessions, setLicenseUrl(): void {} },
      quality: { renditions: [], pinned: null, playing: null, auto() {}, pin() {} },
      tracks: { available: [], active: () => null, select() {} },
      stats: { snapshot: () => ({ scheduling: { bufferGoal: 30 } }) },
      on(_name: string, fn: () => void): () => void {
        listeners.push(fn);
        return () => undefined;
      },
    };
    return {
      fake: fake as unknown as Mattebox,
      fire(): void {
        for (const fn of listeners) fn();
      },
    };
  }

  async function badgeOver(engine: Mattebox): Promise<[MatteboxPlayerElement, HTMLElement]> {
    const player = await over([fakeHandler(engine)]);
    const badge = document.createElement('mbx-drm-badge');
    bar(player)?.append(badge);
    return [player, badge];
  }

  it('is hidden without a key system, and named and described with one', async () => {
    const { fake, fire } = drmEngine(null, []);
    const [, badge] = await badgeOver(fake);
    expect(badge.hidden).toBe(true);
    expect(badge.getAttribute('role')).toBe('img');
    expect(badge.tabIndex).toBe(0);

    (fake as unknown as { drm: { keySystem: string | null } }).drm.keySystem = 'com.widevine.alpha';
    fire();
    expect(badge.hidden).toBe(false);
    expect(badge.getAttribute('aria-label')).toBe('Protected by Widevine, no key yet');
  });

  it('shows the key system and the key statuses in a tooltip on hover and on focus', async () => {
    const { fake } = drmEngine('com.microsoft.playready', [
      { keyId: 'a', status: 'usable' },
      { keyId: 'b', status: 'usable' },
      { keyId: 'c', status: 'expired' },
    ]);
    const [, badge] = await badgeOver(fake);
    const tooltip = inside(badge, 'tooltip');
    expect(tooltip.hidden).toBe(true);
    expect(tooltip.textContent).toContain('PlayReady');
    expect(tooltip.textContent).toContain('com.microsoft.playready');
    expect(tooltip.textContent).toContain('3 keys: usable ×2, expired');

    badge.dispatchEvent(new PointerEvent('pointerenter'));
    expect(tooltip.hidden).toBe(false);
    badge.dispatchEvent(new PointerEvent('pointerleave'));
    expect(tooltip.hidden).toBe(true);
    badge.focus();
    expect(tooltip.hidden).toBe(false);
    badge.blur();
    expect(tooltip.hidden).toBe(true);
  });

  it('takes its words from the attributes', async () => {
    const { fake } = drmEngine('com.apple.fps.1_0', [{ keyId: 'a', status: 'usable' }]);
    const [, badge] = await badgeOver(fake);
    badge.setAttribute('label', 'Protegit per {system}: {keys}');
    badge.setAttribute('label-key', '{count} clau, {statuses}');
    expect(badge.getAttribute('aria-label')).toBe('Protegit per FairPlay: 1 clau, usable');
  });
});
