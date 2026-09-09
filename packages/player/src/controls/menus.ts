/**
 * The menus over the engine's namespaces, for the bar under custom
 * controls: quality over `engine.quality`, audio and subtitles over
 * `engine.tracks`, and a lock badge over `engine.drm`. The same reads and
 * writes as the panels, in the bar's shape. Each factory answers null for
 * a native session, and each menu hides itself while it has nothing to
 * offer.
 *
 * The subtitles menu also carries how they look: a size and a background,
 * kept as attributes on the host, where the element's stylesheet turns
 * them into the custom properties the cue rule reads. A page can set them
 * in markup and persist them however it likes.
 */
import type { ContentType, Mattebox, Rendition, Track } from 'mattebox';
import { el } from '../dom.js';
import { namespaces } from '../namespaces.js';
import type { Control } from './control.js';
import { icon } from './icons.js';
import type { MenuGroup } from './menu.js';
import { menu } from './menu.js';

/** What a menu over a session gets: the engine, and the host for the state it reflects there. */
export interface MenuContext {
  readonly engine: Mattebox;
  readonly host: HTMLElement;
}

export type MenuFactory = (context: MenuContext) => Control;

const AUTO = 'auto';
const OFF = 'off';

/** The subtitle looks, as attribute name, choices, and default. */
export const SUBTITLE_SIZE = 'subtitle-size';
export const SUBTITLE_BACKGROUND = 'subtitle-background';
const SIZES: ReadonlyArray<readonly [string, string]> = [
  ['small', 'Small'],
  ['medium', 'Medium'],
  ['large', 'Large'],
  ['xlarge', 'Extra large'],
];
const BACKGROUNDS: ReadonlyArray<readonly [string, string]> = [
  ['none', 'None'],
  ['dark', 'Dark'],
  ['solid', 'Solid'],
];

/** A rendition's height when the manifest declared one, its bitrate otherwise. */
function renditionLabel(rendition: Rendition): string {
  if (rendition.height !== undefined) return `${rendition.height}p`;
  return `${Math.round(rendition.bitrate / 1000)} kbps`;
}

/** The language, then the role, then the id: whichever the manifest gave. */
function trackLabel(track: Track): string {
  const parts = [track.lang, track.role].filter((part) => part !== undefined);
  return parts.length === 0 ? track.id : parts.join(' · ');
}

/** The quality menu: the pin, where "auto" means none. Hidden without renditions. */
export const qualityMenu: MenuFactory = ({ engine }) => {
  const quality = engine.quality;
  const control = menu({ name: 'quality', label: 'Quality', icon: 'settings' });

  function render(): void {
    const items: Array<readonly [string, string]> = [[AUTO, 'Auto']];
    for (const rendition of quality.renditions)
      items.push([rendition.id, renditionLabel(rendition)]);
    control.fill([
      {
        name: 'rendition',
        items,
        value: quality.pinned ?? AUTO,
        onSelect(value: string): void {
          if (value === AUTO) quality.auto();
          else quality.pin(value);
          render();
        },
      },
    ]);
    control.root.hidden = quality.renditions.length === 0;
  }

  const offs = [
    engine.on('tracks:changed', render),
    engine.on('quality:constraints-unsatisfiable', render),
    engine.on('quality:pin-unsatisfiable', render),
  ];
  render();

  return {
    root: control.root,
    dispose(): void {
      for (const off of offs) off();
      control.dispose();
    },
  };
};

/** The tracks of one content type as menu items, with the active one. */
function trackItems(
  engine: Mattebox,
  contentType: ContentType,
  off: boolean,
): [Array<readonly [string, string]>, string, number] {
  const tracks = engine.tracks;
  const available = tracks.available.filter((track) => track.contentType === contentType);
  const items: Array<readonly [string, string]> = off ? [[OFF, 'Off']] : [];
  for (const track of available) items.push([track.id, trackLabel(track)]);
  return [items, tracks.active(contentType)?.id ?? OFF, available.length];
}

/** The audio menu. Hidden unless there is a choice to make. */
export const audioMenu: MenuFactory = ({ engine }) => {
  const control = menu({ name: 'audio', label: 'Audio', icon: 'music' });

  function render(): void {
    const [items, active, count] = trackItems(engine, 'audio', false);
    control.fill([
      {
        name: 'track',
        items,
        value: active,
        onSelect(value: string): void {
          engine.tracks.select(value);
          render();
        },
      },
    ]);
    control.root.hidden = count < 2;
  }

  const offs = [engine.on('tracks:changed', render), engine.on('tracks:selected', render)];
  render();

  return {
    root: control.root,
    dispose(): void {
      for (const off of offs) off();
      control.dispose();
    },
  };
};

/** An attribute's value where it is one of the choices, else the default. */
function choice(
  host: HTMLElement,
  attribute: string,
  choices: ReadonlyArray<readonly [string, string]>,
  fallback: string,
): string {
  const value = host.getAttribute(attribute);
  return value !== null && choices.some(([id]) => id === value) ? value : fallback;
}

/**
 * The subtitles menu, with "off" because a text selection is releasable
 * and an audio one is not, and a Settings page behind it with the size and
 * the background. The glyph says whether a track is on.
 */
export const textMenu: MenuFactory = ({ engine, host }) => {
  const control = menu({ name: 'text', label: 'Subtitles', icon: 'closed-captions' });

  function looks(
    attribute: string,
    name: string,
    label: string,
    choices: typeof SIZES,
    fallback: string,
  ): MenuGroup {
    return {
      name,
      label,
      items: choices,
      value: choice(host, attribute, choices, fallback),
      onSelect(value: string): void {
        host.setAttribute(attribute, value);
        render();
      },
    };
  }

  function render(): void {
    const [items, active, count] = trackItems(engine, 'text', true);
    control.fill([
      {
        name: 'track',
        label: 'Track',
        items,
        value: active,
        onSelect(value: string): void {
          if (value === OFF) engine.tracks.deselect('text');
          else engine.tracks.select(value);
          render();
        },
      },
      {
        name: 'settings',
        label: 'Settings',
        entries: [
          looks(SUBTITLE_SIZE, 'size', 'Size', SIZES, 'medium'),
          looks(SUBTITLE_BACKGROUND, 'background', 'Background', BACKGROUNDS, 'dark'),
        ],
      },
    ]);
    control.show(active === OFF ? 'closed-captions' : 'closed-captions-on');
    control.root.hidden = count === 0;
  }

  const offs = [engine.on('tracks:changed', render), engine.on('tracks:selected', render)];
  render();

  return {
    root: control.root,
    dispose(): void {
      for (const off of offs) off();
      control.dispose();
    },
  };
};

/** The name a viewer knows a key system by. */
function keySystemName(id: string): string {
  if (id.startsWith('com.widevine')) return 'Widevine';
  if (id.startsWith('com.microsoft.playready')) return 'PlayReady';
  if (id.startsWith('com.apple.fps')) return 'FairPlay';
  return id;
}

/** "3 keys: usable ×2, expired ×1", or "no key yet". */
function sessionsText(sessions: ReadonlyArray<{ readonly status: string }>): string {
  if (sessions.length === 0) return 'no key yet';
  const counts = new Map<string, number>();
  for (const session of sessions) counts.set(session.status, (counts.get(session.status) ?? 0) + 1);
  const parts: string[] = [];
  for (const [status, count] of counts) parts.push(count > 1 ? `${status} ×${count}` : status);
  return `${sessions.length} ${sessions.length === 1 ? 'key' : 'keys'}: ${parts.join(', ')}`;
}

/**
 * A lock over `engine.drm`, hidden until a key session opens and absent
 * without the EME stages. Hover or focus shows what it knows: the key
 * system, and the key sessions with their statuses.
 */
export const drmBadge: MenuFactory = ({ engine }) => {
  const drm = namespaces(engine).drm;
  const root = el('span', 'badge drm-badge');
  root.setAttribute('role', 'img');
  root.append(icon('lock-closed'));
  root.hidden = true;
  if (drm === undefined) return { root, dispose(): void {} };

  const tooltip = el('div', 'tooltip drm-tooltip');
  tooltip.setAttribute('role', 'tooltip');
  const system = el('div', 'tooltip-title drm-tooltip-title');
  const id = el('div', 'tooltip-text drm-tooltip-id');
  const keys = el('div', 'tooltip-text drm-tooltip-keys');
  tooltip.append(system, id, keys);
  tooltip.hidden = true;
  root.append(tooltip);
  root.tabIndex = 0;

  function render(): void {
    const name = drm?.keySystem ?? null;
    root.hidden = name === null;
    if (name === null) return;
    const sessions = drm?.sessions ?? [];
    system.textContent = keySystemName(name);
    id.textContent = name;
    keys.textContent = sessionsText(sessions);
    root.setAttribute(
      'aria-label',
      `Protected by ${keySystemName(name)}, ${sessionsText(sessions)}`,
    );
  }

  function show(): void {
    tooltip.hidden = false;
  }

  function hide(): void {
    tooltip.hidden = true;
  }

  root.addEventListener('pointerenter', show);
  root.addEventListener('pointerleave', hide);
  root.addEventListener('focus', show);
  root.addEventListener('blur', hide);
  const offs = [
    engine.on('drm:keysystem', render),
    engine.on('drm:keystatus', render),
    engine.on('drm:encrypted', render),
  ];
  render();

  return {
    root,
    dispose(): void {
      for (const off of offs) off();
      root.removeEventListener('pointerenter', show);
      root.removeEventListener('pointerleave', hide);
      root.removeEventListener('focus', show);
      root.removeEventListener('blur', hide);
    },
  };
};

/** By the name the layout knows them by. */
export const MENUS: Readonly<Record<string, MenuFactory>> = {
  subtitles: textMenu,
  audio: audioMenu,
  quality: qualityMenu,
  drm: drmBadge,
};
