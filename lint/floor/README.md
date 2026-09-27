# The TV floor rules

Biome plugins that fail the lint on browser features newer than Chromium 76,
the floor of AGENTS.md rule 9. Chromium 76 is Samsung Tizen 6.0, the 2021
sets; LG webOS 6 is Chromium 79.

`biome.json` loads both files for the `src` of every package. The demo and
the tests run in current browsers and are not checked.

| File       | Checks                                           |
| ---------- | ------------------------------------------------ |
| `css.grit` | The CSS files: declarations, selectors, at-rules |
| `js.grit`  | The TypeScript: API calls                        |

Biome's own `useBaseline` rule does not do this job. It targets Baseline,
which follows every major browser, not Chromium 76, and it cannot tell a
flex `gap` from a grid `gap`.

## CSS rules

| Rule                                                               | Needs                | Instead                                                                                                                      |
| ------------------------------------------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `gap`, `row-gap`, `column-gap` in a flex container                 | Chromium 84          | Margins on the items. A rule with `display: grid` is skipped: a grid `gap` works from Chromium 66                            |
| `inset`, `inset-inline`, `inset-block`                             | Chromium 87          | `top`, `right`, `bottom` and `left`                                                                                          |
| `aspect-ratio`                                                     | Chromium 88          | A fixed size, or the rule under `@supports (aspect-ratio: 1)`, which the check allows                                        |
| A bare `:focus-visible`                                            | Chromium 86          | Style `:focus`, then remove it with `:focus:not(:focus-visible)`. An older browser drops a bare rule and shows no focus ring |
| `:is()`, `:where()`, `:has()`                                      | Chromium 88, 105     | List the selectors                                                                                                           |
| `min()`, `max()`, `clamp()`                                        | Chromium 79          | A fixed value, or a media query                                                                                              |
| `color-mix()`                                                      | Chromium 111         | The mixed colour, written out                                                                                                |
| `margin-inline`, `padding-inline`, `margin-block`, `padding-block` | Chromium 87          | The sides. The single sides, such as `margin-inline-start`, need only 69                                                     |
| `translate`, `scale`, `rotate` as properties                       | Chromium 104         | `transform`                                                                                                                  |
| `overflow: clip`                                                   | Chromium 90          | `overflow: hidden`                                                                                                           |
| `accent-color`                                                     | Chromium 93          | Style the control                                                                                                            |
| `text-wrap`                                                        | Chromium 114         | Nothing: leave the text to wrap                                                                                              |
| `@container`, `@layer`, `@property`                                | Chromium 105, 99, 85 | Media queries, source order, a plain custom property                                                                         |

A declaration reports on its line. A selector reports on its whole rule.

## JavaScript rules

| Call                            | Needs        | Instead                                      |
| ------------------------------- | ------------ | -------------------------------------------- |
| `node.replaceChildren(…)`       | Chromium 86  | `setChildren()` from the package's `dom.ts`  |
| `text.replaceAll(a, b)`         | Chromium 85  | `replace()` with a global regular expression |
| `list.at(index)`                | Chromium 92  | `list[list.length - n]`                      |
| `structuredClone(value)`        | Chromium 98  | A copy by hand                               |
| `Object.hasOwn(object, key)`    | Chromium 93  | `Object.prototype.hasOwnProperty.call()`     |
| `findLast()`, `findLastIndex()` | Chromium 97  | A loop from the end                          |
| `toSorted()`, `toReversed()`    | Chromium 110 | `sort()` or `reverse()` on a copy            |
| `Promise.any(list)`             | Chromium 85  | `Promise.all` over caught promises           |
| `AbortSignal.timeout(ms)`       | Chromium 103 | An `AbortController` and `setTimeout`        |
| `node.checkVisibility()`        | Chromium 105 | `getClientRects().length > 0`                |

Syntax such as `?.` and `??` is not checked. The default build lowers it to
ES2015.

## Adding a rule

Each file is one GritQL `or`, and each branch registers its own diagnostic.
A branch for a CSS declaration matches it by name:

```grit
`inset: $v` as $m where {
  register_diagnostic(span=$m, message="inset needs Chromium 87. …")
}
```

Regular expressions in GritQL bind a variable for each capturing group, so
write groups as `(?:…)`. Start a pattern on a whole rule with `(?s).*`, as
the existing ones do.

Biome loads plugins by file, not by folder or pattern. A new rule goes into
one of the two files, so `biome.json` stays as it is.
