/**
 * <mbx-360>: a 360° video, seen from inside. Placed in the player, it draws
 * the picture onto the inside of a sphere over the video, and the viewer
 * looks around: a drag, the mouse wheel to zoom, a game controller's right
 * stick, and the motion of a phone or a tablet. A tap without a drag plays
 * or pauses, as on the video. `enterVR()` shows the view in a headset,
 * which `<mbx-vr-button>` offers.
 *
 * - `headset` names the ways a headset shows the view: `webxr`, a WebXR
 *   session, and `stereo`, the screen split in two for a phone in a viewer.
 *   It is `webxr` unless the page names any. With both, WebXR goes first
 *   where a headset answers. `headsetAvailable` is the way `enterVR()`
 *   takes now, and `headsetchange` says it changed.
 * - The split screen needs the player itself fullscreen, a touch screen and
 *   motion sensors. An iPhone has fullscreen on the video alone, so it is
 *   never offered there. The device turns the view while it shows,
 *   whatever `motion` says: in a viewer the head is the only way to look.
 * - The device's motion turns the view unless `motion="off"`, or unless the
 *   system asks for reduced motion and `motion` is not `on`. The viewer's
 *   own choice, through `setMotion()` and `<mbx-motion-button>`, wins until
 *   the page sets `motion` again. `motionchange` says the state changed.
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
import { FULLSCREEN_EVENTS, fill, filling, fills, landscape, unfill, upright } from './screen.js';
import { Sphere } from './sphere.js';
import type { Projection, View } from './view.js';
import { clamp, DEFAULT_FOV, drag, orientation } from './view.js';
import CSS from './view-360.css?inline';
import type { XRFrame, XRLayer, XRLayerConstructor, XRSession } from './xr.js';
import { compatible, headsets, webxr } from './xr.js';

/** Why the view does not show for a 360° source. */
export type Unavailable = 'drm' | 'source' | 'webgl';

/** A way a headset shows the view: a WebXR session, or the screen split in two for a phone in a viewer. */
export type Headset = 'webxr' | 'stereo';

/** A phone or a tablet: its first pointer is a finger. */
const TOUCH = '(pointer: coarse)';

const PROJECTIONS: readonly string[] = ['equirectangular', 'half-equirectangular'];

const DEGREES = 180 / Math.PI;

/** The system's setting for people whom moving pictures make ill. */
const REDUCED = '(prefers-reduced-motion: reduce)';

/** iOS's `DeviceOrientationEvent`, which asks before it sends motion, or an empty object elsewhere. */
function permission(): Permission {
  return (typeof DeviceOrientationEvent === 'undefined'
    ? {}
    : DeviceOrientationEvent) as unknown as Permission;
}

/** A press that moves less than this, in CSS pixels, is a tap: it plays or pauses. */
const TAP_PX = 6;

/** The right stick leans past this much before it turns the view. */
const DEAD_ZONE = 0.2;

/** Radians a second the right stick turns the view at full lean. */
const STICK_SPEED = Math.PI / 2;

/** The canvas draws at the screen's pixel ratio, up to this, so a 3x phone does not draw 9 times the pixels. */
const MAX_RATIO = 2;

/** iOS's `DeviceOrientationEvent.requestPermission()`, which TypeScript's DOM library does not type. */
interface Permission {
  requestPermission?: () => Promise<string>;
}

/** The screen's turn from the device's natural orientation, in degrees. */
function screenAngle(): number {
  // `window.orientation` is the older iOS Safari's, before `screen.orientation` (Safari 16.4).
  return screen.orientation?.angle ?? (window as { orientation?: number }).orientation ?? 0;
}

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
    return ['projection', 'fov', 'motion', 'headset'];
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
  /** Where the device points, from its last `deviceorientation`; null while motion does not turn the view. */
  declare private device: View | null;
  /** The turn a drag, the wheel or the page added on top of the device's motion. */
  declare private offset: { readonly yaw: number; readonly pitch: number };
  /** The element listens to `deviceorientation`: the view shows and the browser has the event. */
  declare private moving: boolean;
  /** The element asked iOS for the motion permission. */
  declare private asked: boolean;
  /** The viewer's choice through `setMotion()`, or null until they make one or after the page sets `motion`. */
  declare private chosen: boolean | null;
  /** An event with angles came: the device has the sensors. */
  declare private sensed: boolean;
  /** `motionOn` and `motionAvailable` as `motionchange` last told them. */
  declare private reported: string;
  /** The `deviceorientation` listener, one function so it can be removed. */
  declare private readonly turned: (event: Event) => void;
  /** The headset session that shows the view, or null. */
  declare private session: XRSession | null;
  /** A headset can show an immersive session, as the browser last said. */
  declare private xr: boolean;
  /** The split screen shows the view. */
  declare private split: boolean;
  /** The element took the player fullscreen for the split screen, so it gives the screen back. */
  declare private filled: boolean;
  /** `headsetAvailable` as `headsetchange` last told it. */
  declare private offered: string;

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
    this.device = null;
    this.offset = { yaw: 0, pitch: 0 };
    this.moving = false;
    this.asked = false;
    this.chosen = null;
    this.sensed = false;
    this.reported = '';
    this.session = null;
    this.xr = false;
    this.split = false;
    this.filled = false;
    this.offered = 'null';
    this.turned = (event) => this.turn(event as DeviceOrientationEvent);
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
    // A context the browser lost comes back only when the page asks.
    // Entering a headset can lose it, on a computer with two GPUs.
    this.canvas.addEventListener('webglcontextlost', (event) => event.preventDefault());
    this.canvas.addEventListener('webglcontextrestored', () => {
      if (this.sphere === null) return;
      try {
        this.sphere = new Sphere(this.canvas);
      } catch {
        this.sphere = null;
        this.failed = 'webgl';
        this.update();
      }
      this.dirty = true;
    });
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

  /**
   * The device's motion turns the view while it shows: the viewer's
   * choice, else `motion="on"` or `"off"`, else on unless the system asks
   * for reduced motion.
   */
  get motionOn(): boolean {
    if (this.chosen !== null) return this.chosen;
    const asked = this.getAttribute('motion');
    if (asked === 'on' || asked === 'off') return asked === 'on';
    return !(typeof matchMedia === 'function' && matchMedia(REDUCED).matches);
  }

  /**
   * The device can turn the view: it sent angles, or it is a touch device
   * that sends them only once the page asks (iOS).
   */
  get motionAvailable(): boolean {
    return (
      this.sensed ||
      (typeof permission().requestPermission === 'function' &&
        typeof matchMedia === 'function' &&
        matchMedia(TOUCH).matches)
    );
  }

  /**
   * The viewer turns the device's motion on or off, until the page sets
   * `motion` again. Call it from a click to turn it on: iOS asks for the
   * permission then, and a refusal turns it back off.
   */
  setMotion(on: boolean): void {
    this.chosen = on;
    this.sync();
    if (on) this.ask(true);
  }

  /**
   * A headset shows the view, through WebXR or the split screen. The
   * element's `vr` attribute names the way meanwhile.
   */
  get immersive(): boolean {
    return this.session !== null || this.split;
  }

  /**
   * The way `enterVR()` shows the view now, or null where it cannot: the
   * first way `headset` allows that the device has, WebXR before the split
   * screen. Null while no view shows.
   */
  get headsetAvailable(): Headset | null {
    if (this.sphere === null || !this.hasAttribute('active')) return null;
    const ways = this.allowed();
    if (this.xr && ways.includes('webxr')) return 'webxr';
    if (ways.includes('stereo') && this.splits()) return 'stereo';
    return null;
  }

  /**
   * Shows the view in a headset, from where the screen looks: the way
   * `headsetAvailable` names. Call it from a click or a key press: the
   * browser starts a session, and fullscreen, only then. Rejects where no
   * view shows, no allowed way is there, or the browser refuses.
   */
  enterVR(): Promise<void> {
    if (this.sphere === null || this.immersive || !this.hasAttribute('active')) {
      return Promise.reject(new DOMException('No 360° view to show', 'InvalidStateError'));
    }
    if (this.headsetAvailable === 'stereo') return this.halve();
    const api = webxr();
    if (api === null || !this.allowed().includes('webxr')) {
      return Promise.reject(new DOMException('No headset to show the view', 'NotSupportedError'));
    }
    // Asked even before the browser said a headset is there: it is the one that refuses.
    // Before any wait: the click's permission to start a session ends with the click.
    return api.xr
      .requestSession('immersive-vr')
      .then((session) => this.immerse(session, api.Layer));
  }

  /** Ends the headset session or the split screen, if one shows. */
  exitVR(): Promise<void> {
    this.whole();
    return this.session?.end() ?? Promise.resolve();
  }

  /**
   * Over Safari's own HLS the video shows flat, so the player keeps HLS on
   * the engine while the view is inside it. `native-hls="on"` overrides it.
   */
  get needsEngine(): boolean {
    return true;
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
    this.leave();
    this.sphere?.dispose();
    this.sphere = null;
    this.player = null;
    this.xr = false;
    this.motion();
  }

  attributeChangedCallback(name: string): void {
    if (name === 'fov') this.look(this.start());
    else if (name === 'motion') {
      // The page's newer word replaces the viewer's choice.
      this.chosen = null;
      this.sync();
    } else if (name === 'headset') this.offer();
    else this.update();
  }

  private attach(player: PlayerHost): void {
    const media = player.media;
    const watch = new MutationObserver(() => this.update());
    watch.observe(player, { attributes: true, attributeFilter: ['projection'] });
    this.offs.push(() => watch.disconnect());
    // The system's reduced motion turns the default off and on while the page is open.
    if (typeof matchMedia === 'function') {
      const query = matchMedia(REDUCED) as MediaQueryList & {
        addListener(listener: () => void): void;
        removeListener(listener: () => void): void;
      };
      const changed = (): void => this.sync();
      // Safari before 14 has only addListener on a MediaQueryList.
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', changed);
        this.offs.push(() => query.removeEventListener('change', changed));
      } else {
        query.addListener(changed);
        this.offs.push(() => query.removeListener(changed));
      }
    }
    // A headset plugged in or out (WebXR's `devicechange`) changes the answer.
    const epoch = this.epoch;
    const probe = (): void => {
      void headsets().then((supported) => {
        if (epoch !== this.epoch) return;
        this.xr = supported;
        this.offer();
      });
    };
    const xr = webxr()?.xr;
    if (xr !== undefined) this.on(xr, 'devicechange', probe);
    probe();
    // The viewer left fullscreen, or the browser refused it: the split screen ends with it.
    for (const name of FULLSCREEN_EVENTS) {
      this.on(document, name, () => {
        if (this.split && !filling(player)) this.whole();
      });
    }
    this.on(player, 'sourcechange', () => {
      this.encrypted = false;
      if (this.failed !== 'webgl') this.failed = null;
      // The next motion event takes the new source's straight ahead as the device's.
      this.device = null;
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
    // iOS asks for the motion permission only during a touch.
    this.on(canvas, 'touchend', () => this.ask());
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

  /** The ways the page allows, from `headset`: WebXR alone unless it names any. */
  private allowed(): readonly Headset[] {
    const named = (this.getAttribute('headset') ?? '')
      .split(/\s+/)
      .filter((way): way is Headset => way === 'webxr' || way === 'stereo');
    return named.length === 0 ? ['webxr'] : named;
  }

  /**
   * The split screen can show: the player itself can go fullscreen, on a
   * touch screen, with motion sensors. A computer and a TV fail the last
   * two. An iPhone fails the first, whatever the browser.
   */
  private splits(): boolean {
    return (
      this.player !== null &&
      fills(this.player) &&
      typeof matchMedia === 'function' &&
      matchMedia(TOUCH).matches &&
      this.motionAvailable
    );
  }

  /** Fires `headsetchange` when `headsetAvailable` changed. */
  private offer(): void {
    const now = String(this.headsetAvailable);
    if (now === this.offered) return;
    this.offered = now;
    this.dispatchEvent(new Event('headsetchange', { bubbles: true, composed: true }));
  }

  /** The device turns the view: motion is on, or the split screen shows, where the head is the only way to look. */
  private follows(): boolean {
    return this.split || this.motionOn;
  }

  /**
   * Turns the view. While the device's motion turns it too, the change is
   * kept as an offset over the device, so the next motion event keeps it.
   */
  private look(view: View): void {
    const next = clamp({
      yaw: view.yaw,
      pitch: view.pitch,
      fov: view.fov,
      roll: this.view.roll ?? 0,
    });
    if (this.device !== null) {
      this.offset = {
        yaw: this.offset.yaw + next.yaw - this.view.yaw,
        pitch: this.offset.pitch + next.pitch - this.view.pitch,
      };
    }
    this.view = next;
    this.dirty = true;
  }

  /**
   * Listens to the device's motion while the view shows, on or off: an
   * event with angles is how the element learns the device has sensors.
   */
  private motion(): void {
    const want =
      this.player !== null &&
      this.hasAttribute('active') &&
      typeof DeviceOrientationEvent !== 'undefined';
    if (want !== this.moving) {
      this.moving = want;
      if (want) window.addEventListener('deviceorientation', this.turned);
      else window.removeEventListener('deviceorientation', this.turned);
    }
    this.sync();
  }

  /**
   * Lets go of the device when motion turns off, keeping where the view
   * looks, and fires `motionchange` when `motionOn` or `motionAvailable`
   * changed. The sensors and the view decide the split screen too, so
   * `headsetchange` is checked here.
   */
  private sync(): void {
    const on = this.motionOn;
    if ((!this.follows() || !this.moving) && this.device !== null) {
      this.device = null;
      this.view = clamp({ yaw: this.view.yaw, pitch: this.view.pitch, fov: this.view.fov });
      this.dirty = true;
    }
    this.offer();
    const state = `${on} ${this.motionAvailable}`;
    if (state === this.reported) return;
    this.reported = state;
    this.dispatchEvent(new Event('motionchange', { bubbles: true, composed: true }));
  }

  /**
   * Points the view where the device points, plus the offset. The first
   * event keeps the yaw the view has, so the view does not jump; the pitch
   * and the roll are the device's from then on, level with the ground.
   */
  private turn(event: DeviceOrientationEvent): void {
    const { alpha, beta, gamma } = event;
    // A computer without the sensors fires one event with nulls.
    if (alpha === null || beta === null || gamma === null) return;
    if (!this.sensed) {
      this.sensed = true;
      this.sync();
    }
    if (!this.follows()) return;
    const device = orientation(alpha, beta, gamma, screenAngle());
    if (this.device === null) this.offset = { yaw: this.view.yaw - device.yaw, pitch: 0 };
    this.device = device;
    this.view = clamp({
      yaw: device.yaw + this.offset.yaw,
      pitch: device.pitch + this.offset.pitch,
      fov: this.view.fov,
      roll: device.roll ?? 0,
    });
    this.dirty = true;
  }

  /**
   * Asks iOS for the device's motion: iOS 13 and later sends no
   * `deviceorientation` before the page asks, and lets it ask only during
   * a touch or a click. The first touch on the view asks once; the
   * viewer's `setMotion(true)` asks `again`, and iOS answers a refusal it
   * remembers without a prompt. A refusal turns motion off, and ends the
   * split screen, which would not follow the head. A touch outside a
   * gesture fails, and the next touch asks again.
   */
  private ask(again = false): void {
    const api = permission();
    if (
      (this.asked && !again) ||
      !this.moving ||
      !this.follows() ||
      this.device !== null ||
      typeof api.requestPermission !== 'function'
    )
      return;
    this.asked = true;
    api.requestPermission().then(
      (state) => {
        if (state === 'granted') return;
        this.chosen = false;
        this.whole();
        this.sync();
      },
      () => {
        this.asked = false;
      },
    );
  }

  /**
   * Draws the view into the headset from now on, until the session ends.
   * A promise chain, not `async`: the ES2015 build would lower `async` into
   * helpers, which the emit check bans.
   */
  private immerse(session: XRSession, Layer: XRLayerConstructor): Promise<void> {
    this.session = session;
    session.addEventListener('end', () => {
      this.session = null;
      this.removeAttribute('vr');
      // The screen view draws again, where it shows.
      if (this.hasAttribute('active') && this.frame === 0) {
        this.dirty = true;
        this.frame = requestAnimationFrame((now) => this.tick(now));
      }
    });
    let layer: XRLayer;
    return compatible((this.sphere as Sphere).gl)
      .then(() => {
        // Rebuilt, if making it compatible lost the context; the context object stays the same.
        layer = new Layer(session, (this.sphere as Sphere).gl);
        session.updateRenderState({ baseLayer: layer });
        return session.requestReferenceSpace('local');
      })
      .then((space) => {
        // The headset starts where the screen looked; its own pitch is the head's.
        const yaw = this.view.yaw;
        const frame = (_time: number, now: XRFrame): void => {
          if (this.session !== session) return;
          session.requestAnimationFrame(frame);
          const pose = now.getViewerPose(space);
          const media = this.video();
          const projection = this.projection;
          if (pose === null || media === null || projection === null || this.sphere === null)
            return;
          if (media.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
          this.sphere.drawEyes(media, layer, pose.views, yaw, projection);
        };
        session.requestAnimationFrame(frame);
        // The headset draws every frame; the screen view rests meanwhile.
        this.stop();
        this.setAttribute('vr', 'webxr');
      })
      .catch((error: unknown) => {
        this.leave();
        throw error;
      });
  }

  /**
   * Splits the view in two for a phone in a viewer, and takes the player
   * fullscreen so the halves fill the screen. A promise chain, as `immerse`.
   */
  private halve(): Promise<void> {
    const player = this.player as PlayerHost;
    this.split = true;
    // A player that is already fullscreen stays so when the split ends.
    this.filled = !filling(player);
    this.setAttribute('vr', 'stereo');
    // The next motion event levels the view: a drag's pitch would tilt the horizon in a viewer.
    this.device = null;
    this.dirty = true;
    // From the click itself: iOS asks for the motion permission only then.
    this.ask(true);
    return (this.filled ? fill(player) : Promise.resolve()).then(
      () => {
        if (this.split) landscape();
      },
      (error: unknown) => {
        this.whole();
        throw error;
      },
    );
  }

  /** Ends the split screen, if it shows, and gives the screen back where the element took it. */
  private whole(): void {
    if (!this.split) return;
    const player = this.player;
    this.split = false;
    this.removeAttribute('vr');
    upright();
    if (this.filled && player !== null && filling(player)) unfill().catch(() => undefined);
    this.filled = false;
    this.dirty = true;
    // Motion that only the split screen turned on lets go of the device.
    this.sync();
  }

  /**
   * Ends the headset session or the split screen, if one shows. An ended
   * session refuses to end again, which is fine.
   */
  private leave(): void {
    this.whole();
    this.session?.end().catch(() => undefined);
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
      // A flat source in a headset would show nothing.
      this.leave();
    }
    this.motion();
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
        if (this.split) sphere.drawHalves(media, this.view, projection);
        else sphere.draw(media, this.view, projection);
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
    this.look(drag(this.view, dx, dy, this.canvas.clientHeight));
  }

  private up(event: PointerEvent): void {
    const press = this.press;
    if (press === null || press.id !== event.pointerId) return;
    this.press = null;
    // A tap is a click on the video, which the control bar plays or pauses on.
    if (!press.moved) this.video()?.click();
  }
}
