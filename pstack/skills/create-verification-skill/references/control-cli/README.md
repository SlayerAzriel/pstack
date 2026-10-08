# The control CLI template

`control-app.mjs` is the starting point for the control CLI that `/pstack:create-verification-skill` installs at `.claude/skills/verify-<app>/control-<app>.mjs`. It drives a web or Electron app over the Chrome DevTools Protocol with Playwright. One command per invocation, JSON on stdout, exit 1 with an `error` and a `hint` on failure.

## Install

```bash
npm i -D playwright
```

```bash
npx playwright install chromium
```

Playwright is a dev dependency of the project, not of the plugin, so the CLI runs from the repo's own `node_modules`.

## Configure

Write `control.config.json` beside the script. Every key is optional.

```json
{
  "baseUrl": "http://localhost:3000",
  "startCommand": "npm run dev",
  "readyPattern": "ready in|Local:",
  "readyTimeoutMs": 60000,
  "cdpPort": 9222,
  "electronCommand": null,
  "evidenceDir": ".claude/verify-evidence",
  "settleMs": 500
}
```

- `startCommand` is null when the app is already running or the agent starts it some other way. `up` then only launches the browser.
- `readyPattern` is a regex tested against the dev server's log when the port does not answer yet.
- `electronCommand` replaces the browser launch for Electron apps. It must pass `--remote-debugging-port=<cdpPort>` to the app, for example `npx electron . --remote-debugging-port=9222`. `open` then navigates inside the app's window.
- `evidenceDir` defaults to `.claude/verify-evidence` relative to the repo. Add it to `.gitignore`. Set `VERIFY_RUN_ID` to group one verification run's files under one directory.

## Lifecycle

```bash
node .claude/skills/verify-<app>/control-<app>.mjs up
node .claude/skills/verify-<app>/control-<app>.mjs doctor
node .claude/skills/verify-<app>/control-<app>.mjs open /settings
node .claude/skills/verify-<app>/control-<app>.mjs click 'role=tab[name="Appearance"]'
node .claude/skills/verify-<app>/control-<app>.mjs snapshot
node .claude/skills/verify-<app>/control-<app>.mjs screenshot appearance-tab.png
node .claude/skills/verify-<app>/control-<app>.mjs down
```

`up` starts the dev server (if configured) and a Chromium with a DevTools port, detached, and records the PIDs under `<evidenceDir>/.state/pids.json`. Every other command connects over CDP, acts, and disconnects, so page state persists between commands. `down` kills only the recorded PIDs. `cleanup` also removes `.state/`. Nothing removes evidence.

## Extend it for the app

Keep the generic commands. Add the ones the feature map needs, as new entries in the `commands` table:

- `login <user>`: drive the real login form with a seeded test user, or set a session cookie through `context.addCookies`.
- `seed <fixture>`: load a fixture through the app's own dev endpoint or CLI.
- `feature-flag <name> on|off`: whatever the app reads flags from (localStorage, a query param, a dev endpoint).
- `new-session`, `home`, `select-project`: navigation shortcuts the feature map can cite.

Every destructive command takes `--dry-run` and prints what it would do. Every error names the next command to run. `help` stays current. Output stays JSON. These are the properties that let an agent compose the CLI without reading its source: a small composable surface, gradual disclosure through subcommands, descriptive errors, rich help, machine-readable output.

Pre-approve the CLI in the generated skill's frontmatter so runs do not stop for permission prompts:

```yaml
allowed-tools: Bash(node .claude/skills/verify-<app>/control-<app>.mjs *)
```

## Tracing and metrics

`trace <ms> [file]` records a DevTools trace for a fixed window. Start it in one invocation and run the interaction in another while it records, for example `trace 8000 startup.json & sleep 1 && ... open /`. `perf-metrics` reads `Performance.getMetrics` for a cheap before and after number. Vet any number with `/pstack:benchmark-checklist` before it goes in a PR.

## The desktop app's browser pane

The pane is a second way to see the same dev server. Add an entry to `.claude/launch.json` (see `../launch.json.example`) and the desktop app's `preview_start` opens it; `read_page` and `get_page_text` then read the page as text. The pane is for watching and spot checks. It is not available in the CLI, and it is not scripted, so proof still comes from the control CLI.
