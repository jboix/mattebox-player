/**
 * The slider primitive the seek bar and the volume share: a `div` with
 * `role="slider"`, pointer capture for the drag, and the arrow keys. It
 * owns geometry only. What the value means and what happens on change is
 * the caller's, through `onInput`.
 *
 * Not `<input type="range">`: a range input cannot carry layers such as
 * buffered ranges, its geometry is not readable for a preview anchor, and
 * it renders differently per browser. The track is exposed so a caller can
 * lay its own layers on it.
 *
 * The track and the thumb sit on a rail inset from the root's edges by half
 * a thumb, so the thumb at either end is whole and not clipped, and every
 * fraction is measured against the rail.
 */
import { el, state } from '../dom.js';

export interface SliderOptions {
  /** The part prefix: `seek`, `volume`. */
  readonly name: string;
  /** The accessible name. */
  readonly label: string;
  /** What an arrow key moves the value by. */
  readonly step: number;
  /** What Page Up and Page Down move it by. */
  readonly page: number;
  /** The value the pointer or a key asked for, clamped to the range. */
  readonly onInput: (value: number) => void;
}

export interface Slider {
  readonly root: HTMLElement;
  /** The bar the fill sits on. A caller lays extra layers on it. */
  readonly track: HTMLElement;
  /** What fractions are measured against: the track's extent, inset from the root. */
  readonly rail: HTMLElement;
  /** Whether a pointer holds the thumb. A caller keeps its own reads off the thumb meanwhile. */
  dragging(): boolean;
  /** The range the value maps onto. */
  range(min: number, max: number): void;
  /** Where the thumb sits, and what a screen reader hears. */
  set(value: number, text: string): void;
  dispose(): void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function slider(options: SliderOptions): Slider {
  const { name, onInput } = options;
  const root = el('div', `slider ${name}`);
  root.setAttribute('role', 'slider');
  root.setAttribute('aria-label', options.label);
  root.tabIndex = 0;
  const rail = el('div', `rail ${name}-rail`);
  const track = el('div', `track ${name}-track`);
  const fill = el('div', `fill ${name}-fill`);
  const thumb = el('div', `thumb ${name}-thumb`);
  track.append(fill);
  rail.append(track, thumb);
  root.append(rail);

  let min = 0;
  let max = 1;
  let value = 0;
  let held = false;

  function paint(): void {
    const fraction = max > min ? (value - min) / (max - min) : 0;
    const percent = `${fraction * 100}%`;
    fill.style.width = percent;
    thumb.style.left = percent;
  }

  /** The value under a horizontal pointer position. */
  function at(clientX: number): number {
    const rect = rail.getBoundingClientRect();
    if (rect.width === 0) return min;
    return min + clamp((clientX - rect.left) / rect.width, 0, 1) * (max - min);
  }

  function hold(on: boolean): void {
    held = on;
    state(root, `slider ${name}`, { dragging: on });
  }

  function down(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    hold(true);
    // A synthetic event carries no active pointer, and capture throws on it.
    try {
      root.setPointerCapture(event.pointerId);
    } catch {
      // Nothing to capture; the drag still follows moves over the root.
    }
    onInput(at(event.clientX));
  }

  function move(event: PointerEvent): void {
    if (held) onInput(at(event.clientX));
  }

  function up(event: PointerEvent): void {
    if (!held) return;
    hold(false);
    onInput(at(event.clientX));
  }

  function cancel(): void {
    if (held) hold(false);
  }

  function key(event: KeyboardEvent): void {
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = value + options.step;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = value - options.step;
        break;
      case 'PageUp':
        next = value + options.page;
        break;
      case 'PageDown':
        next = value - options.page;
        break;
      case 'Home':
        next = min;
        break;
      case 'End':
        next = max;
        break;
      default:
        return;
    }
    event.preventDefault();
    onInput(clamp(next, min, max));
  }

  root.addEventListener('pointerdown', down);
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', cancel);
  root.addEventListener('keydown', key);

  return {
    root,
    track,
    rail,
    dragging(): boolean {
      return held;
    },
    range(low: number, high: number): void {
      min = low;
      max = high;
      root.setAttribute('aria-valuemin', String(low));
      root.setAttribute('aria-valuemax', String(high));
      paint();
    },
    set(next: number, text: string): void {
      value = clamp(next, min, max);
      root.setAttribute('aria-valuenow', String(value));
      root.setAttribute('aria-valuetext', text);
      paint();
    },
    dispose(): void {
      root.removeEventListener('pointerdown', down);
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerup', up);
      root.removeEventListener('pointercancel', cancel);
      root.removeEventListener('keydown', key);
    },
  };
}
