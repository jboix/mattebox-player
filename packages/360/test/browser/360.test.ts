/**
 * <mbx-360> from outside the player package, the way a page gets it. The
 * renderer draws a picture of four coloured quarters and reads pixels back;
 * the element runs over a short silence, which is enough for its states.
 */
import { MatteboxPlayerElement } from '@mattebox/player';
import type { Mbx360, MbxVrButton } from '@mattebox/player-360';
import { nativeHandler } from '@mattebox/player-core';
import '@mattebox/player-360';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sphere } from '../../src/sphere.js';
import type { Projection } from '../../src/view.js';
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
  async function rigButton(): Promise<{
    player: MatteboxPlayerElement;
    view: Mbx360;
    button: MbxVrButton;
  }> {
    const { player, view } = await rig('projection="equirectangular"');
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
      expect(view.hasAttribute('vr')).toBe(true);
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
});
