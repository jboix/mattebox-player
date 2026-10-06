/**
 * <mbx-drm-badge>: a lock over `engine.drm`, or over `session.eme.drm`
 * for a native session that attached DRM, hidden until a key system is
 * known and for a session without the EME stages. Hover or focus shows
 * what it knows: the key system, and the key sessions with their
 * statuses. The glyph is `icon`; the name comes from `label`, where
 * `{system}` is the key system's name and `{keys}` the sessions:
 * "Protected by {system}, {keys}". The sessions read from `label-keys`
 * with `{count}` and `{statuses}`, `label-key` for one, `label-no-key`
 * for none.
 */

import type { DrmApi } from 'mattebox/eme';
import { icon } from '../controls/icons.js';
import { el } from '../dom.js';
import type { PlayerHost } from '../host.js';
import { fill } from '../labels.js';
import { namespaces } from '../namespaces.js';
import { Component } from './component.js';
import STYLE from './drm-badge.css?inline';
import { style } from './shared.js';

/** The name a viewer knows a key system by. */
function keySystemName(id: string): string {
  if (id.startsWith('com.widevine')) return 'Widevine';
  if (id.startsWith('com.microsoft.playready')) return 'PlayReady';
  if (id.startsWith('com.apple.fps')) return 'FairPlay';
  return id;
}

export class MbxDrmBadge extends Component {
  static get observedAttributes(): readonly string[] {
    return ['label', 'label-key', 'label-keys', 'label-no-key'];
  }

  declare private readonly tooltip: HTMLElement;
  declare private readonly system: HTMLElement;
  declare private readonly system_id: HTMLElement;
  declare private readonly keys: HTMLElement;
  declare private drm: DrmApi | undefined;

  constructor() {
    super();
    this.drm = undefined;
    const root = this.attachShadow({ mode: 'open' });
    const slot = document.createElement('slot');
    slot.name = 'icon';
    slot.append(icon('lock-closed'));
    this.tooltip = el('div', 'tooltip');
    this.tooltip.setAttribute('role', 'tooltip');
    this.system = el('div', 'tooltip-title');
    this.system_id = el('div', 'tooltip-text');
    this.keys = el('div', 'tooltip-text');
    this.tooltip.append(this.system, this.system_id, this.keys);
    this.tooltip.hidden = true;
    root.append(style(STYLE), slot, this.tooltip);
    const show = (): void => {
      this.tooltip.hidden = false;
    };
    const hide = (): void => {
      this.tooltip.hidden = true;
    };
    this.addEventListener('pointerenter', show);
    this.addEventListener('pointerleave', hide);
    this.addEventListener('focus', show);
    this.addEventListener('blur', hide);
  }

  /** Named and focusable before attaching: a constructor must not add attributes. */
  override connectedCallback(): void {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'img');
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    if (this.player === null) this.hidden = true;
    super.connectedCallback();
  }

  /** "3 keys: usable ×2, expired", or "no key yet". */
  private sessionsText(sessions: ReadonlyArray<{ readonly status: string }>): string {
    if (sessions.length === 0) return this.getAttribute('label-no-key') ?? 'no key yet';
    const counts = new Map<string, number>();
    for (const session of sessions) {
      counts.set(session.status, (counts.get(session.status) ?? 0) + 1);
    }
    const parts: string[] = [];
    for (const [status, count] of counts) parts.push(count > 1 ? `${status} ×${count}` : status);
    const template =
      sessions.length === 1
        ? (this.getAttribute('label-key') ?? '{count} key: {statuses}')
        : (this.getAttribute('label-keys') ?? '{count} keys: {statuses}');
    return fill(template, { count: sessions.length, statuses: parts.join(', ') });
  }

  protected override attach(player: PlayerHost): void {
    this.follow(player, (engine) => {
      // The engine's DRM, or the attachment a native session made: one API, the same events.
      const eme = player.player?.session?.eme;
      const source = engine ?? eme;
      this.drm = engine === null ? eme?.drm : namespaces(engine).drm;
      this.render();
      if (source === undefined || this.drm === undefined) return undefined;
      const tick = (): void => {
        this.render();
      };
      const offs = ['drm:keysystem', 'drm:keystatus', 'drm:encrypted'].map((event) =>
        source.on(event, tick),
      );
      return () => {
        for (const off of offs) off();
      };
    });
  }

  protected override detach(): void {
    this.tooltip.hidden = true;
  }

  protected override render(): void {
    const drm = this.drm;
    const name = drm?.keySystem ?? null;
    this.hidden = name === null;
    if (drm === undefined || name === null) return;
    const keys = this.sessionsText(drm.sessions);
    const system = keySystemName(name);
    this.system.textContent = system;
    this.system_id.textContent = name;
    this.keys.textContent = keys;
    this.setAttribute(
      'aria-label',
      fill(this.getAttribute('label') ?? 'Protected by {system}, {keys}', { system, keys }),
    );
  }
}
