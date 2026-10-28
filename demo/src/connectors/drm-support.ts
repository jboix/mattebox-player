/**
 * The key systems this browser grants, at the highest robustness each one
 * grants, the way pillarbox-web's DrmSupport component finds them: one
 * `requestMediaKeySystemAccess` per level, the highest first. The SRG SSR
 * connector sends them to the IL, which then returns the resource this
 * browser can decrypt.
 */

/** A key system the browser granted, and the level it granted, in the IL's words. */
export interface DrmCapability {
  /** The key system, such as `com.widevine.alpha`. */
  readonly keySystem: string;
  /** The IL's name of the vendor: `WIDEVINE`, `PLAYREADY` or `FAIRPLAY`. */
  readonly vendor: string;
  /** The level the IL reads, such as `L1`, `L3`, `SL3000` or `Supported`. */
  readonly level: string;
}

interface Probe {
  readonly vendor: string;
  readonly keySystem: string;
  /** The name the IL takes, which differs from the probed key system for FairPlay. */
  readonly reported: string;
  readonly levels: ReadonlyArray<readonly [robustness: string, label: string]>;
}

/** pillarbox-web's `DrmSupport.DRM_CONFIG` and `Drm.vendors`, in the same order. */
const PROBES: readonly Probe[] = [
  {
    vendor: 'WIDEVINE',
    keySystem: 'com.widevine.alpha',
    reported: 'com.widevine.alpha',
    levels: [
      ['HW_SECURE_ALL', 'L1'],
      ['SW_SECURE_CRYPTO', 'L3'],
    ],
  },
  {
    vendor: 'PLAYREADY',
    keySystem: 'com.microsoft.playready',
    reported: 'com.microsoft.playready',
    levels: [
      ['3000', 'SL3000'],
      ['2000', 'SL2000'],
    ],
  },
  {
    vendor: 'FAIRPLAY',
    keySystem: 'com.apple.fps',
    reported: 'com.apple.fps.1_0',
    levels: [['', 'Supported']],
  },
];

const CONTENT_TYPE = 'video/mp4; codecs="avc1.42E01E"';

/** The first level the browser grants for the probe's key system, or null. */
async function levelOf(probe: Probe): Promise<string | null> {
  for (const [robustness, label] of probe.levels) {
    try {
      const access = await navigator.requestMediaKeySystemAccess(probe.keySystem, [
        { initDataTypes: ['cenc'], videoCapabilities: [{ contentType: CONTENT_TYPE, robustness }] },
      ]);
      // A grant without keys is no grant: some browsers refuse only here.
      await access.createMediaKeys();
      return label;
    } catch {
      // The next level, lower.
    }
  }
  return null;
}

let probed: Promise<readonly DrmCapability[]> | null = null;

/** The browser's key systems, probed once per page: the answer does not change. */
export function drmCapabilities(): Promise<readonly DrmCapability[]> {
  if (probed !== null) return probed;
  if (typeof navigator.requestMediaKeySystemAccess !== 'function') {
    probed = Promise.resolve([]);
    return probed;
  }
  probed = Promise.all(
    PROBES.map(async (probe) => {
      const level = await levelOf(probe);
      return level === null ? null : { keySystem: probe.reported, vendor: probe.vendor, level };
    }),
  ).then((found) => found.filter((entry) => entry !== null));
  return probed;
}

/** The IL's `drmPlayerCapabilities` parameter: `keySystem;level`, comma separated, or '' for none. */
export function capabilityParameter(capabilities: readonly DrmCapability[]): string {
  return capabilities.map((entry) => `${entry.keySystem};${entry.level}`).join(',');
}
