# Template for `.claude/skills/verify-<app>/SKILL.md`

Copy everything below the line into the generated skill and replace every `<placeholder>`. Delete the lines that do not apply to this app's surface. Keep the section order. The `allowed-tools` line pre-approves the control CLI so verification does not stop for permission prompts; drop it for a CLI or service harness and list that harness instead.

---

```markdown
---
name: verify-<app>
description: Drive <app> (<surface: web UI | Electron app | CLI | HTTP service | iOS app>) the way a user does and capture proof. Use when a change to <app> must be verified on the real artifact, when reproducing a reported bug, or when a playbook says "verify on the matching surface".
allowed-tools: Bash(node .claude/skills/verify-<app>/control-<app>.mjs *)
---

# Verify <app>

One instance, driven through the control CLI. One command per step. Every command prints JSON. Evidence goes to `.claude/verify-evidence/<run-id>/` and survives cleanup.

<Say whether two instances can run side by side. If not: "This app cannot run twice on one machine. Run `doctor` first and refuse to drive an instance you did not launch.">

## Launch

```bash
node .claude/skills/verify-<app>/control-<app>.mjs up
```

`up` starts `<dev command>` on port `<port>`, waits for `<ready signal>`, launches a browser with a DevTools port, and opens `<base url>`. It records the PIDs it started so `down` kills only those. <Env vars, seed data, and test users the launch needs, with where they come from.>

For the desktop app's browser pane, `.claude/launch.json` has a `<app>` entry that starts the same dev server. Use the pane to watch or spot-check. Use the CLI for proof.

## Doctor

```bash
node .claude/skills/verify-<app>/control-<app>.mjs doctor
```

Answers: dev server reachable, DevTools port reachable, page count, current title, build id `<how the build id is read>`. Run it first whenever anything looks off, after any failed drive, and before trusting an instance you did not start.

## Drive

Prefer stable handles. `<List the handles this app exposes: ARIA roles and names, data-testid attributes, route paths. Name the three or four the feature map uses most.>`

```bash
node .claude/skills/verify-<app>/control-<app>.mjs open /<route>
node .claude/skills/verify-<app>/control-<app>.mjs click 'role=button[name="<Name>"]'
node .claude/skills/verify-<app>/control-<app>.mjs type 'label=<Field>' '<text>'
node .claude/skills/verify-<app>/control-<app>.mjs press Enter
node .claude/skills/verify-<app>/control-<app>.mjs wait-settle
node .claude/skills/verify-<app>/control-<app>.mjs snapshot
```

`snapshot` prints the accessibility tree. Read it instead of a screenshot when you need text or structure. `<App-specific commands added to the CLI, one line each: login, seed, feature-flag, new-session.>`

The feature map under [`features/`](features/README.md) says how to reach each feature and what proves it.

## Evidence

```bash
node .claude/skills/verify-<app>/control-<app>.mjs screenshot <slug>.png
node .claude/skills/verify-<app>/control-<app>.mjs console 2000
node .claude/skills/verify-<app>/control-<app>.mjs network-summary 2000
```

A proof is the action and the resulting state, not the final screen alone. Capture a snapshot or screenshot before and after the action. Check the side effect the feature promises: `<the file, row, request, or message, and the command that reads it>`. Mock nothing the app can reach for real. When a dry run is the safe path, verify what it actually skipped by observing files, network, and git refs.

Evidence lives in `.claude/verify-evidence/<run-id>/`. Name files by what they prove. Paste the paths in your reply.

## Cleanup

```bash
node .claude/skills/verify-<app>/control-<app>.mjs down
```

`down` kills only the PIDs `up` recorded. `cleanup` also removes scratch state under `.claude/verify-evidence/.state/`. Neither touches evidence. Never kill by process name.

## Helpers

- `control-<app>.mjs`: the control CLI. `node .claude/skills/verify-<app>/control-<app>.mjs help` lists commands. Config in `control.config.json` beside it.
- `<any other script, with its exact invocation>`
```
