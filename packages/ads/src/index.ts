/**
 * @mattebox/player-ads: ads in <mattebox-player>. `ads()` is an add-on for
 * `MatteboxPlayerElement.define({ addons: [ads()] })`: it adds the engine's
 * interstitials stage to every player, follows each player's breaks, reads
 * VAST and VMAP, sends the beacons, and hides the programme's own controls
 * while an ad plays. <mbx-ad-info>, <mbx-ad-skip-button> and <mbx-ad-link>
 * draw the ad. Importing this module registers the three elements; that is
 * the package's one side effect.
 */
import type { PlayerAddon, PlayerHost } from '@mattebox/player';
import interstitials from 'mattebox/stages/interstitials';
import { MbxAdInfo } from './ad-info.js';
import { MbxAdLink } from './ad-link.js';
import { MbxAdProgress } from './ad-progress.js';
import { MbxAdSkipButton } from './ad-skip-button.js';
import { type AdsApi, type AdsOptions, controllerFor } from './controller.js';

export { MbxAdInfo } from './ad-info.js';
export { MbxAdLink } from './ad-link.js';
export { MbxAdProgress } from './ad-progress.js';
export { MbxAdSkipButton } from './ad-skip-button.js';
export type {
  AdBreakInput,
  AdOpportunity,
  AdState,
  AdsApi,
  AdsOptions,
} from './controller.js';
export type { AdsMessages } from './messages.js';
export type {
  VastAd,
  VastCompanion,
  VastMediaFile,
  VastResult,
  VastTracking,
  VastVerification,
} from './vast.js';
export { resolveVast } from './vast.js';

export const AD_INFO = 'mbx-ad-info';
export const AD_SKIP_BUTTON = 'mbx-ad-skip-button';
export const AD_LINK = 'mbx-ad-link';
export const AD_PROGRESS = 'mbx-ad-progress';

/**
 * While an ad plays the player carries `ad`: the seek bar, the times, the
 * menus and the programme's title would describe what does not play. Play,
 * pause, volume and fullscreen stay, and drive the ad. Plain selectors, not
 * `:is()`, which a 2021 TV lacks.
 */
const DURING_AD = [
  'mbx-seek-bar',
  'mbx-current-time',
  'mbx-duration',
  'mbx-remaining-time',
  'mbx-chapters-menu',
  'mbx-marker-button',
  'mbx-quality-menu',
  'mbx-audio-menu',
  'mbx-subtitles-menu',
  'mbx-video-menu',
  'mbx-speed-menu',
  'mbx-live-button',
  'mbx-scan-button',
  'mbx-skip-button',
  'mbx-title',
  'mbx-up-next',
];
const AD_ELEMENTS = ['mbx-ad-info', 'mbx-ad-skip-button', 'mbx-ad-link', 'mbx-ad-progress'];
const HIDDEN = `${[
  // Not during a drag: the seek bar that drags must stay under the pointer.
  // Not for a break the stream plays with the controls kept, `ad="stitched"`.
  ...DURING_AD.map((name) => `mattebox-player[ad]:not([ad="stitched"]):not([scrubbing]) ${name}`),
  ...AD_ELEMENTS.map((name) => `mattebox-player:not([ad]) ${name}`),
].join(',')}{display:none}`;

function addStyle(): void {
  if (document.getElementById('mbx-ads-style') !== null) return;
  const node = document.createElement('style');
  node.id = 'mbx-ads-style';
  node.textContent = HIDDEN;
  document.head.append(node);
}

/** The add-on: pass it in `addons`. */
export function ads(options: AdsOptions = {}): PlayerAddon {
  return {
    name: 'ads',
    stages: () => [interstitials()],
    // Safari's own HLS plays interstitials itself and reports nothing.
    engine: true,
    attach(player) {
      addStyle();
      return controllerFor(player, options).attach();
    },
  };
}

/** The ads of `player`: its schedule, the ad that plays, skip and click. */
export function adsOf(player: PlayerHost): AdsApi {
  return controllerFor(player);
}

if (customElements.get(AD_INFO) === undefined) customElements.define(AD_INFO, MbxAdInfo);
if (customElements.get(AD_SKIP_BUTTON) === undefined)
  customElements.define(AD_SKIP_BUTTON, MbxAdSkipButton);
if (customElements.get(AD_LINK) === undefined) customElements.define(AD_LINK, MbxAdLink);
if (customElements.get(AD_PROGRESS) === undefined)
  customElements.define(AD_PROGRESS, MbxAdProgress);

declare global {
  interface HTMLElementTagNameMap {
    'mbx-ad-info': MbxAdInfo;
    'mbx-ad-skip-button': MbxAdSkipButton;
    'mbx-ad-link': MbxAdLink;
    'mbx-ad-progress': MbxAdProgress;
  }
}
