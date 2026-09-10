/**
 * <mattebox-player>: a real <video> as a light-DOM child, so the integrator
 * can reach it, and the error surface in shadow DOM. The element never
 * forwards or wraps a media element member: play, pause, seek, volume and
 * the rest live on the video, where the browser, Picture-in-Picture and the
 * OS media session already find them.
 *
 * The controls are elements the page places inside, beside the video, and
 * the stage slots them: over the picture for the bar and the screens, in
 * flow under it for the panels row. A page that places none gets the
 * default composition for its mode appended to its light DOM. The element
 * reflects the video's state as attributes on itself, `paused`, `playing`,
 * `ended` and `muted`, for the page's stylesheet and the controls alike.
 *
 * No class fields, `#private` or otherwise: the ES2015 build would lower
 * them into runtime helpers, and the emit check bans helpers. Statics are
 * getters and instance state is declared, then assigned in the constructor.
 */

import type { Handler, Player, PlayerError, Session, Source } from '@mattebox/player-core';
import { createPlayer, matteboxHandler, nativeHandler } from '@mattebox/player-core';
import type { KernelConfig, Mattebox, Stage } from 'mattebox';
import { composeBar, composePanels } from './compose.js';
import type { PlayerHost } from './host.js';
import { namespaces } from './namespaces.js';
import { drmGuard, resolvePreset } from './presets.js';
import { STYLE } from './style.js';
import type { ErrorSurface } from './surface.js';
import { errorSurface } from './surface.js';
import { CONTROL_BAR, PANELS, PLAYER } from './tags.js';

/** Attributes forwarded onto the video as attributes, never as properties. */
const FORWARDED = ['autoplay', 'muted', 'poster', 'crossorigin'];

/** Everything else the element watches. Changing any of them reloads. */
const OWN = ['src', 'type', 'preset', 'license-url', 'thumbnails'];

/**
 * The chapters track URL. A `<track kind="chapters">` on the video, hidden
 * so its cues load and nothing is drawn: chapters are the browser's own
 * text track, which the seek bar and the chapters menu read, and which a
 * page can also put there itself. Changing it swaps the track and never
 * reloads the source.
 */
const CHAPTERS = 'chapters';

/**
 * The one attribute whose meaning the element owns: `native` keeps the
 * browser's controls on the video, `custom` swaps them for the bar, `none`
 * leaves the video bare for a page that draws its own. Anything else is
 * `native`. Changing it swaps the bar without touching the session.
 */
const CONTROLS = 'controls';

/** The video's state, as attributes on the element, read on the events the video fires for it. */
const STATE_EVENTS = ['play', 'pause', 'ended', 'emptied', 'volumechange', 'loadedmetadata'];

/** Every stage the engine ships. A narrower preset is optimization. */
const DEFAULT_PRESET = 'full';

/**
 * What the element dispatches. `error` is also a standard DOM event name, so
 * without these overloads a listener on it is typed as `ErrorEvent` and the
 * payload needs a double cast. They are declarations only: no runtime bytes.
 */
export interface MatteboxPlayerEventMap {
  sourcechange: CustomEvent<Session | null>;
  error: CustomEvent<PlayerError>;
}

export interface MatteboxPlayerElement {
  addEventListener<K extends keyof MatteboxPlayerEventMap>(
    type: K,
    listener: (this: MatteboxPlayerElement, event: MatteboxPlayerEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<K extends keyof MatteboxPlayerEventMap>(
    type: K,
    listener: (this: MatteboxPlayerElement, event: MatteboxPlayerEventMap[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

export interface MatteboxPlayerOptions {
  /** The whole chain, in order. Takes precedence over `stages` and the `preset` attribute. */
  readonly handlers?: readonly Handler[];
  /** Stages for the mattebox handler. Takes precedence over the `preset` attribute. */
  readonly stages?: readonly Stage[];
  /**
   * Kernel tuning for the engines the elements build, `traceCapacity` among
   * it. A page decision, like the stages, so not an attribute. Ignored with
   * `handlers`, which carry their own.
   */
  readonly config?: Partial<KernelConfig>;
}

/**
 * What `define()` recorded, for the elements the parser creates. It is the
 * one value shared across elements, and the prompt asks for it: a page that
 * writes only markup still has to be able to say what the engine carries.
 */
let defaults: MatteboxPlayerOptions = {};

/**
 * The interface above merges only `addEventListener` and `removeEventListener`
 * overloads, which the class inherits from HTMLElement. The rule it suppresses
 * guards against properties an interface declares and a constructor never
 * assigns, and there are none.
 */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: method overloads only, no properties
export class MatteboxPlayerElement extends HTMLElement implements PlayerHost {
  static get observedAttributes(): readonly string[] {
    return [...FORWARDED, ...OWN, CONTROLS, CHAPTERS];
  }

  /**
   * Registers the element once, and records the stages markup-only pages
   * get. The controls register through their own entries, the package's
   * root entry importing every one; a control connected before its player
   * is defined waits for the definition.
   */
  static define(options?: MatteboxPlayerOptions): void {
    if (options !== undefined) defaults = options;
    if (customElements.get(PLAYER) === undefined) {
      customElements.define(PLAYER, MatteboxPlayerElement);
    }
  }

  declare private readonly media: HTMLVideoElement;
  /** Wraps the slot: the picture, and the controls over it or under it. */
  declare private readonly stage: HTMLDivElement;
  /** The default composition this element appended, to take back when the mode changes. */
  declare private composed: HTMLElement[];
  /**
   * Whether the children are all in. While the parser is still inside the
   * element, a page's own bar has not arrived yet, and appending the
   * default then would leave two. So the decision waits for the document
   * to be parsed, or for the microtask after a scripted connect.
   */
  declare private settled: boolean;
  /** Whether the element gave itself a tabindex for the bar, to take back with it. */
  declare private focusable: boolean;
  declare private readonly surface: ErrorSurface;
  /** The chapters track element, while the `chapters` attribute names one. */
  declare private track: HTMLTrackElement | null;
  declare private readonly options: MatteboxPlayerOptions;
  declare private core: Player | null;
  declare private current: Session | null;
  declare private failure: PlayerError | null;
  /** Whether an attribute change is the element's own reflection, which must not write back to the video. */
  declare private reflecting: boolean;
  declare private offs: Array<() => void>;
  /** Everything the element does to the player runs here, so it runs in order. */
  declare private queue: Promise<void>;
  /** Whether a run is queued and not yet started, so a burst of changes loads once. */
  declare private pending: boolean;

  constructor(options?: MatteboxPlayerOptions) {
    super();
    this.options = options ?? defaults;
    this.composed = [];
    this.settled = false;
    this.focusable = false;
    this.track = null;
    this.core = null;
    this.current = null;
    this.failure = null;
    this.reflecting = false;
    this.offs = [];
    this.queue = Promise.resolve();
    this.pending = false;

    this.media = document.createElement('video');
    // Native until the `controls` attribute says otherwise, which arrives
    // through attributeChangedCallback: a constructor must not read attributes.
    this.media.controls = true;
    for (const name of STATE_EVENTS) {
      this.media.addEventListener(name, () => {
        this.reflect();
      });
    }
    // An error over a picture that then plays is wrong by definition.
    this.media.addEventListener('playing', () => {
      this.failure = null;
    });
    this.stage = document.createElement('div');
    this.stage.setAttribute('part', 'stage');
    this.stage.append(document.createElement('slot'));
    this.surface = errorSurface(() => {
      this.reload();
    });

    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    root.append(style, this.stage, this.surface.root);
  }

  /** The media element. Everything the browser already does is here. */
  get video(): HTMLVideoElement {
    return this.media;
  }

  /** The core, or null until the first source has been set up: resolving a preset is asynchronous. */
  get player(): Player | null {
    return this.core;
  }

  /** The engine feeding the video, or null for a native session and before the first load. */
  get engine(): Mattebox | null {
    return this.current?.engine ?? null;
  }

  /**
   * The fatal error of the current load, or null once a load starts or
   * playback resumes. The `error` event says when; this says what, for a
   * control that attaches after the event, such as the default composition
   * behind a source that fails while the page is still parsing.
   */
  get error(): PlayerError | null {
    return this.failure;
  }

  connectedCallback(): void {
    if (this.media.parentNode !== this) this.append(this.media);
    for (const name of FORWARDED) this.forward(name);
    this.reflect();
    if (!this.settled) this.settle();
    this.reload();
  }

  /** Decides on the default composition once the children are all in, then on every mode change. */
  private settle(): void {
    const done = (): void => {
      this.settled = true;
      this.mode();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', done, { once: true });
    } else {
      queueMicrotask(done);
    }
  }

  /** The video's state on the element, for `mattebox-player[paused]` and the like. */
  private reflect(): void {
    const video = this.media;
    this.reflecting = true;
    this.toggleAttribute('paused', video.paused);
    this.toggleAttribute('playing', !video.paused);
    this.toggleAttribute('ended', video.ended);
    // `muted` is also forwarded: the page's attribute sets the video, and
    // the video's state sets the attribute. Reflection never forwards, so
    // a read can only ever change the attribute, never the video.
    this.toggleAttribute('muted', video.muted);
    this.reflecting = false;
  }

  disconnectedCallback(): void {
    // A single-page app must not leave a pipeline attached to a video it
    // navigated away from. Reconnecting loads the `src` again.
    this.enqueue(() => this.teardown());
  }

  attributeChangedCallback(name: string): void {
    if (FORWARDED.includes(name)) {
      if (!this.reflecting) this.forward(name);
      return;
    }
    if (name === CONTROLS) {
      this.mode();
      return;
    }
    if (name === CHAPTERS) {
      this.chapters();
      return;
    }
    // The preset decides the chain, so it is the one attribute that rebuilds it.
    if (name === 'preset') this.enqueue(() => this.discard());
    this.reload();
  }

  /**
   * Applies the `controls` attribute: the video's own controls, the
   * tabindex, and the default composition for the mode where the page
   * wrote none. The controls themselves are elements and attach on their own.
   */
  private mode(): void {
    const value = this.getAttribute(CONTROLS);
    const custom = value === 'custom';
    this.media.controls = !custom && value !== 'none';
    // Under custom controls the error screen element carries a fatal error.
    if (custom) this.surface.clear();
    if (!custom) {
      if (this.focusable) this.removeAttribute('tabindex');
      this.focusable = false;
    } else if (!this.hasAttribute('tabindex')) {
      // A bare video is not focusable, so without this a click on it would
      // leave the shortcuts nowhere to listen. A page that set its own
      // tabindex keeps it.
      this.tabIndex = 0;
      this.focusable = true;
    }
    if (!this.settled) return;
    for (const node of this.composed) node.remove();
    this.composed = [];
    const own = custom ? CONTROL_BAR : PANELS;
    if (this.querySelector(`:scope > ${own}`) === null) {
      this.composed = custom ? composeBar() : composePanels();
      this.append(...this.composed);
    }
  }

  /** Keeps a hidden chapters track on the video for the `chapters` attribute, or none. */
  private chapters(): void {
    const url = this.getAttribute(CHAPTERS);
    if (url === null) {
      this.track?.remove();
      this.track = null;
      return;
    }
    const held = this.track;
    if (held !== null && held.parentNode === this.media && held.getAttribute('src') === url) return;
    // A new element each time: one removed mid-load, as the engine's attach
    // does, stays in its error state, and neither a new `src` nor a second
    // insertion starts it loading again.
    held?.remove();
    const track = document.createElement('track');
    track.kind = 'chapters';
    track.src = url;
    this.track = track;
    this.media.append(track);
    // Set after the insertion: a track element's mode exists once it is in
    // a media element, and `hidden` is what makes its cues load unseen.
    track.track.mode = 'hidden';
  }

  private forward(name: string): void {
    const value = this.getAttribute(name);
    if (value === null) this.media.removeAttribute(name);
    else this.media.setAttribute(name, value);
    // A video reads `muted` into its state only when it is created, and this
    // one was created before any attribute reached it. Muted autoplay and
    // the autoplay policy read the state, so the attribute alone would not do.
    if (name === 'muted') this.media.muted = value !== null;
  }

  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue.then(task, task).catch(() => undefined);
  }

  /**
   * One run per burst. The parser sets every attribute and then connects the
   * element before any queued task starts, and each of those would load on
   * its own; the flag folds them into the one run that sees the final state.
   */
  private reload(): void {
    if (this.pending) return;
    this.pending = true;
    this.enqueue(() => {
      this.pending = false;
      return this.run();
    });
  }

  private emit(name: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private report(error: PlayerError): void {
    if (error.fatal) {
      this.failure = error;
      // Under custom controls the error screen element is the surface, and
      // the row under the video stays quiet, as the panels do.
      if (this.getAttribute(CONTROLS) !== 'custom') this.surface.show(error);
    }
    this.emit('error', error);
  }

  private async run(): Promise<void> {
    this.unmount();
    if (!this.isConnected) return;
    const url = this.getAttribute('src');
    if (url === null) return;

    const core = await this.ensure();
    const type = this.getAttribute('type');
    const source: Source = type === null ? { url } : { url, type };
    this.failure = null;
    this.surface.clear();

    let session: Session;
    try {
      session = await core.load(source);
    } catch {
      // The core already reported it on the error event, which the surface
      // and the element's own event both carry. Nothing to add here.
      return;
    }
    if (!this.isConnected) {
      await core.unload();
      return;
    }
    this.current = session;
    this.configure(session);
    // The engine's attach empties the media element to reset its resource
    // selection (`kernel/mse.ts`), and the chapters track goes with the
    // `<source>` children it means. Wanted: the track to survive attach.
    // Had to: put it back once the session is in. The surface that would
    // make it one call: an attach that removes `<source>` children alone.
    this.chapters();
  }

  private async ensure(): Promise<Player> {
    if (this.core !== null) return this.core;
    const core = createPlayer(this.media, { handlers: await this.chain() });
    this.offs.push(
      core.on('sourcechange', (session) => {
        // Before the event goes out, so a control that reads `engine` on
        // `sourcechange` sees the session the event is about.
        this.current = session;
        this.emit('sourcechange', session);
      }),
      core.on('error', (error) => {
        this.report(error);
      }),
    );
    this.core = core;
    return core;
  }

  private async chain(): Promise<readonly Handler[]> {
    if (this.options.handlers !== undefined) return this.options.handlers;
    const config = this.options.config === undefined ? {} : { config: this.options.config };
    if (this.options.stages !== undefined) {
      return [matteboxHandler({ stages: this.options.stages, ...config }), nativeHandler()];
    }
    const name = this.getAttribute('preset') ?? DEFAULT_PRESET;
    const preset = await resolvePreset(name);
    if (preset === null) {
      this.report({
        category: 'config',
        code: 'CONFIG_INVALID',
        fatal: true,
        recoverable: false,
        handler: null,
        context: { preset: name },
      });
      return [nativeHandler()];
    }
    return [matteboxHandler({ preset, ...config, ...drmGuard() }), nativeHandler()];
  }

  /** What the attributes ask of the session's namespaces, once there is one. */
  private configure(session: Session): void {
    const engine = session.engine;
    if (engine === null) return;

    const optional = namespaces(engine);

    const license = this.getAttribute('license-url');
    // After the session exists, not before: passing a license URL up front
    // means constructing eme-core, and importing a stage to configure it
    // would bundle it.
    if (license !== null && optional.drm !== undefined) optional.drm.setLicenseUrl(license);

    const track = this.getAttribute('thumbnails');
    if (track !== null && optional.thumbnails !== undefined) {
      // Loaded here; drawn by the seek bar's preview under `controls="custom"`.
      // Native controls expose no scrub position to anchor a preview to, so
      // under `native` the track only answers `engine.thumbnails.at(time)` for
      // the app. See docs/guide/03-the-element.md.
      void optional.thumbnails.load(track).catch(() => undefined);
    }
  }

  private unmount(): void {
    this.current = null;
  }

  private async teardown(): Promise<void> {
    this.unmount();
    if (this.core !== null) await this.core.unload();
  }

  /** Drops the player itself, so the next run builds a chain from the new preset. */
  private async discard(): Promise<void> {
    await this.teardown();
    for (const off of this.offs) off();
    this.offs = [];
    this.core = null;
  }
}
