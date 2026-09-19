/**
 * <mbx-airplay-button> over a faked WebKit API, so every browser runs the
 * suite. The picker itself is a system dialog and is only testable on a
 * device; what is asserted here is presence, the click, and the state.
 */
import { MatteboxPlayerElement } from '@mattebox/player';
import { nativeHandler } from '@mattebox/player-core';
import { afterEach, describe, expect, it } from 'vitest';

const WIRELESS_CHANGED = 'webkitcurrentplaybacktargetiswirelesschanged';
const AVAILABILITY = 'WebKitPlaybackTargetAvailabilityEvent';

interface FakeGlobal {
  WebKitPlaybackTargetAvailabilityEvent?: unknown;
}

let undo: Array<() => void> = [];

/** Puts Safari's AirPlay API on this browser, and counts the pickers opened. */
function fakeAirplay(): { picks: () => number } {
  let picks = 0;
  const holder = globalThis as FakeGlobal;
  const had = AVAILABILITY in holder;
  holder.WebKitPlaybackTargetAvailabilityEvent = class {};
  const proto = HTMLVideoElement.prototype as HTMLVideoElement & {
    webkitShowPlaybackTargetPicker?: () => void;
    webkitCurrentPlaybackTargetIsWireless?: boolean;
  };
  proto.webkitShowPlaybackTargetPicker = () => {
    picks += 1;
  };
  proto.webkitCurrentPlaybackTargetIsWireless = false;
  undo.push(() => {
    if (!had) delete holder.WebKitPlaybackTargetAvailabilityEvent;
    delete proto.webkitShowPlaybackTargetPicker;
    delete proto.webkitCurrentPlaybackTargetIsWireless;
  });
  return { picks: () => picks };
}

/** The video moves onto or off a target, as Safari reports it. */
function wireless(video: HTMLVideoElement, on: boolean): void {
  Object.defineProperty(video, 'webkitCurrentPlaybackTargetIsWireless', {
    configurable: true,
    get: () => on,
  });
  video.dispatchEvent(new Event(WIRELESS_CHANGED));
}

/** A player under custom controls over a native session, with the button in the bar. */
function mount(): { player: MatteboxPlayerElement; button: HTMLElement } {
  const player = new MatteboxPlayerElement({ handlers: [nativeHandler()] });
  player.setAttribute('controls', 'custom');
  player.setAttribute('muted', '');
  const bar = document.createElement('mbx-control-bar');
  const button = document.createElement('mbx-airplay-button');
  bar.append(button);
  player.append(bar);
  document.body.append(player);
  return { player, button };
}

afterEach(() => {
  for (const fn of undo) fn();
  undo = [];
  document.body.replaceChildren();
});

describe('<mbx-airplay-button>', () => {
  it('is hidden where the browser has no AirPlay', () => {
    const { button } = mount();
    expect(button.hidden).toBe(true);
  });

  it('shows, opens the picker on a click, and names itself', () => {
    const fake = fakeAirplay();
    const { button } = mount();

    expect(button.hidden).toBe(false);
    const inner = button.shadowRoot?.querySelector('button');
    expect(inner?.getAttribute('aria-label')).toBe('AirPlay');
    inner?.click();
    expect(fake.picks()).toBe(1);
  });

  it('sets airplay on the player while the video is on a target', () => {
    fakeAirplay();
    const { player, button } = mount();

    wireless(player.video, true);
    expect(player.hasAttribute('airplay')).toBe(true);
    expect(button.shadowRoot?.querySelector('button')?.getAttribute('aria-label')).toBe(
      'Stop AirPlay',
    );

    wireless(player.video, false);
    expect(player.hasAttribute('airplay')).toBe(false);
  });

  it('takes the words the page gives', () => {
    fakeAirplay();
    const { player, button } = mount();
    button.setAttribute('label', 'Enviar a la tele');
    button.setAttribute('label-active', 'Aturar');

    const inner = button.shadowRoot?.querySelector('button');
    expect(inner?.getAttribute('aria-label')).toBe('Enviar a la tele');
    wireless(player.video, true);
    expect(inner?.getAttribute('aria-label')).toBe('Aturar');
  });

  it('hides while the element has remote playback disabled, and returns with the next source', () => {
    fakeAirplay();
    const { player, button } = mount();

    // What an engine session without an AirPlay alternative leaves behind.
    // Nothing announces the property, so the source change is when it is
    // read again; a native session hands it back and the button returns.
    player.video.disableRemotePlayback = true;
    player.dispatchEvent(new CustomEvent('sourcechange', { detail: null }));
    expect(button.hidden).toBe(true);

    player.video.disableRemotePlayback = false;
    player.dispatchEvent(new CustomEvent('sourcechange', { detail: null }));
    expect(button.hidden).toBe(false);
  });

  it('drops the player attribute when it leaves', () => {
    fakeAirplay();
    const { player, button } = mount();
    wireless(player.video, true);
    expect(player.hasAttribute('airplay')).toBe(true);

    button.remove();
    expect(player.hasAttribute('airplay')).toBe(false);
  });
});
