/**
 * The subpath entries, in a file of their own: browser test files run in
 * isolation, so what this one registers is only what it imports.
 */
import { MatteboxPlayerElement } from '@mattebox/player/element';
import { MbxControlBar } from '@mattebox/player/elements/control-bar';
import { MbxPlayButton } from '@mattebox/player/elements/play-button';
import { nativeHandler } from '@mattebox/player-core';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  document.body.replaceChildren();
});

describe('the subpath entries', () => {
  it('register the player and the controls imported, and nothing else', () => {
    expect(customElements.get('mattebox-player')).toBe(MatteboxPlayerElement);
    expect(customElements.get('mbx-control-bar')).toBe(MbxControlBar);
    expect(customElements.get('mbx-play-button')).toBe(MbxPlayButton);
    expect(customElements.get('mbx-mute-button')).toBeUndefined();
    expect(customElements.get('mbx-seek-bar')).toBeUndefined();
  });

  it('serve a composition the page writes from what it imported', async () => {
    const player = new MatteboxPlayerElement({ handlers: [nativeHandler()] });
    player.setAttribute('controls', 'custom');
    player.innerHTML = '<mbx-control-bar><mbx-play-button></mbx-play-button></mbx-control-bar>';
    document.body.append(player);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const button = player.querySelector('mbx-play-button');
    expect(button).toBeInstanceOf(MbxPlayButton);
    expect(button?.shadowRoot?.querySelector('button')?.getAttribute('aria-label')).toBe('Play');
    // The page's own bar, and no default beside it.
    expect(player.querySelectorAll('mbx-control-bar').length).toBe(1);
  });
});
