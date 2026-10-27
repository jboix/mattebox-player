/**
 * A tracker that sends nothing: it writes to a list on the page what a
 * media analytics tracker would send, at the moments pillarbox-apple's
 * Commanders Act tracker sends it: play, pause, seek, end, stop, and a
 * heartbeat every 30 seconds of playback. It also shows the mapping a real
 * tracker does, from each connector's data to its own labels.
 */
import type { Programme, Tracker } from '@mattebox/player';
import { deviceId, sessionId } from '@mattebox/player';
import type { IlComposition } from './connectors/srgssr.js';
import { mainChapter } from './connectors/srgssr.js';
import type { SvtVideo } from './connectors/svt.js';

const HEARTBEAT_MS = 30_000;

/** The labels a connector's data carries for audience measurement, by the connector's type. */
function labelsOf(programme: Programme): Readonly<Record<string, unknown>> | undefined {
  try {
    if (programme.type === 'srgssr/urn') {
      return mainChapter(programme.data as IlComposition).analyticsMetadata;
    }
    if (programme.type === 'svt/video') return (programme.data as SvtVideo).mmsStatistics;
  } catch {
    // Data a page injected by hand may lack them.
  }
  return undefined;
}

function nameOf(programme: Programme): string {
  return programme.metadata?.title ?? programme.id ?? programme.sources[0]?.url ?? 'a programme';
}

/** A tracker that hands each line to `write`. */
export function logTracker(write: (line: string) => void): Tracker {
  const device = deviceId({ key: 'mattebox.demo.device' });
  let session: string | undefined;
  let offs: Array<() => void> = [];
  let beat = 0;
  return {
    name: 'log',
    device,
    get session() {
      return session;
    },
    start(programme, player) {
      session = sessionId();
      const video = player.video;
      const at = (): string => `${video.currentTime.toFixed(1)}s`;
      write(`start: ${nameOf(programme)}, session ${session}`);
      const labels = labelsOf(programme);
      if (labels !== undefined) {
        write(
          `labels from ${programme.type}: ${Object.keys(labels).length}, such as ${Object.keys(labels).slice(0, 3).join(', ')}`,
        );
      }
      const on = (target: EventTarget, name: string, fn: (event: Event) => void): void => {
        target.addEventListener(name, fn);
        offs.push(() => target.removeEventListener(name, fn));
      };
      on(video, 'playing', () => write(`play at ${at()}`));
      on(video, 'pause', () => {
        if (!video.ended) write(`pause at ${at()}`);
      });
      on(video, 'seeking', () => write(`seek to ${at()}`));
      on(video, 'ended', () => write(`end at ${at()}`));
      on(player, 'error', (event) => {
        const error = (event as CustomEvent<{ code: string; fatal: boolean }>).detail;
        if (error.fatal) write(`error: ${error.code}`);
      });
      beat = window.setInterval(() => {
        if (!video.paused) write(`heartbeat at ${at()}`);
      }, HEARTBEAT_MS);
    },
    stop() {
      write(`stop, session ${session ?? ''}`);
      for (const off of offs) off();
      offs = [];
      clearInterval(beat);
      session = undefined;
    },
  };
}
