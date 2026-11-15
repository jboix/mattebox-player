/**
 * <mbx-live-captions>: what is said, written word by word over the video.
 * It sits inside the player, like the ad elements. Where the browser can
 * recognize speech from the video's sound, it sets `live-captions="off"` on
 * the player, so the subtitles menu offers live captions.
 * `live-captions="on"` starts them, and `off` stops them.
 *
 * The words roll up in lines of five words: the newest at the bottom, at
 * most two lines, older ones leaving at the top. In-progress words change until the recognizer
 * settles them. They follow the subtitle size and background the subtitles
 * menu sets on the player.
 *
 * It is not a text track: a cue has a start and an end, and these words
 * arrive after they are said and keep changing. Each settled phrase is a
 * `transcript` event on this element, for a page that keeps a transcript.
 *
 * Attributes: `language` names the spoken language, else the playing audio
 * track's, else the document's. `cloud` lets the browser send the sound to
 * a server where the device cannot recognize the language. Without it, no
 * sound leaves the device. `hide` takes the offer back in the states it
 * names: `unavailable`, `covered`, or both.
 *
 * Why they should not run is the element's own `unavailable` attribute, and
 * an `unavailable` event: `browser`, `language` or `source` when they
 * cannot, `covered` when the source has subtitles in the spoken language.
 *
 * Live captions are a subtitle choice in a language. While they run, the
 * player carries `live-captions-language`, the language the viewer turned
 * them on in. It stays through new sources: one in that language turns them
 * back on, or plays its subtitles in that language instead, and one in
 * another language turns them off. The viewer's own off removes it. A page,
 * or `mbx-preferences`, may set it to turn them on at the next source.
 */
import { audioOf, capture } from './audio.js';
import { Component } from './component.js';
import type { PlayerHost } from './host.js';
import { normalize } from './languages.js';
import STYLE from './live-captions.css?inline';
import type { Failure, Recognizer } from './recognizer.js';
import { availability, prepare, recognize, supported } from './recognizer.js';
import { LIVE_CAPTIONS, style } from './shared.js';
import type { Transcript } from './transcript.js';
import { transcript } from './transcript.js';

/** The browser's cue size against the video's height, per WebVTT, which the player's subtitles use too. */
const CUE_SIZE = 0.05;
/** The player's subtitle sizes, as scales of the cue size. */
const SCALES: Readonly<Record<string, number>> = {
  small: 0.75,
  medium: 1,
  large: 1.5,
  xlarge: 2,
};
/** Pixels between the bar and the words above it. */
const AIR = 6;
/** The words go after this long without a new result, so a silence does not keep old words up. */
const QUIET_MS = 6000;
/** How long a notice, such as a failed download, stays. */
const NOTICE_MS = 5000;
/** The player's attribute that names the language the viewer wants live captions in. */
const WANTED = 'live-captions-language';

/** The primary language subtag, so `de-CH` and `de` are the same language (RFC 5646 §2.2.1). */
function primary(tag: string): string {
  return tag.toLowerCase().split('-')[0] ?? '';
}

/**
 * The source's subtitle track in the language of `tag`, as a way to show
 * it: the engine's, else the browser's own. Null when there is none.
 */
function subtitlesIn(player: PlayerHost, tag: string): (() => void) | null {
  const engine = player.engine;
  if (engine !== null) {
    const tracks = engine.tracks;
    const track = tracks.available.find(
      (candidate) =>
        candidate.contentType === 'text' &&
        candidate.forced !== true &&
        tracks.selectable(candidate.id) &&
        primary(normalize(candidate.lang)) === primary(tag),
    );
    return track === undefined ? null : () => tracks.select(track.id);
  }
  const list = (player.media as { textTracks?: ArrayLike<TextTrack> }).textTracks;
  const native = list === undefined ? [] : Array.from(list);
  const found = native.find(
    (track) =>
      (track.kind === 'subtitles' || track.kind === 'captions') &&
      primary(normalize(track.language)) === primary(tag),
  );
  if (found === undefined) return null;
  return () => {
    for (const track of native)
      if (track !== found && track.mode === 'showing') track.mode = 'disabled';
    found.mode = 'showing';
  };
}

/** Turns off the subtitle track that shows, unless the source forced it, so live captions show alone. */
function subtitlesOff(player: PlayerHost): void {
  const tracks = player.engine?.tracks;
  if (tracks !== undefined && tracks.active('text')?.forced !== true) tracks.deselect('text');
}

/**
 * The player's media node, which `captureStream()` takes. `player.media` is
 * what plays, not a node. The node is the player's child in light DOM
 * (player guide, chapter 03); the player's own helper for it is not public.
 */
function nodeOf(player: PlayerHost): HTMLMediaElement | null {
  return player.querySelector<HTMLMediaElement>(':scope > video, :scope > audio');
}

/** The language of the playing audio, from the engine or from Safari's own tracks. */
function audioLanguage(player: PlayerHost): string {
  const engine = player.engine;
  if (engine !== null) return engine.tracks.active('audio')?.lang ?? '';
  const tracks = (
    player.media as { audioTracks?: ArrayLike<{ enabled: boolean; language: string }> }
  ).audioTracks;
  if (tracks === undefined) return '';
  for (let i = 0; i < tracks.length; i += 1) {
    const track = tracks[i];
    if (track?.enabled === true) return track.language;
  }
  return '';
}

/**
 * Why live captions should not run here: the browser cannot recognize
 * speech from a video, cannot recognize this language, or may not capture
 * this source. Or `covered`: they could, but the source has subtitles in
 * the spoken language.
 */
export type Unavailable = 'browser' | 'language' | 'source' | 'covered';

export interface UnavailableDetail {
  readonly reason: Unavailable;
}

export interface TranscriptDetail {
  /** A phrase the recognizer settled. */
  readonly text: string;
  /** The media time when it settled, which is a moment after it was said. */
  readonly time: number;
}

export class MbxLiveCaptions extends Component {
  static get observedAttributes(): readonly string[] {
    return ['language', 'cloud', 'hide'];
  }

  /** The box the lines go in. */
  declare private readonly box: HTMLDivElement;
  declare private readonly words: Transcript;
  declare private recognizer: Recognizer | null;
  /** The capture of the media's sound while recognition runs. */
  declare private stream: MediaStream | null;
  /** Stops listening for the capture's new audio tracks. */
  declare private untrack: (() => void) | null;
  /** Whether recognition is on, or preparing to be. */
  declare private running: boolean;
  /** Bumped on every start and stop, so a late `prepare` does not start a stopped run. */
  declare private run: number;
  /** The language the current run recognizes, to restart when the audio changes language. */
  declare private language: string;
  /** What the element says instead of speech: preparing, or why it stopped. */
  declare private notice: string | null;
  declare private quiet: ReturnType<typeof setTimeout> | undefined;
  declare private noticeTimer: ReturnType<typeof setTimeout> | undefined;
  /** Whether this element set the player's attribute, and so removes it on detach. */
  declare private offered: boolean;
  /** Bumped on every probe, so a late answer about an old source or language is dropped. */
  declare private probes: number;
  /** The value this element last wrote to the player's `live-captions`, to tell its own changes from the viewer's. */
  declare private own: string | null;
  /** The viewer turned live captions on, and the language they run in is not known yet. */
  declare private claim: boolean;
  /** This source already got what the viewer's language asks for: live captions, or its subtitles. */
  declare private acted: boolean;

  constructor() {
    super();
    this.recognizer = null;
    this.stream = null;
    this.untrack = null;
    this.running = false;
    this.run = 0;
    this.language = '';
    this.notice = null;
    this.quiet = undefined;
    this.noticeTimer = undefined;
    this.offered = false;
    this.probes = 0;
    this.own = null;
    this.claim = false;
    this.acted = false;
    this.words = transcript();
    const root = this.attachShadow({ mode: 'open' });
    this.box = document.createElement('div');
    this.box.setAttribute('part', 'box');
    root.append(style(STYLE), this.box);
  }

  override connectedCallback(): void {
    // Not in the constructor: an element made by createElement may not add attributes there.
    // A screen reader user hears the speech itself; reading each word as it changes would only repeat it.
    this.setAttribute('aria-hidden', 'true');
    this.hidden = true;
    super.connectedCallback();
  }

  override attributeChangedCallback(): void {
    super.attributeChangedCallback();
    this.probe();
  }

  private get cloud(): boolean {
    return this.hasAttribute('cloud');
  }

  protected override attach(player: PlayerHost): void {
    if (!supported(this.cloud)) {
      this.mark('browser');
      return;
    }
    this.mark(null);
    this.observe(player, [LIVE_CAPTIONS, 'subtitle-size', 'subtitle-background', 'idle'], () => {
      this.sync();
    });
    // A language the page or the preferences ask for applies to the source that plays.
    this.observe(player, [WANTED], () => {
      if (normalize(player.getAttribute(WANTED)) !== this.language) this.acted = false;
      this.probe();
    });
    const media = player.media;
    // A seek or a new source makes the words on screen wrong.
    this.listen(media, ['seeking', 'emptied'], () => {
      this.words.clear();
      this.render();
    });
    // A new source is a new capture: another site's media may refuse it.
    this.listen(media, ['loadedmetadata'], () => {
      this.acted = false;
      if (this.running) {
        this.stop();
        this.start(player);
      }
      this.probe();
    });
    this.follow(player, (engine) => {
      this.acted = false;
      this.probe();
      this.restart();
      if (engine === null) return undefined;
      const offSelected = engine.on('tracks:selected', () => {
        this.probe();
        this.restart();
      });
      // Subtitle tracks may arrive after the audio: whether the source covers the language changes.
      const offChanged = engine.on('tracks:changed', () => {
        this.probe();
      });
      return () => {
        offSelected();
        offChanged();
      };
    });
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        this.render();
      });
      observer.observe(player);
      this.keep(() => {
        observer.disconnect();
      });
    }
    this.sync();
  }

  protected override detach(player: PlayerHost): void {
    this.stop();
    clearTimeout(this.noticeTimer);
    this.notice = null;
    if (this.offered) player.removeAttribute(LIVE_CAPTIONS);
    this.offered = false;
    this.probes += 1;
    this.hidden = true;
  }

  /**
   * Finds whether live captions can work for the current source and
   * language, once the media says which audio plays, and marks why not.
   * Then gives the source what the viewer's language asks for.
   */
  private probe(): void {
    const player = this.player;
    if (player === null || this.getAttribute('unavailable') === 'browser') return;
    this.probes += 1;
    const probe = this.probes;
    const tag = this.spoken(player);
    if (tag === null) return;
    // A new capture takes the sound from the one before, stopped or not, so
    // the probe captures only while none runs: a running one is the test.
    const node = this.stream === null ? nodeOf(player) : null;
    const test = node === null ? null : capture(node);
    for (const track of test?.getTracks() ?? []) track.stop();
    if (node !== null && test === null) {
      this.mark('source');
      return;
    }
    void availability(tag, this.cloud).then((status) => {
      if (probe !== this.probes || this.player !== player) return;
      const covered = subtitlesIn(player, tag);
      this.mark(status === 'unavailable' ? 'language' : covered !== null ? 'covered' : null);
      this.answer(player, tag, status === 'available', covered);
    });
  }

  /**
   * Once per source in the viewer's language: its subtitles when it has
   * some, which a person wrote, else live captions. Only a language the
   * device has starts by itself, since a download needs the viewer's click.
   */
  private answer(
    player: PlayerHost,
    tag: string,
    ready: boolean,
    covered: (() => void) | null,
  ): void {
    const wanted = normalize(player.getAttribute(WANTED));
    if (this.acted || wanted === '' || primary(wanted) !== primary(tag)) return;
    this.acted = true;
    if (covered !== null) {
      if (this.running) this.turn('off');
      if (player.engine?.tracks.active('text') == null) covered();
    } else if (ready && !this.running) {
      subtitlesOff(player);
      this.turn('on');
    }
  }

  /** Sets the player's `live-captions` as this element's own change, where the player offers them. */
  private turn(value: 'on' | 'off'): void {
    const player = this.player;
    if (player === null || !player.hasAttribute(LIVE_CAPTIONS)) return;
    if (player.getAttribute(LIVE_CAPTIONS) === value) return;
    this.own = value;
    player.setAttribute(LIVE_CAPTIONS, value);
  }

  /** Sets why live captions cannot work, or clears it, and offers them or takes them back to match. */
  private mark(reason: Unavailable | null): void {
    const before = this.getAttribute('unavailable');
    if (reason === null) this.removeAttribute('unavailable');
    else this.setAttribute('unavailable', reason);
    if (reason !== null && reason !== before) {
      this.dispatchEvent(
        new CustomEvent<UnavailableDetail>('unavailable', {
          detail: { reason },
          bubbles: true,
          composed: true,
        }),
      );
    }
    const player = this.player;
    if (player === null) return;
    // The browser's own lack is never offered; the rest is offered, and explained on a click, unless the page hides it.
    const hide = (this.getAttribute('hide') ?? '').split(/\s+/);
    const offer =
      reason !== 'browser' &&
      !(reason === 'covered'
        ? hide.includes('covered')
        : reason !== null && hide.includes('unavailable'));
    if (offer && !player.hasAttribute(LIVE_CAPTIONS)) {
      player.setAttribute(LIVE_CAPTIONS, 'off');
      this.offered = true;
    } else if (!offer && this.offered) {
      player.removeAttribute(LIVE_CAPTIONS);
      this.offered = false;
    }
  }

  /** Starts or stops to match the player's attribute, then draws. */
  private sync(): void {
    const player = this.player;
    if (player === null) return;
    const value = player.getAttribute(LIVE_CAPTIONS);
    // A change this element did not make is the viewer's, through the menu, or the page's.
    const viewer = this.own !== value;
    if (!viewer) this.own = null;
    const on = value === 'on';
    if (on && !this.running) {
      this.claim = viewer;
      this.start(player);
    } else if (!on && this.running) {
      this.stop();
      // The viewer's off: no language wants live captions any more.
      if (viewer) {
        this.claim = false;
        player.removeAttribute(WANTED);
      }
    }
    this.render();
  }

  /**
   * The spoken language: the page's `language`, else the audio track's,
   * else the document's, else the viewer's. Null until the media knows its
   * tracks, so a stream's own language is not missed for the page's.
   */
  private spoken(player: PlayerHost): string | null {
    const own = normalize(this.getAttribute('language'));
    if (own !== '') return own;
    if (player.media.readyState < 1) return null;
    const candidates = [audioLanguage(player), document.documentElement.lang, navigator.language];
    return candidates.map(normalize).find((tag) => tag !== '') ?? 'en';
  }

  /** Starts over when the spoken language changed under a running recognizer. */
  private restart(): void {
    const player = this.player;
    this.words.clear();
    if (player === null || !this.running || (this.spoken(player) ?? '') === this.language) {
      this.render();
      return;
    }
    this.stop();
    this.start(player);
    this.render();
  }

  private start(player: PlayerHost): void {
    this.running = true;
    this.run += 1;
    const run = this.run;
    const node = nodeOf(player);
    if (node === null) {
      this.fail('error');
      return;
    }
    const language = this.spoken(player);
    this.language = language ?? '';
    // In the click that turned live captions on: a download of the language needs a gesture.
    this.say(this.word('label-preparing', 'liveCaptionsPreparing', 'Preparing live captions'), 0);
    // The media does not know its tracks yet: loadedmetadata starts again.
    if (language === null) return;
    // Started by the viewer: this language is theirs. Else live captions run only in the viewer's language.
    const wanted = normalize(player.getAttribute(WANTED));
    if (this.claim) {
      this.claim = false;
      if (wanted !== language) player.setAttribute(WANTED, language);
    } else if (wanted !== '' && primary(wanted) !== primary(language)) {
      this.stop();
      this.say(null, 0);
      this.turn('off');
      return;
    }
    const stream = capture(node);
    if (stream === null) {
      this.fail('source');
      return;
    }
    this.stream = stream;
    const cloud = this.cloud;
    void prepare(language, cloud).then((failure) => {
      if (run !== this.run) return;
      if (failure !== null) {
        this.fail(failure);
        return;
      }
      this.say(null, 0);
      // The capture has no audio track before the media has sound, and a new one per audio change.
      let heard: MediaStreamTrack | undefined;
      const listen = (): void => {
        const track = audioOf(stream);
        // A video track also fires addtrack: the recognizer moves on a new audio track alone.
        if (track === undefined || track === heard) return;
        heard = track;
        this.recognizer?.stop();
        this.recognizer = this.recognizeTrack(player, track, language, cloud);
      };
      stream.addEventListener('addtrack', listen);
      this.untrack = () => {
        stream.removeEventListener('addtrack', listen);
      };
      listen();
    });
  }

  private recognizeTrack(
    player: PlayerHost,
    track: MediaStreamTrack,
    language: string,
    cloud: boolean,
  ): Recognizer {
    // A new recognizer is a new session: its results count from zero.
    this.words.end();
    return recognize(track, language, cloud, {
      results: (phrases) => {
        for (const text of this.words.update(phrases)) {
          this.dispatchEvent(
            new CustomEvent<TranscriptDetail>('transcript', {
              detail: { text, time: player.media.currentTime },
              bubbles: true,
              composed: true,
            }),
          );
        }
        this.heard();
      },
      ended: () => {
        this.words.end();
        this.render();
      },
      failed: (reason) => {
        this.fail(reason);
      },
    });
  }

  private stop(): void {
    this.run += 1;
    this.running = false;
    this.recognizer?.stop();
    this.recognizer = null;
    this.untrack?.();
    this.untrack = null;
    // Ending the capture's tracks ends the capture alone: the media plays on.
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    clearTimeout(this.quiet);
    this.words.clear();
    if (this.notice !== null && this.noticeTimer === undefined) this.notice = null;
  }

  /** Stops, says why, and turns the player's attribute off so the menu reads off. */
  private fail(failure: Failure): void {
    this.stop();
    const words: Record<Failure, string> = {
      language: this.word(
        'label-language',
        'liveCaptionsLanguage',
        'Live captions are not available in this language',
      ),
      download: this.word(
        'label-download',
        'liveCaptionsDownload',
        'Live captions could not be downloaded',
      ),
      source: this.word(
        'label-source',
        'liveCaptionsSource',
        'Live captions cannot listen to this video',
      ),
      error: this.word('label-error', 'liveCaptionsError', 'Live captions stopped'),
    };
    this.say(words[failure], NOTICE_MS);
    // Off as the element's own change: the viewer's language stays, for the next source.
    this.turn('off');
    if (failure === 'language' || failure === 'source') this.mark(failure);
  }

  /** Shows `text` instead of speech, for `ms` or until replaced; null clears it. */
  private say(text: string | null, ms: number): void {
    clearTimeout(this.noticeTimer);
    this.noticeTimer = undefined;
    this.notice = text;
    if (text !== null && ms > 0) {
      this.noticeTimer = setTimeout(() => {
        this.noticeTimer = undefined;
        this.notice = null;
        this.render();
      }, ms);
    }
    this.render();
  }

  /** New words: draw them, and clear them after a silence. */
  private heard(): void {
    clearTimeout(this.quiet);
    this.quiet = setTimeout(() => {
      this.words.clear();
      this.render();
    }, QUIET_MS);
    this.render();
  }

  /** One paragraph per line, reused, so a line whose words did not change is left alone. */
  private draw(lines: readonly string[]): void {
    const paragraphs = this.box.children;
    while (paragraphs.length > lines.length) paragraphs[paragraphs.length - 1]?.remove();
    while (paragraphs.length < lines.length) {
      const paragraph = document.createElement('p');
      paragraph.setAttribute('part', 'line');
      const span = document.createElement('span');
      span.setAttribute('part', 'text');
      paragraph.append(span);
      this.box.append(paragraph);
    }
    lines.forEach((line, i) => {
      const span = paragraphs[i]?.firstElementChild;
      if (span != null && span.textContent !== line) span.textContent = line;
    });
  }

  protected override render(): void {
    const player = this.player;
    if (player === null) return;
    const media = player.media;
    const text = this.notice;
    this.toggleAttribute('notice', text !== null);
    const lines = text !== null ? [text] : this.running ? this.words.lines() : [];
    this.draw(lines);
    this.hidden = lines.length === 0;
    if (this.hidden) return;
    const look = player.getAttribute('subtitle-background');
    this.setAttribute('background', look === 'none' || look === 'solid' ? look : 'dark');
    const box = media.getBoundingClientRect();
    const scale = SCALES[player.getAttribute('subtitle-size') ?? ''] ?? 1;
    this.style.setProperty(
      '--mbx-live-captions-size',
      `${Math.round(box.height * CUE_SIZE * scale)}px`,
    );
    // Above the bar while it shows. The player exposes no measure of what the bar covers, so its whole box counts.
    const bar = player.querySelector('mbx-control-bar');
    const shown =
      bar !== null && player.getAttribute('controls') === 'custom' && !player.hasAttribute('idle');
    const host = player.getBoundingClientRect();
    this.style.setProperty(
      '--mbx-live-captions-lift',
      shown ? `${Math.round(host.bottom - bar.getBoundingClientRect().top + AIR)}px` : '4%',
    );
  }
}
