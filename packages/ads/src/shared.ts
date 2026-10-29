/**
 * What the ad elements share: their style, the text of a template, and the
 * time of the ad. The tokens come through the `--mbx-*` custom properties
 * the player sets, which inherit into every control.
 */
import AD_CSS from './ad.css?inline';

/** A `<style>` with the ad elements' style and the element's own placement. */
export function style(placement: string): HTMLStyleElement {
  const node = document.createElement('style');
  node.textContent = `${AD_CSS}:host{${placement}}`;
  return node;
}

/** `text` with each `{name}` replaced by its value. */
export function fill(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}

/** `m:ss`, the time an ad counts down in. */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
