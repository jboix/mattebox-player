/**
 * The controls over the browser's own media pipeline: a real WAV in a real
 * video, played, seeked and ended by the browser. The controls suite drives
 * a deterministic video instead, see `fakeMedia` in helpers.ts; these few
 * keep its account of a video honest. Every wait is a poll with room to
 * spare, because a browser under a full run takes its own time, and no
 * test writes `muted` twice: WebKit's platform player reports a write back
 * on its own thread, and a second write before that report lands is undone.
 */
import { MatteboxPlayerElement } from '@mattebox/player';
import { nativeHandler } from '@mattebox/player-core';
import { afterEach, describe, expect, it } from 'vitest';
import { cueLift } from '../../src/controls/cues.js';
import { silence } from './helpers.js';

/** Room for the browser under a full run. */
const ROOM = { timeout: 5000 };

/** The element under custom controls over a WAV `seconds` long, muted so the autoplay policy allows it, with the metadata in. */
async function ready(seconds: number): Promise<MatteboxPlayerElement> {
  const player = new MatteboxPlayerElement({ handlers: [nativeHandler()] });
  player.setAttribute('controls', 'custom');
  player.setAttribute('muted', '');
  player.setAttribute('src', silence(seconds));
  document.body.append(player);
  await expect.poll(() => player.querySelector('mbx-control-bar')).not.toBeNull();
  await expect.poll(() => player.video.readyState, ROOM).toBeGreaterThan(0);
  return player;
}

/** The first control of a tag inside the player. */
function control<K extends keyof HTMLElementTagNameMap>(
  player: MatteboxPlayerElement,
  tag: K,
): HTMLElementTagNameMap[K] {
  const node = player.querySelector(tag);
  if (node === null) throw new Error(`no ${tag}`);
  return node;
}

/** The real button inside a control's shadow root. */
function inner(node: HTMLElement): HTMLButtonElement {
  const button = node.shadowRoot?.querySelector('button');
  if (button === null || button === undefined) throw new Error('no button inside');
  return button;
}

function inside(node: HTMLElement, part: string): HTMLElement | null {
  return node.shadowRoot?.querySelector(`[part~="${part}"]`) ?? null;
}

/** A key as the browser sends it: cancelable, so a control's preventDefault reaches the host's listener. */
function press(target: EventTarget, key: string): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }),
  );
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('the controls over a real video', () => {
  it('play and pause it from the play button', async () => {
    const player = await ready(10);
    const play = inner(control(player, 'mbx-play-button'));
    play.click();
    await expect.poll(() => player.hasAttribute('playing'), ROOM).toBe(true);
    expect(play.getAttribute('aria-label')).toBe('Pause');
    expect(control(player, 'mbx-start-button').hidden).toBe(true);
    play.click();
    await expect.poll(() => player.hasAttribute('paused'), ROOM).toBe(true);
    expect(play.getAttribute('aria-label')).toBe('Play');
    expect(control(player, 'mbx-start-button').hidden).toBe(false);
  });

  it('offer a replay once it has ended, in the order the browser reports the end', async () => {
    const player = await ready(1);
    const seen: string[] = [];
    for (const name of ['play', 'pause', 'ended']) {
      player.video.addEventListener(name, () => seen.push(name));
    }
    inner(control(player, 'mbx-play-button')).click();
    // WebKit reports `ended` a moment before it fires the events for it.
    await expect.poll(() => seen, ROOM).toEqual(['play', 'pause', 'ended']);
    expect(player.video.ended).toBe(true);
    expect(player.hasAttribute('ended')).toBe(true);
    expect(player.hasAttribute('playing')).toBe(false);
    expect(inner(control(player, 'mbx-play-button')).getAttribute('aria-label')).toBe('Replay');
    const start = control(player, 'mbx-start-button');
    expect(start.hidden).toBe(false);
    expect(inner(start).getAttribute('aria-label')).toBe('Replay');
  });

  it('seek it from the seek bar, and draw what the browser has buffered', async () => {
    const player = await ready(10);
    const bar = control(player, 'mbx-seek-bar');
    // The whole clip buffered, which the browser reaches in its own time,
    // and a small file can finish between two of the bar's reads: the poll
    // ticks the clock the way playback would, and the bar reads again.
    const buffered = (): string => {
      player.video.dispatchEvent(new Event('timeupdate'));
      return inside(bar, 'buffered-range')?.style.width ?? '';
    };
    await expect.poll(buffered, ROOM).toMatch(/^(100|9\d(\.\d+)?)%$/);
    const knob = inside(bar, 'slider') as HTMLElement;
    press(knob, 'ArrowRight');
    await expect.poll(() => player.video.currentTime, ROOM).toBeCloseTo(5, 1);
    press(knob, 'Home');
    await expect.poll(() => player.video.currentTime, ROOM).toBeCloseTo(0, 1);
  });

  it('lift an unpositioned active cue above the bar while it shows, and put it back', async () => {
    // A bare video and a stand-in bar, so no other lift holds the cues.
    const video = document.createElement('video');
    video.muted = true;
    video.src = silence(10);
    document.body.append(video);
    await expect.poll(() => video.readyState, ROOM).toBeGreaterThan(0);
    const track = video.addTextTrack('subtitles', 'Test', 'en');
    track.mode = 'showing';
    const cue = new VTTCue(0, 10, 'Hello');
    const second = new VTTCue(0, 10, 'Second, two\nlines');
    const placed = new VTTCue(0, 10, 'Author placed');
    placed.line = 10;
    track.addCue(cue);
    track.addCue(second);
    track.addCue(placed);
    // Cues become active when time marches, which a seek makes it do.
    video.currentTime = 1;
    const active = (): number => (video.seeking ? 0 : (track.activeCues?.length ?? 0));
    await expect.poll(active, ROOM).toBe(3);

    const host = document.createElement('div');
    const box = video.getBoundingClientRect();
    // Eighty pixels of bar over the bottom of the picture.
    const lift = cueLift(video, host, () => ({ top: box.bottom - 80, bottom: box.bottom }));
    lift.lifted(true);
    // A negative line count, which wraps everywhere; the earliest sits
    // lowest and the next climbs past it, whichever end a browser anchors.
    expect(cue.snapToLines).toBe(true);
    expect(typeof cue.line).toBe('number');
    const first = cue.line as number;
    expect(first).toBeLessThan(-1);
    // The second is two lines tall: it climbs by at least that.
    expect(second.line as number).toBeLessThanOrEqual(first - 2);
    // The author's placement is the author's.
    expect(placed.line).toBe(10);

    // The lift rebuilds the track's display, and WebKit empties the active
    // cues for a moment while it does; the restore reads them again.
    await expect.poll(active, ROOM).toBe(3);
    lift.lifted(false);
    expect(cue.line).toBe('auto');
    expect(second.line).toBe('auto');
    expect(placed.line).toBe(10);
    lift.dispose();
  });
});
