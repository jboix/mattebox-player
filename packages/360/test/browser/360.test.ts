/**
 * <mbx-360> from outside the player package, the way a page gets it. The
 * renderer draws a picture of four coloured quarters and reads pixels back;
 * the element runs over a short silence, which is enough for its states.
 */
import { MatteboxPlayerElement } from '@mattebox/player';
import type { Mbx360, MbxMotionButton, MbxVrButton } from '@mattebox/player-360';
import { nativeHandler } from '@mattebox/player-core';
import '@mattebox/player-360';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sphere } from '../../src/sphere.js';
import type { FramePacking, Projection, View } from '../../src/view.js';
import { once, silence } from './helpers.js';

afterEach(() => {
  document.body.replaceChildren();
});

/** An equirectangular picture in four upright quarters: red, green, blue, yellow from the left. */
function quarters(): HTMLCanvasElement {
  const picture = document.createElement('canvas');
  picture.width = 64;
  picture.height = 32;
  const context = picture.getContext('2d') as CanvasRenderingContext2D;
  for (const [index, colour] of ['#f00', '#0f0', '#00f', '#ff0'].entries()) {
    context.fillStyle = colour;
    context.fillRect(index * 16, 0, 16, 32);
  }
  return picture;
}

/** The colour at the centre of the view, after one draw at `yaw` degrees. */
function centre(yaw: number, projection: Projection = 'equirectangular'): number[] {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const sphere = new Sphere(canvas);
  sphere.draw(quarters(), { yaw: (yaw * Math.PI) / 180, pitch: 0, fov: 1 }, projection);
  const gl = canvas.getContext('webgl') as WebGLRenderingContext;
  const pixel = new Uint8Array(4);
  gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  sphere.dispose();
  return [...pixel.slice(0, 3)].map((value) => Math.round(value / 255));
}

const PROJECTION: Projection = 'equirectangular';
const RED = [1, 0, 0];
const BLUE = [0, 0, 1];

/** A frame that holds a picture for each eye: red for the left eye, blue for the right. */
function pair(packing: FramePacking): HTMLCanvasElement {
  const picture = document.createElement('canvas');
  picture.width = 64;
  picture.height = 64;
  const context = picture.getContext('2d') as CanvasRenderingContext2D;
  context.fillStyle = '#f00';
  context.fillRect(0, 0, 64, 64);
  context.fillStyle = '#00f';
  if (packing === 'top-bottom') context.fillRect(0, 32, 64, 32);
  else context.fillRect(32, 0, 32, 64);
  return picture;
}

/** The colours at the centre of the left and the right half of a canvas, after `draw` drew a `pair`. */
function halves(
  packing: FramePacking,
  draw: (sphere: Sphere, picture: HTMLCanvasElement, view: View) => void,
): number[][] {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 32;
  const sphere = new Sphere(canvas);
  draw(sphere, pair(packing), { yaw: 0, pitch: 0, fov: 1 });
  const gl = canvas.getContext('webgl') as WebGLRenderingContext;
  const colours = [16, 48].map((x) => {
    const pixel = new Uint8Array(4);
    gl.readPixels(x, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return [...pixel.slice(0, 3)].map((value) => Math.round(value / 255));
  });
  sphere.dispose();
  return colours;
}

describe('the sphere', () => {
  it('shows the quarter of the picture the yaw looks at, the right one as the yaw grows', () => {
    expect(centre(-135)).toEqual([1, 0, 0]);
    expect(centre(-45)).toEqual([0, 1, 0]);
    expect(centre(45)).toEqual([0, 0, 1]);
    expect(centre(135)).toEqual([1, 1, 0]);
  });

  it('spreads a half-equirectangular picture over the front half, and the back is black', () => {
    expect(centre(-60, 'half-equirectangular')).toEqual([1, 0, 0]);
    expect(centre(60, 'half-equirectangular')).toEqual([1, 1, 0]);
    expect(centre(135, 'half-equirectangular')).toEqual([0, 0, 0]);
  });

  it('draws the same view in each half of a split screen', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    const sphere = new Sphere(canvas);
    sphere.drawHalves(quarters(), { yaw: Math.PI / 4, pitch: 0, fov: 1 }, 'equirectangular');
    const gl = canvas.getContext('webgl') as WebGLRenderingContext;
    const colours = [16, 48].map((x) => {
      const pixel = new Uint8Array(4);
      gl.readPixels(x, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return [...pixel.slice(0, 3)].map((value) => Math.round(value / 255));
    });
    sphere.dispose();
    expect(colours).toEqual([
      [0, 0, 1],
      [0, 0, 1],
    ]);
  });

  it('shows each eye its own picture of a frame that holds two', () => {
    for (const packing of ['top-bottom', 'side-by-side'] as const) {
      // Flat on the screen: the left eye's picture alone.
      expect(
        halves(packing, (sphere, picture, view) => sphere.draw(picture, view, PROJECTION, packing)),
      ).toEqual([RED, RED]);
      expect(
        halves(packing, (sphere, picture, view) =>
          sphere.drawHalves(picture, view, PROJECTION, packing),
        ),
      ).toEqual([RED, BLUE]);
    }
  });

  it('gives each eye of a headset its own picture, and one screen for both the left one', () => {
    const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const layer = {
      framebuffer: null,
      getViewport: (view: { eye?: string }) => ({
        x: view.eye === 'right' ? 32 : 0,
        y: 0,
        width: 32,
        height: 32,
      }),
    };
    const eye = (name: 'left' | 'right' | 'none') => ({
      eye: name,
      projectionMatrix: identity,
      transform: { matrix: identity },
    });
    expect(
      halves('top-bottom', (sphere, picture) =>
        sphere.drawEyes(picture, layer, [eye('left'), eye('right')], 0, PROJECTION, 'top-bottom'),
      ),
    ).toEqual([RED, BLUE]);
    expect(
      halves('side-by-side', (sphere, picture) =>
        sphere.drawEyes(picture, layer, [eye('none')], 0, PROJECTION, 'side-by-side'),
      )[0],
    ).toEqual(RED);
  });
});

function videoOf(player: MatteboxPlayerElement): HTMLVideoElement {
  return player.querySelector('video') as HTMLVideoElement;
}

async function rig(attributes = ''): Promise<{ player: MatteboxPlayerElement; view: Mbx360 }> {
  const player = new MatteboxPlayerElement({ handlers: [nativeHandler()] });
  player.setAttribute('controls', 'custom');
  player.setAttribute('muted', '');
  player.style.width = '640px';
  player.innerHTML = `<mbx-360 ${attributes}></mbx-360>`;
  document.body.append(player);
  player.setAttribute('src', silence(5));
  await once(player.media, 'loadedmetadata');
  return { player, view: player.querySelector('mbx-360') as Mbx360 };
}

describe('<mbx-360>', () => {
  it('stays hidden for a flat source, and keeps the video as it was', async () => {
    const { player, view } = await rig();
    expect(player.hasAttribute('projection')).toBe(false);
    expect(view.hasAttribute('active')).toBe(false);
    expect(getComputedStyle(view).display).toBe('none');
    expect(videoOf(player).style.getPropertyValue('aspect-ratio')).toBe('');
  });

  it('shows for the projection the source names, and gives the video a 16:9 box', async () => {
    const { player, view } = await rig();
    // The src attribute wins over sources.
    player.removeAttribute('src');
    player.sources = [{ url: silence(5), type: 'audio/wav', projection: 'equirectangular' }];
    await once(player.media, 'loadedmetadata');
    expect(player.projection).toBe('equirectangular');
    expect(player.getAttribute('projection')).toBe('equirectangular');
    expect(view.projection).toBe('equirectangular');
    expect(view.hasAttribute('active')).toBe(true);
    expect(videoOf(player).style.getPropertyValue('aspect-ratio')).toBe('16 / 9');
    player.sources = [{ url: silence(5), type: 'audio/wav' }];
    await once(player.media, 'loadedmetadata');
    expect(player.hasAttribute('projection')).toBe(false);
    expect(view.hasAttribute('active')).toBe(false);
    expect(videoOf(player).style.getPropertyValue('aspect-ratio')).toBe('');
  });

  it('lets the video show until the source draws a frame, and from a source change', async () => {
    const { player, view } = await rig();
    const canvas = view.shadowRoot?.querySelector('canvas') as HTMLCanvasElement;
    player.removeAttribute('src');
    player.sources = [{ url: silence(5), type: 'audio/wav', projection: 'equirectangular' }];
    await once(player.media, 'loadedmetadata');
    expect(view.hasAttribute('active')).toBe(true);
    // Silence has no picture: nothing draws, and the video under it shows.
    expect(getComputedStyle(view).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(canvas).visibility).toBe('hidden');
    canvas.style.visibility = '';
    // Hidden as the video empties, before the new source is known.
    const emptied = once(player.media, 'emptied');
    player.sources = [{ url: silence(4), type: 'audio/wav', projection: 'equirectangular' }];
    await emptied;
    expect(getComputedStyle(canvas).visibility).toBe('hidden');
    await once(player.media, 'loadedmetadata');
    expect(view.hasAttribute('active')).toBe(true);
    expect(getComputedStyle(canvas).visibility).toBe('hidden');
  });

  it('takes its own projection over the player, and none keeps a source flat', async () => {
    const { player, view } = await rig('projection="half-equirectangular"');
    expect(view.projection).toBe('half-equirectangular');
    expect(view.hasAttribute('active')).toBe(true);
    player.setAttribute('projection', 'equirectangular');
    view.setAttribute('projection', 'none');
    expect(view.projection).toBeNull();
    expect(view.hasAttribute('active')).toBe(false);
  });

  it('does not show for an encrypted source, and says so', async () => {
    const { player, view } = await rig('projection="equirectangular"');
    player.media.dispatchEvent(new Event('encrypted'));
    expect(view.getAttribute('unavailable')).toBe('drm');
    expect(view.hasAttribute('active')).toBe(false);
  });

  it('turns with a drag, zooms with the wheel, and a tap clicks the video', async () => {
    const { player, view } = await rig('projection="equirectangular" fov="60"');
    expect(view.fov).toBeCloseTo(60);
    const canvas = view.shadowRoot?.querySelector('canvas') as HTMLCanvasElement;
    const clicks: EventTarget[] = [];
    player.addEventListener('click', (event) =>
      clicks.push(event.composedPath()[0] as EventTarget),
    );
    const pointer = (type: string, x: number, y: number): void => {
      canvas.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          clientX: x,
          clientY: y,
          bubbles: true,
          composed: true,
        }),
      );
    };
    pointer('pointerdown', 100, 100);
    pointer('pointermove', 200, 50);
    pointer('pointerup', 200, 50);
    expect(view.yaw).toBeLessThan(0);
    expect(view.pitch).toBeLessThan(0);
    expect(clicks).toHaveLength(0);
    pointer('pointerdown', 100, 100);
    pointer('pointerup', 102, 101);
    expect(clicks).toHaveLength(1);
    // The video itself, which the control bar plays or pauses on; `media` is a stand-in.
    expect(clicks[0] === player.querySelector('video')).toBe(true);
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 200, cancelable: true }));
    expect(view.fov).toBeGreaterThan(60);
  });

  it('turns with the W, A, S and D keys, by their place on the keyboard', async () => {
    const { player, view } = await rig('projection="equirectangular" fov="75"');
    const press = (code: string, init: KeyboardEventInit = {}): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', {
        code,
        bubbles: true,
        composed: true,
        cancelable: true,
        ...init,
      });
      player.dispatchEvent(event);
      return event;
    };
    // A fifteenth of the field of view for each press.
    expect(press('KeyD').defaultPrevented).toBe(true);
    expect(view.yaw).toBeCloseTo(5);
    press('KeyA');
    press('KeyA');
    expect(view.yaw).toBeCloseTo(-5);
    press('KeyW');
    expect(view.pitch).toBeCloseTo(5);
    press('KeyS');
    press('KeyS');
    expect(view.pitch).toBeCloseTo(-5);
    // The place, not the letter: Z on a French keyboard sits where W does.
    press('KeyW', { key: 'z' });
    expect(view.pitch).toBeCloseTo(0);
    // Another key, a shortcut of the browser, and a key the page took are left alone.
    expect(press('KeyE').defaultPrevented).toBe(false);
    expect(press('KeyD', { ctrlKey: true }).defaultPrevented).toBe(false);
    player.addEventListener('keydown', (event) => event.preventDefault(), { capture: true });
    press('KeyD');
    expect(view.yaw).toBeCloseTo(-5);
  });

  it('leaves the keys alone for a flat source, and for a letter typed into a field', async () => {
    const { player, view } = await rig();
    const press = (target: EventTarget): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', {
        code: 'KeyD',
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
      return event;
    };
    expect(press(player).defaultPrevented).toBe(false);
    view.setAttribute('projection', 'equirectangular');
    const field = document.createElement('input');
    player.append(field);
    expect(press(field).defaultPrevented).toBe(false);
    expect(view.yaw).toBeCloseTo(0);
  });

  it('takes the frame packing the source names, through the player', async () => {
    const { player, view } = await rig();
    expect(player.framePacking).toBeNull();
    expect(view.framePacking).toBeNull();
    player.removeAttribute('src');
    player.sources = [
      {
        url: silence(5),
        type: 'audio/wav',
        projection: 'equirectangular',
        framePacking: 'top-bottom',
      },
    ];
    await once(player.media, 'loadedmetadata');
    expect(player.framePacking).toBe('top-bottom');
    expect(player.getAttribute('frame-packing')).toBe('top-bottom');
    expect(view.framePacking).toBe('top-bottom');
    // The next source has one picture a frame.
    player.sources = [{ url: silence(5), type: 'audio/wav', projection: 'equirectangular' }];
    await once(player.media, 'loadedmetadata');
    expect(player.framePacking).toBeNull();
    expect(player.hasAttribute('frame-packing')).toBe(false);
    expect(view.framePacking).toBeNull();
  });

  it('takes its own frame packing over the player, and none draws one picture', async () => {
    const { player, view } = await rig('projection="equirectangular"');
    player.setAttribute('frame-packing', 'top-bottom');
    expect(view.framePacking).toBe('top-bottom');
    view.setAttribute('frame-packing', 'side-by-side');
    expect(view.framePacking).toBe('side-by-side');
    view.setAttribute('frame-packing', 'none');
    expect(view.framePacking).toBeNull();
    view.removeAttribute('frame-packing');
    expect(view.framePacking).toBe('top-bottom');
  });

  it('writes the showing subtitles over the view', async () => {
    const { player, view } = await rig('projection="equirectangular"');
    const track = player.media.addTextTrack('subtitles', 'English', 'en');
    track.addCue(new VTTCue(0, 60, '<i>Hello</i> there'));
    track.mode = 'showing';
    const words = view.shadowRoot?.querySelector('[part="subtitles"]') as HTMLElement;
    // A paused video makes a cue active only once its time moves.
    player.media.currentTime = 1;
    await once(player.media, 'seeked');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(words.textContent).toBe('Hello there');
  });

  it("asks its player for the engine, since Safari's own HLS shows flat", () => {
    expect((document.createElement('mbx-360') as Mbx360).needsEngine).toBe(true);
  });
});

/** Fires a `deviceorientation` with these angles, in degrees, as a phone would. */
function tilt(alpha: number | null, beta: number | null, gamma: number | null): void {
  // A plain event with the angles: every browser's constructor takes them, not every one's exists.
  const event = new Event('deviceorientation');
  Object.defineProperties(event, {
    alpha: { value: alpha },
    beta: { value: beta },
    gamma: { value: gamma },
  });
  window.dispatchEvent(event);
}

/** Presses `canvas` at `x`, `y` and lets go at `toX`, `toY`. */
function dragOn(canvas: HTMLCanvasElement, x: number, y: number, toX: number, toY: number): void {
  for (const [type, cx, cy] of [
    ['pointerdown', x, y],
    ['pointermove', toX, toY],
    ['pointerup', toX, toY],
  ] as const) {
    canvas.dispatchEvent(new PointerEvent(type, { pointerId: 1, clientX: cx, clientY: cy }));
  }
}

describe('<mbx-360> and the device', () => {
  it('turns with the device from the yaw it had, and a drag adds to the motion', async () => {
    const { view } = await rig('projection="equirectangular"');
    view.yaw = 20;
    // Held upright: the first event keeps the yaw, and the pitch is level.
    tilt(0, 90, 0);
    expect(view.yaw).toBeCloseTo(20);
    expect(view.pitch).toBeCloseTo(0);
    // Turned 30° right, its top leaning back 30°.
    tilt(-30, 120, 0);
    expect(view.yaw).toBeCloseTo(50);
    expect(view.pitch).toBeCloseTo(30);
    const canvas = view.shadowRoot?.querySelector('canvas') as HTMLCanvasElement;
    dragOn(canvas, 100, 100, 200, 100);
    const dragged = view.yaw;
    expect(dragged).toBeLessThan(50);
    // The device has not moved: the drag stays.
    tilt(-30, 120, 0);
    expect(view.yaw).toBeCloseTo(dragged);
    tilt(-40, 120, 0);
    expect(view.yaw).toBeCloseTo(dragged + 10);
  });

  it('ignores an event without angles, and the device with motion="off"', async () => {
    const { view } = await rig('projection="equirectangular" motion="off"');
    tilt(-90, 90, 0);
    expect(view.yaw).toBeCloseTo(0);
    view.removeAttribute('motion');
    tilt(null, null, null);
    expect(view.yaw).toBeCloseTo(0);
    tilt(0, 90, 0);
    tilt(-90, 90, 0);
    expect(view.yaw).toBeCloseTo(90);
  });

  it('does not listen while the source is flat', async () => {
    const { view } = await rig();
    tilt(0, 90, 0);
    tilt(-90, 90, 0);
    expect(view.yaw).toBeCloseTo(0);
  });

  it('asks iOS for the motion permission once, at the first touch on the view', async () => {
    const asked = vi.fn(() => Promise.resolve('granted'));
    Object.defineProperty(DeviceOrientationEvent, 'requestPermission', {
      configurable: true,
      value: asked,
    });
    try {
      const { view } = await rig('projection="equirectangular"');
      const canvas = view.shadowRoot?.querySelector('canvas') as HTMLCanvasElement;
      canvas.dispatchEvent(new Event('touchend'));
      canvas.dispatchEvent(new Event('touchend'));
      expect(asked).toHaveBeenCalledTimes(1);
    } finally {
      delete (DeviceOrientationEvent as { requestPermission?: unknown }).requestPermission;
    }
  });
});

/**
 * Answers `matchMedia` as a system would: reduced motion as `reduce` says,
 * and a coarse pointer as `touch` says. `set` changes reduced motion and
 * tells the listeners, as a change in the system's settings does.
 */
function fakeMedia(
  reduce: boolean,
  touch = false,
): { set: (to: boolean) => void; restore: () => void } {
  const real = window.matchMedia;
  const listeners = new Set<() => void>();
  let reduced = reduce;
  window.matchMedia = ((query: string) => ({
    media: query,
    get matches() {
      if (query.includes('prefers-reduced-motion')) return reduced;
      if (query.includes('pointer: coarse')) return touch;
      return real.call(window, query).matches;
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  })) as unknown as typeof window.matchMedia;
  return {
    set: (to) => {
      reduced = to;
      for (const listener of listeners) listener();
    },
    restore: () => {
      window.matchMedia = real;
    },
  };
}

/** Makes this browser iOS's: `DeviceOrientationEvent.requestPermission` answers `answer`. */
function fakePermission(answer: string): { asked: ReturnType<typeof vi.fn>; restore: () => void } {
  const asked = vi.fn(() => Promise.resolve(answer));
  Object.defineProperty(DeviceOrientationEvent, 'requestPermission', {
    configurable: true,
    value: asked,
  });
  return {
    asked,
    restore: () => {
      delete (DeviceOrientationEvent as { requestPermission?: unknown }).requestPermission;
    },
  };
}

describe("<mbx-360> and the viewer's choice", () => {
  it('starts without motion when the system asks for reduced motion, and follows the setting', async () => {
    const media = fakeMedia(true);
    try {
      const { view } = await rig('projection="equirectangular"');
      expect(view.motionOn).toBe(false);
      tilt(0, 90, 0);
      tilt(-90, 90, 0);
      expect(view.yaw).toBeCloseTo(0);
      const changes = vi.fn();
      view.addEventListener('motionchange', changes);
      media.set(false);
      expect(view.motionOn).toBe(true);
      expect(changes).toHaveBeenCalledTimes(1);
      tilt(0, 90, 0);
      tilt(-90, 90, 0);
      expect(view.yaw).toBeCloseTo(90);
    } finally {
      media.restore();
    }
  });

  it('turns with the device under reduced motion when motion="on"', async () => {
    const media = fakeMedia(true);
    try {
      const { view } = await rig('projection="equirectangular" motion="on"');
      expect(view.motionOn).toBe(true);
      tilt(0, 90, 0);
      tilt(-90, 90, 0);
      expect(view.yaw).toBeCloseTo(90);
    } finally {
      media.restore();
    }
  });

  it("keeps the viewer's choice over the attribute until the page sets it again", async () => {
    const { view } = await rig('projection="equirectangular" motion="off"');
    const changes = vi.fn();
    view.addEventListener('motionchange', changes);
    view.setMotion(true);
    expect(view.motionOn).toBe(true);
    expect(changes).toHaveBeenCalledTimes(1);
    view.setAttribute('motion', 'off');
    expect(view.motionOn).toBe(false);
    expect(changes).toHaveBeenCalledTimes(2);
  });

  it('keeps where the view looks when motion turns off, and does not jump when it turns on', async () => {
    const { view } = await rig('projection="equirectangular"');
    tilt(0, 90, 0);
    tilt(-30, 90, 0);
    expect(view.yaw).toBeCloseTo(30);
    view.setMotion(false);
    tilt(-90, 90, 0);
    expect(view.yaw).toBeCloseTo(30);
    view.setMotion(true);
    tilt(-90, 90, 0);
    expect(view.yaw).toBeCloseTo(30);
    tilt(-100, 90, 0);
    expect(view.yaw).toBeCloseTo(40);
  });

  it('learns the device has sensors from the first event with angles', async () => {
    const { view } = await rig('projection="equirectangular"');
    const changes = vi.fn();
    view.addEventListener('motionchange', changes);
    tilt(null, null, null);
    expect(view.motionAvailable).toBe(false);
    tilt(0, 90, 0);
    expect(view.motionAvailable).toBe(true);
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('turns motion back off when iOS refuses it', async () => {
    const ios = fakePermission('denied');
    try {
      const { view } = await rig('projection="equirectangular" motion="off"');
      view.setMotion(true);
      expect(ios.asked).toHaveBeenCalledTimes(1);
      await settle();
      expect(view.motionOn).toBe(false);
    } finally {
      ios.restore();
    }
  });
});

describe('<mbx-motion-button>', () => {
  async function rigMotion(attributes = 'projection="equirectangular"'): Promise<{
    view: Mbx360;
    button: MbxMotionButton;
    inner: HTMLButtonElement;
  }> {
    const { player, view } = await rig(attributes);
    const button = document.createElement('mbx-motion-button');
    player.append(button);
    await settle();
    const inner = button.shadowRoot?.querySelector('button') as HTMLButtonElement;
    return { view, button, inner };
  }

  it('stays hidden on a device without sensors, which is every browser here', async () => {
    const { button } = await rigMotion();
    tilt(null, null, null);
    expect(button.hidden).toBe(true);
  });

  it('shows once the device sends angles, and switches the motion', async () => {
    const { view, button, inner } = await rigMotion();
    tilt(0, 90, 0);
    expect(button.hidden).toBe(false);
    expect(inner.getAttribute('aria-label')).toBe('Turn with the device');
    expect(inner.getAttribute('aria-pressed')).toBe('true');
    inner.click();
    expect(view.motionOn).toBe(false);
    expect(inner.getAttribute('aria-pressed')).toBe('false');
    const off = button.shadowRoot?.querySelector('slot[name="icon-off"]') as HTMLSlotElement;
    expect(off.hidden).toBe(false);
    tilt(-90, 90, 0);
    expect(view.yaw).toBeCloseTo(0);
    inner.click();
    expect(inner.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows on iOS before any motion, and asks for the permission from its click', async () => {
    const ios = fakePermission('granted');
    const media = fakeMedia(false, true);
    try {
      const { view, button, inner } = await rigMotion('projection="equirectangular" motion="off"');
      expect(button.hidden).toBe(false);
      inner.click();
      expect(view.motionOn).toBe(true);
      expect(ios.asked).toHaveBeenCalledTimes(1);
    } finally {
      media.restore();
      ios.restore();
    }
  });

  it('takes its label from its attribute, and hides while the source is flat', async () => {
    const { button, inner } = await rigMotion('');
    tilt(0, 90, 0);
    expect(button.hidden).toBe(true);
    button.setAttribute('label', 'Gir');
    expect(inner.getAttribute('aria-label')).toBe('Gir');
  });
});

/** A WebXR session that records what the view asks of it. */
class FakeSession extends EventTarget {
  declare frame: ((time: number, frame: unknown) => void) | null;
  declare layer: unknown;
  constructor() {
    super();
    this.frame = null;
    this.layer = null;
  }
  updateRenderState(state: { baseLayer: unknown }): void {
    this.layer = state.baseLayer;
  }
  requestReferenceSpace(): Promise<object> {
    return Promise.resolve({});
  }
  requestAnimationFrame(callback: (time: number, frame: unknown) => void): number {
    this.frame = callback;
    return 1;
  }
  end(): Promise<void> {
    this.dispatchEvent(new Event('end'));
    return Promise.resolve();
  }
}

/** Puts a fake `navigator.xr` and `XRWebGLLayer` on the page; returns the sessions it starts and a cleanup. */
function fakeXr(supported: boolean): { sessions: FakeSession[]; restore: () => void } {
  const sessions: FakeSession[] = [];
  const xr = Object.assign(new EventTarget(), {
    isSessionSupported: () => Promise.resolve(supported),
    requestSession: () => {
      const session = new FakeSession();
      sessions.push(session);
      return Promise.resolve(session);
    },
  });
  Object.defineProperty(navigator, 'xr', { configurable: true, value: xr });
  Object.defineProperty(window, 'XRWebGLLayer', {
    configurable: true,
    value: class {
      framebuffer = null;
      getViewport(): object {
        return { x: 0, y: 0, width: 32, height: 32 };
      }
    },
  });
  return {
    sessions,
    restore: () => {
      delete (navigator as { xr?: unknown }).xr;
      delete (window as { XRWebGLLayer?: unknown }).XRWebGLLayer;
    },
  };
}

/** Lets promises and mutation observers run. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

describe('<mbx-vr-button>', () => {
  async function rigButton(attributes = ''): Promise<{
    player: MatteboxPlayerElement;
    view: Mbx360;
    button: MbxVrButton;
  }> {
    const { player, view } = await rig(`projection="equirectangular" ${attributes}`);
    const button = document.createElement('mbx-vr-button');
    player.append(button);
    await settle();
    return { player, view, button };
  }

  it('stays hidden without a headset, which is every browser here', async () => {
    const { button } = await rigButton();
    expect(button.hidden).toBe(true);
  });

  it('stays hidden with WebXR but no headset', async () => {
    const fake = fakeXr(false);
    try {
      const { button } = await rigButton();
      expect(button.hidden).toBe(true);
    } finally {
      fake.restore();
    }
  });

  it('shows with a headset while the view shows, and draws each eye into the session', async () => {
    const fake = fakeXr(true);
    try {
      const { player, view, button } = await rigButton();
      expect(button.hidden).toBe(false);
      const inner = button.shadowRoot?.querySelector('button') as HTMLButtonElement;
      expect(inner.getAttribute('aria-label')).toBe('Enter VR');
      // The real makeXRCompatible needs a device.
      const canvas = view.shadowRoot?.querySelector('canvas') as HTMLCanvasElement;
      const gl = canvas.getContext('webgl') as WebGLRenderingContext & {
        makeXRCompatible?: () => Promise<void>;
      };
      gl.makeXRCompatible = () => Promise.resolve();
      inner.click();
      await settle();
      const session = fake.sessions[0] as FakeSession;
      expect(session.layer).not.toBeNull();
      expect(view.immersive).toBe(true);
      expect(view.getAttribute('vr')).toBe('webxr');
      expect(inner.getAttribute('aria-label')).toBe('Exit VR');
      // One frame, one eye looking ahead: nothing throws without a picture.
      const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      const eye = { projectionMatrix: identity, transform: { matrix: identity } };
      session.frame?.(0, { getViewerPose: () => ({ views: [eye] }) });
      inner.click();
      await settle();
      expect(view.immersive).toBe(false);
      expect(view.hasAttribute('vr')).toBe(false);
      expect(inner.getAttribute('aria-label')).toBe('Enter VR');
      // A flat source hides the button.
      player.setAttribute('projection', 'none');
      view.setAttribute('projection', 'none');
      await settle();
      expect(button.hidden).toBe(true);
    } finally {
      fake.restore();
    }
  });

  it('takes its labels from its attributes', async () => {
    const fake = fakeXr(true);
    try {
      const { button } = await rigButton();
      button.setAttribute('label-enter', 'Casc');
      const inner = button.shadowRoot?.querySelector('button') as HTMLButtonElement;
      expect(inner.getAttribute('aria-label')).toBe('Casc');
    } finally {
      fake.restore();
    }
  });

  it('refuses a session without a view to show', async () => {
    const fake = fakeXr(true);
    try {
      const view = document.createElement('mbx-360');
      await expect(view.enterVR()).rejects.toThrow();
      expect(fake.sessions).toHaveLength(0);
    } finally {
      fake.restore();
    }
  });

  it('tells the page when the way to a headset changes', async () => {
    const fake = fakeXr(true);
    try {
      const { view } = await rigButton();
      expect(view.headsetAvailable).toBe('webxr');
      const changes = vi.fn();
      view.addEventListener('headsetchange', changes);
      view.setAttribute('headset', 'stereo');
      expect(view.headsetAvailable).toBeNull();
      expect(changes).toHaveBeenCalledTimes(1);
    } finally {
      fake.restore();
    }
  });
});

/**
 * Makes this browser a phone's: a touch screen, and a page that may go
 * fullscreen. The sensors come from `tilt()`. The player's fullscreen is
 * replaced, since a real one needs a click; `fullscreen` counts the calls.
 */
function fakePhone(): { fullscreen: ReturnType<typeof vi.fn>; restore: () => void } {
  const media = fakeMedia(false, true);
  const fullscreen = vi.fn(() => Promise.resolve());
  const real = HTMLElement.prototype.requestFullscreen;
  HTMLElement.prototype.requestFullscreen = fullscreen;
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
  return {
    fullscreen,
    restore: () => {
      media.restore();
      HTMLElement.prototype.requestFullscreen = real;
      delete (document as { fullscreenEnabled?: boolean }).fullscreenEnabled;
    },
  };
}

describe('the split screen', () => {
  async function rigSplit(headset: string | null): Promise<{
    player: MatteboxPlayerElement;
    view: Mbx360;
    button: MbxVrButton;
    inner: HTMLButtonElement;
  }> {
    const { player, view } = await rig(
      `projection="equirectangular" ${headset === null ? '' : `headset="${headset}"`}`,
    );
    const button = document.createElement('mbx-vr-button');
    player.append(button);
    await settle();
    const inner = button.shadowRoot?.querySelector('button') as HTMLButtonElement;
    return { player, view, button, inner };
  }

  it('is not offered unless the page names it', async () => {
    const phone = fakePhone();
    try {
      const { view, button } = await rigSplit(null);
      tilt(0, 90, 0);
      expect(view.headsetAvailable).toBeNull();
      expect(button.hidden).toBe(true);
    } finally {
      phone.restore();
    }
  });

  it('is not offered on a computer, which has no touch screen', async () => {
    const { view, button } = await rigSplit('webxr stereo');
    tilt(0, 90, 0);
    expect(view.headsetAvailable).toBeNull();
    expect(button.hidden).toBe(true);
  });

  it('shows on a phone without WebXR once it sends angles, and fills the screen', async () => {
    const phone = fakePhone();
    try {
      const { view, button, inner } = await rigSplit('webxr stereo');
      expect(button.hidden).toBe(true);
      tilt(0, 90, 0);
      expect(view.headsetAvailable).toBe('stereo');
      expect(button.hidden).toBe(false);
      inner.click();
      await settle();
      expect(phone.fullscreen).toHaveBeenCalledTimes(1);
      expect(view.immersive).toBe(true);
      expect(view.getAttribute('vr')).toBe('stereo');
      expect(inner.getAttribute('aria-label')).toBe('Exit VR');
      inner.click();
      await settle();
      expect(view.immersive).toBe(false);
      expect(view.hasAttribute('vr')).toBe(false);
      expect(inner.getAttribute('aria-label')).toBe('Enter VR');
    } finally {
      phone.restore();
    }
  });

  it('ends when the viewer leaves fullscreen', async () => {
    const phone = fakePhone();
    try {
      const { view } = await rigSplit('stereo');
      tilt(0, 90, 0);
      await view.enterVR();
      expect(view.getAttribute('vr')).toBe('stereo');
      // The player is not the fullscreen element: the fake never made it one.
      document.dispatchEvent(new Event('fullscreenchange'));
      expect(view.immersive).toBe(false);
      expect(view.hasAttribute('vr')).toBe(false);
    } finally {
      phone.restore();
    }
  });

  it('ends when the browser refuses fullscreen, and says so', async () => {
    const phone = fakePhone();
    try {
      const { view } = await rigSplit('stereo');
      tilt(0, 90, 0);
      phone.fullscreen.mockImplementationOnce(() => Promise.reject(new Error('refused')));
      await expect(view.enterVR()).rejects.toThrow('refused');
      expect(view.immersive).toBe(false);
      expect(view.hasAttribute('vr')).toBe(false);
    } finally {
      phone.restore();
    }
  });

  it('gives way to WebXR where a headset answers, unless the page names it alone', async () => {
    const phone = fakePhone();
    const fake = fakeXr(true);
    try {
      const { view } = await rigSplit('webxr stereo');
      tilt(0, 90, 0);
      expect(view.headsetAvailable).toBe('webxr');
      view.setAttribute('headset', 'stereo');
      expect(view.headsetAvailable).toBe('stereo');
    } finally {
      fake.restore();
      phone.restore();
    }
  });

  it('is not offered where only the video goes fullscreen, as on an iPhone', async () => {
    const phone = fakePhone();
    try {
      const { player, view, button } = await rigSplit('webxr stereo');
      // An iPhone's elements have neither method.
      Object.defineProperties(player, {
        requestFullscreen: { configurable: true, value: undefined },
        webkitRequestFullscreen: { configurable: true, value: undefined },
      });
      tilt(0, 90, 0);
      expect(view.headsetAvailable).toBeNull();
      expect(button.hidden).toBe(true);
    } finally {
      phone.restore();
    }
  });

  it('follows the device with motion off, and lets go of it at the end', async () => {
    const phone = fakePhone();
    try {
      const { view } = await rigSplit('stereo');
      view.setAttribute('motion', 'off');
      tilt(0, 90, 0);
      await view.enterVR();
      tilt(0, 90, 0);
      tilt(-90, 90, 0);
      expect(view.yaw).toBeCloseTo(90);
      expect(view.motionOn).toBe(false);
      await view.exitVR();
      tilt(-180, 90, 0);
      expect(view.yaw).toBeCloseTo(90);
    } finally {
      phone.restore();
    }
  });
});
