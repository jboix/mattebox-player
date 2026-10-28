/**
 * The reels demo: a feed of RTS reels to scroll through, with one player
 * and one playlist. The player moves into the reel on screen and the
 * playlist plays that item. The page measures how long each reel takes to
 * start, and whether its manifest came from a preload.
 *
 * The reels are a fixed list of RTS URNs, which the SRG SSR connector
 * resolves at each start: a stream needs a fresh token.
 *
 * The playlist preloads the next item near the end of the one that plays.
 * A feed moves on before that, so this page asks the core itself, once a
 * reel plays. The preload resolves the next URN too, so its start asks the
 * IL nothing. Wanted: the playlist to do it. Had to: call `preload` here.
 * The surface that would make it one call: an option of the playlist that
 * preloads the next item from the start.
 */
import '@mattebox/player';
import { MatteboxPlayerElement } from '@mattebox/player';
import type { PlaylistItem } from '@mattebox/player-playlist';
import { createPlaylist } from '@mattebox/player-playlist';
import logoUrl from '../../docs/logo.svg';
import { srgssr } from './connectors/srgssr.js';
import { REELS } from './reel-list.js';
import { wireTheme } from './theme.js';

MatteboxPlayerElement.define({ connectors: [srgssr] });

for (const img of document.querySelectorAll<HTMLImageElement>('img.logo')) img.src = logoUrl;
for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')) {
  link.href = logoUrl;
}

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`no #${id}`);
  return node as T;
}

/** Seconds the engine keeps what it preloaded, and how often a reel that stays on screen asks again. */
const KEEP_SECONDS = 60;
const PRELOAD_EVERY = 50_000;

const feed = byId<HTMLDivElement>('feed');
const preload = byId<HTMLInputElement>('preload');
const sound = byId<HTMLInputElement>('sound');
const segments = byId<HTMLSelectElement>('segments');
const log = byId<HTMLOListElement>('log');
const medians = {
  preloaded: byId<HTMLElement>('median-preloaded'),
  network: byId<HTMLElement>('median-network'),
};

wireTheme(byId<HTMLButtonElement>('theme-toggle'));

// A long feed makes more requests than the browser's default of 250 entries.
performance.setResourceTimingBufferSize(5000);

/** The picture of a reel, scaled by the IL's image service to the width the feed draws. */
function artwork(imageUrl: string): string {
  return `https://il.srgssr.ch/images/?imageUrl=${encodeURIComponent(imageUrl)}&format=jpg&width=480`;
}

/** The reels as playlist items: each URN goes to the SRG SSR connector. */
function rtsReels(): PlaylistItem[] {
  return REELS.map((reel) => ({
    src: reel.urn,
    type: srgssr.type,
    heading: reel.title,
    subheading: `RTS, ${Math.round(reel.seconds)} s`,
    artwork: artwork(reel.image),
    duration: reel.seconds,
  }));
}

interface Slide {
  readonly slide: HTMLElement;
  readonly hud: HTMLElement;
}

/** One slide per reel: its artwork until the picture starts, its title, and what the page measured. */
function build(reels: readonly PlaylistItem[]): Slide[] {
  return reels.map((item, index) => {
    const slide = document.createElement('article');
    slide.className = 'reel';
    slide.dataset.index = String(index);
    if (item.artwork !== undefined) {
      const art = document.createElement('img');
      art.className = 'reel-art';
      art.alt = '';
      art.src = item.artwork;
      slide.append(art);
    }
    const meta = document.createElement('div');
    meta.className = 'reel-meta';
    const heading = document.createElement('h2');
    heading.className = 'reel-title';
    heading.textContent = item.heading ?? '';
    const sub = document.createElement('p');
    sub.textContent = `${index + 1} of ${reels.length}. ${item.subheading ?? ''}`;
    const hud = document.createElement('p');
    hud.className = 'reel-hud';
    meta.append(heading, sub, hud);
    slide.append(meta);
    feed.append(slide);
    return { slide, hud };
  });
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

/**
 * Whether the manifest of `url` was already there at `since`: the browser's
 * resource timing has no request for it after the reel was selected. The
 * query is left out of the match, because a stage a page adds (CMCD) can
 * put its own on every request.
 */
function wasPreloaded(url: string, since: number): boolean {
  const path = (name: string): string => name.split('?')[0] as string;
  const absolute = path(new URL(url, location.href).href);
  const entries = performance
    .getEntriesByType('resource')
    .filter((entry) => path(entry.name) === absolute);
  return entries.length > 0 && entries.every((entry) => entry.startTime < since);
}

function run(reels: readonly PlaylistItem[]): void {
  const slides = build(reels);

  // The player is in the page's markup, outside the feed until a reel exists.
  const player = byId<MatteboxPlayerElement>('player');
  slides[0]?.slide.prepend(player);
  player.hidden = false;

  // A reel plays again from its start, and the feed decides what plays
  // next. Under repeat one the playlist preloads nothing itself, so the
  // checkbox on this page is the one switch for the preload.
  const playlist = createPlaylist(player, { repeat: 'one', skipOnError: false });

  let starts: Array<{ readonly ms: number; readonly preloaded: boolean }> = [];
  /** When the reel on screen was selected, or null once its start is measured. */
  let selectedAt: number | null = performance.now();
  let preloadTimer = 0;

  function tally(): void {
    for (const kind of ['preloaded', 'network'] as const) {
      const values = starts.filter((s) => s.preloaded === (kind === 'preloaded')).map((s) => s.ms);
      medians[kind].textContent =
        values.length === 0
          ? 'no reel yet'
          : `median ${Math.round(median(values))} ms over ${values.length}`;
    }
  }

  /** Asks the engine for the next reel's manifest, now and while this reel stays. */
  function preloadNext(): void {
    clearInterval(preloadTimer);
    if (!preload.checked) return;
    const next = reels[playlist.index + 1];
    if (next === undefined) return;
    const ask = (): void => {
      // The core asks the handler that will play the reel. The browser's
      // own playback of a source preloads nothing.
      void player.player?.preload(
        next.type === undefined ? { url: next.src } : { url: next.src, type: next.type },
        { segments: Number(segments.value), keepSeconds: KEEP_SECONDS },
      );
    };
    ask();
    preloadTimer = window.setInterval(ask, PRELOAD_EVERY);
  }

  // The reel's progress: one thin seek bar, moved with the player. The
  // player has no controls here, so the page draws it and it never hides.
  const progress = document.createElement('div');
  progress.className = 'reel-progress';
  progress.tabIndex = 0;
  progress.setAttribute('role', 'slider');
  progress.setAttribute('aria-label', 'Seek');
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', '100');
  const fill = document.createElement('div');
  fill.className = 'reel-progress-fill';
  progress.append(fill);
  slides[0]?.slide.append(progress);

  /** Draws how far the reel is, on every frame, so the line moves without steps. */
  function drawProgress(): void {
    const { currentTime, duration } = player.video;
    const part = duration > 0 && Number.isFinite(duration) ? currentTime / duration : 0;
    fill.style.transform = `scaleX(${Math.min(1, Math.max(0, part))})`;
    progress.setAttribute('aria-valuenow', String(Math.round(part * 100)));
    requestAnimationFrame(drawProgress);
  }
  requestAnimationFrame(drawProgress);

  /** Seeks to where the pointer is along the bar. */
  function seekTo(event: PointerEvent): void {
    const { duration } = player.video;
    if (!(duration > 0) || !Number.isFinite(duration)) return;
    const box = progress.getBoundingClientRect();
    const part = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    player.video.currentTime = part * duration;
  }
  progress.addEventListener('pointerdown', (event) => {
    progress.setPointerCapture(event.pointerId);
    seekTo(event);
  });
  progress.addEventListener('pointermove', (event) => {
    if (progress.hasPointerCapture(event.pointerId)) seekTo(event);
  });
  // A press on the bar seeks. It must not also reach the feed, which pauses.
  progress.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  progress.addEventListener('keydown', (event) => {
    const step = event.key === 'ArrowRight' ? 5 : event.key === 'ArrowLeft' ? -5 : 0;
    if (step === 0) return;
    event.preventDefault();
    player.video.currentTime = Math.max(0, player.video.currentTime + step);
  });

  /** Moves the player into the reel on screen and plays its item. */
  function show(index: number): void {
    const target = slides[index];
    if (target === undefined || index === playlist.index) return;
    clearInterval(preloadTimer);
    target.slide.prepend(player);
    target.slide.append(progress);
    selectedAt = performance.now();
    // In the same task as the move: the element loads once, with the new source.
    playlist.select(index);
  }

  player.video.addEventListener('playing', () => {
    if (selectedAt === null) return;
    const item = playlist.item;
    const slide = slides[playlist.index];
    if (item === null || slide === undefined) return;
    const ms = performance.now() - selectedAt;
    const native = player.engine === null;
    // The stream the connector resolved, with its token: what the preload fetched.
    const url = player.player?.session?.source.url;
    const preloaded = !native && url !== undefined && wasPreloaded(url, selectedAt);
    selectedAt = null;
    starts.push({ ms, preloaded });
    const how = native
      ? 'native session, no preload'
      : preloaded
        ? 'manifest preloaded'
        : 'manifest from the network';
    // What the network still had to do between the scroll and the first frame.
    const since = performance.now() - ms;
    const requests = performance
      .getEntriesByType('resource')
      .filter(
        (entry) =>
          entry.startTime >= since &&
          (entry as PerformanceResourceTiming).initiatorType === 'fetch',
      ).length;
    slide.hud.textContent = `start ${Math.round(ms)} ms, ${requests} requests, ${how}`;
    const line = document.createElement('li');
    line.textContent = `${Math.round(ms)} ms  ${requests} req  ${how}  ${item.heading ?? ''}`;
    log.prepend(line);
    while (log.childElementCount > 30) log.lastElementChild?.remove();
    tally();
    preloadNext();
  });

  player.addEventListener('error', (event) => {
    const error = (event as CustomEvent<{ readonly fatal: boolean; readonly code: string }>).detail;
    const slide = slides[playlist.index];
    if (error.fatal && slide !== undefined) slide.hud.textContent = `error ${error.code}`;
  });

  // The reel that fills most of the feed is the one on screen.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        show(Number((entry.target as HTMLElement).dataset.index));
      }
    },
    { root: feed, threshold: 0.6 },
  );
  for (const { slide } of slides) observer.observe(slide);

  feed.addEventListener('click', () => {
    if (player.video.paused) player.video.play().catch(() => undefined);
    else player.video.pause();
  });

  // On the page, so the arrows work without a click on the feed first.
  document.addEventListener('keydown', (event) => {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    slides[playlist.index + step]?.slide.scrollIntoView({ behavior: 'smooth' });
  });

  preload.addEventListener('change', () => {
    if (preload.checked) preloadNext();
    else clearInterval(preloadTimer);
  });
  segments.addEventListener('change', preloadNext);

  sound.addEventListener('change', () => {
    player.toggleAttribute('muted', !sound.checked);
  });

  byId<HTMLButtonElement>('reset').addEventListener('click', () => {
    starts = [];
    log.replaceChildren();
    tally();
  });

  playlist.load(reels);
}

feed.replaceChildren();
run(rtsReels());
