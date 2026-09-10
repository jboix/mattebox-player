/**
 * The five charts, on one canvas: the buffer per source buffer over media
 * time, and over wall time the throughput, the stalls, the frames and the
 * switches. Drawn the way the engine's playground draws them, in a copy
 * that reads the sampler and needs no DOM of its own beyond the canvas,
 * the legend and the readout it is given. Colours come from the element,
 * read off its custom properties, so a page's tokens reach the canvas.
 */
import type { Mattebox, Rendition } from 'mattebox';
import { bitrate, clock } from './format.js';
import type { Counters, Mark, Sample } from './sampler.js';

export type ChartTab = 'buffer' | 'throughput' | 'stalls' | 'frames' | 'switches';

export const CHART_TABS: readonly ChartTab[] = [
  'buffer',
  'throughput',
  'stalls',
  'frames',
  'switches',
];

export interface Palette {
  readonly ink: string;
  readonly muted: string;
  readonly accent: string;
  readonly warn: string;
  readonly series: readonly string[];
}

export interface ChartInput {
  readonly tab: ChartTab;
  /** Seconds of wall time across the plot. */
  readonly window: number;
  readonly samples: readonly Sample[];
  readonly marks: readonly Mark[];
  readonly counters: Counters;
  readonly video: HTMLVideoElement;
  readonly engine: Mattebox | null;
  readonly palette: Palette;
}

export interface Charts {
  draw(input: ChartInput): void;
}

interface Frame {
  readonly ctx: CanvasRenderingContext2D;
  readonly w: number;
  readonly h: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

type Point = readonly [number, number];

/** A round step for a range: 1, 2, 5 times a power of ten. */
function niceStep(range: number, target: number): number {
  const raw = range / Math.max(target, 1);
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  for (const m of [1, 2, 5, 10]) if (raw <= m * pow) return m * pow;
  return 10 * pow;
}

/** Greys with the alpha the grid and the bands need, from any colour the tokens give. */
function alpha(color: string, value: number): string {
  const probe = document.createElement('canvas').getContext('2d');
  if (probe === null) return color;
  probe.fillStyle = color;
  const hex = probe.fillStyle;
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return color;
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${value})`;
}

export function createCharts(
  canvas: HTMLCanvasElement,
  legend: HTMLElement,
  readout: HTMLElement,
): Charts {
  function frame(): Frame | null {
    const ctx = canvas.getContext('2d');
    if (ctx === null) return null;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return null;
    const width = Math.round(w * dpr);
    const height = Math.round(h * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    return { ctx, w, h, left: 44, right: w - 8, top: 8, bottom: h - 18 };
  }

  /** The wall-time axis, now at the right edge, labelled back from it. Returns the mapping. */
  function wallAxis(f: Frame, t0: number, t1: number, p: Palette): (t: number) => number {
    const x = (t: number): number => f.left + ((t - t0) / (t1 - t0)) * (f.right - f.left);
    const span = (t1 - t0) / 1000;
    const step = niceStep(span, 6);
    f.ctx.strokeStyle = alpha(p.muted, 0.25);
    f.ctx.fillStyle = p.muted;
    f.ctx.textAlign = 'center';
    f.ctx.textBaseline = 'top';
    for (let back = 0; back <= span; back += step) {
      const px = x(t1 - back * 1000);
      f.ctx.beginPath();
      f.ctx.moveTo(px, f.top);
      f.ctx.lineTo(px, f.bottom);
      f.ctx.stroke();
      const text = back === 0 ? 'now' : back < 60 ? `-${back}s` : `-${clock(back)}`;
      f.ctx.fillText(text, px, f.bottom + 3);
    }
    return x;
  }

  /** The value axis from zero, four gridlines, labelled by `unit`. Returns the mapping. */
  function valueAxis(
    f: Frame,
    max: number,
    unit: (v: number) => string,
    p: Palette,
  ): (v: number) => number {
    const y = (v: number): number => f.bottom - (v / max) * (f.bottom - f.top);
    const step = niceStep(max, 4);
    f.ctx.strokeStyle = alpha(p.muted, 0.25);
    f.ctx.fillStyle = p.muted;
    f.ctx.textAlign = 'right';
    f.ctx.textBaseline = 'middle';
    for (let v = 0; v <= max; v += step) {
      const py = y(v);
      f.ctx.beginPath();
      f.ctx.moveTo(f.left, py);
      f.ctx.lineTo(f.right, py);
      f.ctx.stroke();
      f.ctx.fillText(unit(v), f.left - 4, py);
    }
    return y;
  }

  function line(
    f: Frame,
    points: readonly Point[],
    color: string,
    options: { dashed?: boolean; step?: boolean; width?: number } = {},
  ): void {
    if (points.length === 0) return;
    f.ctx.save();
    f.ctx.strokeStyle = color;
    f.ctx.lineWidth = options.width ?? 2;
    f.ctx.setLineDash(options.dashed === true ? [4, 4] : []);
    f.ctx.beginPath();
    let previous: Point | undefined;
    for (const point of points) {
      if (previous === undefined) f.ctx.moveTo(point[0], point[1]);
      else if (options.step === true) {
        f.ctx.lineTo(point[0], previous[1]);
        f.ctx.lineTo(point[0], point[1]);
      } else f.ctx.lineTo(point[0], point[1]);
      previous = point;
    }
    f.ctx.stroke();
    f.ctx.restore();
  }

  function dot(f: Frame, px: number, py: number, color: string, r = 2.5): void {
    f.ctx.fillStyle = color;
    f.ctx.beginPath();
    f.ctx.arc(px, py, r, 0, Math.PI * 2);
    f.ctx.fill();
  }

  /** A dashed vertical rule with a glyph at its top. */
  function marker(f: Frame, px: number, color: string, glyph: string): void {
    f.ctx.save();
    f.ctx.strokeStyle = color;
    f.ctx.lineWidth = 1;
    f.ctx.setLineDash([2, 3]);
    f.ctx.beginPath();
    f.ctx.moveTo(px, f.top);
    f.ctx.lineTo(px, f.bottom);
    f.ctx.stroke();
    f.ctx.restore();
    f.ctx.fillStyle = color;
    f.ctx.textAlign = 'center';
    f.ctx.textBaseline = 'top';
    f.ctx.fillText(glyph, px, f.top);
  }

  function setLegend(items: ReadonlyArray<readonly [string, string]>): void {
    legend.replaceChildren();
    for (const [text, color] of items) {
      const item = document.createElement('span');
      item.setAttribute('part', 'legend-item');
      const swatch = document.createElement('span');
      swatch.setAttribute('part', 'swatch');
      swatch.style.background = color;
      item.append(swatch, text);
      legend.append(item);
    }
  }

  /** The samples in the window, plus the one before it so the line enters from the left. */
  function visible(samples: readonly Sample[], t0: number): Sample[] {
    const from = samples.findIndex((s) => s.t >= t0);
    if (from < 0) return samples.length > 0 ? [samples[samples.length - 1] as Sample] : [];
    return samples.slice(Math.max(0, from - 1));
  }

  function renditions(engine: Mattebox | null): readonly Rendition[] {
    return engine?.quality.renditions ?? [];
  }

  function drawBuffer(f: Frame, input: ChartInput): void {
    const { video, engine, palette: p } = input;
    const state = engine?.stats.snapshot() ?? null;
    const duration = state?.presentation?.duration ?? video.duration;
    const live = state?.live ?? null;
    const now = video.currentTime;
    let d0 = 0;
    let d1 = Number.isFinite(duration) && duration > 0 ? duration : Math.max(now + 10, 10);
    if (live !== null) {
      d0 = live.span.start;
      d1 = Math.max(live.span.end, now + 10);
    } else if (d1 > 600) {
      d0 = Math.max(0, now - 60);
      d1 = now + 180;
    }
    const x = (t: number): number => f.left + ((t - d0) / (d1 - d0)) * (f.right - f.left);

    // One row per source buffer, or the video's own ranges for a native session.
    const rows: Array<{ label: string; ranges: ReadonlyArray<{ start: number; end: number }> }> =
      state === null
        ? [
            {
              label: 'video',
              ranges: Array.from({ length: video.buffered.length }, (_, i) => ({
                start: video.buffered.start(i),
                end: video.buffered.end(i),
              })),
            },
          ]
        : [...state.buffers.entries()].map(([id, buffer]) => ({
            label: id.replace('sb:', ''),
            ranges: buffer.ranges,
          }));
    if (rows.length === 0) rows.push({ label: 'video', ranges: [] });
    const ladder = renditions(engine);
    const rowGap = 8;
    const rowH = Math.min(34, (f.bottom - f.top - rowGap * (rows.length - 1)) / rows.length);
    f.ctx.textAlign = 'left';
    f.ctx.textBaseline = 'middle';
    rows.forEach((row, i) => {
      const y = f.top + i * (rowH + rowGap);
      f.ctx.fillStyle = alpha(p.muted, 0.15);
      f.ctx.fillRect(f.left, y, f.right - f.left, rowH);
      if (state !== null) {
        for (const [range, id] of state.quality.appendLog) {
          const index = ladder.findIndex((r) => r.id === id);
          f.ctx.fillStyle = alpha(p.series[Math.max(0, index) % p.series.length] ?? p.accent, 0.3);
          f.ctx.fillRect(x(range.start), y, Math.max(1, x(range.end) - x(range.start)), rowH);
        }
      }
      f.ctx.fillStyle = p.ink;
      for (const range of row.ranges) {
        f.ctx.fillRect(x(range.start), y + rowH - 4, Math.max(1, x(range.end) - x(range.start)), 3);
      }
      f.ctx.fillStyle = p.muted;
      f.ctx.fillText(row.label, f.left + 4, y + rowH / 2);
    });
    if (live !== null) marker(f, x(live.edge), p.warn, 'edge');
    f.ctx.fillStyle = p.accent;
    f.ctx.fillRect(x(now) - 1, f.top, 2, f.bottom - f.top);
    f.ctx.fillStyle = p.muted;
    f.ctx.textAlign = 'left';
    f.ctx.textBaseline = 'top';
    f.ctx.fillText(clock(d0), f.left, f.bottom + 3);
    f.ctx.textAlign = 'right';
    f.ctx.fillText(clock(d1), f.right, f.bottom + 3);

    setLegend([
      ...ladder.map((r, i): readonly [string, string] => [
        r.height !== undefined ? `${r.height}p` : bitrate(r.bitrate),
        p.series[i % p.series.length] ?? p.accent,
      ]),
      ['buffered', p.ink],
      ['playhead', p.accent],
    ]);
    const ahead = input.samples[input.samples.length - 1]?.ahead ?? 0;
    readout.textContent = `${clock(now)} of ${clock(d1)}, ${ahead.toFixed(1)}s buffered ahead${
      live !== null ? `, window ${clock(live.span.start)} to ${clock(live.span.end)}` : ''
    }`;
  }

  function drawThroughput(f: Frame, input: ChartInput, t0: number, t1: number): void {
    const p = input.palette;
    const view = visible(input.samples, t0);
    const segments = input.marks.filter((m) => m.kind === 'segment' && m.t >= t0);
    const top =
      Math.max(
        1_000_000,
        ...view.map((s) => Math.max(s.slow, s.fast, s.playingBitrate)),
        ...segments.map((m) => m.value),
      ) * 1.15;
    const y = valueAxis(f, top, (v) => (v / 1e6).toFixed(v >= 1e7 ? 0 : 1), p);
    const x = wallAxis(f, t0, t1, p);
    for (const m of segments) {
      const audio = m.trackId?.startsWith('aud') === true || m.trackId?.includes('audio') === true;
      dot(f, x(m.t), y(m.value), (audio ? p.series[4] : p.series[0]) ?? p.accent);
    }
    line(
      f,
      view.map((s): Point => [x(s.t), y(s.slow)]),
      p.series[1] ?? p.accent,
    );
    line(
      f,
      view.map((s): Point => [x(s.t), y(s.fast)]),
      p.series[2] ?? p.accent,
      { dashed: true },
    );
    line(
      f,
      view.map((s): Point => [x(s.t), y(s.playingBitrate)]),
      p.muted,
      { step: true, width: 1.5 },
    );
    setLegend([
      ['video segment', p.series[0] ?? p.accent],
      ['audio segment', p.series[4] ?? p.accent],
      ['slow estimate', p.series[1] ?? p.accent],
      ['fast estimate', p.series[2] ?? p.accent],
      ['playing bitrate', p.muted],
    ]);
    const last = view[view.length - 1];
    readout.textContent =
      last === undefined
        ? 'Mbps'
        : `Mbps. Now: slow ${bitrate(last.slow)}, fast ${bitrate(last.fast)}, playing ${bitrate(last.playingBitrate)}`;
  }

  function drawStalls(f: Frame, input: ChartInput, t0: number, t1: number): void {
    const p = input.palette;
    const view = visible(input.samples, t0);
    const top = Math.max(5, ...view.map((s) => s.ahead)) * 1.15;
    const y = valueAxis(f, top, (v) => `${v.toFixed(0)}s`, p);
    const x = wallAxis(f, t0, t1, p);
    f.ctx.fillStyle = alpha(p.series[3] ?? p.accent, 0.25);
    let start: number | null = null;
    for (const [i, s] of view.entries()) {
      if (s.stalled && start === null) start = s.t;
      const last = i === view.length - 1;
      if ((!s.stalled || last) && start !== null) {
        f.ctx.fillRect(x(start), f.top, Math.max(2, x(s.t) - x(start)), f.bottom - f.top);
        start = null;
      }
    }
    line(
      f,
      view.map((s): Point => [x(s.t), y(s.ahead)]),
      p.series[0] ?? p.accent,
    );
    for (const m of input.marks) {
      if (m.t < t0 || m.kind === 'segment' || m.kind === 'switch') continue;
      if (m.kind === 'stall') marker(f, x(m.t), p.accent, '!');
      else if (m.kind === 'seek') marker(f, x(m.t), p.muted, '>');
      else marker(f, x(m.t), p.warn, m.kind.charAt(0).toUpperCase());
    }
    setLegend([
      ['buffered ahead', p.series[0] ?? p.accent],
      ['stalled', p.series[3] ?? p.accent],
      ['! stall', p.accent],
      ['> seek', p.muted],
      ['N F S G recovery', p.warn],
    ]);
    const c = input.counters;
    const now = view[view.length - 1]?.stalled === true ? ', stalled now' : '';
    readout.textContent = `${c.stalls} stalls, ${c.stalledSeconds.toFixed(1)}s stalled in total${now}`;
  }

  function drawFrames(f: Frame, input: ChartInput, t0: number, t1: number): void {
    const p = input.palette;
    const view = visible(input.samples, t0);
    const fps = view.map((s, i) => {
      const prev = view[i - 1];
      const dt = prev === undefined ? 0.5 : Math.max((s.t - prev.t) / 1000, 0.05);
      return s.decoded / dt;
    });
    const top = Math.max(30, ...fps) * 1.15;
    const y = valueAxis(f, top, (v) => v.toFixed(0), p);
    const x = wallAxis(f, t0, t1, p);
    const maxDrop = Math.max(1, ...view.map((s) => s.dropped));
    f.ctx.fillStyle = p.accent;
    for (const s of view) {
      if (s.dropped === 0) continue;
      const height = (s.dropped / maxDrop) * (f.bottom - f.top) * 0.6;
      f.ctx.fillRect(x(s.t) - 1.5, f.bottom - height, 3, height);
    }
    line(
      f,
      view.map((s, i): Point => [x(s.t), y(fps[i] ?? 0)]),
      p.series[0] ?? p.accent,
    );
    setLegend([
      ['decoded per second', p.series[0] ?? p.accent],
      ['dropped, relative', p.accent],
    ]);
    const c = input.counters;
    const rate = c.decoded > 0 ? ((c.dropped / c.decoded) * 100).toFixed(2) : '0.00';
    readout.textContent = `${c.decoded} decoded, ${c.dropped} dropped (${rate}%) this session`;
  }

  function drawSwitches(f: Frame, input: ChartInput, t0: number, t1: number): void {
    const p = input.palette;
    const view = visible(input.samples, t0);
    const ladder = renditions(input.engine);
    const useHeight = ladder.some((r) => r.height !== undefined);
    const levels = ladder.map((r) => (useHeight ? (r.height ?? 0) : r.bitrate));
    const top =
      Math.max(1, ...levels, ...view.map((s) => (useHeight ? s.playingHeight : s.playingBitrate))) *
      1.15;
    const y = (v: number): number => f.bottom - (v / top) * (f.bottom - f.top);
    // The ladder is the axis: one line per rendition.
    f.ctx.strokeStyle = alpha(p.muted, 0.25);
    f.ctx.fillStyle = p.muted;
    f.ctx.textAlign = 'right';
    f.ctx.textBaseline = 'middle';
    for (const level of levels) {
      const py = y(level);
      f.ctx.beginPath();
      f.ctx.moveTo(f.left, py);
      f.ctx.lineTo(f.right, py);
      f.ctx.stroke();
      f.ctx.fillText(useHeight ? `${level}p` : bitrate(level), f.left - 4, py);
    }
    const x = wallAxis(f, t0, t1, p);
    line(
      f,
      view.map((s): Point => [x(s.t), y(useHeight ? s.playingHeight : s.playingBitrate)]),
      p.series[0] ?? p.accent,
      { step: true },
    );
    for (const m of input.marks)
      if (m.kind === 'switch' && m.t >= t0) marker(f, x(m.t), p.warn, 'S');
    setLegend([
      ['playing', p.series[0] ?? p.accent],
      ['S switch', p.warn],
    ]);
    const last = view[view.length - 1];
    const now =
      last === undefined || last.playingId === null
        ? '–'
        : useHeight
          ? `${last.playingHeight}p`
          : bitrate(last.playingBitrate);
    readout.textContent = `${input.counters.switches} switches this session, now ${now}`;
  }

  return {
    draw(input): void {
      const f = frame();
      if (f === null) return;
      if (input.engine === null && (input.tab === 'throughput' || input.tab === 'switches')) {
        setLegend([]);
        readout.textContent = 'A native session: the browser holds this, and says nothing.';
        return;
      }
      const t1 = performance.now();
      const t0 = t1 - input.window * 1000;
      switch (input.tab) {
        case 'buffer':
          drawBuffer(f, input);
          break;
        case 'throughput':
          drawThroughput(f, input, t0, t1);
          break;
        case 'stalls':
          drawStalls(f, input, t0, t1);
          break;
        case 'frames':
          drawFrames(f, input, t0, t1);
          break;
        case 'switches':
          drawSwitches(f, input, t0, t1);
          break;
      }
    },
  };
}
