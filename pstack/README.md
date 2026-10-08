# pstack

This is a Claude Code port of [pstack](https://github.com/cursor/plugins/tree/main/pstack) by [Lauren Tan](https://x.com/poteto), who built it from the skills she uses daily at Cursor and on the React core team. Her framing stands: there is a growing sense that AI writes too much slop code. Throughput without quality is not the goal. If you want to go fast, go deep first.

**pstack is the answer.** It turns one agent into an engineering team that reproduces before fixing, designs before coding, proves before reporting, and cleans before committing. The goal is not to maximize lines of code. It is the opposite. pstack helps you write less, but higher quality code.

**pstack gives you fearless parallelism.** When you can go deep on one agent and trust it to write good, verifiable code, you can parallelize with confidence. Start several worktree-isolated subagents with `/pstack:mode` and trust that they apply the same principles.

**This port keeps the shape and swaps the plumbing.** Cursor's `Task` became Claude Code's `Agent`, cloud agents became worktree subagents, Custom Modes became a `CLAUDE.md` line or the `pstack-mode-pin` hook, and the model panel is `opus` and `sonnet`. [`PORTING.md`](../PORTING.md) lists every change.

Fork it. Improve it. Make it yours. PRs are welcome.

## Install

```text
/plugin marketplace add <owner>/pstack-claude
/plugin install pstack@pstack-claude
```

For a local checkout, `claude --plugin-dir ./pstack-claude/pstack`.

## Get started

Two steps:

1. Run [`/pstack:setup`](./skills/setup/SKILL.md), pick an effort budget, and choose which models you want per role.
2. Use [`/pstack:mode`](./skills/mode/SKILL.md) whenever you're doing anything that requires rigor.

New here? The [pstack guide](./docs/guide/README.md) walks you through a first real task, from setup and prompting through verification and overnight runs. Stuck, or unsure which skill fits? Ask [`/pstack:ask`](./skills/ask/SKILL.md).

That's it. The other skills are situational; the mode skill uses them for you as needed. Out of the box the mode splits work by model strength: code delegates (feature, refactoring, bug fix, perf, hillclimb) go to `sonnet`, while the hardest changes, prose, and judgment go to `opus`. The default review panel is `opus` and `sonnet`. [`/pstack:setup`](./skills/setup/SKILL.md) changes any of it, including `fable` for the hardest tasks when your account has it.

## Usage

Use [`/pstack:mode`](./skills/mode/SKILL.md) at the start of a task. It reads your request, picks from a set of playbooks, and runs the other skills as the steps need them.

```text
/pstack:mode this pr has a subtle bug where the scroll drifts every 750ms even when idle. repro first, then fix and verify.
```

```text
/pstack:mode i'm going to bed. land the stack even if ci flakes. i want everything merged by morning.
```

<details>
<summary>the twenty-three playbooks</summary>

| playbook | for |
|---|---|
| [investigation](./skills/mode/playbooks/investigation.md) | a read-only question. how does x work, why was y built this way, are we sure. |
| [bug fix](./skills/mode/playbooks/bug-fix.md) | reproduce a defect, root-cause it, and fix with runtime evidence. |
| [perf](./skills/mode/playbooks/perf-issue.md) | trace a measured slowness and improve it against a baseline. |
| [hillclimb](./skills/mode/playbooks/hillclimb.md) | sustained, scientific improvement of one metric against a target, one commit per accepted win. |
| [runtime forensics](./skills/mode/playbooks/runtime-forensics.md) | diagnose a live symptom (leak, idle-cpu spin, glitch) from instrumentation. |
| [trace forensics](./skills/mode/playbooks/trace-forensics.md) | diagnose a captured profiling artifact (cpuprofile, trace, spindump, heap snapshot). |
| [feature](./skills/mode/playbooks/feature.md) | new or changed behavior, built from a named data shape. |
| [refactoring](./skills/mode/playbooks/refactoring.md) | a behavior-preserving change to structure or shape. |
| [prototype](./skills/mode/playbooks/prototype.md) | a throwaway sketch to make a design or behavioral decision cheaply. |
| [visual parity](./skills/mode/playbooks/visual-parity.md) | pixel-exact ui equivalence between two implementations. |
| [authoring a skill](./skills/mode/playbooks/authoring-a-skill.md) | writing or editing a SKILL.md. |
| [eval](./skills/mode/playbooks/eval.md) | test how a skill or prompt change affects agent behavior, blinded. |
| [babysit](./skills/mode/playbooks/babysit.md) | drive a pr or a stack to merge-ready: conflicts, review threads, ci. |
| [shipping](./skills/mode/playbooks/shipping.md) | independently verify a green stack, then land the contiguous verified run bottom-up through `gh`. |
| [autonomous run](./skills/mode/playbooks/autonomous-run.md) | drive a long task to completion without stopping. |
| [orchestrate](./skills/mode/playbooks/orchestrate.md) | a standing project handed to one coordinator chat: multi-day, many stacked prs, fleets of subagents. |
| [autopilot-full](./skills/mode/playbooks/autopilot-full.md) | run independent prs to merged with one owner per pr and a root swarm verdict on each round. |
| [autopilot-stack](./skills/mode/playbooks/autopilot-stack.md) | build and verify one linear base-branch stack for the operator to review and land. |
| [session pickup](./skills/mode/playbooks/session-pickup.md) | resume or take over a prior agent's in-flight work. |
| [pause safely](./skills/mode/playbooks/pause-safely.md) | suspend in-flight work cleanly so it can be resumed later. |
| [multi-phase plan](./skills/mode/playbooks/multi-phase-plan.md) | work that spans phases or stacked PRs. |
| [worktree cleanup](./skills/mode/playbooks/worktree-cleanup.md) | reclaim disk by pruning merged or abandoned worktrees and stale ios simulators, safety-gated. |
| [opening a pr](./skills/mode/playbooks/opening-a-pr.md) | open a ready pr from small ordered commits. invoked at the end of every other playbook. |

</details>

When invoked it:

1. matches your task to a [playbook](./skills/mode/playbooks/) and opens a todo list whose first items are its steps, copied in verbatim.
2. routes to the other skills as the steps fire.
3. writes unslopped replies framed for the consumer and the maintainer.

The full rules and playbooks live in [`skills/mode/SKILL.md`](./skills/mode/SKILL.md).

To keep `/pstack:mode` on across turns, add `Use /pstack:mode for any non-trivial task.` to the project's `CLAUDE.md`, or install the `pstack-mode-pin` plugin from the same marketplace. Either stays out of casual turns. Say so to opt out.

`/pstack:mode` works well with Claude Code's `/loop` skill. You can make Claude Code work for many hours without sacrificing rigor.

## Skills

[`/pstack:mode`](./skills/mode/SKILL.md) runs most of these for you when a step needs them (`how`, `why`, `architect`, `arena`, `swarm`, `interrogate`, `unslop`, `deslop`, `no-comments`, `technical-writing`, `tdd`, and the principles). The table below is for when you want one directly:

```text
/pstack:how do we cancel runs? do we have an n+1 when we look up every run to cancel?
```

```text
/pstack:interrogate review this pr.
```

<details>
<summary>all skills</summary>

| skill | use it when |
|---|---|
| [`/pstack:mode`](./skills/mode/SKILL.md) | default entry point for any non-trivial task. |
| [`/pstack:ask`](./skills/ask/SKILL.md) | you're new to pstack, or unsure which skill, playbook, or principle fits. answers, and hands you a prompt to type. |
| [`/pstack:how`](./skills/how/SKILL.md) | you want a walkthrough of how a subsystem works. |
| [`/pstack:why`](./skills/why/SKILL.md) | you want to know why something was built this way. queries every evidence category your MCP servers expose, in parallel. |
| [`/pstack:recall`](./skills/recall/SKILL.md) | you're starting or resuming work and want your recent context on a topic rebuilt from your own sessions and the shared record. |
| [`/pstack:blast-radius`](./skills/blast-radius/SKILL.md) | you have a small-looking change and want to know what else it could break, proven by running code. |
| [`/pstack:architect`](./skills/architect/SKILL.md) | you're about to write code that crosses a function boundary and want the caller's usage, types, and module shape settled first. |
| [`/pstack:arena`](./skills/arena/SKILL.md) | you want N parallel attempts at the same thing, then to grab the best parts of each. |
| [`/pstack:swarm`](./skills/swarm/SKILL.md) | you want N parallel workers across different slices or races, then one aggregated report. |
| [`/pstack:interrogate`](./skills/interrogate/SKILL.md) | you have a diff and want reviewers to try to break it, including a strict code-quality lens. |
| [`/pstack:automate-me`](./skills/automate-me/SKILL.md) | you want your own `-mode` skill, drafted from how you've actually worked. |
| [`/pstack:setup`](./skills/setup/SKILL.md) | you want to pick which models and effort pstack uses per role. |
| [`/pstack:reflect`](./skills/reflect/SKILL.md) | a long task landed and you want the recipe captured as a skill edit. |
| [`/pstack:correct`](./skills/correct/SKILL.md) | you keep correcting agents for the same mistakes. fixes each class at the highest level that works. |
| [`/pstack:teach`](./skills/teach/SKILL.md) | you want to actually understand a change or subsystem, not just have it summarized. |
| [`/pstack:tdd`](./skills/tdd/SKILL.md) | you're fixing a bug and there's a cheap local test path. |
| [`/pstack:benchmark-checklist`](./skills/benchmark-checklist/SKILL.md) | you measured a speedup or regression. vets the number before you report or act on it. |
| [`/pstack:deslop`](./skills/deslop/SKILL.md) | strip narrating comments, unsupported guards, dead paths, and unrelated edits from a diff before commit. |
| [`/pstack:no-comments`](./skills/no-comments/SKILL.md) | strip comments before review; spawns Comment Sicko, fixes accepted findings. |
| [`/pstack:typescript-best-practices`](./skills/typescript-best-practices/SKILL.md) | you're reading or editing typescript. |
| [`/pstack:figure-it-out`](./skills/figure-it-out/SKILL.md) | no bundled playbook fits. designs a rigorous, auditable playbook for the task. |
| [`/pstack:show-me-your-work`](./skills/show-me-your-work/SKILL.md) | you want a reviewable decision trail. logs decisions to a tsv you can commit. |
| [`/pstack:create-verification-skill`](./skills/create-verification-skill/SKILL.md) | your project has no scripted way to prove app behavior. generates a project-local verify skill with a control CLI and a feature map. |
| [`/pstack:maintain-verification-skill`](./skills/maintain-verification-skill/SKILL.md) | your verify skill's feature map has drifted from the app. |
| [`/pstack:unslop`](./skills/unslop/SKILL.md) | you're cleaning up writing. removes AI tells. |
| [`/pstack:bro`](./skills/bro/SKILL.md) | you want the last message restated in plain human language. |
| [`/pstack:technical-writing`](./skills/technical-writing/SKILL.md) | layered doc standard for docs, RFCs, readmes, PR descriptions, commit messages. |

</details>

The bare form (`/how`, `/interrogate`) also works when no other installed plugin defines the same skill name.

## The `pstack-agent` and Comment Sicko subagents

pstack ships a subagent that runs the mode end to end. Spawn it from a parent agent via [`subagent_type: "pstack-agent"`](./agents/pstack-agent.md) (or `pstack:pstack-agent` if the tool only knows the namespaced name). It reads the mode skill in full, including its inline principles index, before doing any work. Substituting `general-purpose` skips that read and drifts.

pstack also ships [Comment Sicko](./agents/comment-sicko.md), a comment reviewer available as `subagent_type: "comment-sicko"`. Usually invoke it through [`/pstack:no-comments`](./skills/no-comments/SKILL.md), not directly.

## Principles

Twenty-four short skills, one principle each. The mode skill indexes them inline and reads that index at task start. The standalone files are there so other skills can reference a principle by name, and so the index can point at the full rule for each. You steer with their names: "apply prove it works. show me the real output."

<details>
<summary>all twenty-four principles</summary>

| principle | group | rule |
|---|---|---|
| [laziness-protocol](./skills/principle-laziness-protocol/SKILL.md) | core | Bias toward deletion and the smallest change that solves the problem. |
| [foundational-thinking](./skills/principle-foundational-thinking/SKILL.md) | core | Get the data structures right so downstream code becomes obvious. |
| [redesign-from-first-principles](./skills/principle-redesign-from-first-principles/SKILL.md) | core | Redesign as if the requirement had been foundational from day one, instead of bolting it on. |
| [attack-the-premise](./skills/principle-attack-the-premise/SKILL.md) | core | When two fixes sharing one premise fail the same gate, question the premise. |
| [subtract-before-you-add](./skills/principle-subtract-before-you-add/SKILL.md) | core | Remove dead weight first, then build on the simpler base. |
| [minimize-reader-load](./skills/principle-minimize-reader-load/SKILL.md) | core | Count layers and hidden state; collapse one-caller wrappers, shrink mutable scope. |
| [outcome-oriented-execution](./skills/principle-outcome-oriented-execution/SKILL.md) | core | Converge on the target architecture; don't preserve throwaway compatibility states. |
| [experience-first](./skills/principle-experience-first/SKILL.md) | core | Choose user delight over implementation convenience. |
| [exhaust-the-design-space](./skills/principle-exhaust-the-design-space/SKILL.md) | core | Build 2-3 competing prototypes and compare before committing. |
| [build-the-lever](./skills/principle-build-the-lever/SKILL.md) | core | Build the tool that does or proves the work instead of working by hand. |
| [model-the-domain](./skills/principle-model-the-domain/SKILL.md) | architecture | Encode the domain in a structure instead of scattered conditionals. |
| [boundary-discipline](./skills/principle-boundary-discipline/SKILL.md) | architecture | Guards at system boundaries; trust internal types; pure business logic. |
| [type-system-discipline](./skills/principle-type-system-discipline/SKILL.md) | architecture | Make illegal states unrepresentable, brand primitives, parse at boundaries. |
| [make-operations-idempotent](./skills/principle-make-operations-idempotent/SKILL.md) | architecture | Converge to the same end state regardless of partial prior runs. |
| [migrate-callers-then-delete-legacy-apis](./skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md) | architecture | Migrate callers and delete the old API in the same wave. |
| [separate-before-serializing-shared-state](./skills/principle-separate-before-serializing-shared-state/SKILL.md) | architecture | Eliminate the sharing first; serialize structurally only for a real invariant. |
| [prove-it-works](./skills/principle-prove-it-works/SKILL.md) | verification | Verify against the real artifact, not a proxy, self-report, or "it compiles". |
| [fix-root-causes](./skills/principle-fix-root-causes/SKILL.md) | verification | Reproduce first, ask why until you reach the cause, fix it there. |
| [sequence-verifiable-units](./skills/principle-sequence-verifiable-units/SKILL.md) | verification | Small units that each end in a check, ordered so the sequence proves itself. |
| [test-behavior-not-implementation](./skills/principle-test-behavior-not-implementation/SKILL.md) | verification | If the test would pass when every import returned undefined, rewrite or delete it. |
| [explain-the-number](./skills/principle-explain-the-number/SKILL.md) | verification | Find what limits a measured number and rule out that it measured something else. |
| [guard-the-context-window](./skills/principle-guard-the-context-window/SKILL.md) | delegation | Route bulk to subagents; keep summaries in the main thread. |
| [never-block-on-the-human](./skills/principle-never-block-on-the-human/SKILL.md) | delegation | Proceed on reversible work, present the result, reserve confirmation for the irreversible. |
| [encode-lessons-in-structure](./skills/principle-encode-lessons-in-structure/SKILL.md) | meta | Encode the rule as a lint, flag, check, or script instead of more text. |

</details>

## Not shipped here

- `control-ui` and `control-cli` from Cursor's `cursor-team-kit` have no Claude Code equivalent. The project's `verify-<app>` skill, generated by [`/pstack:create-verification-skill`](./skills/create-verification-skill/SKILL.md), is the control surface in this port.
- `/skill-creator` comes from the `anthropic-skills` plugin. The [authoring playbook](./skills/mode/playbooks/authoring-a-skill.md) works without it.
- The original's `benny` Slack automation pack and `make-bot-ui` skill are Cursor and Grok Bot specific and were not ported. See [`PORTING.md`](../PORTING.md).

## Why are there no planning skills?

Claude Code already has a plan mode which works with pstack. But, in Lauren's words, the best spec is code. If you do want to make a plan, [`/pstack:mode`](./skills/mode/SKILL.md) covers it with the multi-phase plan playbook, but it's not a default.

## Make it yours

The mode skill is one person's style. You may not want exactly that.

Type [`/pstack:automate-me`](./skills/automate-me/SKILL.md). It mines your recent sessions, drafts a `<your-name>-mode` skill from how you've actually worked, and routes through pstack underneath. You keep pstack as the base and end up with your own routing skill alongside the mode.

Models are configurable too. Type [`/pstack:setup`](./skills/setup/SKILL.md). It writes `~/.claude/pstack-models.md`, a small file mapping each role (code, judgment, the review panels) to a model, plus an effort budget. Every skill reads it and falls back to sensible defaults when the file is absent, so you override only what you want.

## License

MIT. The original is (c) 2026 Lauren Tan. See [`LICENSE`](./LICENSE).
