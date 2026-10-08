#!/usr/bin/env node
// control-<app>: an agent-friendly CLI that drives a web or Electron app over the
// Chrome DevTools Protocol with Playwright. One command per invocation. JSON out.
//
// Setup, once per repo:   npm i -D playwright && npx playwright install chromium
// Config:                 control.config.json beside this file (see README.md)
// Usage:                  node control-app.mjs <command> [args] [--json] [--dry-run]
//
// The browser and the dev server outlive each invocation. `up` starts them
// detached and records their PIDs. Every other command connects over CDP, acts,
// and disconnects. `down` kills only what `up` started.

import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(here, "control.config.json");
const defaults = {
  baseUrl: "http://localhost:3000",
  startCommand: null, // "npm run dev"; null when the app is already running
  readyPattern: null, // regex source tested against the start command's output
  readyTimeoutMs: 60000,
  cdpPort: 9222,
  electronCommand: null, // "npx electron . --remote-debugging-port=9222"; replaces the browser launch
  evidenceDir: path.resolve(here, "../../verify-evidence"),
  settleMs: 500,
};
const config = {
  ...defaults,
  ...(fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {}),
};
config.cdpUrl = `http://127.0.0.1:${config.cdpPort}`;
const stateDir = path.join(config.evidenceDir, ".state");
const pidFile = path.join(stateDir, "pids.json");
const runId = process.env.VERIFY_RUN_ID ?? new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(config.evidenceDir, runId);

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const args = argv.filter((a) => !a.startsWith("--"));
const [command = "help", ...rest] = args;
const dryRun = flags.has("--dry-run");

function out(obj) {
  process.stdout.write(JSON.stringify(obj, null, flags.has("--json") ? 0 : 2) + "\n");
}
function die(error, hint) {
  out({ ok: false, command, error, hint });
  process.exit(1);
}
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
function readPids() {
  return fs.existsSync(pidFile) ? JSON.parse(fs.readFileSync(pidFile, "utf8")) : {};
}
function writePids(pids) {
  ensureDir(stateDir);
  fs.writeFileSync(pidFile, JSON.stringify(pids, null, 2));
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function reachable(url, timeoutMs = 2000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e.cause?.code ?? e.message) };
  }
}
function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(port, "127.0.0.1");
  });
}
function spawnDetached(cmd, logName) {
  ensureDir(stateDir);
  const log = fs.openSync(path.join(stateDir, logName), "a");
  const child = spawn(cmd, { shell: true, detached: process.platform !== "win32", stdio: ["ignore", log, log] });
  child.unref();
  return child.pid;
}
async function waitFor(predicate, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return true;
    await sleep(500);
  }
  die(`timed out after ${timeoutMs}ms waiting for ${label}`, "run `doctor`, then read the logs under .state/");
}
function kill(pid) {
  try {
    if (process.platform === "win32") spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-pid, "SIGTERM");
    return true;
  } catch {
    try {
      process.kill(pid, "SIGTERM");
      return true;
    } catch {
      return false;
    }
  }
}

async function playwright() {
  try {
    return await import("playwright");
  } catch {
    die("playwright is not installed", "npm i -D playwright && npx playwright install chromium");
  }
}
async function connect() {
  const { chromium } = await playwright();
  const probe = await reachable(`${config.cdpUrl}/json/version`);
  if (!probe.ok) die("no browser on the DevTools port", "run `up` first, or set cdpPort in control.config.json");
  const browser = await chromium.connectOverCDP(config.cdpUrl);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = context.pages().find((p) => !p.url().startsWith("devtools://")) ?? (await context.newPage());
  return { browser, context, page };
}
function locator(page, target) {
  const m = target.match(/^(role|text|label|testid|placeholder)=(.*)$/s);
  if (!m) return page.locator(target);
  const [, kind, value] = m;
  if (kind === "role") {
    const r = value.match(/^([a-z]+)(?:\[name="([^"]*)"\])?$/);
    if (!r) die(`bad role target ${target}`, 'use role=button[name="Save"]');
    return page.getByRole(r[1], r[2] ? { name: r[2] } : {});
  }
  if (kind === "text") return page.getByText(value);
  if (kind === "label") return page.getByLabel(value);
  if (kind === "testid") return page.getByTestId(value);
  return page.getByPlaceholder(value);
}
async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: config.readyTimeoutMs }).catch(() => {});
  await page.evaluate(
    (quiet) =>
      new Promise((resolve) => {
        let timer = setTimeout(done, quiet);
        const obs = new MutationObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(done, quiet);
        });
        obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
        function done() {
          obs.disconnect();
          resolve();
        }
      }),
    config.settleMs
  );
}
async function snapshot(page) {
  const body = page.locator("body");
  if (typeof body.ariaSnapshot === "function") return await body.ariaSnapshot();
  return JSON.stringify(await page.accessibility.snapshot(), null, 2);
}

const commands = {
  async help() {
    out({
      ok: true,
      usage: "node control-app.mjs <command> [args] [--json] [--dry-run]",
      commands: {
        doctor: "is this instance worth driving? server, DevTools port, page title",
        up: "start the dev server (if configured) and a browser with a DevTools port, open baseUrl",
        down: "kill only what `up` started (--dry-run lists the PIDs)",
        cleanup: "`down` plus remove .state/; never touches evidence",
        "open <path|url>": "navigate the current page",
        snapshot: "print the accessibility tree of the current page",
        "screenshot [file]": "save a PNG under the run's evidence dir (full page)",
        "click <target>": 'css, or role=button[name="Save"], text=..., label=..., testid=..., placeholder=...',
        "type <target> <text>": "fill a field",
        "press <key>": "press a key, e.g. Enter, Escape, Control+K",
        "eval <js>": "evaluate in the page and print the result (--dry-run prints the code)",
        "wait-settle": "wait for network idle and a quiet DOM",
        "console [ms]": "collect console messages for ms (default 2000)",
        "network-summary [ms]": "collect requests for ms and group by status",
        "perf-metrics": "DevTools Performance.getMetrics for the current page",
        "trace <ms> [file]": "record a DevTools trace for ms; run the interaction in a second invocation meanwhile",
        "url": "print the current URL and title",
      },
      config,
    });
  },

  async doctor() {
    const server = await reachable(config.baseUrl);
    const cdp = await reachable(`${config.cdpUrl}/json/version`);
    let pages = null;
    let title = null;
    let url = null;
    if (cdp.ok) {
      const { browser, page } = await connect();
      pages = browser.contexts().reduce((n, c) => n + c.pages().length, 0);
      title = await page.title();
      url = page.url();
      await browser.close().catch(() => {});
    }
    const pids = readPids();
    out({ ok: server.ok && cdp.ok, command, server, devtools: cdp, pages, title, url, started: pids, runDir });
  },

  async up() {
    const pids = readPids();
    const server = await reachable(config.baseUrl);
    if (!server.ok && config.startCommand) {
      if (dryRun) return out({ ok: true, dryRun: true, wouldStart: config.startCommand });
      pids.server = spawnDetached(config.startCommand, "server.log");
      writePids(pids);
      await waitFor(async () => {
        if ((await reachable(config.baseUrl)).ok) return true;
        if (!config.readyPattern) return false;
        const log = fs.readFileSync(path.join(stateDir, "server.log"), "utf8");
        return new RegExp(config.readyPattern).test(log);
      }, config.readyTimeoutMs, `dev server at ${config.baseUrl}`);
    } else if (!server.ok) {
      die(`nothing answers at ${config.baseUrl} and no startCommand is configured`, "start the app yourself or set startCommand");
    }
    const cdp = await reachable(`${config.cdpUrl}/json/version`);
    if (!cdp.ok) {
      if (!(await portFree(config.cdpPort))) die(`port ${config.cdpPort} is taken by something that is not a DevTools endpoint`, "change cdpPort");
      if (dryRun) return out({ ok: true, dryRun: true, wouldLaunch: config.electronCommand ?? "chromium" });
      if (config.electronCommand) {
        pids.app = spawnDetached(config.electronCommand, "app.log");
      } else {
        const { chromium } = await playwright();
        const exe = chromium.executablePath();
        const profile = path.join(stateDir, "profile");
        ensureDir(profile);
        const cmd = [
          JSON.stringify(exe),
          `--remote-debugging-port=${config.cdpPort}`,
          `--user-data-dir=${JSON.stringify(profile)}`,
          "--no-first-run",
          "--no-default-browser-check",
          JSON.stringify(config.baseUrl),
        ].join(" ");
        pids.browser = spawnDetached(cmd, "browser.log");
      }
      writePids(pids);
      await waitFor(async () => (await reachable(`${config.cdpUrl}/json/version`)).ok, config.readyTimeoutMs, "DevTools port");
    }
    ensureDir(runDir);
    out({ ok: true, command, baseUrl: config.baseUrl, cdpUrl: config.cdpUrl, started: pids, runDir });
  },

  async down() {
    const pids = readPids();
    if (dryRun) return out({ ok: true, dryRun: true, wouldKill: pids });
    const killed = {};
    for (const [name, pid] of Object.entries(pids)) killed[name] = kill(pid);
    writePids({});
    out({ ok: true, command, killed });
  },

  async cleanup() {
    await commands.down();
    if (!dryRun) fs.rmSync(stateDir, { recursive: true, force: true });
    out({ ok: true, command, removed: stateDir, evidenceKept: config.evidenceDir });
  },

  async open() {
    const target = rest[0] ?? "/";
    const url = /^https?:/.test(target) ? target : new URL(target, config.baseUrl).toString();
    const { browser, page } = await connect();
    await page.goto(url);
    await settle(page);
    out({ ok: true, command, url: page.url(), title: await page.title() });
    await browser.close().catch(() => {});
  },

  async url() {
    const { browser, page } = await connect();
    out({ ok: true, command, url: page.url(), title: await page.title() });
    await browser.close().catch(() => {});
  },

  async snapshot() {
    const { browser, page } = await connect();
    const tree = await snapshot(page);
    out({ ok: true, command, url: page.url(), tree });
    await browser.close().catch(() => {});
  },

  async screenshot() {
    ensureDir(runDir);
    const file = path.resolve(runDir, rest[0] ?? `screenshot-${Date.now()}.png`);
    const { browser, page } = await connect();
    await page.screenshot({ path: file, fullPage: true });
    out({ ok: true, command, file });
    await browser.close().catch(() => {});
  },

  async click() {
    if (!rest[0]) die("click needs a target", 'click role=button[name="Save"]');
    const { browser, page } = await connect();
    if (dryRun) {
      const n = await locator(page, rest[0]).count();
      out({ ok: true, dryRun: true, target: rest[0], matches: n });
    } else {
      await locator(page, rest[0]).first().click();
      await settle(page);
      out({ ok: true, command, target: rest[0], url: page.url() });
    }
    await browser.close().catch(() => {});
  },

  async type() {
    if (rest.length < 2) die("type needs a target and text", "type label=Email me@example.com");
    const { browser, page } = await connect();
    await locator(page, rest[0]).first().fill(rest.slice(1).join(" "));
    out({ ok: true, command, target: rest[0] });
    await browser.close().catch(() => {});
  },

  async press() {
    if (!rest[0]) die("press needs a key", "press Enter");
    const { browser, page } = await connect();
    await page.keyboard.press(rest[0]);
    await settle(page);
    out({ ok: true, command, key: rest[0], url: page.url() });
    await browser.close().catch(() => {});
  },

  async eval() {
    const code = rest.join(" ");
    if (!code) die("eval needs code", "eval document.title");
    if (dryRun) return out({ ok: true, dryRun: true, code });
    const { browser, page } = await connect();
    const result = await page.evaluate(code);
    out({ ok: true, command, result });
    await browser.close().catch(() => {});
  },

  async "wait-settle"() {
    const { browser, page } = await connect();
    await settle(page);
    out({ ok: true, command, url: page.url() });
    await browser.close().catch(() => {});
  },

  async console() {
    const ms = Number(rest[0] ?? 2000);
    const { browser, page } = await connect();
    const messages = [];
    page.on("console", (m) => messages.push({ type: m.type(), text: m.text() }));
    page.on("pageerror", (e) => messages.push({ type: "pageerror", text: String(e) }));
    await sleep(ms);
    out({ ok: true, command, ms, messages });
    await browser.close().catch(() => {});
  },

  async "network-summary"() {
    const ms = Number(rest[0] ?? 2000);
    const { browser, page } = await connect();
    const byStatus = {};
    const failed = [];
    page.on("response", (r) => {
      const k = String(r.status());
      byStatus[k] = (byStatus[k] ?? 0) + 1;
      if (r.status() >= 400) failed.push({ status: r.status(), url: r.url() });
    });
    page.on("requestfailed", (r) => failed.push({ status: "failed", url: r.url(), error: r.failure()?.errorText }));
    await sleep(ms);
    out({ ok: true, command, ms, byStatus, failed });
    await browser.close().catch(() => {});
  },

  async "perf-metrics"() {
    const { browser, page } = await connect();
    const session = await page.context().newCDPSession(page);
    await session.send("Performance.enable");
    const { metrics } = await session.send("Performance.getMetrics");
    out({ ok: true, command, metrics: Object.fromEntries(metrics.map((m) => [m.name, m.value])) });
    await browser.close().catch(() => {});
  },

  async trace() {
    const ms = Number(rest[0] ?? 5000);
    ensureDir(runDir);
    const file = path.resolve(runDir, rest[1] ?? `trace-${Date.now()}.json`);
    const { browser, page } = await connect();
    const session = await page.context().newCDPSession(page);
    const chunks = [];
    session.on("Tracing.dataCollected", (e) => chunks.push(...e.value));
    const complete = new Promise((r) => session.once("Tracing.tracingComplete", r));
    await session.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline,v8.execute,blink.user_timing" });
    await sleep(ms);
    await session.send("Tracing.end");
    await complete;
    fs.writeFileSync(file, JSON.stringify({ traceEvents: chunks }));
    out({ ok: true, command, ms, file, events: chunks.length });
    await browser.close().catch(() => {});
  },
};

const fn = commands[command];
if (!fn) die(`unknown command ${command}`, "run `help`");
fn().catch((e) => die(String(e?.message ?? e), "run `doctor`; if the page is wedged, `open /` or `down` then `up`"));
