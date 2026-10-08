# Porting notes

This repository is a Claude Code port of [pstack](https://github.com/cursor/plugins/tree/main/pstack) by Lauren Tan, taken from the `cursor/plugins` repository at commit `ccb5507` (7 October 2026, pstack 0.15.15). The content is MIT licensed and so is this port. This file lists what changed, what did not port, and what to check before trusting it.

## Layout

| Path | What it is |
|---|---|
| `.claude-plugin/marketplace.json` | Makes this repository installable with `/plugin marketplace add`. Lists both plugins below. |
| `pstack/` | The plugin. Same tree as the original: `skills/`, `agents/`, `docs/guide/`, plus `.claude-plugin/plugin.json`. |
| `mode-pin/` | Optional second plugin. One `UserPromptSubmit` hook that reminds the agent to apply `/pstack:mode`. The stand-in for Cursor's pinned Custom Mode. |
| `scripts/check-skills.mjs` | Validates frontmatter, relative links, SKILL.md length, and leftover Cursor vocabulary. Run it after any edit. |

## Renames

Claude Code namespaces plugin skills as `/<plugin>:<skill>`, so the plugin is named `pstack` and three skills lost their prefix to avoid `/pstack:pstack-mode`:

| Original | Port |
|---|---|
| `/poteto-mode` | `/pstack:mode` |
| `/poteto-help` | `/pstack:ask` (`help` collides with the built-in `/help`) |
| `/setup-pstack` | `/pstack:setup` |
| `poteto-agent` subagent | `pstack-agent` (namespaced form `pstack:pstack-agent`) |
| `Comment Sicko` subagent | `comment-sicko` |
| `~/.cursor/rules/pstack-models.mdc` | `~/.claude/pstack-models.md` |
| `.cursor/skills/verify-<app>/` | `.claude/skills/verify-<app>/` |

Every other skill keeps its name, invoked as `/pstack:how`, `/pstack:why`, `/pstack:interrogate`, and so on.

## Mechanical substitutions

- Cursor's `Task` tool became Claude Code's `Agent` tool. `subagent_type: generalPurpose` became `general-purpose`. `AskQuestion` became `AskUserQuestion`.
- Model slugs became Claude Code model names. `grok-4.7-xhigh-fast` (code roles) became `sonnet`. `claude-opus-5-5-xhigh` (judgment and prose) became `opus`. The `xhigh` suffix became the `effort` field that `/pstack:setup` records as a budget line and every spawn passes through.
- `readonly: true` has no equivalent on the `Agent` tool. Read-only spawns now say so in the prompt. The `Explore` type is read-only but reads excerpts, so whole-file readers use `general-purpose` with a no-edit instruction.
- `environment: "cloud"` became `isolation: "worktree"`. Cursor cloud agents became worktree-isolated subagents. Remote isolation is not documented for Claude Code, so nothing here depends on it.
- `~/.cursor/projects/<slug>/agent-transcripts/` became `~/.claude/projects/<slug>/`, with the slug rule Claude Code uses (every non-alphanumeric character in the absolute path becomes `-`) and the separate `<session>/subagents/` layout. The JSONL format is internal to Claude Code and the skills say so.
- Cursor's `/loop` is also a Claude Code skill, so it stayed. Custom Modes became a `CLAUDE.md` line or the `pstack-mode-pin` hook.
- Cursor's built-in `create-skill` became the `skill-creator` skill from the `anthropic-skills` plugin, with the authoring playbook as the fallback.
- Playbooks that re-read themselves from trunk with `git show origin/main:pstack/...` now re-read the installed plugin. `check-plan.mjs` enforces the new marker.

## Things added

- `skills/deslop/`. The original depends on `/deslop` from Cursor's `cursor-team-kit`, which is not public here. This port ships a small equivalent.
- `skills/create-verification-skill/` was rewritten for Claude Code and ships a Playwright-over-CDP control CLI template, a SKILL.md template, a CLI and TUI harness recipe, and a `.claude/launch.json` example for the desktop app's browser pane. See its `references/`.
- `mode-pin/`, described above.
- `scripts/check-skills.mjs`, described above.

## Things not ported

- `automations/benny/`. It is built on Cursor Automations and Slack. The overnight guide says how to build the same line with Claude Code routines or GitHub Actions.
- `skills/make-bot-ui/`. Grok Bot specific.
- `control-ui` and `control-cli` from `cursor-team-kit`. The project's `verify-<app>` skill is the control surface in this port.
- Origin and Graphite forge support. Every PR operation uses `gh`. One consequence: `orch frontier set` in `skills/mode/scripts/orch/` still shells out to Graphite's `gt` for stack discovery. On a repo without Graphite, write `frontier.json` by hand from `gh pr list`; the orchestrate playbook says how and names the shape.
- The guide's illustrations.

## Deliberate deviations

- **Autonomy.** The original lets reversible work and external actions (team chat posts, ticket updates) proceed without asking. This port keeps "reversible work proceeds" and makes externally visible actions wait for the user's go unless the session grant names them. Claude Code's own permission model treats sending messages and posting as actions that need consent, and the port should not fight it.
- **Model invocation.** Routed workflow skills (`how`, `why`, `architect`, `arena`, `swarm`, `interrogate`, `unslop`, `deslop`, `no-comments`, `technical-writing`, `tdd`, `benchmark-checklist`, `show-me-your-work`, `figure-it-out`, `blast-radius`, `typescript-best-practices`) are model-invocable so the router can call them with the Skill tool. User-entry skills and the 24 principle leaves keep `disable-model-invocation: true`; the router reads principles by path.
- **Review panels.** The original's adversarial review leans on cross-vendor model diversity (Opus against Grok). Claude Code's `Agent` tool offers one family at several sizes, so `interrogate`, `arena`, and the mode skill now say to vary context as well as model size, and to weight agreement accordingly.

## Not verified

- The exact `subagent_type` string for a plugin agent. Docs say the frontmatter `name` is the identifier, and plugin agents are listed as `<plugin>:<name>`. The skills say `pstack-agent` and fall back to `pstack:pstack-agent`.
- `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_SKILL_DIR}` are substituted in SKILL.md and agent files. They are not substituted inside playbook files read with the Read tool, so the mode skill states its own directory once and playbooks use paths relative to it.
- The scripts under `skills/mode/scripts/` (orch, watch-pr, check-plan) were copied with path and marker edits only. Their tests were not rerun here. `bun test` in that directory runs them.
- Nothing in this port has been run inside a live Claude Code session yet. Run `node scripts/check-skills.mjs` and `claude plugin validate ./pstack` first, then a small real task with `/pstack:mode`.
