/**
 * <mbx-gamepad> and <mbx-gamepad-help>: a controller drives the player
 * through the keys a remote sends, the page remaps its buttons, and the
 * bubble lists what each button does. No browser here has a pad, so a fake
 * one stands behind `navigator.getGamepads`, read on each frame as a real
 * one is.
 */
import { MatteboxPlayerElement } from '@mattebox/player';
import type { GamepadActionDetail, MbxGamepad } from '@mattebox/player-spatial-nav/gamepad';
import '@mattebox/player-spatial-nav/gamepad';
import { nativeHandler } from '@mattebox/player-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fr from '../../src/locales/fr.js';
import { kindOf, mapping, parseMap } from '../../src/pad.js';
import { once, silence } from './helpers.js';

const XBOX = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';
const DUALSENSE = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
const SWITCH = 'Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)';

/** The standard layout's indices, by place. */
const INDEX: Readonly<Record<string, number>> = {
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  select: 8,
  start: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
};

interface FakeButton {
  pressed: boolean;
  value: number;
  touched: boolean;
}

interface FakePad {
  id: string;
  index: number;
  connected: boolean;
  mapping: string;
  timestamp: number;
  axes: number[];
  buttons: FakeButton[];
}

let pads: FakePad[] = [];
const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'getGamepads');

beforeEach(() => {
  pads = [];
  Object.defineProperty(navigator, 'getGamepads', {
    configurable: true,
    value: () => pads,
  });
});

afterEach(() => {
  document.body.replaceChildren();
  delete (navigator as unknown as Record<string, unknown>).getGamepads;
  if (original !== undefined) Object.defineProperty(Navigator.prototype, 'getGamepads', original);
});

/** Plugs in a pad of `id`, as the browser reports it at its first press. */
function plug(id = XBOX): FakePad {
  const pad: FakePad = {
    id,
    index: pads.length,
    connected: true,
    mapping: 'standard',
    timestamp: 0,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })),
  };
  pads.push(pad);
  window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: pad }));
  return pad;
}

/** Waits `count` animation frames. */
async function frames(count = 2): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

/** Presses `button` and lets the pad be read. */
async function press(pad: FakePad, button: string, value = 1): Promise<void> {
  const own = pad.buttons[INDEX[button] as number] as FakeButton;
  own.pressed = value > 0;
  own.value = value;
  await frames();
}

/** Lets `button` go and lets the pad be read. */
async function release(pad: FakePad, button: string): Promise<void> {
  await press(pad, button, 0);
}

/** A press and a release. */
async function tap(pad: FakePad, button: string): Promise<void> {
  await press(pad, button);
  await release(pad, button);
}

const BAR = `
      <mbx-seek-bar></mbx-seek-bar>
      <mbx-play-button></mbx-play-button>
      <mbx-mute-button></mbx-mute-button>
      <mbx-spacer></mbx-spacer>
      <mbx-speed-menu></mbx-speed-menu>
      <mbx-subtitles-menu></mbx-subtitles-menu>`;

/** A player with the spatial navigation, the gamepad and its bubble. */
async function rig(extra = ''): Promise<MatteboxPlayerElement> {
  const player = new MatteboxPlayerElement({ handlers: [nativeHandler()] });
  player.setAttribute('controls', 'custom');
  player.setAttribute('muted', '');
  player.style.width = '800px';
  player.innerHTML = `
    <mbx-spatial-nav></mbx-spatial-nav>
    <mbx-gamepad ${extra}></mbx-gamepad>
    <mbx-gamepad-help manual></mbx-gamepad-help>
    <mbx-control-bar idle-ms="600000">${BAR}</mbx-control-bar>`;
  document.body.append(player);
  player.setAttribute('src', silence(30));
  await once(player.media, 'loadedmetadata');
  return player;
}

function gamepad(player: MatteboxPlayerElement): MbxGamepad {
  return player.querySelector('mbx-gamepad') as MbxGamepad;
}

/** The shadow host of the focused element: the control it sits in. */
function focusedControl(): string {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement != null) active = active.shadowRoot.activeElement;
  const root = active?.getRootNode();
  return root instanceof ShadowRoot ? root.host.localName : (active?.localName ?? '');
}

function inner(player: MatteboxPlayerElement, selector: string): HTMLElement {
  const control = player.querySelector(selector) as HTMLElement;
  return control.shadowRoot?.querySelector('button, [role="slider"]') as HTMLElement;
}

describe('the make of a pad', () => {
  it('comes from the vendor id, in Chromium and Firefox, then the name, else Xbox', () => {
    expect(kindOf(DUALSENSE)).toBe('playstation');
    expect(kindOf(SWITCH)).toBe('nintendo');
    expect(kindOf('054c-0ce6-DualSense Wireless Controller')).toBe('playstation');
    expect(kindOf('Wireless Controller DUALSHOCK 4')).toBe('playstation');
    expect(kindOf('Joy-Con L+R')).toBe('nintendo');
    expect(kindOf(XBOX)).toBe('xbox');
    expect(kindOf('Generic USB Joystick')).toBe('xbox');
  });
});

describe('the mapping', () => {
  it('selects with the lower face button, and with A, the right one, on a Nintendo pad', () => {
    expect(mapping('xbox').south).toBe('activate');
    expect(mapping('xbox').east).toBe('back');
    expect(mapping('nintendo').east).toBe('activate');
    expect(mapping('nintendo').south).toBe('back');
  });

  it('reads overrides from the attribute, leaving unknown buttons out, none unbinding', () => {
    expect(parseMap('rb:fast-forward west:mute select:none bogus:next')).toEqual({
      rb: 'fast-forward',
      west: 'mute',
      select: null,
    });
    const map = mapping('xbox', { west: 'mute' }, { west: 'fullscreen' });
    expect(map.west).toBe('fullscreen');
    expect(map.rb).toBe('next');
  });
});

describe('<mbx-gamepad>', () => {
  it('reads no pad until one connects, then tells the page its make', async () => {
    let reads = 0;
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => {
        reads += 1;
        return pads;
      },
    });
    const player = await rig();
    await frames(3);
    const before = reads;
    await frames(3);
    expect(reads).toBe(before);
    const told = once(player, 'gamepadconnect');
    plug(DUALSENSE);
    expect(((await told) as CustomEvent).detail.kind).toBe('playstation');
    await frames(3);
    expect(reads).toBeGreaterThan(before);
    expect(gamepad(player).kind).toBe('playstation');
  });

  it('moves focus with the d-pad and the left stick, as the arrows do', async () => {
    const player = await rig();
    const pad = plug();
    await tap(pad, 'right');
    // The first direction places focus, as the first arrow does.
    expect(focusedControl()).toBe('mbx-play-button');
    await tap(pad, 'right');
    expect(focusedControl()).toBe('mbx-mute-button');
    pad.axes[0] = -0.9;
    await frames();
    pad.axes[0] = 0;
    await frames();
    expect(focusedControl()).toBe('mbx-play-button');
    expect(player.media.currentTime).toBe(0);
  });

  it('shows the focus it gives until a pointer presses', async () => {
    const player = await rig();
    const pad = plug();
    expect(player.hasAttribute('focus-ring')).toBe(false);
    await tap(pad, 'right');
    expect(player.hasAttribute('focus-ring')).toBe(true);
    // The controls read the property in their :not(:focus-visible) rules. The
    // outline itself is not asserted: it needs :focus, which a test window
    // without the system's focus does not match.
    const button = inner(player, 'mbx-play-button');
    expect(getComputedStyle(button).getPropertyValue('--mbx-focus-ring').trim()).toBe('solid');
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    expect(player.hasAttribute('focus-ring')).toBe(false);
  });

  it('repeats a held direction', async () => {
    const player = await rig();
    const pad = plug();
    inner(player, 'mbx-seek-bar').focus();
    await press(pad, 'right');
    await new Promise((resolve) => setTimeout(resolve, 700));
    await release(pad, 'right');
    // WebKit reads 0 while a seek is pending.
    if (player.media.seeking) {
      await new Promise((resolve) =>
        player.media.addEventListener('seeked', resolve, { once: true }),
      );
    }
    // The seek bar takes left and right: one step, then the repeats.
    expect(player.media.currentTime).toBeGreaterThan(10);
  });

  it('plays and pauses with A while no control has focus, and clicks the focused one', async () => {
    const player = await rig();
    const pad = plug();
    const playing = once(player.media, 'play');
    await tap(pad, 'south');
    await playing;
    const menu = player.querySelector('mbx-speed-menu') as HTMLElement;
    inner(player, 'mbx-speed-menu').focus();
    await tap(pad, 'south');
    expect(menu.hasAttribute('open')).toBe(true);
    // B closes the menu, as the remote's Back does.
    await tap(pad, 'east');
    expect(menu.hasAttribute('open')).toBe(false);
  });

  it('plays and pauses with Menu, and scans with the triggers', async () => {
    const player = await rig();
    const pad = plug();
    const playing = once(player.media, 'play');
    await tap(pad, 'start');
    await playing;
    const pausing = once(player.media, 'pause');
    await tap(pad, 'start');
    await pausing;
    const from = player.media.currentTime;
    await tap(pad, 'rt');
    expect(player.media.currentTime).toBeCloseTo(from + 5, 1);
    await tap(pad, 'lt');
    expect(player.media.currentTime).toBeCloseTo(from, 1);
  });

  it('goes to the next and previous chapter with the shoulders', async () => {
    const player = await rig();
    const track = player.media.addTextTrack('chapters');
    track.addCue(new VTTCue(0, 10, 'One'));
    track.addCue(new VTTCue(10, 20, 'Two'));
    track.addCue(new VTTCue(20, 30, 'Three'));
    // A disabled track lists no cues; the player hides it on its own a little later.
    track.mode = 'hidden';
    const pad = plug();
    // Each press waits for its seek to end. WebKit reads 0 while a seek is
    // pending, so a press during the last one's would skip from 0: the time
    // alone can read right before the seek is done.
    const press = async (button: string, to: number): Promise<void> => {
      const seeked = once(player.media, 'seeked');
      await tap(pad, button);
      await seeked;
      expect(player.media.currentTime).toBe(to);
    };
    await press('rb', 10);
    await press('rb', 20);
    player.media.currentTime = 25;
    await new Promise((resolve) =>
      player.media.addEventListener('seeked', resolve, { once: true }),
    );
    // Past the first seconds of a chapter, previous goes to its start.
    await press('lb', 20);
    await press('lb', 10);
  });

  it('selects with A, the right button, on a Nintendo pad', async () => {
    const player = await rig();
    const pad = plug(SWITCH);
    const playing = once(player.media, 'play');
    await tap(pad, 'east');
    await playing;
  });

  it('takes the overrides of the attribute, then of the property', async () => {
    const player = await rig('map="west:mute start:none"');
    const pad = plug();
    await tap(pad, 'west');
    expect(player.media.muted).toBe(false);
    await tap(pad, 'start');
    expect(player.media.paused).toBe(true);
    gamepad(player).map = { west: 'fullscreen', north: null };
    expect(gamepad(player).bindings().west).toBe('fullscreen');
    expect(gamepad(player).bindings().north).toBe(null);
  });

  it('asks the page first: an action it cancels, or one of its own name, does nothing more', async () => {
    const player = await rig('map="west:like"');
    const seen: GamepadActionDetail[] = [];
    player.addEventListener('gamepadaction', (event) => {
      const detail = (event as CustomEvent<GamepadActionDetail>).detail;
      seen.push(detail);
      if (detail.action === 'play-pause') event.preventDefault();
    });
    const pad = plug();
    await tap(pad, 'west');
    await tap(pad, 'start');
    expect(seen.map((each) => each.action)).toEqual(['like', 'play-pause']);
    expect(seen[0]?.button).toBe('west');
    expect(player.media.paused).toBe(true);
  });
});

describe('<mbx-gamepad-help>', () => {
  it('opens with View, lists the bindings as the make prints them, and closes with Back', async () => {
    const player = await rig('map="west:mute"');
    const help = player.querySelector('mbx-gamepad-help') as HTMLElement;
    help.setAttribute('label-mute', 'Sound off');
    const pad = plug(DUALSENSE);
    await tap(pad, 'select');
    expect(help.hasAttribute('open')).toBe(true);
    const rows = [...(help.shadowRoot?.querySelectorAll('dt') ?? [])].map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent,
    ]);
    expect(rows).toContainEqual(['↑↓←→', 'Move']);
    expect(rows).toContainEqual(['✕', 'Select']);
    expect(rows).toContainEqual(['○', 'Back']);
    expect(rows).toContainEqual(['R2', 'Fast forward']);
    expect(rows).toContainEqual(['□', 'Sound off']);
    expect(help.shadowRoot?.querySelector('kbd')?.getAttribute('aria-label')).toBe(null);
    expect(help.shadowRoot?.querySelector('dt kbd[aria-label="Cross"]')).not.toBe(null);
    // Back closes the bubble and goes no further.
    const playing = player.media.paused;
    await tap(pad, 'east');
    expect(help.hasAttribute('open')).toBe(false);
    expect(player.media.paused).toBe(playing);
  });

  it("speaks the player's language, switches with it, and keeps the page's labels", async () => {
    MatteboxPlayerElement.addLocale('fr', fr);
    const player = await rig();
    player.language = 'fr';
    const help = player.querySelector('mbx-gamepad-help') as HTMLElement;
    help.setAttribute('label-mute', 'Sans le son');
    const pad = plug(DUALSENSE);
    await tap(pad, 'select');
    const root = help.shadowRoot;
    const rows = (): Array<[string | null, string | null | undefined]> =>
      [...(root?.querySelectorAll('dt') ?? [])].map((term) => [
        term.textContent,
        term.nextElementSibling?.textContent,
      ]);
    expect(root?.querySelector('h2')?.textContent).toBe('Manette');
    expect(rows()).toContainEqual(['✕', 'Sélectionner']);
    expect(rows()).toContainEqual(['R2', 'Avance rapide']);
    expect(root?.querySelector('dt kbd[aria-label="Croix"]')).not.toBe(null);
    player.language = '';
    expect(root?.querySelector('h2')?.textContent).toBe('Controller');
    expect(rows()).toContainEqual(['✕', 'Select']);
    expect(root?.querySelector('dt kbd[aria-label="Cross"]')).not.toBe(null);
  });

  it('opens when a pad connects, unless manual, and closes by itself', async () => {
    const player = await rig();
    const help = player.querySelector('mbx-gamepad-help') as HTMLElement;
    help.removeAttribute('manual');
    help.setAttribute('close-ms', '100');
    plug();
    expect(help.hasAttribute('open')).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(help.hasAttribute('open')).toBe(false);
  });
});
