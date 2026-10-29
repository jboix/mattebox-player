import { describe, expect, it } from 'vitest';
import { resolveVast, WRAPPER_LIMIT } from '../../src/vast.js';
import { breakOffset, offsetTime, parseVmap } from '../../src/vmap.js';

const inline = (id: string, extra = '', sequence = '') => `<Ad id="${id}"${sequence}>
  <InLine>
    <AdSystem>Example</AdSystem>
    <AdTitle>${id}</AdTitle>
    <Impression><![CDATA[https://t.example/${id}/impression]]></Impression>
    <Error><![CDATA[https://t.example/${id}/error?c=[ERRORCODE]]]></Error>
    <AdVerifications>
      <Verification vendor="verifier.example">
        <JavaScriptResource apiFramework="omid"><![CDATA[https://v.example/omid.js]]></JavaScriptResource>
        <VerificationParameters><![CDATA[k=1]]></VerificationParameters>
      </Verification>
    </AdVerifications>
    <ViewableImpression><Viewable><![CDATA[https://t.example/${id}/viewable]]></Viewable></ViewableImpression>
    <Creatives>
      <Creative>
        <Linear ${extra}>
          <Duration>00:00:20.000</Duration>
          <TrackingEvents>
            <Tracking event="start"><![CDATA[https://t.example/${id}/start]]></Tracking>
            <Tracking event="progress" offset="25%"><![CDATA[https://t.example/${id}/p25]]></Tracking>
          </TrackingEvents>
          <VideoClicks>
            <ClickThrough><![CDATA[https://brand.example/]]></ClickThrough>
            <ClickTracking><![CDATA[https://t.example/${id}/click]]></ClickTracking>
          </VideoClicks>
          <MediaFiles>
            <MediaFile delivery="progressive" type="video/mp4" width="640" height="360"><![CDATA[https://cdn.example/${id}-360.mp4]]></MediaFile>
            <MediaFile delivery="streaming" type="application/x-mpegURL"><![CDATA[https://cdn.example/${id}/master.m3u8]]></MediaFile>
            <MediaFile delivery="progressive" type="application/javascript" apiFramework="VPAID"><![CDATA[https://cdn.example/vpaid.js]]></MediaFile>
          </MediaFiles>
        </Linear>
      </Creative>
      <Creative>
        <CompanionAds>
          <Companion width="300" height="250">
            <StaticResource creativeType="image/png"><![CDATA[https://cdn.example/banner.png]]></StaticResource>
            <CompanionClickThrough><![CDATA[https://brand.example/banner]]></CompanionClickThrough>
          </Companion>
        </CompanionAds>
      </Creative>
    </Creatives>
  </InLine>
</Ad>`;
const vast = (...ads: string[]) => `<VAST version="4.2">${ads.join('')}</VAST>`;
const wrapper = (next: string, extra = '') => `<VAST version="4.2"><Ad id="w"><Wrapper ${extra}>
  <Impression><![CDATA[https://t.example/w/impression]]></Impression>
  <VASTAdTagURI><![CDATA[${next}]]></VASTAdTagURI>
  <Creatives><Creative><Linear><TrackingEvents>
    <Tracking event="complete"><![CDATA[https://t.example/w/complete]]></Tracking>
  </TrackingEvents></Linear></Creative></Creatives>
</Wrapper></Ad></VAST>`;

/** A fetcher over a map of URLs, which records what it was asked. */
function served(documents: Record<string, string>) {
  const asked: string[] = [];
  const load = async (url: string): Promise<string> => {
    asked.push(url);
    const text = documents[url];
    if (text === undefined) throw new Error('404');
    return text;
  };
  return { load, asked };
}

describe('VAST', () => {
  it('reads an inline linear ad: files, beacons, skip offset, clicks, and the data it does not play', async () => {
    const result = await resolveVast({ xml: vast(inline('a', 'skipoffset="25%"')) });
    expect(result.code).toBeUndefined();
    const [ad] = result.ads;
    expect(ad).toMatchObject({
      id: 'a',
      title: 'a',
      duration: 20,
      skipOffset: 5,
      impressions: ['https://t.example/a/impression'],
      clickThrough: 'https://brand.example/',
      clickTracking: ['https://t.example/a/click'],
      viewable: ['https://t.example/a/viewable'],
    });
    expect(ad?.tracking).toEqual([
      { event: 'start', url: 'https://t.example/a/start' },
      { event: 'progress', url: 'https://t.example/a/p25', offset: 5 },
    ]);
    expect(ad?.mediaFiles.map((f) => [f.delivery, f.type])).toEqual([
      ['progressive', 'video/mp4'],
      ['streaming', 'application/x-mpegURL'],
      ['progressive', 'application/javascript'],
    ]);
    expect(ad?.verifications).toEqual([
      { vendor: 'verifier.example', script: 'https://v.example/omid.js', parameters: 'k=1' },
    ]);
    expect(ad?.companions).toEqual([
      {
        width: 300,
        height: 250,
        resource: 'https://cdn.example/banner.png',
        kind: 'static',
        clickThrough: 'https://brand.example/banner',
      },
    ]);
  });

  it('follows a wrapper and adds its beacons to the ad it leads to', async () => {
    const { load, asked } = served({ 'https://ads.example/inline.xml': vast(inline('a')) });
    const result = await resolveVast({ xml: wrapper('https://ads.example/inline.xml') }, load);
    expect(asked).toEqual(['https://ads.example/inline.xml']);
    expect(result.ads[0]?.impressions).toEqual([
      'https://t.example/w/impression',
      'https://t.example/a/impression',
    ]);
    expect(result.ads[0]?.tracking.map((t) => t.event)).toContain('complete');
  });

  it(`stops after ${WRAPPER_LIMIT} wrappers with error 302, and at a wrapper that allows no more`, async () => {
    const documents: Record<string, string> = {};
    for (let i = 0; i < 8; i += 1)
      documents[`https://ads.example/${i}`] = wrapper(`https://ads.example/${i + 1}`);
    const deep = await resolveVast({ url: 'https://ads.example/0' }, served(documents).load);
    expect(deep.ads).toEqual([]);
    expect(deep.code).toBe(302);
    const stopped = await resolveVast(
      { xml: wrapper('https://ads.example/0', 'followAdditionalWrappers="false"') },
      served(documents).load,
    );
    expect(stopped.code).toBe(302);
  });

  it('plays a pod in sequence order, and answers 303 for no ad and 100 for no VAST', async () => {
    const pod = await resolveVast({
      xml: vast(
        inline('second', '', ' sequence="2"'),
        inline('first', '', ' sequence="1"'),
        inline('alone'),
      ),
    });
    expect(pod.ads.map((a) => a.id)).toEqual(['first', 'second']);
    const empty = await resolveVast({
      xml: '<VAST version="4.2"><Error><![CDATA[https://t.example/none]]></Error></VAST>',
    });
    expect(empty).toEqual({ ads: [], errors: ['https://t.example/none'], code: 303 });
    expect((await resolveVast({ xml: '<html></html>' })).code).toBe(100);
  });
});

describe('VMAP', () => {
  it('reads each linear break with its offset, its VAST URL or inline VAST, and its beacons', () => {
    const breaks = parseVmap(
      `<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">
  <vmap:AdBreak timeOffset="start" breakType="linear" breakId="pre">
    <vmap:AdSource><vmap:AdTagURI templateType="vast4"><![CDATA[pre.xml]]></vmap:AdTagURI></vmap:AdSource>
    <vmap:TrackingEvents><vmap:Tracking event="breakStart"><![CDATA[https://t.example/pre/start]]></vmap:Tracking></vmap:TrackingEvents>
  </vmap:AdBreak>
  <vmap:AdBreak timeOffset="00:10:00.000" breakType="linear" breakId="mid">
    <vmap:AdSource><vmap:VASTAdData>${vast(inline('m'))}</vmap:VASTAdData></vmap:AdSource>
  </vmap:AdBreak>
  <vmap:AdBreak timeOffset="end" breakType="nonlinear"><vmap:AdSource><vmap:AdTagURI><![CDATA[x.xml]]></vmap:AdTagURI></vmap:AdSource></vmap:AdBreak>
</vmap:VMAP>`,
      'https://ads.example/vmap/',
    );
    expect(breaks?.map((b) => [b.id, b.offset])).toEqual([
      ['pre', 'start'],
      ['mid', { time: 600 }],
    ]);
    expect(breaks?.[0]?.vast).toEqual({ url: 'https://ads.example/vmap/pre.xml' });
    expect(breaks?.[0]?.tracking).toEqual([
      { event: 'breakStart', url: 'https://t.example/pre/start' },
    ]);
    expect('xml' in (breaks?.[1]?.vast ?? {})).toBe(true);
    expect(parseVmap(vast(inline('a')), 'https://x.example/')).toBeNull();
  });

  it('places percentages and positions once the duration is known', () => {
    expect(offsetTime(breakOffset('50%') ?? 'start', 1200)).toBe(600);
    expect(offsetTime(breakOffset('end') ?? 'start', Number.NaN)).toBeNull();
    expect(offsetTime(breakOffset('#2') ?? 'start', 100, [30, 60])).toBe(60);
  });
});
