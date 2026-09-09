/**
 * The volume slider over the primitive. It shows zero while muted, and
 * writing any level above zero unmutes: dragging the volume up is how a
 * viewer says they want to hear it.
 */
import type { Control } from './control.js';
import { slider } from './slider.js';

export function volumeSlider(video: HTMLVideoElement): Control {
  const bar = slider({
    name: 'volume',
    label: 'Volume',
    step: 0.05,
    page: 0.2,
    onInput(value: number): void {
      video.volume = value;
      if (value > 0) video.muted = false;
    },
  });
  bar.range(0, 1);

  function render(): void {
    const level = video.muted ? 0 : video.volume;
    bar.set(level, `${Math.round(level * 100)}%`);
  }

  video.addEventListener('volumechange', render);
  render();

  return {
    root: bar.root,
    dispose(): void {
      video.removeEventListener('volumechange', render);
      bar.dispose();
    },
  };
}
