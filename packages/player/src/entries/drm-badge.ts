/** `@mattebox/player/elements/drm-badge`: registers <mbx-drm-badge>, and the player with it. */
import '../element-entry.js';
import { MbxDrmBadge } from '../elements/drm-badge.js';
import { DRM_BADGE } from '../tags.js';

if (customElements.get(DRM_BADGE) === undefined) customElements.define(DRM_BADGE, MbxDrmBadge);

export { MbxDrmBadge };
