/**
 * <mbx-speed-menu>: the rate over `video.playbackRate`. Video-only, so it
 * works for every session, native included. The rates come from `rates`,
 * space-separated, and the video's own value is the truth, read on
 * `ratechange` and listed even when it is not one of them. The name comes
 * from `label`, the word for one from `label-normal`.
 */
import type { PlayerHost } from '../host.js';
import { MenuElement, single } from './menu-element.js';
import { show } from './shared.js';

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export class MbxSpeedMenu extends MenuElement {
  static get observedAttributes(): readonly string[] {
    return ['rates', 'label', 'label-normal', 'label-back'];
  }

  constructor() {
    super(...single('playback-speed'));
    show(this.slots, 'default');
  }

  protected override name(): string {
    return 'Playback speed';
  }

  private rates(): number[] {
    const raw = this.getAttribute('rates');
    if (raw === null) return RATES;
    const out = raw
      .split(/\s+/)
      .map(Number)
      .filter((rate) => Number.isFinite(rate) && rate > 0);
    return out.length === 0 ? RATES : out;
  }

  protected override attach(player: PlayerHost): void {
    this.listen(player.video, ['ratechange'], () => {
      this.render();
    });
    this.render();
  }

  protected override render(): void {
    super.render();
    const video = this.player?.video;
    if (video === undefined) return;
    const normal = this.getAttribute('label-normal') ?? 'Normal';
    const items: Array<readonly [string, string]> = this.rates().map((rate) => [
      String(rate),
      rate === 1 ? normal : `${rate}×`,
    ]);
    const current = String(video.playbackRate);
    if (!items.some(([id]) => id === current)) items.push([current, `${current}×`]);
    this.menu.fill([
      {
        name: 'rate',
        items,
        value: current,
        onSelect: (value) => {
          video.playbackRate = Number(value);
        },
      },
    ]);
  }
}
