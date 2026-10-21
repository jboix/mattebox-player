# Accessibility

`<mattebox-player>` aims to meet [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
at level AA. Nobody has audited it by hand, so this is the goal the tests
check against, not a claim of conformance.

The player covers its own controls. Your page, its colours and the controls
you add yourself are yours to check.

## How it is checked

- axe-core checks the controls of every package for WCAG 2.0, 2.1 and 2.2 A and AA, in Chromium, Firefox and WebKit: the player before the first play, while it plays, with the speed and subtitles menus open and on the error screen, the diagnostics panel on each page, the playlist closed and open, and the cast button and screen.
- Browser tests check that every control has a name and that every glyph is hidden from the accessibility tree, in Chromium, Firefox and WebKit.
- Browser tests check the keyboard: every control is reachable, and the shortcuts, sliders and menus answer their keys.
- Biome's accessibility lint rules run on the code.

## What the player does

- Every control is reachable with the keyboard, and every control has a name. The sliders announce their value in words.
- The shortcuts work from every control while focus is inside the player. [The element](guide/03-the-element.md) lists them.
- A visible focus ring shows on keyboard focus.
- The bar stays visible while keyboard focus is inside it.
- The bar's fade, the spinner and the animations of the start, live, marker and volume controls follow the system's reduce motion setting.
- The subtitles menu sets the subtitle size and background.
- The audio and subtitles menus mark audio description (AD), subtitles for the deaf and hard of hearing (SDH) and closed captions (CC). A screen reader reads each badge's full name.
- A live region says a play, a pause, a long wait, a fatal error and a track change to a screen reader. `announce="off"` turns it off.
- Every label is an attribute, so you can translate what a screen reader says.
- `@mattebox/player-spatial-nav` moves focus with the arrow keys of a TV remote.

## Known limitations

- axe-core finds part of the WCAG issues, about 57% by its maker Deque's count. The rest needs a review by hand, which has not been done.
- The default labels are English only.
- VoiceOver, TalkBack, NVDA and JAWS have not been tested by hand.
- Windows high contrast mode (forced colours) has not been checked.
- Image subtitles are pictures. A screen reader cannot read them, and the subtitle size and background do not change them.

## Report a barrier

[Open an accessibility issue](https://github.com/jboix/mattebox-player/issues/new?template=03_accessibility.yml)
and say what stopped you, on which control, with which device, browser and
assistive technology. Every report is read. There is no fixed timeline for
a fix.
