import type { MatteboxPlayerElement, Remote, RemoteLoad, RemoteMedia } from '@mattebox/player';
import '@mattebox/player';
import type { Source } from '@mattebox/player-core';
import { afterEach, describe, expect, it } from 'vitest';
import { silence } from './helpers.js';

/** A device that plays nothing: it keeps what it is told and reports it. */
class FakeMedia extends EventTarget implements RemoteMedia {
  time = 0;
  duration = 100;
  paused = true;
  ended = false;
  volume = 1;
  muted = false;
  readonly seekable = { length: 1, start: () => 0, end: () => 100 };

  get currentTime(): number {
    return this.time;
  }

  set currentTime(value: number) {
    this.time = value;
    this.dispatchEvent(new Event('seeking'));
    this.dispatchEvent(new Event('timeupdate'));
  }

  play(): Promise<void> {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }
}

interface Fake extends Remote {
  readonly media: FakeMedia;
  readonly loads: { source: Source; load: RemoteLoad }[];
  refuse: boolean;
}

function fakeRemote(): Fake {
  const media = new FakeMedia();
  const loads: Fake['loads'] = [];
  const remote: Fake = {
    target: { kind: 'chromecast', name: 'Living room' },
    media,
    loads,
    refuse: false,
    load(source, load) {
      loads.push({ source, load });
      if (remote.refuse) return Promise.reject(new Error('refused'));
      media.time = typeof load.at === 'number' ? load.at : 0;
      media.paused = !load.playing;
      return Promise.resolve();
    },
    stop() {},
  };
  return remote;
}

function mount(markup = '<mattebox-player></mattebox-player>'): MatteboxPlayerElement {
  document.body.innerHTML = markup;
  return document.querySelector('mattebox-player') as MatteboxPlayerElement;
}

function once(target: EventTarget, name: string): Promise<Event> {
  return new Promise((resolve) => {
    target.addEventListener(name, resolve, { once: true });
  });
}

/** A player with a native session of `seconds` of silence, loaded to its metadata. */
async function loaded(seconds = 4): Promise<MatteboxPlayerElement> {
  const player = mount();
  const ready = once(player.querySelector('video') as HTMLVideoElement, 'loadedmetadata');
  player.setAttribute('src', silence(seconds));
  player.setAttribute('type', 'audio/wav');
  await ready;
  return player;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('player.media', () => {
  it('reads and calls the video without a device', () => {
    const player = mount();
    const video = player.querySelector('video') as HTMLVideoElement;
    expect(player.media).toBe(player.media);
    expect(player.media).toBeInstanceOf(HTMLVideoElement);
    expect('video' in player).toBe(false);
    expect('remote' in player).toBe(false);
    player.media.volume = 0.25;
    expect(video.volume).toBe(0.25);
    // A DOM method refuses any receiver but the element.
    expect(player.media.canPlayType('audio/wav')).toBe(video.canPlayType('audio/wav'));
    expect(player.media.getBoundingClientRect().width).toBe(video.getBoundingClientRect().width);
    expect(player.media.play).toBe(player.media.play);
  });

  it('hears the video through a listener, once per listener', () => {
    const player = mount();
    const video = player.querySelector('video') as HTMLVideoElement;
    let heard = 0;
    const listener = (): void => {
      heard += 1;
    };
    player.media.addEventListener('timeupdate', listener);
    player.media.addEventListener('timeupdate', listener);
    video.dispatchEvent(new Event('timeupdate'));
    expect(heard).toBe(1);
    player.media.removeEventListener('timeupdate', listener);
    video.dispatchEvent(new Event('timeupdate'));
    expect(heard).toBe(1);
  });

  it('keeps an event handler and a function of the page as they are', () => {
    const player = mount();
    const handler = (): void => {};
    player.media.onplay = handler;
    expect(player.media.onplay).toBe(handler);
  });
});

describe('player.cast', () => {
  it('reads the device for the members it has, and the video for the rest', async () => {
    const player = await loaded();
    const video = player.querySelector('video') as HTMLVideoElement;
    const remote = fakeRemote();
    const end = player.cast(remote);
    remote.media.time = 42;
    expect(player.media.currentTime).toBe(42);
    expect(player.media.duration).toBe(100);
    expect(player.media.seekable.end(0)).toBe(100);
    // The device has no such member: the video answers.
    expect(player.media.videoWidth).toBe(video.videoWidth);
    expect(player.media.textTracks).toBe(video.textTracks);
    player.media.currentTime = 10;
    expect(remote.media.time).toBe(10);
    expect(video.currentTime).not.toBe(10);
    await player.media.play();
    expect(remote.media.paused).toBe(false);
    expect(video.paused).toBe(true);
    end();
  });

  it('moves the playback listeners to the device and back, and has them draw', async () => {
    const player = await loaded();
    const video = player.querySelector('video') as HTMLVideoElement;
    const heard: string[] = [];
    player.media.addEventListener('timeupdate', () => heard.push('timeupdate'));
    player.media.addEventListener('emptied', () => heard.push('emptied'));
    const remote = fakeRemote();
    const end = player.cast(remote);
    // Called at the move, so a control draws the device's state.
    expect(heard).toEqual(['timeupdate']);
    video.dispatchEvent(new Event('timeupdate'));
    expect(heard).toEqual(['timeupdate']);
    remote.media.dispatchEvent(new Event('timeupdate'));
    expect(heard).toEqual(['timeupdate', 'timeupdate']);
    // Not a playback event: it stays the video's.
    video.dispatchEvent(new Event('emptied'));
    expect(heard[heard.length - 1]).toBe('emptied');
    end();
    heard.length = 0;
    remote.media.dispatchEvent(new Event('timeupdate'));
    expect(heard).toEqual([]);
    video.dispatchEvent(new Event('timeupdate'));
    expect(heard).toEqual(['timeupdate']);
  });

  it('sets casting, fires castingchange, and reflects the device on the attributes', async () => {
    const player = await loaded();
    const changes: unknown[] = [];
    player.addEventListener('castingchange', (event) => {
      changes.push((event as CustomEvent).detail);
    });
    const remote = fakeRemote();
    const end = player.cast(remote);
    expect(player.getAttribute('casting')).toBe('chromecast');
    expect(player.casting).toEqual({ kind: 'chromecast', name: 'Living room' });
    await player.media.play();
    expect(player.hasAttribute('playing')).toBe(true);
    remote.media.pause();
    expect(player.hasAttribute('paused')).toBe(true);
    end();
    expect(player.hasAttribute('casting')).toBe(false);
    expect(player.casting).toBeNull();
    expect(changes).toEqual([{ kind: 'chromecast', name: 'Living room' }, null]);
  });

  it('sends the session to the device with the position, the markers and the tracks', async () => {
    const player = await loaded();
    const video = player.querySelector('video') as HTMLVideoElement;
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.src = 'https://example.com/en.vtt';
    track.srclang = 'en';
    track.label = 'English';
    video.append(track);
    player.setAttribute('thumbnails', 'https://example.com/thumbs.vtt');
    player.markers.set([{ start: 1, end: 2, kind: 'blocked' }]);
    video.currentTime = 3;
    const remote = fakeRemote();
    const end = player.cast(remote);
    expect(remote.loads).toHaveLength(1);
    const { source, load } = remote.loads[0] as Fake['loads'][number];
    expect(source.url).toBe(player.getAttribute('src'));
    expect(load.at).toBe(3);
    expect(load.playing).toBe(false);
    expect(load.markers).toEqual([{ start: 1, end: 2, kind: 'blocked' }]);
    expect(load.thumbnails).toBe('https://example.com/thumbs.vtt');
    expect(load.textTracks).toEqual([
      { url: 'https://example.com/en.vtt', kind: 'subtitles', label: 'English', language: 'en' },
    ]);
    expect(load.addons).toEqual({});
    end();
  });

  it('sends no load for a session the device already plays', async () => {
    const player = await loaded();
    const remote = fakeRemote();
    const end = player.cast(remote, { adopted: true });
    expect(remote.loads).toHaveLength(0);
    expect(player.getAttribute('casting')).toBe('chromecast');
    end();
  });

  it('sends a load during the cast to the device, and keeps the video paused', async () => {
    const player = await loaded();
    const video = player.querySelector('video') as HTMLVideoElement;
    const remote = fakeRemote();
    const end = player.cast(remote);
    const changed = once(player, 'sourcechange');
    const next = silence(2);
    player.setAttribute('src', next);
    await changed;
    expect(remote.loads).toHaveLength(2);
    expect(remote.loads[1]?.source.url).toBe(next);
    expect(remote.loads[1]?.load.playing).toBe(true);
    // The video never plays while the device does.
    await video.play().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(video.paused).toBe(true);
    end();
  });

  it('gives the video the position of the device back, with no new load', async () => {
    const player = await loaded();
    const video = player.querySelector('video') as HTMLVideoElement;
    let sessions = 0;
    player.addEventListener('sourcechange', () => {
      sessions += 1;
    });
    const remote = fakeRemote();
    const end = player.cast(remote);
    remote.media.time = 2.5;
    end();
    expect(video.currentTime).toBe(2.5);
    expect(sessions).toBe(0);
    expect(player.media.currentTime).toBe(2.5);
    // The function is spent: a second call changes nothing.
    video.currentTime = 1;
    end();
    expect(video.currentTime).toBe(1);
  });

  it('skips a blocked range on the device', async () => {
    const player = await loaded();
    player.markers.set([{ start: 10, end: 20, kind: 'blocked' }]);
    const remote = fakeRemote();
    const end = player.cast(remote);
    player.media.currentTime = 12;
    expect(remote.media.time).toBeGreaterThanOrEqual(20);
    end();
  });

  it('reports a load the device refuses, and keeps the cast', async () => {
    const player = await loaded();
    const errors: { code: string; fatal: boolean }[] = [];
    player.addEventListener('error', (event) => {
      errors.push((event as CustomEvent).detail);
    });
    const remote = fakeRemote();
    remote.refuse = true;
    const end = player.cast(remote);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(errors.map((error) => [error.code, error.fatal])).toEqual([
      ['REMOTE_LOAD_FAILED', false],
    ]);
    expect(player.getAttribute('casting')).toBe('chromecast');
    end();
  });

  it('ends the cast that runs when a second one starts', async () => {
    const player = await loaded();
    const first = fakeRemote();
    const second = fakeRemote();
    player.cast(first);
    const end = player.cast({ ...second, target: { kind: 'chromecast', name: 'Kitchen' } });
    expect(player.casting?.name).toBe('Kitchen');
    end();
    expect(player.casting).toBeNull();
  });
});
