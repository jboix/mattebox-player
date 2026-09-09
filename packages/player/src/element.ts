/**
 * <mattebox-player>: a real <video> as a light-DOM child, so the integrator
 * can reach it, and the player's own panels in shadow DOM. The element never
 * forwards or wraps a media element member: play, pause, seek, volume and
 * the rest live on the video, where the browser, Picture-in-Picture and the
 * OS media session already find them.
 *
 * No class fields, `#private` or otherwise: the ES2015 build would lower
 * them into runtime helpers, and the emit check bans helpers. Statics are
 * getters and instance state is declared, then assigned in the constructor.
 */

import type { Handler, Player, PlayerError, Session, Source } from '@mattebox/player-core';
import { createPlayer, matteboxHandler, nativeHandler } from '@mattebox/player-core';
import type { Mattebox, Stage } from 'mattebox';
import type { ControlBar } from './controls/bar.js';
import { controlBar } from './controls/bar.js';
import type { ControlsOptions } from './controls/options.js';
import { ATTRIBUTES, resolve } from './controls/options.js';
import { namespaces } from './namespaces.js';
import { drmPanel } from './panels/drm.js';
import type { ErrorSurface } from './panels/error.js';
import { errorSurface } from './panels/error.js';
import { livePanel } from './panels/live.js';
import type { Panel, PanelFactory } from './panels/panel.js';
import { qualityPanel } from './panels/quality.js';
import { tracksPanel } from './panels/tracks.js';
import { drmGuard, resolvePreset } from './presets.js';
import { STYLE } from './style.js';

const TAG = 'mattebox-player';

/** Attributes forwarded onto the video as attributes, never as properties. */
const FORWARDED = ['autoplay', 'muted', 'poster'];

/** Everything else the element watches. Changing any of them reloads. */
const OWN = ['src', 'type', 'preset', 'license-url', 'thumbnails'];

/**
 * The one attribute whose meaning the element owns: `native` keeps the
 * browser's controls on the video, `custom` swaps them for the bar, `none`
 * leaves the video bare for a page that draws its own. Anything else is
 * `native`. Changing it swaps the bar without touching the session.
 */
const CONTROLS = 'controls';

/** The bar's knobs as attributes. Changing one rebuilds the bar with the new value. */
const KNOBS: readonly string[] = Object.values(ATTRIBUTES);

/** Composed in this order, and each one answers null when its namespace is absent. */
const PANELS: readonly PanelFactory[] = [qualityPanel, tracksPanel, livePanel, drmPanel];

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
  /** The bar's knobs under `controls="custom"`. An attribute of the same name in kebab-case wins over each. */
  readonly controls?: ControlsOptions;
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
export class MatteboxPlayerElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return [...FORWARDED, ...OWN, CONTROLS, ...KNOBS];
  }

  /** Registers the element once, and records the stages markup-only pages get. */
  static define(options?: MatteboxPlayerOptions): void {
    if (options !== undefined) defaults = options;
    if (customElements.get(TAG) === undefined) customElements.define(TAG, MatteboxPlayerElement);
  }

  declare private readonly media: HTMLVideoElement;
  /** Wraps the slot, so the overlay's bottom is the video's bottom and not the panels'. */
  declare private readonly stage: HTMLDivElement;
  declare private readonly bar: HTMLDivElement;
  declare private controls: ControlBar | null;
  /** Whether the element gave itself a tabindex for the bar, to take back with it. */
  declare private focusable: boolean;
  declare private readonly surface: ErrorSurface;
  declare private readonly options: MatteboxPlayerOptions;
  declare private panels: Panel[];
  declare private core: Player | null;
  declare private current: Session | null;
  declare private offs: Array<() => void>;
  /** Everything the element does to the player runs here, so it runs in order. */
  declare private queue: Promise<void>;
  /** Whether a run is queued and not yet started, so a burst of changes loads once. */
  declare private pending: boolean;

  constructor(options?: MatteboxPlayerOptions) {
    super();
    this.options = options ?? defaults;
    this.panels = [];
    this.controls = null;
    this.focusable = false;
    this.core = null;
    this.current = null;
    this.offs = [];
    this.queue = Promise.resolve();
    this.pending = false;

    this.media = document.createElement('video');
    // Native until the `controls` attribute says otherwise, which arrives
    // through attributeChangedCallback: a constructor must not read attributes.
    this.media.controls = true;
    this.stage = document.createElement('div');
    this.stage.setAttribute('part', 'stage');
    this.stage.append(document.createElement('slot'));
    this.bar = document.createElement('div');
    this.bar.setAttribute('part', 'panels');
    this.surface = errorSurface(() => {
      this.reload();
    });

    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    root.append(style, this.stage, this.bar, this.surface.root);
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

  connectedCallback(): void {
    if (this.media.parentNode !== this) this.append(this.media);
    for (const name of FORWARDED) this.forward(name);
    this.reload();
  }

  disconnectedCallback(): void {
    // A single-page app must not leave a pipeline attached to a video it
    // navigated away from. Reconnecting loads the `src` again.
    this.enqueue(() => this.teardown());
  }

  attributeChangedCallback(name: string): void {
    if (FORWARDED.includes(name)) {
      this.forward(name);
      return;
    }
    if (name === CONTROLS || KNOBS.includes(name)) {
      this.mode();
      return;
    }
    // The preset decides the chain, so it is the one attribute that rebuilds it.
    if (name === 'preset') this.enqueue(() => this.discard());
    this.reload();
  }

  /**
   * Applies the `controls` attribute and the knobs: the video's own
   * controls, and the bar rebuilt from scratch. Rebuilding is cheap, the
   * knobs are read once at build, and a session re-attaches in one call.
   */
  private mode(): void {
    const value = this.getAttribute(CONTROLS);
    const custom = value === 'custom';
    this.media.controls = !custom && value !== 'none';
    // The bar carries the menus, so the panels row would say it all twice.
    this.bar.hidden = custom;
    if (this.controls !== null) {
      this.controls.dispose();
      this.controls = null;
      this.removeAttribute('fullscreen');
      if (this.focusable) this.removeAttribute('tabindex');
      this.focusable = false;
    }
    if (!custom) return;
    // A bare video is not focusable, so without this a click on it would
    // leave the shortcuts nowhere to listen. A page that set its own
    // tabindex keeps it.
    if (!this.hasAttribute('tabindex')) {
      this.tabIndex = 0;
      this.focusable = true;
    }
    const knobs = resolve(this.options.controls, (name) => this.getAttribute(name));
    // Fullscreen goes on the stage, in shadow DOM, and `:fullscreen` does
    // not match the host for that; the attribute is how a page styles the
    // light-DOM video in that state.
    this.controls = controlBar(
      this,
      this.stage,
      this.media,
      knobs,
      (name, on) => {
        this.toggleAttribute(name, on);
      },
      () => {
        this.reload();
      },
    );
    // The bar's own screen carries a fatal error while the bar is up.
    this.surface.clear();
    this.stage.append(this.controls.root);
    if (this.current !== null) this.controls.attach(this.current);
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
      if (this.controls !== null) this.controls.error(error);
      else this.surface.show(error);
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
    this.surface.clear();
    this.controls?.clearError();

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
    this.controls?.attach(session);
    for (const factory of PANELS) {
      const panel = factory(session, this.media);
      if (panel === null) continue;
      this.panels.push(panel);
      this.bar.append(panel.root);
    }
  }

  private async ensure(): Promise<Player> {
    if (this.core !== null) return this.core;
    const core = createPlayer(this.media, { handlers: await this.chain() });
    this.offs.push(
      core.on('sourcechange', (session) => {
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
    if (this.options.stages !== undefined) {
      return [matteboxHandler({ stages: this.options.stages }), nativeHandler()];
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
    return [matteboxHandler({ preset, ...drmGuard() }), nativeHandler()];
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
    this.controls?.detach();
    for (const panel of this.panels) panel.dispose();
    this.panels = [];
    this.bar.replaceChildren();
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
