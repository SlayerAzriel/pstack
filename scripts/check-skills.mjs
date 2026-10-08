#!/usr/bin/env node
// Validate the plugins in this repository: skill and agent frontmatter, relative
// links, SKILL.md length, and leftover Cursor-only vocabulary.
// Usage: node scripts/check-skills.mjs [repo-root]
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.argv[2] ?? ".");
const plugins = ["pstack", "mode-pin"].map((p) => path.join(root, p)).filter((p) => fs.existsSync(p));
const problems = [];
const fail = (file, msg) => problems.push(`${path.relative(root, file)}: ${msg}`);

const LEFTOVERS = [
  /\bCursor\b/, /cursor-team-kit/, /generalPurpose/, /`readonly`/, /grok-4/, /claude-opus-5-5/, /agent-transcripts/,
  /\.cursor\//, /origin pr /, /Graphite/, /`gt`/, /control-ui/, /control-cli/, /Custom Mode/, /poteto-mode/, /poteto-help/,
  /AskQuestion\b/, /\bTask tool\b/, /add-plugin/, /\/in-cloud/, /environment: "cloud"/, /cloud_base_branch/,
];
// Files that mention Cursor, Graphite, or cursor-team-kit on purpose, to explain what this port replaced.
const LEFTOVER_ALLOW = new Set([
  "pstack/skills/mode/references/bugbot-triage.md", "pstack/docs/guide/07-overnight.md", "PORTING.md", "pstack/README.md", "README.md",
  "pstack/skills/ask/SKILL.md", "pstack/skills/create-verification-skill/SKILL.md", "pstack/skills/mode/playbooks/orchestrate.md",
]);

function stripFences(text) {
  return text.replace(/```[\s\S]*?```/g, "");
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2];
  }
  return fm;
}

for (const plugin of plugins) {
  const manifest = path.join(plugin, ".claude-plugin", "plugin.json");
  if (!fs.existsSync(manifest)) fail(plugin, "missing .claude-plugin/plugin.json");
  else {
    const m = JSON.parse(fs.readFileSync(manifest, "utf8"));
    if (!m.name || !/^[a-z0-9-]+$/.test(m.name)) fail(manifest, "plugin.json name must be kebab-case");
    if (/^(claude-|anthropic-|anthropics-|cc-plugin-)/.test(m.name ?? "")) fail(manifest, "reserved name prefix");
  }

  const skillsDir = path.join(plugin, "skills");
  if (fs.existsSync(skillsDir)) {
    for (const d of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const skill = path.join(skillsDir, d.name, "SKILL.md");
      if (!fs.existsSync(skill)) { fail(path.join(skillsDir, d.name), "no SKILL.md"); continue; }
      const text = fs.readFileSync(skill, "utf8");
      const fm = frontmatter(text);
      if (!fm) { fail(skill, "no frontmatter"); continue; }
      if (!fm.name) fail(skill, "frontmatter lacks name");
      else if (fm.name !== d.name) fail(skill, `frontmatter name "${fm.name}" differs from directory "${d.name}"`);
      if (!fm.description) fail(skill, "frontmatter lacks description");
      const lines = text.split("\n").length;
      if (lines > 500) fail(skill, `${lines} lines, docs recommend under 500`);
      for (const key of ["icon", "color", "mode", "reminder", "is_background"]) if (key in fm) fail(skill, `Cursor-only frontmatter key ${key}`);
    }
  }

  const agentsDir = path.join(plugin, "agents");
  if (fs.existsSync(agentsDir)) {
    for (const f of fs.readdirSync(agentsDir)) {
      const p = path.join(agentsDir, f);
      const fm = frontmatter(fs.readFileSync(p, "utf8"));
      if (!fm) { fail(p, "no frontmatter"); continue; }
      if (!fm.name) fail(p, "agent lacks name");
      else if (/[:\s]/.test(fm.name)) fail(p, `agent name "${fm.name}" must be kebab-case with no colon`);
      if (!fm.description) fail(p, "agent lacks description");
      if ("is_background" in fm) fail(p, "use background:, not is_background:");
    }
  }

  const hooks = path.join(plugin, "hooks", "hooks.json");
  if (fs.existsSync(hooks)) {
    const h = JSON.parse(fs.readFileSync(hooks, "utf8"));
    if (!h.hooks || typeof h.hooks !== "object") fail(hooks, "hooks.json needs a top-level hooks object");
  }
}

// relative links and leftovers across every markdown file in the repo
for (const file of walk(root).filter((f) => f.endsWith(".md"))) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const raw = fs.readFileSync(file, "utf8");
  if (raw.includes("\r\n")) fail(file, "CRLF line endings");
  const text = stripFences(raw);
  const linkRe = /\]\((?!https?:|mailto:|#)([^)\s]+?)(?:#[^)]*)?\)/g;
  let m;
  while ((m = linkRe.exec(text))) {
    const target = m[1].replace(/\$\{CLAUDE_[A-Z_]+\}\/?/, "");
    if (target.includes("<") || target.includes("*") || target === "url") continue;
    const abs = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(abs)) fail(file, `broken link ${m[1]}`);
  }
  if (!LEFTOVER_ALLOW.has(rel)) {
    for (const re of LEFTOVERS) {
      const hit = text.match(re);
      if (hit) fail(file, `leftover Cursor-only text: ${hit[0]}`);
    }
  }
}

if (problems.length) {
  console.log(problems.join("\n"));
  console.log(`\n${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`ok: ${plugins.length} plugin(s) checked`);
