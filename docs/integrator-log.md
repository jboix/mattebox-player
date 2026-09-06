# Integrator log

Every place the player had to reach around the engine, ordered by how much
each entry hurt. Each entry states what the player wanted to do, what it had
to do instead, and which engine surface would have made it one call. This
file goes back to the engine as its next roadmap; the engine is never fixed
from this repository.

| # | Wanted                                                                 | Had to                                                                                                    | Engine surface that would fix it                                                |
| - | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1 | Import the `Preset` type from `mattebox` to type the handler's option. | Import it from a preset subpath (`mattebox/presets/dual`), which reads as if the type belonged to `dual`. | Export `Preset`, `PresetOptions`, and `PresetStageOptions` from the root entry. |
