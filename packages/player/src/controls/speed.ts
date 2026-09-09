/**
 * The speed menu over `video.playbackRate`. Video-only, so it sits in the
 * bar for every session, native included. The rates are the ones every
 * player offers; the video's own value is the truth, read on `ratechange`.
 */
import type { Control } from './control.js';
import { menu } from './menu.js';

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function speedMenu(video: HTMLVideoElement): Control {
  const control = menu({ name: 'speed', label: 'Playback speed', icon: 'playback-speed' });

  function render(): void {
    const items: Array<readonly [string, string]> = RATES.map((rate) => [
      String(rate),
      rate === 1 ? 'Normal' : `${rate}×`,
    ]);
    const current = String(video.playbackRate);
    if (!RATES.some((rate) => String(rate) === current)) items.push([current, `${current}×`]);
    control.fill([
      {
        name: 'rate',
        items,
        value: current,
        onSelect(value: string): void {
          video.playbackRate = Number(value);
        },
      },
    ]);
  }

  video.addEventListener('ratechange', render);
  render();

  return {
    root: control.root,
    dispose(): void {
      video.removeEventListener('ratechange', render);
      control.dispose();
    },
  };
}
