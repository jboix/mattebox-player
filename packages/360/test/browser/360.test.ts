/**
 * <mbx-360> from outside the player package, the way a page gets it. The
 * renderer draws a picture of four coloured quarters and reads pixels back;
 * the element runs over a short silence, which is enough for its states.
 */
import { MatteboxPlayerElement } from '@mattebox/player';
import type { Mbx360 } from '@mattebox/player-360';
import { nativeHandler } from '@mattebox/player-core';
import '@mattebox/player-360';
import { afterEach, describe, expect, it } from 'vitest';
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
