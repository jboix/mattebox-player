/**
 * Subtitles and the bar. Two things.
 *
 * The lift: the browser draws native cues at the bottom of the video, under
 * the bar. While the bar shows, every active cue the author left
 * unpositioned is moved above it, and put back when the bar hides. The
 * position is a negative line count, the one form every browser wraps at
 * the video's width; a percentage does not wrap in Chromium. Chromium
 * anchors the box's top on the count and Gecko its bottom, and their
 * overlap avoidance pushes in opposite directions, so nothing is left to
 * them: subtitles often show two cues at once, and the cues stack by their
 * own measured heights, wrapping included, clear under both readings. A
 * cue with a position of its own is the author's and is not touched.
 *
 * The look: `::cue` can only be styled from the document that holds the
 * video, which is the page and not the shadow root, and it takes no custom
 * properties. So a small sheet goes into the document, once, with one rule
 * per look the host's `subtitle-size` and `subtitle-background` attributes
 * can take. Sizes are percentages of the browser's own cue size, which
 * already follows the video's height, in the page and in fullscreen alike.
 * A page that wants more writes its own `mattebox-player > video::cue`.
 */
/** How the sizes scale the browser's own cue size; the lift counts lines by it. */
export const SCALES: Readonly<Record<string, number>> = {
  small: 0.75,
  medium: 1,
  large: 1.5,
  xlarge: 2,
};

const BACKDROP = 'video::-webkit-media-text-track-display-backdrop';

/**
 * The sheet in the document. `mattebox-player` is the element's tag. The
 * background goes on `::cue` and on the backdrop pseudo-element Chromium
 * and WebKit have, both: which of the two paints it differs by browser and
 * version, and a selector a browser does not know only voids its own rule.
 */
const CUE_RULES = `mattebox-player[subtitle-size="small"] > video::cue { font-size: 75%; }
mattebox-player[subtitle-size="large"] > video::cue { font-size: 150%; }
mattebox-player[subtitle-size="xlarge"] > video::cue { font-size: 200%; }
mattebox-player[subtitle-background="none"] > video::cue { background-color: transparent; }
mattebox-player[subtitle-background="solid"] > video::cue { background-color: #000; }
mattebox-player[subtitle-background="none"] > ${BACKDROP} { background-color: transparent; }
mattebox-player[subtitle-background="solid"] > ${BACKDROP} { background-color: #000; }`;

const MARK = 'data-mattebox-cue';

/** The browser's cue size against the video's height, per WebVTT, and its line against the size. */
const CUE_SIZE = 0.05;
const LINE_HEIGHT = 1.2;
/** What a cue box spans of the video's width by default, so wrapping is measured against it. */
const CUE_WIDTH = 0.96;
/** Pixels of air between the bar and the cue above it, before rounding up to a line. */
const AIR = 6;

/** Puts the cue rules in the document, once. */
export function cueStyle(): void {
  if (document.head.querySelector(`style[${MARK}]`) !== null) return;
  const style = document.createElement('style');
  style.setAttribute(MARK, '');
  style.textContent = CUE_RULES;
  document.head.append(style);
}

/** What a lifted cue looked like before, to put back. */
interface Placed {
  readonly line: number | 'auto';
  readonly snapToLines: boolean;
  readonly lineAlign: LineAlignSetting;
}

export interface CueLift {
  /** Whether the bar is showing, so the cues move above it or back. */
  lifted(on: boolean): void;
  dispose(): void;
}

/** What the bar covers of the picture: from its first row's top, not its gradient run-in, to its bottom. */
export type Covered = () => { readonly top: number; readonly bottom: number };

export function cueLift(video: HTMLVideoElement, host: HTMLElement, covered: Covered): CueLift {
  /** The cues moved, with what they were, so they and only they are put back. */
  const lifted = new Map<VTTCue, Placed>();
  let on = false;
  let canvas: CanvasRenderingContext2D | null | undefined;

  function showing(): TextTrack[] {
    const out: TextTrack[] = [];
    for (const track of video.textTracks) if (track.mode === 'showing') out.push(track);
    return out;
  }

  /** The browser's cue font size, in pixels, from the video's height and the host's scale. */
  function fontSize(height: number): number {
    const scale = SCALES[host.getAttribute('subtitle-size') ?? ''] ?? 1;
    return height * CUE_SIZE * scale;
  }

  /** Measures text the way the browser draws cues, to count the lines a cue wraps into. */
  function measure(): CanvasRenderingContext2D | null {
    if (canvas === undefined) canvas = document.createElement('canvas').getContext('2d');
    return canvas;
  }

  /**
   * A cue's text without its tags, for measuring: `<b>`, `<c.name>`, the
   * timestamps and their closers. Brackets are counted, so a tag inside
   * another's brackets goes with it.
   */
  function plain(text: string): string {
    let out = '';
    let depth = 0;
    for (const char of text) {
      if (char === '<') depth += 1;
      else if (char === '>') depth = Math.max(0, depth - 1);
      else if (depth === 0) out += char;
    }
    return out;
  }

  /** The lines a cue takes: its own, each wrapped at the cue box's width. */
  function lines(cue: VTTCue, font: number, width: number): number {
    const context = measure();
    let total = 0;
    for (const line of plain(cue.text).split('\n')) {
      if (context === null) {
        total += 1;
        continue;
      }
      context.font = `${font}px sans-serif`;
      total += Math.max(1, Math.ceil(context.measureText(line).width / (width * CUE_WIDTH)));
    }
    return total;
  }

  function apply(): void {
    const box = video.getBoundingClientRect();
    const height = box.height;
    const span = covered();
    const pixels = span.bottom - span.top;
    const lift = on && height > 0 && pixels > 0 && pixels < height;
    const font = fontSize(height);
    const unit = font * LINE_HEIGHT;
    // The lines the bar covers, with a little air, rounded up to whole lines.
    const base = Math.ceil((pixels + AIR) / unit);
    for (const track of showing()) {
      // Earliest first, the order the browser stacks them in, so the first
      // sits lowest and the rest climb.
      const active = [...(track.activeCues ?? [])]
        .filter((cue): cue is VTTCue => cue instanceof VTTCue)
        .sort((a, b) => a.startTime - b.startTime);
      let previous: { line: number; height: number } | null = null;
      let changed = false;
      for (const cue of active) {
        const was = lifted.get(cue);
        if (!lift) {
          if (was === undefined) continue;
          cue.line = was.line;
          cue.snapToLines = was.snapToLines;
          cue.lineAlign = was.lineAlign;
          lifted.delete(cue);
          changed = true;
          continue;
        }
        // The author's own placement is the author's.
        if (was === undefined && cue.line !== 'auto') continue;
        if (was === undefined) {
          lifted.set(cue, {
            line: cue.line,
            snapToLines: cue.snapToLines,
            lineAlign: cue.lineAlign,
          });
        }
        // A negative line count, which every browser wraps at the video's
        // width, unlike a percentage. Chromium anchors the box's top on it
        // and Gecko its bottom, so the count clears the bar and the cue
        // below under both readings, with a little air to spare in one.
        const own = lines(cue, font, box.width);
        const line: number =
          previous === null ? base + own : previous.line + Math.max(own, previous.height);
        if (cue.line !== -line || !cue.snapToLines) changed = true;
        cue.snapToLines = true;
        cue.line = -line;
        previous = { line, height: own };
      }
      // Chromium lays a changed line out again only when the track's display
      // is rebuilt, which neither time nor a seek does for a cue already
      // showing; the mode flipped off and on in one task rebuilds it with no
      // paint in between. Only on a change, so the change event this fires
      // finds nothing to do and the loop ends there.
      if (changed) {
        track.mode = 'hidden';
        track.mode = 'showing';
      }
    }
  }

  function watch(): void {
    for (const track of video.textTracks) {
      track.removeEventListener('cuechange', apply);
      track.addEventListener('cuechange', apply);
    }
    apply();
  }

  video.textTracks.addEventListener('change', watch);
  video.textTracks.addEventListener('addtrack', watch);
  watch();

  return {
    lifted(next: boolean): void {
      on = next;
      apply();
    },
    dispose(): void {
      on = false;
      apply();
      video.textTracks.removeEventListener('change', watch);
      video.textTracks.removeEventListener('addtrack', watch);
      for (const track of video.textTracks) track.removeEventListener('cuechange', apply);
    },
  };
}
