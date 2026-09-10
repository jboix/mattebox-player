/**
 * <mbx-chapters-menu>: the chapters of the video as a list, each with its
 * start time, the one the playhead is in checked; choosing one seeks to its
 * start. The chapters are the video's own chapters text track, from the
 * player's `chapters` attribute or a `<track>` the page put there, so the
 * menu works for every session, native included, and hides while the
 * video has none. The name comes from `label`.
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
    this.keep(followChapters(player.video, tick));
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
    const list = chapters(video);
    this.hidden = list.length === 0;
    const current = String(chapterAt(list, video.currentTime));
    const items = list.map((chapter, i): readonly [string, string, string] => [
      String(i),
      chapter.title,
      format(chapter.start),
    ]);
    const key = `${current}|${items.map(([, title, start]) => `${start} ${title}`).join('\n')}`;
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
