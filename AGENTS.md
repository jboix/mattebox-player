# AGENTS.md — Standing instructions for the Mattebox player

Place this at the repository root. It applies to every deliverable.

---

## What this project is

The **Mattebox player** is two packages in one npm workspace over the
`mattebox` engine: `@mattebox/player-core` (the headless handler chain) and
`@mattebox/player` (the `<mattebox-player>` custom element). Read
`docs/architecture.md` before doing anything.

The player exists for two reasons in this order. First, to put its author in
the shoes of an integrator of the engine and find every place the engine's
API is awkward, missing, or wrong. Second, to be a usable player. When the two
conflict, the first wins: write the awkward code, and say in a comment what
you had to reach around.

> The design record (`docs/specs/` of the engine repository) is maintained
> locally by the project owner and is not part of this repository. The
> player's prompt is chapter 18 of that record.

## Non-negotiable rules

1. **The boundary is strict.** The core never imports the UI. The UI never
   bypasses the core to talk to the engine about source selection.
   `dependency-cruiser` enforces the import direction.

2. **Runtime dependencies are the engine and the core.** Nothing else.
   The engine is a peer of both packages; the core is a dependency of the
   element. Do not add a dependency to work around a problem.

3. **The element stays native.** Never forward or wrap an `HTMLMediaElement`
   member. Play, pause, seek, volume, buffered, native controls,
   Picture-in-Picture, media session: all on the video.

4. **No side effects in the core.** `sideEffects: false` is audited: importing
   the built core creates no global and registers nothing. The element
   package registers `<mattebox-player>` on import and nothing else.

5. **No normalization over native.** `session.engine` is null for native
   playback and the UI feature-tests. Native sessions have no diagnostics
   beyond the element's `MediaError`; do not invent any.

6. **No player-level registry, no plugin API, no skin system, no framework.**
   A player is per element, like an engine. The controls are custom elements
   the page places inside `<mattebox-player>`, and the browser's element
   registry is the one extension point: a page's own element inside the bar
   is a control. See `docs/v3-composable-controls-plan.md`.

7. **Do not fix the engine from here.** A missing engine surface is an entry
   in the integrator log, not a workaround that hides the gap.

8. **Banned TypeScript:** non-const `enum`, `namespace`, parameter properties,
   decorators. The emit check enforces this.

## Before writing code

- Read the engine's guide chapters 01, 02, 03, 09, and 14, and its
  `docs/architecture.md`. The rules the engine fixed bind the player.
- Check `packages/core/src/types.ts`. The three concepts are fixed: `Source`,
  `Handler`, `Session`. Do not invent parallel types.

## While writing code

- Explicit `.js` extensions in all import specifiers.
- `import type` for type-only imports.
- Comments explain **why**. Cite the engine's guide chapter when a rule comes from it.
- Every time you write code that works around the engine, say so in a
  comment where it happens: what you wanted to do, what you had to do
  instead, and which engine surface would have made it one call.

## Writing

Documentation, comments, commit messages, and user-facing strings use direct language.

- Write plain declarative sentences. State the fact, then at most one sentence of why.
- No em-dashes. Use commas, colons, parentheses, periods.
- No rambling, aphorisms, or clever turns. No "X is what makes Y"; write the fact or "Y because X".
- No idioms or unusual verbs. Name things for what they are. No cute jargon.
- One fact per bullet. Paragraphs of one to three short sentences.
- Reference docs carry no essays. A one-line table entry is the documentation; add a section only when asked.

## Before declaring a deliverable complete

Run every gate and paste the **actual output** into the handoff report:

```bash
npm run verify        # every gate, in CI's order
npm run test:e2e      # the demo page in three browsers
```

## Handoff report format

End every deliverable with:

```markdown
## Deliverable N Handoff

### Built
<file-by-file summary>

### Definition of Done
- [x] item — evidence
- [ ] item — why not

### Deviations from the prompt
<what, why, and whether docs need updating>

### Decisions not covered by the prompt
<anything you had to choose; flag for human review>

### Gate output
<actual command output, pasted>

### Integrator log
<the entries added, ordered by how much each hurt>
```

## Scope discipline

**Do not build ahead.** The deliverables are ordered so a human can review
incrementally; building ahead defeats that and makes review impossible.

If you believe a deliverable's scope is wrong, say so in the handoff report
and stop. Do not expand scope unilaterally.

## When the prompt is wrong or silent

The prompt encodes decisions the engine made, often for non-obvious reasons.
If something seems wrong:

1. Check the engine's guide; the option may already be decided there.
2. If still wrong, implement what you believe is correct, and **document the
   deviation prominently** in the handoff report.
3. Never silently deviate.
