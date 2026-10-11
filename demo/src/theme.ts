/**
 * The room, light or dark: one button, with the icon of the room in use.
 * The page follows the system until a choice is made, which is kept. Both
 * demo pages share it.
 */
/** The toggle's icons, the ones the website draws: a sun for light, a moon for dark. */
const SUN =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const MOON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';

export function wireTheme(button: HTMLButtonElement): void {
  const KEY = 'mattebox.demo.theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  function current(): 'light' | 'dark' {
    const set = document.documentElement.dataset.theme;
    if (set === 'light' || set === 'dark') return set;
    return system.matches ? 'dark' : 'light';
  }
  function paint(): void {
    const dark = current() === 'dark';
    button.innerHTML = dark ? MOON : SUN;
    const label = `Colour scheme: ${dark ? 'dark' : 'light'}. Switch to ${dark ? 'light' : 'dark'}`;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(dark));
  }
  button.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage may be unavailable; the room still changes.
    }
    paint();
  });
  // Follows the system until a choice is made.
  system.addEventListener('change', paint);
  paint();
}
