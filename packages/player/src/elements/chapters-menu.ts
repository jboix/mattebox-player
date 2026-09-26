/**
 * <mbx-chapters-menu>: the chapters of the video as a list, each with its
 * start time, the one the playhead is in checked; choosing one seeks to its
 * start. The chapters are the engine's when the session holds some, and
 * the video's own chapters text track otherwise, see `controls/chapters.ts`,
 * so the menu works for every session, native included, and hides while
 * there are none. Each item shows the chapter's picture when every chapter
 * has one: a list where some rows have a picture and some do not reads as
 * broken. The name comes from `label`.
 */
import { chapterAt, chapters, followChapters } from '../controls/chapters.js';
import { format } from '../controls/time.js';
import type { PlayerHost } from '../host.js';
import { MenuElement, single } from './menu-element.js';
import { show } from './shared.js';

export class MbxChaptersMenu extends MenuElement {
  static get observedAttributes(): readonly string[] {
    return ['label', 'label-back'];
  }

  /** What the last fill drew, so a cue change inside the same chapter leaves the popup alone. */
  declare private drawn: string;

  constructor() {
    super(...single('chapters'));
    this.drawn = '';
    show(this.slots, 'default');
  }

  protected override name(): string {
    return 'Chapters';
  }

  protected override attach(player: PlayerHost): void {
    const tick = (): void => {
      this.render();
    };
    this.keep(followChapters(player, tick));
    // The clock too: WebKit fires no `cuechange` for a hidden track, and the
    // render is a no-op while the chapter is the same.
    this.listen(player.video, ['timeupdate', 'seeked', 'emptied', 'loadedmetadata'], tick);
    this.listen(player, ['sourcechange'], tick);
    this.render();
  }

  protected override render(): void {
    super.render();
    const video = this.player?.video;
    if (video === undefined) return;
    const list = chapters(video, this.player?.engine ?? null);
    this.hidden = list.length === 0;
    const current = String(chapterAt(list, video.currentTime));
    const pictured = list.every((chapter) => chapter.image !== undefined);
    const items = list.map((chapter, i): readonly [string, string, string, string?] =>
      pictured && chapter.image !== undefined
        ? [String(i), chapter.title, format(chapter.start), chapter.image]
        : [String(i), chapter.title, format(chapter.start)],
    );
    const key = `${current}|${items.map((item) => item.slice(1).join(' ')).join('\n')}`;
    if (key === this.drawn) return;
    this.drawn = key;
    this.menu.fill([
      {
        name: 'chapter',
        items,
        value: current,
        onSelect: (value) => {
          const chapter = list[Number(value)];
          if (chapter !== undefined) video.currentTime = chapter.start;
        },
      },
    ]);
  }
}
