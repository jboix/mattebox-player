/**
 * The part of WebXR the headset view uses, typed here because TypeScript's
 * DOM library has none of it. The names follow the WebXR Device API:
 * https://www.w3.org/TR/webxr/
 *
 * Everything is detected before use. A browser without WebXR, which is
 * most of them and every TV, never reaches past `headsets()`.
 */

/** One eye of the viewer: where it looks from and its frustum (XRView). */
export interface XRView {
  readonly projectionMatrix: Float32Array;
  readonly transform: { readonly matrix: Float32Array };
}

/** One frame of an immersive session (XRFrame). */
export interface XRFrame {
  getViewerPose(space: unknown): { readonly views: readonly XRView[] } | null;
}

/** The WebGL layer a session draws into (XRWebGLLayer). */
export interface XRLayer {
  readonly framebuffer: WebGLFramebuffer | null;
  getViewport(view: XRView): {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  } | null;
}

/** An immersive session (XRSession). It fires `end`. */
export interface XRSession extends EventTarget {
  updateRenderState(state: { readonly baseLayer: XRLayer }): void;
  requestReferenceSpace(type: 'local'): Promise<unknown>;
  requestAnimationFrame(callback: (time: number, frame: XRFrame) => void): number;
  end(): Promise<void>;
}

/** `navigator.xr` (XRSystem). It fires `devicechange`. */
interface XRSystem extends EventTarget {
  isSessionSupported(mode: 'immersive-vr'): Promise<boolean>;
  requestSession(mode: 'immersive-vr'): Promise<XRSession>;
}

/** The layer's constructor, on `window` where the browser has WebXR. */
export type XRLayerConstructor = new (session: XRSession, gl: WebGLRenderingContext) => XRLayer;

/** WebGL's `makeXRCompatible()`, on a context where the browser has WebXR. */
type Compatible = WebGLRenderingContext & { makeXRCompatible?: () => Promise<void> };

/** `navigator.xr` and the layer's constructor, or null where either is missing. */
export function webxr(): { readonly xr: XRSystem; readonly Layer: XRLayerConstructor } | null {
  const xr = (navigator as { xr?: XRSystem }).xr;
  const Layer = (window as { XRWebGLLayer?: XRLayerConstructor }).XRWebGLLayer;
  return xr === undefined || typeof Layer !== 'function' ? null : { xr, Layer };
}

/**
 * Whether a headset can show an immersive VR session now. False without
 * WebXR, and where asking fails: a page in a frame without the `xr-spatial-tracking`
 * permission policy rejects the question.
 */
export function headsets(): Promise<boolean> {
  const api = webxr();
  if (api === null) return Promise.resolve(false);
  return api.xr.isSessionSupported('immersive-vr').catch(() => false);
}

/**
 * Makes the context able to draw into a headset. On a computer with two
 * GPUs the browser may move the context to the headset's GPU, which loses
 * and restores it:
 * https://www.w3.org/TR/webxr/#dom-webglrenderingcontextbase-makexrcompatible
 * `<mbx-360>` builds its sphere again on `webglcontextrestored`.
 */
export function compatible(gl: WebGLRenderingContext): Promise<void> {
  return (gl as Compatible).makeXRCompatible?.() ?? Promise.resolve();
}
