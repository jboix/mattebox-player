/**
 * <mbx-360>: a 360° video, seen from inside. Placed in the player, it draws
 * the picture onto the inside of a sphere over the video, and the viewer
 * looks around: a drag, the mouse wheel to zoom, and a game controller's
 * right stick. A tap without a drag plays or pauses, as on the video.
 *
 * - It shows while the source is 360°: its own `projection` attribute, else
 *   the player's, which comes from the source or the manifest.
 *   `projection="none"` keeps a source flat.
 * - It does not show, and says why in `unavailable`, where the browser does
 *   not let a page read the picture: `drm` for an encrypted source,
 *   `source` for another origin's video served without CORS, `webgl` with
 *   no WebGL. The flat video plays then.
 * - The poster shows as on a flat video, until the source plays or seeks;
 *   the sphere draws from then. A new load hides the last source's picture
 *   as soon as the video empties.
 * - While it shows, the video keeps a 16:9 box: an equirectangular picture
 *   is 2:1, and the view is a window into it, not the picture.
 * - The browser draws subtitles inside the video, under the view, so the
 *   element writes the active cues over the view itself.
 *
 * No class fields: the ES2015 build would lower them into helpers, and the
 * emit check bans helpers. State is declared, then assigned in the
 * constructor.
 */
import type { PlayerHost } from '@mattebox/player';
import { findPlayer, PLAYER } from './host.js';
import { Sphere } from './sphere.js';
import type { Projection, View } from './view.js';
import { clamp, DEFAULT_FOV, drag } from './view.js';
import CSS from './view-360.css?inline';

/** Why the view does not show for a 360° source. */
export type Unavailable = 'drm' | 'source' | 'webgl';

const PROJECTIONS: readonly string[] = ['equirectangular', 'half-equirectangular'];

const DEGREES = 180 / Math.PI;

/** A press that moves less than this, in CSS pixels, is a tap: it plays or pauses. */
const TAP_PX = 6;

/** The right stick leans past this much before it turns the view. */
const DEAD_ZONE = 0.2;

/** Radians a second the right stick turns the view at full lean. */
const STICK_SPEED = Math.PI / 2;

/** The canvas draws at the screen's pixel ratio, up to this, so a 3x phone does not draw 9 times the pixels. */
const MAX_RATIO = 2;

/** One press on the view: where it started, where it was last, and whether it became a drag. */
interface Press {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  lastX: number;
  lastY: number;
  moved: boolean;
}

export class Mbx360 extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['projection', 'fov'];
  }

  declare private player: PlayerHost | null;
  declare private offs: Array<() => void>;
  /** Bumped on every connect and disconnect, so a late upgrade attaches only to the current connection. */
  declare private epoch: number;
  declare private canvas: HTMLCanvasElement;
  declare private words: HTMLElement;
  declare private sphere: Sphere | null;
  declare private view: View;
  declare private frame: number;
  /** The view changed since the last draw. */
  declare private dirty: boolean;
  /** The video's time at the last draw. */
  declare private shown: number;
  /** The time of the last frame, for the stick's speed. */
  declare private last: number;
  declare private press: Press | null;
  /** The video's own `aspect-ratio` from before the view showed; null while the view does not hold it. */
  declare private ratio: string | null;
  /** The source fired `encrypted`. */
  declare private encrypted: boolean;
  /** The source failed to draw, or the browser has no WebGL. */
  declare private failed: Unavailable | null;
  /** The subtitles on screen. */
  declare private said: string;
  /** The canvas holds a frame of the current source. */
  declare private drawn: boolean;
  /** The source played or seeked since it loaded: a video then no longer shows its poster. */
  declare private started: boolean;

  constructor() {
    super();
    this.player = null;
    this.offs = [];
    this.epoch = 0;
    this.sphere = null;
    this.view = { yaw: 0, pitch: 0, fov: DEFAULT_FOV };
    this.frame = 0;
    this.dirty = true;
    this.shown = -1;
    this.last = 0;
    this.press = null;
    this.ratio = null;
    this.encrypted = false;
    this.failed = null;
    this.said = '';
    this.drawn = false;
    this.started = false;
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('part', 'view');
    // The video stays the accessible media; this is a picture of it.
    this.canvas.setAttribute('aria-hidden', 'true');
    // Hidden until there is a frame to show: the video shows through.
    this.canvas.style.visibility = 'hidden';
    this.words = document.createElement('div');
    this.words.setAttribute('part', 'subtitles');
    this.words.setAttribute('aria-hidden', 'true');
    root.append(style, this.canvas, this.words);
  }

  /** Degrees the view is turned right of the picture's centre. */
  get yaw(): number {
    return this.view.yaw * DEGREES;
  }

  set yaw(value: number) {
    this.look({ yaw: value / DEGREES, pitch: this.view.pitch, fov: this.view.fov });
  }

  /** Degrees the view looks up. */
  get pitch(): number {
    return this.view.pitch * DEGREES;
  }

  set pitch(value: number) {
    this.look({ yaw: this.view.yaw, pitch: value / DEGREES, fov: this.view.fov });
  }

  /** The vertical field of view in degrees, from 30 to 100. */
  get fov(): number {
    return this.view.fov * DEGREES;
  }

  set fov(value: number) {
    this.look({ yaw: this.view.yaw, pitch: this.view.pitch, fov: value / DEGREES });
  }

  /** The projection the view draws, or null while the source is flat. */
  get projection(): Projection | null {
    const value =
      this.getAttribute('projection') ?? this.player?.getAttribute('projection') ?? null;
    return value !== null && PROJECTIONS.includes(value) ? (value as Projection) : null;
  }

  connectedCallback(): void {
    const found = findPlayer(this);
    if (found === null) return;
    this.epoch += 1;
    const epoch = this.epoch;
    const attach = (): void => {
      if (epoch !== this.epoch || !this.isConnected) return;
      customElements.upgrade(found);
      if (!('media' in found)) return;
      this.player = found as PlayerHost;
      this.attach(this.player);
    };
    if ('media' in found) attach();
    else void customElements.whenDefined(PLAYER).then(attach);
  }

  disconnectedCallback(): void {
    this.epoch += 1;
    for (const off of this.offs) off();
    this.offs = [];
    this.show(false);
    this.sphere?.dispose();
    this.sphere = null;
    this.player = null;
  }

  attributeChangedCallback(name: string): void {
    if (name === 'fov') this.look(this.start());
    else this.update();
  }

  private attach(player: PlayerHost): void {
    const media = player.media;
    const watch = new MutationObserver(() => this.update());
    watch.observe(player, { attributes: true, attributeFilter: ['projection'] });
    this.offs.push(() => watch.disconnect());
    this.on(player, 'sourcechange', () => {
      this.encrypted = false;
      if (this.failed !== 'webgl') this.failed = null;
      this.view = this.start();
      this.blank();
      this.update();
    });
    // The video empties as soon as a new load starts, before `sourcechange`,
    // which waits for a connector: the old frame goes at once.
    this.on(media, 'emptied', () => {
      this.started = false;
      this.blank();
    });
    this.on(media, 'playing', () => this.begin());
    this.on(media, 'seeked', () => this.begin());
    this.on(media, 'encrypted', () => {
      this.encrypted = true;
      this.update();
    });
    const canvas = this.canvas;
    this.on(canvas, 'pointerdown', (event) => this.down(event as PointerEvent));
    this.on(canvas, 'pointermove', (event) => this.move(event as PointerEvent));
    this.on(canvas, 'pointerup', (event) => this.up(event as PointerEvent));
    this.on(canvas, 'pointercancel', () => {
      this.press = null;
    });
    this.on(
      canvas,
      'wheel',
      (event) => {
        event.preventDefault();
        const { yaw, pitch, fov } = this.view;
        this.look({ yaw, pitch, fov: fov * Math.exp((event as WheelEvent).deltaY * 0.001) });
      },
      { passive: false },
    );
    this.view = this.start();
    this.update();
  }

  /**
   * The player's own video element. `player.media` is a stand-in that also
   * answers for a cast device, and WebGL takes only a real element.
   */
  private video(): HTMLVideoElement | null {
    return this.player?.querySelector<HTMLVideoElement>(':scope > video') ?? null;
  }

  /** Adds `fn` for `name` on `target`, removed on detach. */
  private on(
    target: EventTarget,
    name: string,
    fn: (event: Event) => void,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(name, fn, options);
    this.offs.push(() => target.removeEventListener(name, fn, options));
  }

  /** The view a source starts with: straight ahead, at the `fov` attribute. */
  private start(): View {
    const fov = Number(this.getAttribute('fov'));
    return clamp({ yaw: 0, pitch: 0, fov: fov > 0 ? fov / DEGREES : DEFAULT_FOV });
  }

  private look(view: View): void {
    this.view = clamp(view);
    this.dirty = true;
  }

  /** Decides whether the view shows, and why not. */
  private update(): void {
    const player = this.player;
    const projection = this.projection;
    let reason: Unavailable | null = null;
    if (player !== null && projection !== null) {
      if (this.encrypted || this.video()?.mediaKeys != null) reason = 'drm';
      else if (this.failed !== null) reason = this.failed;
      else if (this.sphere === null) {
        try {
          this.sphere = new Sphere(this.canvas);
        } catch {
          this.failed = 'webgl';
          reason = 'webgl';
        }
      }
    }
    if (reason === null) this.removeAttribute('unavailable');
    else this.setAttribute('unavailable', reason);
    this.show(player !== null && projection !== null && reason === null);
  }

  private show(on: boolean): void {
    const video = this.video();
    if (on === this.hasAttribute('active') || video === null) {
      if (!on) this.stop();
      return;
    }
    this.toggleAttribute('active', on);
    if (on) {
      this.ratio = video.style.getPropertyValue('aspect-ratio');
      video.style.setProperty('aspect-ratio', '16 / 9');
      this.dirty = true;
      this.frame = requestAnimationFrame((now) => this.tick(now));
    } else {
      if (this.ratio !== null) video.style.setProperty('aspect-ratio', this.ratio);
      this.ratio = null;
      this.blank();
      this.words.textContent = '';
      this.said = '';
      this.stop();
    }
  }

  /**
   * Hides the last source's frame until the new one draws, so the new
   * source's poster shows meanwhile, not a picture of the old one.
   */
  private blank(): void {
    this.drawn = false;
    this.shown = -1;
    this.dirty = true;
    this.canvas.style.visibility = 'hidden';
  }

  /** The source played or seeked: its frames replace the poster. */
  private begin(): void {
    this.started = true;
    this.dirty = true;
  }

  /**
   * Shows the canvas once it holds a frame of the source, and once the
   * video would show that frame too: a video keeps its poster until it
   * plays or seeks, so a programme waiting at its start shows its poster
   * here as well, not a flash of it before the first frame.
   */
  private reveal(media: HTMLVideoElement): void {
    const visible = this.drawn && (this.started || media.poster === '');
    const value = visible ? '' : 'hidden';
    if (this.canvas.style.visibility !== value) this.canvas.style.visibility = value;
  }

  private stop(): void {
    if (this.frame !== 0) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.last = 0;
    this.press = null;
  }

  private tick(now: number): void {
    this.frame = 0;
    const player = this.player;
    const sphere = this.sphere;
    const projection = this.projection;
    const media = this.video();
    if (player === null || sphere === null || projection === null || media === null) return;
    this.steer(now);
    this.fit();
    const changed = this.dirty || media.currentTime !== this.shown || !media.paused;
    // No picture yet, or none at all: nothing to draw, and the canvas stays black.
    const picture = media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && media.videoWidth > 0;
    if (changed && picture) {
      try {
        sphere.draw(media, this.view, projection);
      } catch {
        // A SecurityError: another origin's picture, without CORS.
        this.failed = 'source';
        this.update();
        return;
      }
      this.shown = media.currentTime;
      this.dirty = false;
      this.drawn = true;
    }
    this.reveal(media);
    this.subtitles(media);
    this.frame = requestAnimationFrame((next) => this.tick(next));
  }

  /** Sizes the canvas to its box, at the screen's pixel ratio. */
  private fit(): void {
    const canvas = this.canvas;
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_RATIO);
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (width === canvas.width && height === canvas.height) return;
    canvas.width = width;
    canvas.height = height;
    this.dirty = true;
  }

  /** Turns the view with a game controller's right stick, by the time since the last frame. */
  private steer(now: number): void {
    const seconds = this.last === 0 ? 0 : Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (seconds === 0 || typeof navigator.getGamepads !== 'function') return;
    for (const pad of navigator.getGamepads()) {
      if (pad == null) continue;
      const x = pad.axes[2] ?? 0;
      const y = pad.axes[3] ?? 0;
      if (Math.abs(x) < DEAD_ZONE && Math.abs(y) < DEAD_ZONE) continue;
      const { yaw, pitch, fov } = this.view;
      const step = STICK_SPEED * seconds;
      this.look({ yaw: yaw + x * step, pitch: pitch - y * step, fov });
    }
  }

  /** Writes the active cues of the showing text tracks over the view. */
  private subtitles(media: HTMLMediaElement): void {
    const lines: string[] = [];
    for (const track of Array.from(media.textTracks)) {
      if (track.mode !== 'showing') continue;
      for (const cue of Array.from(track.activeCues ?? [])) {
        const text = (cue as TextTrackCue & { text?: string }).text;
        if (text !== undefined) lines.push(text.replace(/<[^>]*>/g, ''));
      }
    }
    const said = lines.join('\n');
    if (said === this.said) return;
    this.said = said;
    this.words.textContent = said;
  }

  private down(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.press = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
    };
    // The drag goes on outside the view. A pointer already gone cannot be captured.
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {}
  }

  private move(event: PointerEvent): void {
    const press = this.press;
    if (press === null || press.id !== event.pointerId) return;
    if (!press.moved) {
      press.moved = Math.hypot(event.clientX - press.x, event.clientY - press.y) >= TAP_PX;
      if (!press.moved) return;
    }
    const dx = event.clientX - press.lastX;
    const dy = event.clientY - press.lastY;
    press.lastX = event.clientX;
    press.lastY = event.clientY;
    this.view = drag(this.view, dx, dy, this.canvas.clientHeight);
    this.dirty = true;
  }

  private up(event: PointerEvent): void {
    const press = this.press;
    if (press === null || press.id !== event.pointerId) return;
    this.press = null;
    // A tap is a click on the video, which the control bar plays or pauses on.
    if (!press.moved) this.video()?.click();
  }
}
