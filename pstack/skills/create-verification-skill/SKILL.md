---
name: create-verification-skill
description: "Generate a project-local verification skill that lets Claude Code drive the real app the way a user does and prove behavior, for any language, framework, or platform. Ships a control CLI template, a SKILL.md template, and a feature map. Use for /pstack:create-verification-skill, \"make a control skill for this repo\", \"verify skill\", or when a project has no scripted way to prove UI, CLI, or service behavior."
disable-model-invocation: true
---

# Create a verification skill

Every serious project needs a scripted way to drive the real app and prove behavior: launch it, exercise a feature the way a user would, and capture evidence. This skill generates that as a project-local skill at `.claude/skills/verify-<app>/`, tailored to the repo. You write the generator's output for the next agent, not for a human. It will be read cold, mid-task, by an agent that has never seen the app.

The verification skill is infrastructure, not a one-off. It is what lets an agent close its own loop, what a `/pstack:swarm` fans out over, and what the Bug fix, Feature, Perf, and Shipping playbooks mean by "verify on the real surface". Treat it the way you treat CI.

## What Claude Code gives you

- **Bash** runs scripts. The primary harness is a small control CLI the agent calls with one command per step, because a CLI call costs fewer tokens than a throwaway script and reruns the same way every time (the **principle-build-the-lever** skill). The template is at [`references/control-cli/control-app.mjs`](references/control-cli/control-app.mjs).
- **The desktop app's browser pane** (`preview_start`, `read_page`, `get_page_text`, `find`, `computer` screenshot) can open the dev server from `.claude/launch.json` and show the user what the agent sees. It is interactive, not scripted, and absent in the CLI, so the generated skill treats it as a second surface for watching and spot checks, never as the proof path. Example config at [`references/launch.json.example`](references/launch.json.example).
- **Subagents** with `isolation: "worktree"` can each run their own instance when the app supports side-by-side instances. The skill must say whether it does.
- **Skill frontmatter** can pre-approve the control CLI with `allowed-tools`, so verification runs do not stop for permission prompts. The template shows the line.

## 1. Interview the repo, not the user

Answer these from the codebase and only ask the user what you cannot observe:

- **Surface.** What does a user actually touch? A web UI, a CLI or TUI, a desktop app, an API, a mobile app, a library? A repo can have several. Pick the primary one and note the rest.
- **Run.** How does the app start locally? Prefer the repo's own documented dev command (package scripts, Makefile, README quickstart). Note ports, env vars, seed data, auth.
- **Drive.** How can an agent interact with it programmatically? Existing harnesses first: Playwright or Cypress specs, expect scripts, PTY helpers, curl-able endpoints, a debug port. Only then pick the generic recipe: the control CLI over CDP for web and Electron, a PTY or tmux harness for CLI and TUI ([`references/cli-and-service-harness.md`](references/cli-and-service-harness.md)), plain HTTP for services, the simulator for mobile.
- **Observe.** What evidence can be captured? Screenshots, accessibility snapshots, terminal transcripts, response bodies, logs, exit codes, DB state.
- **Isolate.** Can two instances run side by side (ports, data dirs, profiles)? If not, say so in the generated skill. Refusing to double-drive a shared instance beats corrupting the user's session.

If the checkout does not build or start as-is, fix that first, or report it precisely, before generating. A skill written against a broken base teaches wrong steps. When an irrelevant missing asset blocks startup (a static dir the API never serves, a sample config), the generated skill may create it, clearly marked as verification scaffolding, and remove it in cleanup.

## 2. Generate the skill

Copy [`references/skill-template.md`](references/skill-template.md) to `.claude/skills/verify-<app>/SKILL.md` and fill every placeholder from what the interview found. No placeholder may survive. The frontmatter needs `name: verify-<app>` and a `description` that names the app, the surface, and when to reach for it. Without frontmatter the skill never registers. The sections:

- **Launch.** The exact command that starts the app for verification, how to tell it is ready (a log line, a port answering, a prompt), and teardown. For a short-lived CLI there is no server to keep alive. Launch means build the binary or install deps once, then start each drive in its own isolated PTY session.
- **Doctor.** One read-only check that answers "is this instance worth driving?": process up, right build, port owned by us, auth valid. An agent runs this first whenever anything looks off.
- **Drive.** The harness recipe with real selectors and commands from this repo, not examples. Prefer stable handles (ARIA roles and names, data attributes, prompt strings, route paths) over coordinates and tab order.
- **Evidence.** What to capture for a proof and where it goes. The default is `.claude/verify-evidence/<run-id>/`, gitignored. Proof standards: exercise the real user path, not internal setters or test-only endpoints. Capture the action and the resulting state, not just the final screen. Verify side effects (files written, rows inserted, messages sent) alongside what is visible. Mock only where a production boundary already isolates the external system. When the safe path is a dry run, verify what it actually skips by observing files, network, and git refs rather than trusting its name.
- **Cleanup.** How to tear down instances the run created. Never kill by process name. Kill what you started. Cleanup removes instances and scratch state, never the evidence.
- **Helpers.** Any script the skill ships is executable and its invocation is shown in the skill body. A helper the reader has to reverse-engineer is not a helper.

For a web or Electron surface, copy the control CLI template to `.claude/skills/verify-<app>/control-<app>.mjs`, write its `control.config.json`, and install Playwright per [`references/control-cli/README.md`](references/control-cli/README.md). Keep the generic commands. Add the app-specific ones the feature map needs (`login`, `seed`, `feature-flag`, `new-session`). For a web surface also add an entry to `.claude/launch.json` so the desktop app's browser pane can open the same dev server.

Add `.claude/verify-evidence/` to `.gitignore`.

## 3. Seed the feature map

Create `.claude/skills/verify-<app>/features/README.md` plus one file per user-facing feature you can identify. Aim for the top 3 to 5 to start, from routes, commands, menus, or docs. Follow the shape in [`references/feature-map-example/`](references/feature-map-example/), with a README index and one file per feature. Each file answers, from the user's point of view: what the feature is, how to reach it, how to drive it with the harness, and what observable end state proves it works. The four H2s are `Sub-features`, `How to get to it (user POV)`, `Driving it with <harness>`, and `Gotchas`. The map is the repo's maintained verification source. A proof that drives one convenient entry point is incomplete when the map lists others.

## 4. Prove the generated skill before handing it over

Run its own instructions end to end once: launch, doctor, drive ONE mapped feature (one is enough, the map exists so later runs can cover the rest), capture evidence, clean up. After cleanup, confirm the evidence still exists at the named location. A cleanup that eats the proof fails this step. Fix what fails, and run the generated cleanup after every failed iteration too, so broken attempts do not strand processes and ports. A generated skill that was never executed is a draft, not a deliverable.

## 5. Offer the maintenance loop

Point the user at `/pstack:maintain-verification-skill` for keeping the map honest as the app changes. Suggest `/loop 1d /pstack:maintain-verification-skill` or a routine only if they ask for a cadence.

**Reply:** the surface and harness chosen and why, the files written, the one feature driven with its evidence path, what the interview could not answer, and the maintenance offer.
