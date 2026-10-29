/**
 * The ads of one player: the schedule a page or a VMAP gives, the VAST of
 * each break, the breaks the stream signals, the beacons, and the state the
 * ad controls draw.
 *
 * Every ad plays on the player's own video, so the controls drive it and a
 * TV with one decoder plays it. An ad with an HLS or DASH file plays
 * through the engine's interstitials stage. An ad with only a progressive
 * file (MP4, WebM) plays through `player.interrupt`, which loads it in the
 * programme's place, and `player.resume` loads the programme again where
 * it stopped. On a native session, every ad plays that way.
 */
import type { BreakMark, Marker, PlayerHost } from '@mattebox/player';
import type { AdCreative, Break, InterstitialsApi } from 'mattebox/stages/interstitials';
import { expand, type MacroValues, send } from './beacons.js';
import { fetchText, resolveVast, type VastAd, type VastFetch, type VastMediaFile } from './vast.js';
import { type BreakOffset, offsetTime, parseVmap, type ScheduledBreak } from './vmap.js';

/** What the ad controls show while an ad plays. */
export interface AdState {
  readonly breakId: string;
  /** 1 for the first ad of the break. */
  readonly index: number;
  readonly total: number;
  /** Seconds into the ad that plays. */
  readonly currentTime: number;
  /** Seconds of the ad that plays, or NaN while unknown. */
  readonly duration: number;
  /** Seconds left in the whole break, or NaN while unknown. */
  readonly remaining: number;
  /** Seconds until the viewer may skip, 0 once they may, null when the ad cannot be skipped. */
  readonly skipIn: number | null;
  readonly clickThrough?: string;
  /** The VAST ad, absent for an ad the stream signalled. */
  readonly ad?: VastAd;
  /** The stream plays the break itself: a cue-out with no ad of the page's. */
  readonly stitched: boolean;
  /** An ad, or a promotion of the channel's own. */
  readonly role: 'ad' | 'promo';
  /**
   * A break the stream plays that sets no rule, under `stitched: 'free'`:
   * the programme's controls stay, the seek bar among them, and the ad can be
   * skipped at once.
   */
  readonly free: boolean;
}

/** A break the page schedules: where, and the VAST to ask. */
export interface AdBreakInput {
  readonly id?: string;
  /** 'start', 'end', seconds, or a VMAP `timeOffset` such as '00:10:00' or '50%'. */
  readonly offset: 'start' | 'end' | number | string;
  /** The VAST URL. */
  readonly vast: string;
}

/** A cue-out of a live stream, which the page can fill with ads. */
export interface AdOpportunity {
  readonly id: string;
  readonly start: number;
  readonly duration: number;
}

export interface AdsApi {
  /** The ad that plays, or null. */
  readonly state: AdState | null;
  /** Loads a VMAP, or a VAST as one pre-roll, for the current programme. */
  load(url: string): Promise<void>;
  /** Adds breaks for the current programme. A new programme clears them. */
  schedule(breaks: readonly AdBreakInput[]): void;
  /** Skips the ad that plays, when it may be skipped by now. */
  skip(): void;
  /** Opens the ad's page, pauses the ad, and reports the click. */
  click(): void;
  /** The VAST URL to fill a cue-out with, or null to let the stream play. */
  onOpportunity: ((opportunity: AdOpportunity) => string | null) | null;
  /** Runs `fn` whenever the state changes; returns the unsubscribe. */
  watch(fn: () => void): () => void;
}

export interface AdsOptions {
  /** How VAST and VMAP documents are fetched: a page that signs its ad requests gives its own. */
  readonly fetch?: VastFetch;
  /** Ads with only a progressive file: played on the player's video, or skipped. */
  readonly progressive?: 'play' | 'skip';
  /** Sends each beacon, in place of the add-on: a page that logs them, or sends them through its own server. */
  readonly beacon?: (url: string) => void;
  /**
   * A break the stream plays itself and that sets no rule, as every SCTE-35
   * cue: `free`, the default, keeps the programme's controls and lets the
   * viewer skip it; `strict` takes no seek, as a break that forbids one.
   */
  readonly stitched?: 'free' | 'strict';
}

/** Seconds before a break at which its VAST is fetched: fresh, and in time for the preload. */
const LOOKAHEAD = 10;
const QUARTILE_EVENTS = ['firstQuartile', 'midpoint', 'thirdQuartile'] as const;
/** The keys that seek: the bar's arrows and media keys, the seek bar's Home, End and pages. */
const SEEK_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'MediaRewind',
  'MediaFastForward',
  'MediaTrackNext',
  'MediaTrackPrevious',
  'j',
  'J',
  'l',
  'L',
  ...'0123456789',
]);
const STREAMING = /mpegurl|dash\+xml/i;

/** What of the engine's chapters this add-on reads and writes. */
interface ChaptersView {
  readonly source: string;
  set(chapters: readonly { start: number; end?: number; title: string }[]): number;
}

interface Plan {
  readonly id: string;
  readonly offset: BreakOffset;
  readonly vast: ScheduledBreak['vast'];
  readonly tracking: ScheduledBreak['tracking'];
  /** Seconds a cue-out lasts, for a fill. */
  readonly covers?: number;
  status: 'waiting' | 'resolving' | 'stream' | 'progressive' | 'done';
  ads: readonly VastAd[];
  files: readonly VastMediaFile[];
  start?: number;
}

interface Current {
  readonly plan: Plan | null;
  readonly entry: Break | null;
  readonly stitched: boolean;
  index: number;
  ad: VastAd | undefined;
  /** What the stream says of the ad, SVTA2053, for an ad without a VAST. */
  creative: AdCreative | undefined;
  file: VastMediaFile | undefined;
  skipped: boolean;
  quartiles: number;
  /** Progress beacons and stream tracking already sent, by index. */
  sent: Set<number>;
  viewable: boolean;
  /** The viewer paused the ad: the next play is a resume. */
  paused: boolean;
  /** A progressive ad, which `player.interrupt` plays in the programme's place. */
  readonly interrupt: boolean;
  /** The ad's last time, which a refused seek goes back to. */
  last: number;
  /** The programme time where the break started, for the macros. */
  readonly at: number;
}

const controllers = new WeakMap<PlayerHost, Controller>();

/** The ads of `player`, created on first use. */
export function controllerFor(player: PlayerHost, options?: AdsOptions): Controller {
  let found = controllers.get(player);
  if (found === undefined) {
    found = new Controller(player, options ?? {});
    controllers.set(player, found);
  } else if (options !== undefined) {
    // The add-on's options, for a controller a page or an element made first.
    found.configure(options);
  }
  return found;
}

/** The time form of a scheduled offset. */
function offsetFrom(value: AdBreakInput['offset']): BreakOffset {
  if (value === 'start' || value === 'end') return value;
  if (typeof value === 'number') return { time: value };
  if (value.endsWith('%')) return { percent: Number(value.slice(0, -1)) };
  const parts = value.split(':').map(Number);
  return { time: parts.reduce((sum, part) => sum * 60 + part, 0) };
}

/** The file to play: a streaming one the engine reads, else the progressive one closest above the player's height. */
function pick(
  ad: VastAd,
  engine: boolean,
  video: HTMLVideoElement,
  height: number,
): VastMediaFile | undefined {
  const usable = ad.mediaFiles.filter((file) => file.apiFramework === undefined);
  if (engine) {
    const stream = usable.find((file) => STREAMING.test(file.type));
    if (stream !== undefined) return stream;
  }
  const progressive = usable
    .filter((file) => !STREAMING.test(file.type) && video.canPlayType(file.type) !== '')
    .sort((a, b) => (a.height ?? 0) - (b.height ?? 0));
  return (
    progressive.find((file) => (file.height ?? 0) >= height) ?? progressive[progressive.length - 1]
  );
}

export class Controller implements AdsApi {
  declare onOpportunity: ((opportunity: AdOpportunity) => string | null) | null;
  declare private readonly player: PlayerHost;
  declare private fetchDoc: VastFetch;
  declare private progressive: 'play' | 'skip';
  declare private send: (url: string) => void;
  declare private stitchedMode: 'free' | 'strict';
  /** The credits markers this add-on gave the player, so a page's own stay. */
  declare private own: ReadonlySet<Marker>;
  declare private plans: Map<string, Plan>;
  declare private current: Current | null;
  declare private watchers: Set<() => void>;
  declare private offEngine: (() => void) | null;
  declare private lastTime: number;
  /** A pre-roll is still being asked for: the programme waits for it. */
  declare private holding: boolean;
  /** Schedules being fetched, which may hold a pre-roll. */
  declare private fetching: number;
  declare private observer: IntersectionObserver | null;
  declare private visibleSince: number | null;
  declare private seq: number;
  /** The breaks that played, by id, which the seek bar draws faded. */
  declare private done: Set<string>;

  constructor(player: PlayerHost, options: AdsOptions) {
    this.onOpportunity = null;
    this.player = player;
    this.fetchDoc = fetchText;
    this.progressive = 'play';
    this.send = send;
    this.stitchedMode = 'free';
    this.own = new Set();
    this.configure(options);
    this.plans = new Map();
    this.current = null;
    this.watchers = new Set();
    this.offEngine = null;
    this.lastTime = 0;
    this.holding = false;
    this.fetching = 0;
    this.observer = null;
    this.visibleSince = null;
    this.seq = 0;
    this.done = new Set();
  }

  configure(options: AdsOptions): void {
    this.fetchDoc = options.fetch ?? fetchText;
    this.progressive = options.progressive ?? 'play';
    this.send = options.beacon ?? send;
    this.stitchedMode = options.stitched ?? 'free';
  }

  /** Follows the player until `detach`. */
  attach(): () => void {
    const player = this.player;
    const video = player.video;
    const onSource = (): void => {
      this.reset();
      this.bindEngine();
      const schedule = player.getAttribute('ad-schedule');
      if (schedule !== null && schedule !== '') void this.load(schedule);
    };
    const onTime = (): void => this.tick();
    const onMetadata = (): void => {
      this.mark();
      this.tick();
    };
    const onPlay = (): void => {
      // The pre-roll first: the programme waits while its ad server answers,
      // and a progressive pre-roll already answered starts now.
      if (this.current === null && this.pending('start')) {
        this.holding = true;
        video.pause();
      } else if (this.current === null) {
        const pre = [...this.plans.values()].find(
          (plan) => plan.offset === 'start' && plan.status === 'progressive',
        );
        if (pre !== undefined) {
          video.pause();
          this.startProgressive(pre);
        }
      }
      this.tick();
    };
    const onEnded = (): void => {
      if (this.current?.interrupt === true) {
        this.nextProgressive();
        return;
      }
      if (this.current !== null || this.engineBreaks()?.playing != null) return;
      const post = [...this.plans.values()].find(
        (plan) => plan.offset === 'end' && plan.status === 'progressive',
      );
      if (post !== undefined) this.startProgressive(post);
    };
    const onError = (): void => {
      const current = this.current;
      if (current?.interrupt !== true) return;
      if (current.ad !== undefined) {
        for (const url of current.ad.errors)
          this.send(expand(url, { ...this.macros(current), errorCode: 405 }));
      }
      this.emit('aderror', { id: current.plan?.id, code: 405 });
      this.nextProgressive();
    };
    const onSeeking = (): void => {
      // An ad takes no seek: back to where it was.
      const current = this.current;
      if (current?.interrupt !== true) return;
      if (Math.abs(video.currentTime - current.last) > 0.5) video.currentTime = current.last;
    };
    // An ad of the engine's plays on the player's own video.
    const onAdPause = (): void => {
      if (this.current !== null) this.adPaused(video);
    };
    const onAdPlay = (): void => {
      if (this.current !== null) this.adResumed(video);
    };
    const onAdVolume = (): void => {
      if (this.current !== null && !this.current.stitched) this.adVolume(video);
    };
    // An ad takes no seek: the keys that seek go nowhere while one plays.
    // Play, pause, mute and fullscreen stay the bar's. In the capture phase,
    // so the bar and the seek bar never hear them.
    const onKey = (event: KeyboardEvent): void => {
      if (this.current === null || this.free(this.current)) return;
      if (!SEEK_KEYS.has(event.key)) return;
      // The volume's own arrows, when it has focus, are the volume's.
      const volume = event
        .composedPath()
        .some((node) => node instanceof HTMLElement && node.localName.startsWith('mbx-volume'));
      if (volume) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    player.addEventListener('keydown', onKey, true);
    // A page's markers replace the list: the credits this add-on gave come back.
    const onMarkers = (): void => this.spans();
    player.addEventListener('markerschange', onMarkers);
    // At the end of a drag, the ad the stream plays where it landed, if any.
    const scrub = new MutationObserver(() => {
      if (!player.hasAttribute('scrubbing')) this.landed();
    });
    scrub.observe(player, { attributes: true, attributeFilter: ['scrubbing'] });
    player.addEventListener('sourcechange', onSource);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('play', onPlay);
    video.addEventListener('loadedmetadata', onMetadata);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    video.addEventListener('seeking', onSeeking);
    video.addEventListener('pause', onAdPause);
    video.addEventListener('playing', onAdPlay);
    video.addEventListener('volumechange', onAdVolume);
    this.bindEngine();
    return () => {
      scrub.disconnect();
      player.removeEventListener('markerschange', onMarkers);
      player.removeEventListener('keydown', onKey, true);
      player.removeEventListener('sourcechange', onSource);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('loadedmetadata', onMetadata);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      video.removeEventListener('seeking', onSeeking);
      video.removeEventListener('pause', onAdPause);
      video.removeEventListener('playing', onAdPlay);
      video.removeEventListener('volumechange', onAdVolume);
      this.reset();
      this.offEngine?.();
      this.offEngine = null;
    };
  }

  get state(): AdState | null {
    const current = this.current;
    if (current === null) return null;
    const media = this.player.video;
    const ads = current.plan?.ads ?? [];
    const assets = current.entry?.assets ?? [];
    const total = Math.max(1, ads.length || assets.length);
    const time = current.stitched
      ? this.player.video.currentTime - (current.entry?.start ?? 0)
      : media.currentTime;
    const duration = current.stitched
      ? (current.entry?.covers ?? Number.NaN)
      : Number.isFinite(media.duration)
        ? media.duration
        : (current.ad?.duration ?? assets[current.index]?.duration ?? Number.NaN);
    const later = (
      ads.length > 0
        ? ads.map((ad) => ad.duration)
        : assets.map((asset) => asset.duration ?? Number.NaN)
    )
      .slice(current.index + 1)
      .reduce((sum, value) => sum + value, 0);
    const free = this.free(current);
    // A break the stream plays and that sets no rule skips at once when free.
    const skipOffset =
      current.ad?.skipOffset ??
      current.creative?.skipOffset ??
      (current.ad === undefined && !current.stitched ? current.entry?.skipAfter : undefined);
    const clickThrough = current.ad?.clickThrough ?? current.creative?.clickThrough;
    return {
      breakId: current.plan?.id ?? current.entry?.id ?? '',
      index: current.index + 1,
      total,
      currentTime: time,
      duration,
      remaining: duration - time + later,
      skipIn: free ? 0 : skipOffset === undefined ? null : Math.max(0, skipOffset - time),
      ...(clickThrough !== undefined ? { clickThrough } : {}),
      ...(current.ad !== undefined ? { ad: current.ad } : {}),
      stitched: current.stitched,
      role: current.entry?.role === 'promo' ? 'promo' : 'ad',
      free,
    };
  }

  /** A break the stream plays itself, with no rule of its own, under `stitched: 'free'`. */
  private free(current: Current): boolean {
    const entry = current.entry;
    return (
      current.stitched &&
      this.stitchedMode === 'free' &&
      entry !== null &&
      !entry.noSkip &&
      !entry.noJump &&
      current.creative?.skipOffset === undefined
    );
  }

  watch(fn: () => void): () => void {
    this.watchers.add(fn);
    return () => {
      this.watchers.delete(fn);
    };
  }

  async load(source: string): Promise<void> {
    // Absolute, so the ad tags of a VMAP resolve against it.
    const url = new URL(source, location.href).href;
    let text: string;
    this.fetching += 1;
    try {
      text = await this.fetchDoc(url, new AbortController().signal);
    } catch {
      this.fetching -= 1;
      this.emit('aderror', { code: 900, url });
      this.release();
      return;
    }
    this.fetching -= 1;
    const breaks = parseVmap(text, url);
    if (breaks === null) {
      this.add({ id: 'preroll', offset: 'start', vast: { xml: text }, tracking: [] });
    } else {
      for (const entry of breaks) this.add(entry);
    }
    // A schedule without a pre-roll lets the programme play.
    this.release();
    this.tick();
  }

  schedule(breaks: readonly AdBreakInput[]): void {
    for (const entry of breaks) {
      this.seq += 1;
      this.add({
        id: entry.id ?? `ad-break-${this.seq}`,
        offset: offsetFrom(entry.offset),
        vast: { url: new URL(entry.vast, location.href).href },
        tracking: [],
      });
    }
    this.tick();
  }

  skip(): void {
    const current = this.current;
    const state = this.state;
    if (current === null || state === null || state.skipIn === null || state.skipIn > 0) return;
    if (current.interrupt) {
      current.skipped = true;
      this.track(current, 'skip');
      this.emit('adskip', this.detail());
      this.nextProgressive();
      return;
    }
    current.skipped = true;
    this.track(current, 'skip');
    this.emit('adskip', this.detail());
    if (current.stitched && current.entry !== null) {
      // The stream plays this ad itself: a skip is a seek past it.
      this.player.video.currentTime = current.entry.start + current.entry.covers;
      return;
    }
    this.engineBreaks()?.skip();
  }

  click(): void {
    const current = this.current;
    const target = current?.ad?.clickThrough ?? current?.creative?.clickThrough;
    if (current === null || target === undefined) return;
    for (const url of current.ad?.clickTracking ?? []) this.send(expand(url, this.macros(current)));
    this.track(current, 'clickTracking');
    window.open(target, '_blank', 'noopener');
    this.player.video.pause();
    this.emit('adclick', this.detail());
  }

  // ---- the schedule ------------------------------------------------------

  private add(entry: ScheduledBreak & { readonly covers?: number }): void {
    this.plans.set(entry.id, { ...entry, status: 'waiting', ads: [], files: [] });
    this.mark();
  }

  /**
   * The seek bar's ticks: the mid-roll breaks of the engine and of the
   * schedule, spans where a break replaces a part, faded once played. A
   * pre-roll and a post-roll sit at the ends and get none.
   */
  private mark(): void {
    const marks: BreakMark[] = [];
    const engine = this.engineBreaks();
    const ids = new Set<string>();
    for (const entry of engine?.breaks ?? []) {
      ids.add(entry.id);
      if (entry.cue !== undefined) continue;
      if (entry.role !== undefined && entry.role !== 'ad' && entry.role !== 'promo') continue;
      marks.push({
        start: entry.start,
        ...(entry.covers > 0 ? { end: entry.start + entry.covers } : {}),
        ...(this.done.has(entry.id) ? { played: true } : {}),
      });
    }
    const duration = this.programmeDuration();
    for (const plan of this.plans.values()) {
      if (ids.has(plan.id) || plan.offset === 'start' || plan.offset === 'end') continue;
      const at = offsetTime(plan.offset, duration);
      if (at === null) continue;
      marks.push({ start: at, ...(plan.status === 'done' ? { played: true } : {}) });
    }
    this.player.breaks.set('ads', marks);
    this.spans();
  }

  /**
   * The credits and chapters a SCTE-35 section names, as the player shows
   * them: the credits as markers, which give Skip intro and Skip credits,
   * beside the page's own, and the chapters in the chapter menu when nothing
   * else gives chapters.
   */
  private spans(): void {
    const breaks = this.engineBreaks()?.breaks ?? [];
    const credits: Marker[] = breaks.flatMap((entry) =>
      (entry.role === 'opening-credits' || entry.role === 'closing-credits') && entry.covers > 0
        ? [{ start: entry.start, end: entry.start + entry.covers, kind: entry.role }]
        : [],
    );
    const markers = this.player.markers;
    const theirs = markers.list.filter((marker) => !this.own.has(marker));
    const same =
      credits.length === this.own.size &&
      [...this.own].every((marker, i) => {
        const next = credits[i];
        return next !== undefined && next.start === marker.start && next.end === marker.end;
      }) &&
      [...this.own].every((marker) => markers.list.includes(marker));
    if (!same) {
      this.own = new Set(credits);
      markers.set([...theirs, ...credits]);
    }
    const chapters = breaks.filter((entry) => entry.role === 'chapter');
    const api = (this.player.engine as { chapters?: ChaptersView } | null)?.chapters;
    if (
      api !== undefined &&
      chapters.length > 0 &&
      api.source !== 'manifest' &&
      api.source !== 'app'
    ) {
      api.set(
        chapters.map((entry, i) => ({
          start: entry.start,
          ...(entry.covers > 0 ? { end: entry.start + entry.covers } : {}),
          title: `${i + 1}`,
        })),
      );
    }
  }

  private pending(offset: 'start'): boolean {
    if (this.fetching > 0) return true;
    return [...this.plans.values()].some(
      (plan) =>
        plan.offset === offset && (plan.status === 'waiting' || plan.status === 'resolving'),
    );
  }

  private engineBreaks(): InterstitialsApi | undefined {
    return (this.player.engine as { interstitials?: InterstitialsApi } | null)?.interstitials;
  }

  /** The programme's own time, through a break. */
  private programmeTime(): number {
    return this.engineBreaks()?.primary.currentTime ?? this.player.video.currentTime;
  }

  private programmeDuration(): number {
    return this.engineBreaks()?.primary.duration ?? this.player.video.duration;
  }

  /** Fetches the VAST of each break as it comes near, and starts the progressive ones on time. */
  private tick(): void {
    this.update();
    if (this.current !== null) {
      this.followAd(this.current);
      return;
    }
    const time = this.programmeTime();
    const duration = this.programmeDuration();
    const seeked = Math.abs(time - this.lastTime) > 2;
    for (const plan of this.plans.values()) {
      const at = offsetTime(plan.offset, duration);
      if (at === null) continue;
      if (plan.status === 'waiting' && (plan.offset === 'start' || at - time <= LOOKAHEAD)) {
        void this.resolve(plan, at);
      } else if (
        plan.status === 'progressive' &&
        plan.offset !== 'end' &&
        !seeked &&
        this.lastTime <= at &&
        time >= at &&
        plan.offset !== 'start'
      ) {
        this.startProgressive(plan);
        break;
      }
    }
    this.lastTime = time;
  }

  private async resolve(plan: Plan, at: number): Promise<void> {
    plan.status = 'resolving';
    const result = await resolveVast(plan.vast, this.fetchDoc);
    if (this.plans.get(plan.id) !== plan) return;
    const engine = this.engineBreaks() !== undefined;
    const height = this.player.clientHeight;
    const playable: VastAd[] = [];
    const files: VastMediaFile[] = [];
    for (const ad of result.ads) {
      const file = pick(ad, engine, this.player.video, height);
      if (file === undefined || (!STREAMING.test(file.type) && this.progressive === 'skip')) {
        for (const url of ad.errors) this.send(expand(url, { errorCode: 403 }));
        continue;
      }
      playable.push(ad);
      files.push(file);
    }
    if (result.ads.length === 0) {
      for (const url of result.errors) this.send(expand(url, { errorCode: result.code ?? 303 }));
    }
    plan.ads = playable;
    plan.files = files;
    plan.start = at;
    if (playable.length === 0) {
      plan.status = 'done';
      this.vmapTrack(plan, 'error');
      this.emit('aderror', { id: plan.id, code: result.code ?? 403 });
      this.release();
      return;
    }
    const streams = files.every((file) => STREAMING.test(file.type));
    if (engine && streams) {
      plan.status = 'stream';
      // A skippable ad still takes no seek: the controls skip it from its offset.
      const offsets = playable.flatMap((ad) =>
        ad.skipOffset === undefined ? [] : [ad.skipOffset],
      );
      if (this.holding) {
        this.holding = false;
        void this.player.video.play()?.catch(() => {});
      }
      this.engineBreaks()?.schedule({
        id: plan.id,
        start: at,
        ...(plan.offset === 'start'
          ? { cue: 'pre' as const }
          : plan.offset === 'end'
            ? { cue: 'post' as const }
            : {}),
        ...(plan.covers !== undefined ? { covers: plan.covers } : {}),
        assets: files.map((file, i) => ({
          url: file.url,
          duration: playable[i]?.duration ?? 0,
          mimeType: /dash/i.test(file.type)
            ? 'application/dash+xml'
            : 'application/vnd.apple.mpegurl',
        })),
        noSkip: true,
        noJump: true,
        // An ad server's break plays once per programme, as IMA plays a VMAP.
        once: true,
        ...(offsets.length > 0 ? { skipAfter: Math.min(...offsets) } : {}),
      });
      return;
    }
    plan.status = 'progressive';
    if (plan.offset === 'start' && (this.holding || !this.player.video.paused)) {
      this.holding = false;
      this.player.video.pause();
      this.startProgressive(plan);
    }
  }

  /** Lets the programme play once no pre-roll holds it. */
  private release(): void {
    if (!this.holding || this.pending('start')) return;
    this.holding = false;
    void this.player.video.play()?.catch(() => {});
  }

  // ---- the engine's breaks -----------------------------------------------

  private bindEngine(): void {
    this.offEngine?.();
    this.offEngine = null;
    const engine = this.player.engine;
    if (engine === null || this.engineBreaks() === undefined) return;
    const on = (name: string, fn: (payload: Record<string, unknown>) => void): (() => void) =>
      engine.on(`interstitials:${name}`, (payload) => fn(payload as Record<string, unknown>));
    const offs = [
      on('break-start', (p) => {
        // A drag on the seek bar crosses a break the stream plays at each of
        // its seeks: where the drag ends decides, not each step of it.
        if (p.stitched === true && this.player.hasAttribute('scrubbing')) return;
        this.engineBreakStart(p.break as Break, p.stitched === true);
      }),
      on('asset-start', (p) => this.engineAssetStart(Number(p.asset))),
      on('progress', (p) => this.quartile(Number(p.quartile))),
      on('asset-end', () => this.adEnd()),
      on('break-end', (p) => {
        if (p.stitched === true && this.player.hasAttribute('scrubbing')) return;
        this.breakEnd();
      }),
      on('warning', (p) => {
        const current = this.current;
        if (current?.ad !== undefined) {
          for (const url of current.ad.errors)
            this.send(expand(url, { ...this.macros(current), errorCode: 405 }));
        }
        this.emit('aderror', { id: p.id, code: 405, reason: p.reason });
      }),
      on('opportunity', (p) => this.opportunity(p.break as Break, Number(p.duration))),
    ];
    offs.push(engine.on('interstitials:changed', () => this.mark()));
    this.offEngine = () => {
      for (const off of offs) off();
    };
    this.mark();
  }

  /** After a drag: in an ad the stream plays, it starts; out of it, the ad that showed ends. */
  private landed(): void {
    const time = this.player.video.currentTime;
    const inside = (this.engineBreaks()?.breaks ?? []).find(
      (entry) =>
        entry.assets.length === 0 &&
        entry.assetList === undefined &&
        time >= entry.start &&
        time < entry.start + Math.max(entry.covers, 0.001),
    );
    const current = this.current;
    if (current?.stitched === true && current.entry?.id !== inside?.id) this.breakEnd();
    if (inside !== undefined && this.current === null) this.engineBreakStart(inside, true);
  }

  private engineBreakStart(entry: Break, stitched: boolean): void {
    const plan = this.plans.get(entry.id) ?? null;
    this.current = {
      plan,
      entry,
      stitched,
      index: -1,
      ad: undefined,
      creative: undefined,
      file: undefined,
      skipped: false,
      quartiles: 0,
      sent: new Set(),
      viewable: false,
      paused: false,
      interrupt: false,
      last: 0,
      at: this.programmeTime(),
    };
    this.breakStart();
    // A break the stream plays itself is one ad, from its start.
    if (stitched) this.engineAssetStart(0);
  }

  private engineAssetStart(index: number): void {
    const current = this.current;
    if (current === null) return;
    current.index = index;
    current.ad = current.plan?.ads[index];
    current.creative = current.stitched
      ? current.entry?.creatives?.[0]
      : current.entry?.assets[index]?.creatives?.[0];
    current.file = current.plan?.files[index];
    current.skipped = false;
    current.quartiles = 0;
    current.sent = new Set();
    current.viewable = false;
    this.adStart(current);
  }

  private opportunity(entry: Break, duration: number): void {
    const url = this.onOpportunity?.({ id: entry.id, start: entry.start, duration });
    if (url === null || url === undefined) return;
    this.add({
      id: entry.id,
      offset: { time: entry.start },
      vast: { url: new URL(url, location.href).href },
      tracking: [],
      covers: duration,
    });
    const plan = this.plans.get(entry.id);
    if (plan !== undefined) void this.resolve(plan, entry.start);
  }

  // ---- progressive ads, on the player's video -------------------------------

  /** A break of progressive ads: each in the programme's place, then the programme again. */
  private startProgressive(plan: Plan): void {
    plan.status = 'done';
    this.current = {
      plan,
      entry: null,
      stitched: false,
      index: -1,
      ad: undefined,
      creative: undefined,
      file: undefined,
      skipped: false,
      quartiles: 0,
      sent: new Set(),
      viewable: false,
      paused: false,
      interrupt: true,
      last: 0,
      at: this.programmeTime(),
    };
    this.breakStart();
    this.nextProgressive();
  }

  private nextProgressive(): void {
    const current = this.current;
    if (current === null || !current.interrupt || current.plan === null) return;
    if (current.index >= 0) this.adEnd();
    current.index += 1;
    const ad = current.plan.ads[current.index];
    const file = current.plan.files[current.index];
    if (ad === undefined || file === undefined) {
      const plan = current.plan;
      this.breakEnd();
      // After a post-roll the programme comes back on its last frame, paused.
      void this.player.resume(
        plan.offset === 'end' ? { at: plan.start ?? null, playing: false } : { playing: true },
      );
      return;
    }
    current.ad = ad;
    current.file = file;
    current.skipped = false;
    current.quartiles = 0;
    current.sent = new Set();
    current.viewable = false;
    current.paused = false;
    current.last = 0;
    this.player.interrupt({ url: file.url, type: file.type }).catch(() => {
      // No handler plays the file: the next ad, or the programme.
      if (this.current !== current) return;
      for (const url of ad.errors)
        this.send(expand(url, { ...this.macros(current), errorCode: 405 }));
      this.emit('aderror', { id: current.plan?.id, code: 405 });
      this.nextProgressive();
    });
    this.adStart(current);
  }

  // ---- one ad ------------------------------------------------------------

  private breakStart(): void {
    const current = this.current;
    if (current === null) return;
    // `stitched` keeps the programme's controls; any other ad takes their place.
    this.player.setAttribute('ad', this.free(current) ? 'stitched' : '');
    if (current.plan !== null) this.vmapTrack(current.plan, 'breakStart');
    this.observe();
    this.emit('adbreakstart', this.detail());
  }

  private adStart(current: Current): void {
    if (current.ad !== undefined) {
      for (const url of current.ad.impressions) this.send(expand(url, this.macros(current)));
    }
    // SVTA2053 names the impression among its tracking events.
    this.track(current, 'impression');
    this.track(current, 'creativeView');
    this.track(current, 'start');
    this.visibleSince = null;
    this.emit('adstart', this.detail());
    this.update();
  }

  private quartile(n: number): void {
    const current = this.current;
    if (current === null || n <= current.quartiles) return;
    current.quartiles = n;
    const event = QUARTILE_EVENTS[n - 1];
    if (event !== undefined) this.track(current, event);
    this.emit('adprogress', { ...this.detail(), quartile: n });
  }

  /** The ad's own time: progressive quartiles, progress beacons, the stream's callbacks, viewability. */
  private followAd(current: Current): void {
    const media = this.player.video;
    const time = current.stitched
      ? this.player.video.currentTime - (current.entry?.start ?? 0)
      : media.currentTime;
    if (current.interrupt && !media.seeking) current.last = time;
    if (current.interrupt && Number.isFinite(media.duration) && media.duration > 0) {
      const reached = Math.floor((time / media.duration) * 4);
      for (let n = current.quartiles + 1; n <= Math.min(3, reached); n += 1) this.quartile(n);
    }
    const progress = current.ad?.tracking ?? [];
    progress.forEach((entry, i) => {
      if (
        entry.event !== 'progress' ||
        entry.offset === undefined ||
        current.sent.has(i) ||
        time < entry.offset
      )
        return;
      current.sent.add(i);
      this.send(expand(entry.url, this.macros(current)));
    });
    // DASH callback events of a List MPD, at their offsets in the asset.
    const tracking = current.entry?.assets[current.index]?.tracking ?? [];
    tracking.forEach((entry, i) => {
      const key = 1000 + i;
      if (current.sent.has(key) || time < entry.offset) return;
      current.sent.add(key);
      this.send(entry.url);
    });
    this.view(current);
  }

  private adPaused(media: HTMLVideoElement): void {
    const current = this.current;
    if (current === null || media.ended || current.paused) return;
    current.paused = true;
    this.track(current, 'pause');
  }

  private adResumed(media: HTMLVideoElement): void {
    const current = this.current;
    if (current === null || !current.paused || media !== this.player.video) return;
    current.paused = false;
    this.track(current, 'resume');
  }

  private adVolume(media: HTMLVideoElement): void {
    const current = this.current;
    if (current === null) return;
    this.track(current, media.muted ? 'mute' : 'unmute');
  }

  private adEnd(): void {
    const current = this.current;
    if (current === null || current.index < 0) return;
    if (!current.skipped) this.track(current, 'complete');
    if (current.ad !== undefined && !current.viewable) {
      for (const url of current.ad.notViewable) this.send(expand(url, this.macros(current)));
    }
    this.emit('adend', this.detail());
  }

  private breakEnd(): void {
    const current = this.current;
    if (current === null) return;
    // A break the stream plays has no asset of its own to end.
    if (current.stitched) this.adEnd();
    if (current.plan !== null) {
      current.plan.status = 'done';
      this.vmapTrack(current.plan, 'breakEnd');
    }
    const detail = this.detail();
    const id = current.plan?.id ?? current.entry?.id;
    if (id !== undefined) this.done.add(id);
    this.current = null;
    this.player.removeAttribute('ad');
    this.mark();
    this.observer?.disconnect();
    this.observer = null;
    this.emit('adbreakend', detail);
    this.update();
  }

  // ---- viewability -------------------------------------------------------

  /** MRC: half the player in view for two seconds in a row. */
  private observe(): void {
    if (typeof IntersectionObserver === 'undefined' || this.observer !== null) return;
    this.observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.some((entry) => entry.intersectionRatio >= 0.5);
        this.visibleSince = seen ? (this.visibleSince ?? performance.now()) : null;
      },
      { threshold: [0, 0.5] },
    );
    this.observer.observe(this.player);
  }

  private view(current: Current): void {
    if (current.viewable || current.ad === undefined || this.visibleSince === null) return;
    if (performance.now() - this.visibleSince < 2000) return;
    current.viewable = true;
    for (const url of current.ad.viewable) this.send(expand(url, this.macros(current)));
    this.emit('adviewable', this.detail());
  }

  // ---- beacons and events ------------------------------------------------

  private macros(current: Current): MacroValues {
    const media = this.player.video;
    const offset = current.plan?.offset;
    return {
      mediaPlayhead: current.at,
      adPlayhead: media.currentTime,
      ...(current.file !== undefined ? { assetUri: current.file.url } : {}),
      breakPosition: offset === 'start' ? 1 : offset === 'end' ? 3 : 2,
      playerSize: [this.player.clientWidth, this.player.clientHeight],
    };
  }

  private track(current: Current, event: string): void {
    for (const entry of current.ad?.tracking ?? []) {
      if (entry.event === event) this.send(expand(entry.url, this.macros(current)));
    }
  }

  private vmapTrack(plan: Plan, event: string): void {
    for (const entry of plan.tracking) if (entry.event === event) this.send(entry.url);
  }

  private detail(): Record<string, unknown> {
    const current = this.current;
    return {
      breakId: current?.plan?.id ?? current?.entry?.id ?? null,
      index: (current?.index ?? 0) + 1,
      ad: current?.ad ?? null,
      stitched: current?.stitched ?? false,
    };
  }

  private emit(name: string, detail: object): void {
    this.player.dispatchEvent(new CustomEvent(name, { detail }));
  }

  private update(): void {
    for (const fn of [...this.watchers]) fn();
  }

  private reset(): void {
    const current = this.current;
    if (current !== null) this.player.removeAttribute('ad');
    this.current = null;
    this.plans = new Map();
    this.done = new Set();
    this.own = new Set();
    this.player.breaks.set('ads', []);
    this.holding = false;
    this.lastTime = 0;
    this.observer?.disconnect();
    this.observer = null;
    this.update();
  }
}
