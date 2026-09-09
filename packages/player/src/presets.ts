/**
 * Resolving the `preset` attribute to a preset factory without bundling one.
 * The size story is the engine's, and an element that statically imported a
 * preset would undo it.
 *
 * Two routes, in order. A page on the CDN path has no module resolver, and
 * its engine bundle carries exactly one preset behind `mattebox.preset`.
 * Everywhere else the table below answers.
 *
 * The table is explicit because a computed specifier is not a portable
 * dynamic import: no bundler can analyze `import('mattebox/presets/' + name)`,
 * so it survives the build as a bare specifier the browser cannot resolve.
 * Twelve literal imports are twelve chunks a bundler can split, and the page
 * downloads only the one it names. An unknown name is an error the element
 * reports, not a failed request.
 */
import type { Preset } from 'mattebox/presets/full';

/** The shape the engine's CDN bundle puts on `globalThis`. */
interface EngineGlobal {
  readonly preset?: Preset;
}

/** eme-core's teardown calls `element.setMediaKeys(null)` unguarded, so a build without EME throws out of `detach`. See docs/integrator-log.md. */
const DRM_STAGES = ['eme-core', 'eme-cenc', 'eme-fairplay'];

type Load = () => Promise<{ readonly default: Preset }>;

/** The engine's preset matrix: a protocol line, a `-ts` tier, a `-drm` tier, plus `full` and `kernel`. */
const PRESETS: Readonly<Record<string, Load>> = {
  dash: () => import('mattebox/presets/dash'),
  'dash-drm': () => import('mattebox/presets/dash-drm'),
  dual: () => import('mattebox/presets/dual'),
  'dual-drm': () => import('mattebox/presets/dual-drm'),
  'dual-ts': () => import('mattebox/presets/dual-ts'),
  'dual-ts-drm': () => import('mattebox/presets/dual-ts-drm'),
  full: () => import('mattebox/presets/full'),
  hls: () => import('mattebox/presets/hls'),
  'hls-drm': () => import('mattebox/presets/hls-drm'),
  'hls-ts': () => import('mattebox/presets/hls-ts'),
  'hls-ts-drm': () => import('mattebox/presets/hls-ts-drm'),
  kernel: () => import('mattebox/presets/kernel'),
};

export async function resolvePreset(name: string): Promise<Preset | null> {
  const engine = (globalThis as { mattebox?: EngineGlobal }).mattebox;
  if (engine?.preset !== undefined) return engine.preset;
  const load = PRESETS[name];
  if (load === undefined) return null;
  try {
    return (await load()).default;
  } catch {
    return null;
  }
}

/** The DRM stages to leave out of a preset on a browser that cannot use them. */
export function drmGuard(): { without?: readonly string[] } {
  return 'setMediaKeys' in HTMLMediaElement.prototype ? {} : { without: DRM_STAGES };
}
