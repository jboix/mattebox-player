# Stability and versions

The packages are at version 0.x. Each one has its own version. This page
says what you can rely on now, what version 1.0 promises, and what changes
before it.

## Before 1.0

- A patch release fixes bugs. It changes no API.
- A minor release adds features. It can also change or remove an API. The
  release notes name the change.
- Use a tilde range, such as `~0.9.0`, if you review each minor release
  before you take it.
- `@mattebox/player` names the `mattebox` engine versions it works with
  in its peer dependency. Keep both inside those ranges.

## The public API

You can rely on these, within the rules above:

| Surface                                                                   | Where                                                 |
| ------------------------------------------------------------------------- | ----------------------------------------------------- |
| The `<mattebox-player>` attributes, properties, and events                | [Chapter 03](guide/03-the-element.md)                 |
| The control elements, their attributes, parts, and CSS custom properties  | [Chapter 03](guide/03-the-element.md#the-controls)    |
| The handler chain and the `Handler` contract of `@mattebox/player-core`   | [Chapter 02](guide/02-handlers.md)                    |
| The CDN file names, the `matteboxPlayer` global, and the integrity hashes | [Chapter 04](guide/04-cdn.md)                         |
| The diagnostics elements and the report format                            | [Chapter 05](guide/05-diagnostics.md)                 |
| The spatial navigation and remote keys                                    | [Chapter 06](guide/06-tv.md)                          |
| The playlist element and its events                                       | [Chapter 07](guide/07-playlist.md)                    |
| The browsers the element runs in                                          | [Chapter 03](guide/03-the-element.md#browser-support) |

These are not a promise:

- The markup inside the element's shadow root. Style it through its parts
  and custom properties.
- The default labels and icons. A minor release can reword a label.
- The bundle size of a package.

## What 1.0 promises

- Version numbers follow [Semantic Versioning](https://semver.org/). Only a
  major release changes or removes a public API.
- A deprecated attribute, property, or event keeps working for at least
  two minor releases. The guide and the release notes name its
  replacement.
- A change to a default that changes what plays or what the viewer sees,
  such as the controls shown, counts as a change of API.

## What changes before 1.0

These are expected to change. Each change ships in a minor release.

| API                     | Expected change                                                        |
| ----------------------- | ---------------------------------------------------------------------- |
| Error screens           | Reason codes for a blocked or unavailable stream, with localized texts |
| Labels                  | Shipped locales beside English                                         |
| Preferences             | The viewer's volume, captions, and audio language kept between visits  |
| Source fallback         | Fallback after playback started, and alternate streams                 |
| Analytics               | Adapters that report playback to an analytics service                  |
| `@mattebox/player-cast` | DRM and signed URLs forwarded to the receiver                          |

## Reporting a break

If a patch release breaks your page, or a minor release breaks it without a
note, [open an issue](https://github.com/jboix/mattebox-player/issues/new/choose).
That is a bug.
