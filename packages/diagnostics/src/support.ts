/**
 * What this browser can do, probed the way the engine's playground probes
 * it: the platform APIs, the codecs through MSE, the element and Media
 * Capabilities, and the DRM key systems with their security levels,
 * schemes, persistence, identifiers and output protection. Every probe is
 * bounded by a timeout, and the whole run is cached for the page: it does
 * not change while the page lives, and the key-system probes are not free.
 * Nothing here touches the engine.
 */

/** A probe's answer: yes, no, not applicable, maybe, or a text of its own. */
export type Cell = 'yes' | 'no' | 'na' | 'maybe' | (string & {});

export interface PlatformRow {
  readonly label: string;
  readonly value: Cell;
}

export interface CodecRow {
  readonly label: string;
  readonly codec: string;
  readonly kind: 'video' | 'audio';
  /** Through MSE, in fMP4 and in WebM. */
  readonly mse: Cell;
  readonly webm: Cell;
  /** The video element's own `canPlayType`. */
  readonly element: Cell;
  /** Media Capabilities: smooth and power-efficient at 1080p30, or stereo 128 kbps. */
  readonly smooth: Cell;
  readonly efficient: Cell;
}

export interface DrmRow {
  readonly label: string;
  readonly keySystem: string | null;
  readonly level: Cell;
  readonly schemes: Cell;
  readonly persistent: Cell;
  readonly identifier: Cell;
  readonly hdcp: Cell;
}

export interface Support {
  readonly userAgent: string;
  readonly platform: readonly PlatformRow[];
  readonly codecs: readonly CodecRow[];
  readonly drm: readonly DrmRow[];
}

interface CodecProbe {
  readonly label: string;
  readonly codec: string;
  readonly kind: 'video' | 'audio';
  readonly containers: readonly string[];
}

const CODECS: readonly CodecProbe[] = [
  { label: 'H.264 High 4.0', codec: 'avc1.640028', kind: 'video', containers: ['mp4'] },
  { label: 'H.264 Baseline', codec: 'avc1.42e01e', kind: 'video', containers: ['mp4'] },
  { label: 'H.265 / HEVC Main', codec: 'hvc1.1.6.L123.B0', kind: 'video', containers: ['mp4'] },
  { label: 'VP9 Profile 0', codec: 'vp09.00.40.08', kind: 'video', containers: ['mp4', 'webm'] },
  { label: 'AV1 Main', codec: 'av01.0.08M.08', kind: 'video', containers: ['mp4', 'webm'] },
  { label: 'AAC-LC', codec: 'mp4a.40.2', kind: 'audio', containers: ['mp4'] },
  { label: 'HE-AAC', codec: 'mp4a.40.5', kind: 'audio', containers: ['mp4'] },
  { label: 'Opus', codec: 'opus', kind: 'audio', containers: ['mp4', 'webm'] },
  { label: 'FLAC', codec: 'flac', kind: 'audio', containers: ['mp4'] },
  { label: 'AC-3', codec: 'ac-3', kind: 'audio', containers: ['mp4'] },
  { label: 'E-AC-3', codec: 'ec-3', kind: 'audio', containers: ['mp4'] },
];

interface KeySystemProbe {
  readonly label: string;
  /** Tried in order; the first the browser grants wins. */
  readonly keySystems: readonly string[];
  /** Robustness strings and their names, highest first. */
  readonly levels: ReadonlyArray<readonly [string, string]>;
}

const KEY_SYSTEMS: readonly KeySystemProbe[] = [
  {
    label: 'Widevine',
    keySystems: ['com.widevine.alpha'],
    levels: [
      ['HW_SECURE_ALL', 'L1'],
      ['HW_SECURE_DECODE', 'L1'],
      ['HW_SECURE_CRYPTO', 'L2'],
      ['SW_SECURE_DECODE', 'L3'],
      ['SW_SECURE_CRYPTO', 'L3'],
    ],
  },
  {
    label: 'PlayReady',
    keySystems: ['com.microsoft.playready.recommendation', 'com.microsoft.playready'],
    levels: [
      ['3000', 'SL3000'],
      ['2000', 'SL2000'],
      ['150', 'SL150'],
    ],
  },
  { label: 'FairPlay', keySystems: ['com.apple.fps', 'com.apple.fps.1_0'], levels: [] },
  { label: 'ClearKey', keySystems: ['org.w3.clearkey'], levels: [] },
];

const HDCP_VERSIONS = ['1.0', '1.1', '1.2', '1.3', '1.4', '2.0', '2.1', '2.2', '2.3'];
const VIDEO_TYPE = 'video/mp4; codecs="avc1.42e01e"';
const VIDEO_TYPE_ALT = 'video/mp4; codecs="vp09.00.10.08"';
const AUDIO_TYPE = 'audio/mp4; codecs="mp4a.40.2"';
const AUDIO_TYPE_ALT = 'audio/mp4; codecs="opus"';

/** A probe that never answers is a no: some CDMs hang instead of rejecting. */
function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 4000): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

function has(name: string): Cell {
  return name in globalThis ? 'yes' : 'no';
}

function platform(): PlatformRow[] {
  let changeType: Cell = 'no';
  try {
    if (typeof MediaSource !== 'undefined' && 'changeType' in SourceBuffer.prototype) {
      changeType = 'yes';
    }
  } catch {
    changeType = 'no';
  }
  return [
    { label: 'Secure context', value: window.isSecureContext ? 'yes' : 'no' },
    { label: 'MediaSource', value: has('MediaSource') },
    { label: 'ManagedMediaSource', value: has('ManagedMediaSource') },
    { label: 'SourceBuffer.changeType', value: changeType },
    { label: 'Encrypted Media (EME)', value: has('MediaKeys') },
    {
      label: 'MediaCapabilities',
      value: navigator.mediaCapabilities !== undefined ? 'yes' : 'no',
    },
    { label: 'WebCodecs', value: has('VideoDecoder') },
  ];
}

function mseSupports(type: string): boolean {
  try {
    return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(type);
  } catch {
    return false;
  }
}

function elementSupports(type: string): Cell {
  const answer = document.createElement('video').canPlayType(type);
  return answer === 'probably' ? 'yes' : answer === 'maybe' ? 'maybe' : 'no';
}

async function decodingInfo(probe: CodecProbe): Promise<{ smooth: Cell; efficient: Cell }> {
  const capabilities = navigator.mediaCapabilities;
  if (capabilities?.decodingInfo === undefined) return { smooth: 'na', efficient: 'na' };
  const contentType = `${probe.kind}/${probe.containers[0]}; codecs="${probe.codec}"`;
  const config: MediaDecodingConfiguration =
    probe.kind === 'video'
      ? {
          type: 'media-source',
          video: { contentType, width: 1920, height: 1080, bitrate: 6_000_000, framerate: 30 },
        }
      : { type: 'media-source', audio: { contentType, channels: '2', bitrate: 128_000 } };
  const info = await withTimeout(
    capabilities.decodingInfo(config) as Promise<MediaCapabilitiesDecodingInfo | null>,
    null,
  );
  if (info === null) return { smooth: 'na', efficient: 'na' };
  if (!info.supported) return { smooth: 'no', efficient: 'no' };
  return { smooth: info.smooth ? 'yes' : 'no', efficient: info.powerEfficient ? 'yes' : 'no' };
}

async function codec(probe: CodecProbe): Promise<CodecRow> {
  const cell = (container: string): Cell =>
    probe.containers.includes(container)
      ? mseSupports(`${probe.kind}/${container}; codecs="${probe.codec}"`)
        ? 'yes'
        : 'no'
      : 'na';
  const { smooth, efficient } = await decodingInfo(probe);
  return {
    label: probe.label,
    codec: probe.codec,
    kind: probe.kind,
    mse: cell('mp4'),
    webm: cell('webm'),
    element: elementSupports(`${probe.kind}/${probe.containers[0]}; codecs="${probe.codec}"`),
    smooth,
    efficient,
  };
}

function videoAlternates(
  extra: Partial<MediaKeySystemMediaCapability> = {},
): MediaKeySystemMediaCapability[] {
  return [
    { contentType: VIDEO_TYPE, ...extra },
    { contentType: VIDEO_TYPE_ALT, ...extra },
  ];
}

function baseConfig(extra: Partial<MediaKeySystemConfiguration> = {}): MediaKeySystemConfiguration {
  return {
    initDataTypes: ['cenc', 'keyids', 'sinf', 'skd'],
    videoCapabilities: videoAlternates(),
    audioCapabilities: [{ contentType: AUDIO_TYPE }, { contentType: AUDIO_TYPE_ALT }],
    ...extra,
  };
}

function requestAccess(
  keySystem: string,
  config: MediaKeySystemConfiguration,
): Promise<MediaKeySystemAccess | null> {
  if (typeof navigator.requestMediaKeySystemAccess !== 'function') return Promise.resolve(null);
  return withTimeout(
    navigator.requestMediaKeySystemAccess(keySystem, [config]).then(
      (access) => access,
      () => null,
    ),
    null,
  );
}

const NONE = (label: string): DrmRow => ({
  label,
  keySystem: null,
  level: 'na',
  schemes: 'na',
  persistent: 'na',
  identifier: 'na',
  hdcp: 'na',
});

async function keySystem(probe: KeySystemProbe): Promise<DrmRow> {
  let system: string | null = null;
  let access: MediaKeySystemAccess | null = null;
  for (const candidate of probe.keySystems) {
    access = await requestAccess(candidate, baseConfig());
    if (access !== null) {
      system = candidate;
      break;
    }
  }
  if (system === null || access === null) return NONE(probe.label);

  let level: Cell = probe.levels.length === 0 ? 'n/a for this system' : 'none granted';
  for (const [robustness, name] of probe.levels) {
    const granted = await requestAccess(
      system,
      baseConfig({ videoCapabilities: videoAlternates({ robustness }) }),
    );
    if (granted !== null) {
      level = `${name} (${robustness})`;
      break;
    }
  }

  // Only a scheme the browser echoes back counts: an old EME grants any.
  const echoed: string[] = [];
  let schemeApi = false;
  for (const scheme of ['cenc', 'cbcs']) {
    const granted = await requestAccess(
      system,
      baseConfig({ videoCapabilities: videoAlternates({ encryptionScheme: scheme }) }),
    );
    const answer = granted
      ?.getConfiguration()
      .videoCapabilities?.find((c) => c.contentType !== '')?.encryptionScheme;
    if (answer !== undefined && answer !== null) schemeApi = true;
    if (answer === scheme) echoed.push(scheme);
  }
  const schemes: Cell = !schemeApi
    ? 'unknown (no API)'
    : echoed.length === 0
      ? 'none'
      : echoed.join(', ');

  const persistent = await requestAccess(
    system,
    baseConfig({ persistentState: 'required', sessionTypes: ['persistent-license'] }),
  );
  const identifier = await requestAccess(system, baseConfig({ distinctiveIdentifier: 'required' }));

  let hdcp: Cell = 'na';
  try {
    const keys = (await withTimeout(access.createMediaKeys(), null)) as
      | (MediaKeys & {
          getStatusForPolicy?: (policy: { minHdcpVersion: string }) => Promise<string>;
        })
      | null;
    if (keys !== null && typeof keys.getStatusForPolicy === 'function') {
      let best: string | null = null;
      for (const version of HDCP_VERSIONS) {
        const status = await withTimeout(
          keys.getStatusForPolicy({ minHdcpVersion: version }),
          'unknown',
        );
        if (status !== 'usable') break;
        best = version;
      }
      hdcp = best === null ? 'no output protection' : `up to ${best}`;
    }
  } catch {
    hdcp = 'na';
  }

  return {
    label: probe.label,
    keySystem: system,
    level,
    schemes,
    persistent: persistent !== null ? 'yes' : 'no',
    identifier: identifier !== null ? 'yes' : 'no',
    hdcp,
  };
}

let cached: Promise<Support> | null = null;

/** Probes the browser once per page and answers from the cache after. */
export function probeSupport(): Promise<Support> {
  if (cached === null) {
    cached = (async (): Promise<Support> => ({
      userAgent: navigator.userAgent,
      platform: platform(),
      codecs: await Promise.all(CODECS.map(codec)),
      drm: await Promise.all(KEY_SYSTEMS.map(keySystem)),
    }))();
  }
  return cached;
}
