/**
 * @mattebox/player: the <mattebox-player> custom element and every control
 * that goes inside it. Importing this module registers them all; that is
 * the package's one side effect. A page that wants only some takes
 * `@mattebox/player/element` and the `@mattebox/player/elements/*` entries.
 */
import type { MatteboxPlayerElement } from './element-entry.js';
import type { MbxAudioMenu } from './entries/audio-menu.js';
import type { MbxChaptersMenu } from './entries/chapters-menu.js';
import type { MbxControlBar } from './entries/control-bar.js';
import type { MbxCurrentTime } from './entries/current-time.js';
import type { MbxDrmBadge } from './entries/drm-badge.js';
import type { MbxDuration } from './entries/duration.js';
import type { MbxErrorScreen } from './entries/error-screen.js';
import type { MbxFullscreenButton } from './entries/fullscreen-button.js';
import type { MbxLiveButton } from './entries/live-button.js';
import type { MbxMuteButton } from './entries/mute-button.js';
import type { MbxPanels } from './entries/panels.js';
import type { MbxPipButton } from './entries/pip-button.js';
import type { MbxPlayButton } from './entries/play-button.js';
import type { MbxQualityMenu } from './entries/quality-menu.js';
import type { MbxSeekBar } from './entries/seek-bar.js';
import type { MbxSkipButton } from './entries/skip-button.js';
import type { MbxSpacer } from './entries/spacer.js';
import type { MbxSpeedMenu } from './entries/speed-menu.js';
import type { MbxStartButton } from './entries/start-button.js';
import type { MbxSubtitlesMenu } from './entries/subtitles-menu.js';
import type { MbxVolume } from './entries/volume.js';
import type { MbxVolumeSlider } from './entries/volume-slider.js';

export type { MatteboxPlayerOptions } from './element-entry.js';
export { MatteboxPlayerElement } from './element-entry.js';
export { MbxAudioMenu } from './entries/audio-menu.js';
export { MbxChaptersMenu } from './entries/chapters-menu.js';
export { MbxControlBar } from './entries/control-bar.js';
export { MbxCurrentTime } from './entries/current-time.js';
export { MbxDrmBadge } from './entries/drm-badge.js';
export { MbxDuration } from './entries/duration.js';
export { MbxErrorScreen } from './entries/error-screen.js';
export { MbxFullscreenButton } from './entries/fullscreen-button.js';
export { MbxLiveButton } from './entries/live-button.js';
export { MbxMuteButton } from './entries/mute-button.js';
export { MbxPanels } from './entries/panels.js';
export { MbxPipButton } from './entries/pip-button.js';
export { MbxPlayButton } from './entries/play-button.js';
export { MbxQualityMenu } from './entries/quality-menu.js';
export { MbxSeekBar } from './entries/seek-bar.js';
export { MbxSkipButton } from './entries/skip-button.js';
export { MbxSpacer } from './entries/spacer.js';
export { MbxSpeedMenu } from './entries/speed-menu.js';
export { MbxStartButton } from './entries/start-button.js';
export { MbxSubtitlesMenu } from './entries/subtitles-menu.js';
export { MbxVolume } from './entries/volume.js';
export { MbxVolumeSlider } from './entries/volume-slider.js';
export type { PlayerHost } from './host.js';

declare global {
  interface HTMLElementTagNameMap {
    'mattebox-player': MatteboxPlayerElement;
    'mbx-control-bar': MbxControlBar;
    'mbx-spacer': MbxSpacer;
    'mbx-play-button': MbxPlayButton;
    'mbx-mute-button': MbxMuteButton;
    'mbx-volume-slider': MbxVolumeSlider;
    'mbx-volume': MbxVolume;
    'mbx-skip-button': MbxSkipButton;
    'mbx-pip-button': MbxPipButton;
    'mbx-fullscreen-button': MbxFullscreenButton;
    'mbx-start-button': MbxStartButton;
    'mbx-error-screen': MbxErrorScreen;
    'mbx-current-time': MbxCurrentTime;
    'mbx-duration': MbxDuration;
    'mbx-seek-bar': MbxSeekBar;
    'mbx-live-button': MbxLiveButton;
    'mbx-speed-menu': MbxSpeedMenu;
    'mbx-quality-menu': MbxQualityMenu;
    'mbx-audio-menu': MbxAudioMenu;
    'mbx-subtitles-menu': MbxSubtitlesMenu;
    'mbx-drm-badge': MbxDrmBadge;
    'mbx-chapters-menu': MbxChaptersMenu;
    'mbx-panels': MbxPanels;
  }
}
