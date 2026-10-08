---
name: setup
description: Configure which Claude model pstack uses per role and at what effort budget. Writes ~/.claude/pstack-models.md, which every pstack skill reads and which overrides the skill defaults. Use for /pstack:setup, "configure pstack models", "pstack budget", or changing pstack's model choices.
disable-model-invocation: true
---

# Setup pstack

Write `~/.claude/pstack-models.md`, a small file that sets pstack's model and effort per role. Every pstack skill reads it before spawning a subagent and falls back to its own defaults when the file or a line is missing.

## Steps

### 1. Confirm the available models

The `Agent` tool accepts `haiku`, `sonnet`, `opus`, and `fable`, plus `inherit`, which omits `model` so the subagent runs on the parent chat's model. `fable` needs account access. Ask the user once, with AskUserQuestion, whether `fable` is available to them. Never write a model name outside this set.

### 2. Load current state

If `~/.claude/pstack-models.md` exists, read it and treat its `# budget` line and its role values as the current choices. Otherwise start from the defaults in step 5. A line whose role is not in step 5 is from a retired role. Drop it and list it in step 3c.

### 3. Budget, map, and confirm

**(a) Ask for a budget.** Prefer AskUserQuestion over free text. Offer these four options with these exact labels, and name the current budget when the file records one. With no file, say that `large` matches the skill defaults.

- `unlimited — max effort`
- `large — xhigh effort`
- `medium — high effort`
- `small — medium effort`

**(b) Apply it.** The budget sets the effort every pstack spawn passes in the Agent tool's `effort` field: `unlimited` is `max`, `large` is `xhigh`, `medium` is `high`, `small` is `medium`. It also nudges the model table. `unlimited` moves `hardest tasks` to `fable` when the user has it. `small` moves the code roles (`feature, refactoring`, `bug-fix`, `perf-issue`, `hillclimb`, `swarm workers`, `how explorer`, `why investigators`, `reflect tooling`) to `haiku`. `large` and `medium` keep the defaults. On a re-run, keep any role the user changed by hand.

**(c) Show the roles and confirm.** Show every role with its model. List each line step 2 dropped. Ask whether to accept as-is or change specific roles, offering the available models plus `inherit`. Prefer AskUserQuestion over free text. For panel roles (`arena runners`, `architect runners`, `interrogate reviewers`) the value is a list, and one subagent runs per entry, alias entries included, so the list length sets the count. `arena cross-judge pool` is also a list, but Arena selects one value from it whose model differs from the parent's when possible. `swarm workers` is the default model for every worker unless a race or comparison assigns another model per arm.

### 4. Validate

Every model written must be one of `haiku`, `sonnet`, `opus`, `fable`, or `inherit`. The budget's effort must be one of `max`, `xhigh`, `high`, `medium`, or `low`. Otherwise stop and ask again.

### 5. Write the file

Overwrite `~/.claude/pstack-models.md` so re-runs stay idempotent. Shape:

```
# pstack model configuration. One line per role. Delete a line to fall back to the skill default.
# `inherit` as a value: the role runs on the parent chat model (omit `model`). Alias entries in a panel list still count toward its fan-out.
# budget: large (xhigh)
feature, refactoring: sonnet
bug-fix: sonnet
perf-issue: sonnet
hillclimb: sonnet
judgment and prose: opus
hardest tasks: opus
how explorer: sonnet
how explainer: opus
why investigators: sonnet
why synthesizer: opus
reflect tooling: sonnet
reflect judgment, divergent, synthesizer: opus
arena runners: opus, sonnet
arena cross-judge pool: opus, sonnet
swarm workers: sonnet
architect runners: opus, sonnet
interrogate reviewers: opus, sonnet
```

### 6. Confirm

Tell the user the file was written and that it applies to new sessions. Re-running this skill updates it.

### 7. Offer to keep the mode on (optional)

Check the project's `CLAUDE.md` for a `/pstack:mode` line. If there is none, offer once: "want `/pstack:mode` on for every task in this repo? I can add `Use /pstack:mode for any non-trivial task.` to CLAUDE.md." On yes, append that line. On no, mention the `pstack-mode-pin` plugin once and move on.

### 8. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof: a `verify-*` skill under `.claude/skills/`, or an existing harness such as Playwright specs or a PTY script. If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /pstack:create-verification-skill." On yes, invoke the `pstack:create-verification-skill` skill. On no, move on without pushing.
