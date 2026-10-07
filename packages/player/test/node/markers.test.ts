import { describe, expect, it } from 'vitest';
import type { Marker } from '../../src/controls/markers.js';
import { createMarkers } from '../../src/controls/markers.js';

/** A video that only holds a time and a duration, and fires what it is told. */
function fakeVideo(duration = 100) {
  return Object.assign(new EventTarget(), { currentTime: 0, duration }) as EventTarget & {
    currentTime: number;
    duration: number;
  };
}

function setup(duration?: number) {
  const video = fakeVideo(duration);
  const events: Array<[string, unknown]> = [];
  const markers = createMarkers(video as unknown as HTMLVideoElement, (name, detail) =>
    events.push([name, detail]),
  );
  const at = (time: number, event = 'timeupdate'): void => {
    video.currentTime = time;
    video.dispatchEvent(new Event(event));
  };
  return { video, events, markers, at };
}

const credits: Marker = { start: 0, end: 20, kind: 'opening-credits' };
const blocked: Marker = { start: 30, end: 40, kind: 'blocked', label: 'Not available here' };

describe('markers', () => {
  it('keeps the list by start, reports each change, and finds the ones holding a time', () => {
    const { markers, events } = setup();
    markers.set([blocked, credits]);
    expect(markers.list).toEqual([credits, blocked]);
    expect(events).toEqual([['markerschange', [credits, blocked]]]);
    expect(markers.within(10)).toEqual([credits]);
    // The end is outside: playback past it has left the range.
    expect(markers.within(20)).toEqual([]);
  });

  it('moves playback past a blocked range, entered by playing or by seeking', () => {
    const { markers, events, at, video } = setup();
    markers.set([credits, blocked]);
    at(29.9);
    expect(video.currentTime).toBe(29.9);
    at(30);
    expect(video.currentTime).toBeCloseTo(40.1);
    at(35, 'seeking');
    expect(video.currentTime).toBeCloseTo(40.1);
    expect(events.filter(([name]) => name === 'blocked')).toEqual([
      ['blocked', blocked],
      ['blocked', blocked],
    ]);
  });

  it('a blocked range set under the playhead moves it at once', () => {
    const { markers, video } = setup();
    video.currentTime = 35;
    markers.set([blocked]);
    expect(video.currentTime).toBeCloseTo(40.1);
  });

  it('a blocked range at the end stops at the duration', () => {
    const { markers, at, video } = setup(40);
    markers.set([blocked]);
    at(35);
    expect(video.currentTime).toBe(40);
  });

  it('other kinds never move playback', () => {
    const { markers, at, video } = setup();
    markers.set([credits]);
    at(5);
    expect(video.currentTime).toBe(5);
  });
});
