import { MatteboxPlayerElement } from '@mattebox/player';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  document.body.replaceChildren();
});

describe('<mattebox-player>', () => {
  it('is registered on import', () => {
    expect(customElements.get('mattebox-player')).toBe(MatteboxPlayerElement);
  });

  it('upgrades with a native video in light DOM and its own shadow root', () => {
    document.body.innerHTML = '<mattebox-player></mattebox-player>';
    const player = document.querySelector('mattebox-player');
    expect(player).toBeInstanceOf(MatteboxPlayerElement);
    const video = player?.querySelector('video');
    expect(video).toBeInstanceOf(HTMLVideoElement);
    expect(video?.controls).toBe(true);
    expect((player as MatteboxPlayerElement).video).toBe(video);
    expect(player?.shadowRoot).not.toBeNull();
  });

  it('forwards autoplay, muted and poster as attributes', () => {
    document.body.innerHTML = '<mattebox-player muted poster="p.png"></mattebox-player>';
    const player = document.querySelector('mattebox-player') as MatteboxPlayerElement;
    expect(player.video.getAttribute('muted')).toBe('');
    expect(player.video.getAttribute('poster')).toBe('p.png');
    player.setAttribute('autoplay', '');
    expect(player.video.hasAttribute('autoplay')).toBe(true);
    player.removeAttribute('poster');
    expect(player.video.hasAttribute('poster')).toBe(false);
  });

  it('define() is idempotent', () => {
    expect(() => MatteboxPlayerElement.define()).not.toThrow();
  });
});
