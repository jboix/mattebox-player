/**
 * The default compositions: what a player gets when the page wrote none of
 * its own. Under `controls="custom"` the screens and the bar, appended
 * when there is no `<mbx-control-bar>` child; under `native` and `none`
 * the panels row under the video, appended when there is no
 * `<mbx-panels>` child. Built by tag, so this module needs no element
 * class, and appended to the player's light DOM, where the page can see
 * it and style it the way it would its own.
 */
import {
  AUDIO_MENU,
  CHAPTERS_MENU,
  CONTROL_BAR,
  CURRENT_TIME,
  DRM_BADGE,
  DURATION,
  ERROR_SCREEN,
  FULLSCREEN_BUTTON,
  LIVE_BUTTON,
  PANELS,
  PIP_BUTTON,
  PLAY_BUTTON,
  QUALITY_MENU,
  SEEK_BAR,
  SKIP_BUTTON,
  SPACER,
  SPEED_MENU,
  START_BUTTON,
  SUBTITLES_MENU,
  VOLUME,
} from './tags.js';

function skip(seconds: number): HTMLElement {
  const node = document.createElement(SKIP_BUTTON);
  node.setAttribute('seconds', String(seconds));
  return node;
}

function each(...tags: string[]): HTMLElement[] {
  return tags.map((tag) => document.createElement(tag));
}

/** The screens and the bar. */
export function composeBar(): HTMLElement[] {
  const bar = document.createElement(CONTROL_BAR);
  bar.append(
    ...each(CURRENT_TIME, SEEK_BAR, DURATION, LIVE_BUTTON),
    skip(-10),
    document.createElement(PLAY_BUTTON),
    skip(10),
    ...each(VOLUME, SPACER, SPEED_MENU, CHAPTERS_MENU, SUBTITLES_MENU, AUDIO_MENU),
    ...each(QUALITY_MENU, PIP_BUTTON, FULLSCREEN_BUTTON),
  );
  return [...each(START_BUTTON, ERROR_SCREEN), bar];
}

/** The row under the video. */
export function composePanels(): HTMLElement[] {
  const row = document.createElement(PANELS);
  row.append(
    ...each(QUALITY_MENU, AUDIO_MENU, SUBTITLES_MENU, CHAPTERS_MENU, LIVE_BUTTON, DRM_BADGE),
  );
  return [row];
}
