/**
 * <mbx-spatial-nav>: the arrows of a remote move focus between the controls,
 * the TV key codes reach the player under their standard names, and Back
 * goes back a step at a time. The player plays a short native clip, so the
 * bar's shortcuts act on a real video.
 */
import { MatteboxPlayerElement } from '@mattebox/player';
import '@mattebox/player-tv';
import { nativeHandler } from '@mattebox/player-core';
import { afterEach, describe, expect, it } from 'vitest';
import { once, silence } from './helpers.js';

afterEach(() => {
  document.body.replaceChildren();
});

/** The bar's children: a seek row over a row of buttons. */
const BAR = `
      <mbx-seek-bar></mbx-seek-bar>
      <mbx-skip-button seconds="-10"></mbx-skip-button>
      <mbx-play-button></mbx-play-button>
      <mbx-skip-button seconds="10"></mbx-skip-button>
      <mbx-spacer></mbx-spacer>
      <mbx-speed-menu></mbx-speed-menu>
      <mbx-fullscreen-button></mbx-fullscreen-button>
    `;

/** A player under custom controls with a two-row bar, the spatial navigation inside. */
async function tv(bar = BAR): Promise<MatteboxPlayerElement> {
  const player = new MatteboxPlayerElement({ handlers: [nativeHandler()] });
  player.setAttribute('controls', 'custom');
  player.setAttribute('muted', '');
  player.style.width = '800px';
  player.innerHTML = `
    <mbx-spatial-nav></mbx-spatial-nav>
    <mbx-control-bar idle-ms="600000">${bar}</mbx-control-bar>`;
  document.body.append(player);
  player.setAttribute('src', silence(30));
  await once(player.video, 'loadedmetadata');
  return player;
}

/** A keydown on `target` as a remote sends it: a name, a code, or both. */
function key(target: EventTarget, name: string, code = 0): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  if (code !== 0) Object.defineProperty(event, 'keyCode', { get: () => code });
  target.dispatchEvent(event);
  return event;
}

/** The element focused, through shadow roots. */
function focused(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement != null) active = active.shadowRoot.activeElement;
  return active;
}

/** The shadow host of the focused element: the control it sits in. */
function control(): Element | null {
  const root = focused()?.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

/** The control a focused element sits in: its shadow host. */
function host(element: Element | null): string {
  const root = element?.getRootNode();
  return root instanceof ShadowRoot ? root.host.localName : (element?.localName ?? '');
}

function inner(player: MatteboxPlayerElement, selector: string): HTMLElement {
  const control = player.querySelector(selector) as HTMLElement;
  return control.shadowRoot?.querySelector('button, [role="slider"]') as HTMLElement;
}

describe('the arrows', () => {
  it('place focus on the play button first, and take nothing else with that key', async () => {
    const player = await tv();
    const first = key(player, 'ArrowRight');
    expect(first.defaultPrevented).toBe(true);
    expect(host(focused())).toBe('mbx-play-button');
    expect(player.video.currentTime).toBe(0);
  });

  it('start from the control `initial` names', async () => {
    const player = await tv();
    player.querySelector('mbx-spatial-nav')?.setAttribute('initial', 'mbx-fullscreen-button');
    key(player, 'ArrowRight');
    expect(host(focused())).toBe('mbx-fullscreen-button');
  });

  it('move to the nearest control on each side, and back the way they came', async () => {
    const player = await tv();
    inner(player, 'mbx-play-button').focus();
    key(focused() as Element, 'ArrowRight');
    expect(control()).toBe(player.querySelectorAll('mbx-skip-button')[1]);
    key(focused() as Element, 'ArrowLeft');
    expect(host(focused())).toBe('mbx-play-button');
    // Up to the seek bar in the row above, and down lands where it left.
    key(focused() as Element, 'ArrowUp');
    expect(focused()?.getAttribute('role')).toBe('slider');
    key(focused() as Element, 'ArrowDown');
    expect(host(focused())).toBe('mbx-play-button');
  });

  it('keep left and right in the row, even where the seek bar starts past the button', async () => {
    // The TV setup on a stream without I-frames: play alone at the left, the
    // seek bar starting after the time, one menu at the far right.
    const player = await tv(`
      <mbx-current-time></mbx-current-time>
      <mbx-seek-bar></mbx-seek-bar>
      <mbx-play-button></mbx-play-button>
      <mbx-spacer></mbx-spacer>
      <mbx-speed-menu></mbx-speed-menu>`);
    const play = inner(player, 'mbx-play-button');
    const seek = inner(player, 'mbx-seek-bar');
    expect(seek.getBoundingClientRect().left).toBeGreaterThan(play.getBoundingClientRect().right);
    play.focus();
    key(play, 'ArrowRight');
    expect(host(focused())).toBe('mbx-speed-menu');
    key(focused() as Element, 'ArrowLeft');
    expect(host(focused())).toBe('mbx-play-button');
    // Up from the far right still reaches the bar above.
    inner(player, 'mbx-speed-menu').focus();
    key(focused() as Element, 'ArrowUp');
    expect(host(focused())).toBe('mbx-seek-bar');
  });

  it('leave left and right to a slider, which seeks', async () => {
    const player = await tv();
    inner(player, 'mbx-seek-bar').focus();
    const right = key(focused() as Element, 'ArrowRight');
    expect(right.defaultPrevented).toBe(true);
    expect(host(focused())).toBe('mbx-seek-bar');
    expect(player.video.currentTime).toBeGreaterThan(0);
  });

  it('fire navigateout at an edge, and take the arrow so the bar does not seek', async () => {
    const player = await tv();
    const nav = player.querySelector('mbx-spatial-nav') as HTMLElement;
    const out: string[] = [];
    document.addEventListener('navigateout', (event) => {
      out.push((event as CustomEvent<string>).detail);
    });
    inner(player, 'mbx-fullscreen-button').focus();
    const right = key(focused() as Element, 'ArrowRight');
    expect(right.defaultPrevented).toBe(true);
    expect(out).toEqual(['right']);
    expect(player.video.currentTime).toBe(0);
    expect(nav.isConnected).toBe(true);
  });

  it('leave every arrow to an open menu', async () => {
    const player = await tv();
    inner(player, 'mbx-speed-menu').click();
    const menu = player.querySelector('mbx-speed-menu') as HTMLElement;
    expect(menu.hasAttribute('open')).toBe(true);
    const item = focused();
    key(item as Element, 'ArrowLeft');
    expect(menu.hasAttribute('open')).toBe(true);
    expect(host(focused())).toBe('mbx-speed-menu');
  });

  it('read the arrows and Enter from their codes when a set leaves the name empty', async () => {
    const player = await tv();
    inner(player, 'mbx-play-button').focus();
    key(focused() as Element, '', 39);
    expect(control()).toBe(player.querySelectorAll('mbx-skip-button')[1]);
    // Enter by code alone: the element clicks, which a real Enter does itself.
    key(focused() as Element, '', 13);
    await once(player.video, 'seeked');
    expect(player.video.currentTime).toBe(10);
  });
});

describe('the remote keys', () => {
  it('reach the bar under their standard names: play, pause, fast forward', async () => {
    const player = await tv();
    key(player, 'Unidentified', 415);
    await once(player.video, 'play');
    key(player, '', 19);
    await once(player.video, 'pause');
    key(player, '', 417);
    expect(player.video.currentTime).toBe(5);
  });

  it('go Back a step at a time: the menu closes, focus leaves, then the application has it', async () => {
    const player = await tv();
    const menu = player.querySelector('mbx-speed-menu') as HTMLElement;
    inner(player, 'mbx-speed-menu').click();
    expect(menu.hasAttribute('open')).toBe(true);
    const closing = key(focused() as Element, '', 10009);
    expect(closing.defaultPrevented).toBe(true);
    expect(menu.hasAttribute('open')).toBe(false);
    expect(host(focused())).toBe('mbx-speed-menu');
    const leaving = key(focused() as Element, '', 461);
    expect(leaving.defaultPrevented).toBe(true);
    expect(host(focused())).not.toBe('mbx-speed-menu');
    const app = key(player, 'GoBack');
    expect(app.defaultPrevented).toBe(false);
  });
});

describe('the pointer', () => {
  it('pauses the navigation: the next key starts from the control it was over', async () => {
    const player = await tv();
    inner(player, 'mbx-play-button').focus();
    const fullscreen = inner(player, 'mbx-fullscreen-button');
    fullscreen.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, composed: true }));
    key(focused() as Element, 'ArrowLeft');
    expect(host(focused())).toBe('mbx-fullscreen-button');
  });
});
