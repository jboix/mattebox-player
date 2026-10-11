/**
 * The reels demo: a feed of RTS reels to scroll through, with one player
 * and one playlist. The player moves into the reel on screen and the
 * playlist plays that item. The page measures how long each reel takes to
 * start, and whether its manifest came from a preload.
 *
 * The playlist preloads the next item near the end of the one that plays.
 * A feed moves on before that, so this page asks the engine itself, once a
 * reel plays. Wanted: the playlist to do it. Had to: call `engine.preload`
 * here. The surface that would make it one call: an option of the playlist
 * that preloads the next item from the start.
 */
import '@mattebox/player';
import type { MatteboxPlayerElement } from '@mattebox/player';
import type { PlaylistItem } from '@mattebox/player-playlist';
import { createPlaylist } from '@mattebox/player-playlist';
import logoUrl from '../../docs/logo.svg';
import { fetchComposition, searchMedia, tokenize } from './srgssr.js';
import { wireTheme } from './theme.js';

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

/**
 * The reels RTS publishes: what a search for "reel" finds in the upright
 * format, each resolved to its HLS stream. A reel that does not resolve is
 * left out.
 */
async function rtsReels(): Promise<PlaylistItem[]> {
  const signal = new AbortController().signal;
  const found = await searchMedia('rts', 'reel', signal);
  const upright = found.filter((media) => media.mediaType === 'VIDEO' && media.upright);
  const resolved = await Promise.all(
    upright.map(async (media): Promise<PlaylistItem | null> => {
      try {
        const composition = await fetchComposition(media.urn, signal);
        const resource = composition.resources.find((r) => r.streaming === 'HLS');
        if (resource === undefined) return null;
        const token = resource.tokenType !== undefined && resource.tokenType !== 'NONE';
        return {
          src: token ? await tokenize(resource.url, signal) : resource.url,
          type: 'application/vnd.apple.mpegurl',
          heading: media.title,
          subheading: `RTS, ${Math.round(media.duration / 1000)} s`,
          ...(composition.imageUrl === undefined ? {} : { artwork: artwork(composition.imageUrl) }),
          duration: media.duration / 1000,
        };
      } catch {
        return null;
      }
    }),
  );
  return resolved.filter((item): item is PlaylistItem => item !== null);
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

  /** Moves the player into the reel on screen and plays its item. */
  function show(index: number): void {
    const target = slides[index];
    if (target === undefined || index === playlist.index) return;
    clearInterval(preloadTimer);
    target.slide.prepend(player);
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
    const preloaded = !native && wasPreloaded(item.src, selectedAt);
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

/** A line in the feed while the reels load, or when they do not. */
function notice(text: string): void {
  const line = document.createElement('p');
  line.className = 'feed-notice';
  line.textContent = text;
  feed.replaceChildren(line);
}

notice('Loading the reels from RTS');
rtsReels().then(
  (reels) => {
    if (reels.length === 0) {
      notice('The search found no reel');
      return;
    }
    feed.replaceChildren();
    run(reels);
  },
  (cause: unknown) => {
    notice(`The reels did not load: ${cause instanceof Error ? cause.message : String(cause)}`);
  },
);
