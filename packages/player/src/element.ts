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
    return [...FORWARDED, ...OWN];
  }

  /** Registers the element once, and records the stages markup-only pages get. */
  static define(options?: MatteboxPlayerOptions): void {
    if (options !== undefined) defaults = options;
    if (customElements.get(TAG) === undefined) customElements.define(TAG, MatteboxPlayerElement);
  }

  declare private readonly media: HTMLVideoElement;
  declare private readonly bar: HTMLDivElement;
  declare private readonly surface: ErrorSurface;
  declare private readonly options: MatteboxPlayerOptions;
  declare private panels: Panel[];
  declare private core: Player | null;
  declare private current: Session | null;
  declare private offs: Array<() => void>;
  /** Everything the element does to the player runs here, so it runs in order. */
  declare private queue: Promise<void>;

  constructor(options?: MatteboxPlayerOptions) {
    super();
    this.options = options ?? defaults;
    this.panels = [];
    this.core = null;
    this.current = null;
    this.offs = [];
    this.queue = Promise.resolve();

    this.media = document.createElement('video');
    // Native controls in v1. The panels cover only what the video cannot show.
    this.media.controls = true;
    this.bar = document.createElement('div');
    this.bar.setAttribute('part', 'panels');
    this.surface = errorSurface(() => {
      this.reload();
    });

    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    root.append(style, document.createElement('slot'), this.bar, this.surface.root);
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
    // The preset decides the chain, so it is the one attribute that rebuilds it.
    if (name === 'preset') this.enqueue(() => this.discard());
    this.reload();
  }

  private forward(name: string): void {
    const value = this.getAttribute(name);
    if (value === null) this.media.removeAttribute(name);
    else this.media.setAttribute(name, value);
  }

  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue.then(task, task).catch(() => undefined);
  }

  private reload(): void {
    this.enqueue(() => this.run());
  }

  private emit(name: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private report(error: PlayerError): void {
    if (error.fatal) this.surface.show(error);
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
    // would bundle it. See docs/integrator-log.md.
    if (license !== null && optional.drm !== undefined) optional.drm.setLicenseUrl(license);

    const track = this.getAttribute('thumbnails');
    if (track !== null && optional.thumbnails !== undefined) {
      // Loaded, not drawn. Native controls expose no scrub position to anchor
      // a preview to, so v1 populates `engine.thumbnails` for the app and
      // leaves the preview to custom controls. See docs/guide/03-the-element.md.
      void optional.thumbnails.load(track).catch(() => undefined);
    }
  }

  private unmount(): void {
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
