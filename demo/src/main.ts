// The demo page. The source rows arrive with the core; for now the page
// upgrades the element and plays one progressive mp4 through the video's
// native path, the same thing the native handler will do.
import '@mattebox/player';
import type { MatteboxPlayerElement } from '@mattebox/player';
// Imported, not referenced from the HTML: the file lives outside the demo
// root, and only an import gives it a URL the dev server and the build serve.
import logoUrl from '../../docs/logo.svg';

const SOURCE = {
  url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
  kind: 'Progressive mp4',
  handler: 'native (video.src, until the core ships)',
};

for (const img of document.querySelectorAll<HTMLImageElement>('img.logo')) img.src = logoUrl;
for (const icon of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')) {
  icon.href = logoUrl;
}

const player = document.getElementById('player') as MatteboxPlayerElement;
player.video.setAttribute('aria-label', 'Mattebox player');
player.video.src = SOURCE.url;

const row = document.createElement('tr');
for (const text of [SOURCE.url, SOURCE.kind, SOURCE.handler]) {
  const cell = document.createElement('td');
  cell.textContent = text;
  row.append(cell);
}
document.querySelector('#sources tbody')?.append(row);
