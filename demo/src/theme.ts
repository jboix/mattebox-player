/**
 * The room, light or dark: one button, naming the room it would switch to.
 * The page follows the system until a choice is made, which is kept. Both
 * demo pages share it.
 */
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
    button.textContent = dark ? '☀ Light' : '☾ Dark';
    button.title = `Switch to the ${dark ? 'light' : 'dark'} room`;
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
