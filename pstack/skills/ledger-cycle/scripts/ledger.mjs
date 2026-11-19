#!/usr/bin/env node
// Ledger CLI for /pstack:ledger-cycle. One cycle is one append-only markdown file written by five
// roles. This tool is the only writer. It enforces the order of the parts, who may write each part,
// the rules of each part, and a hash chain that makes a later edit detectable.
//
//   node ledger.mjs init    [--dir ledgers] [--program NAME]
//   node ledger.mjs status  [--dir ledgers]
//   node ledger.mjs new     [--dir ledgers]
//   node ledger.mjs append  --file F --part P --role R [--from FILE]   (content from FILE or stdin)
//   node ledger.mjs seal    --file F
//   node ledger.mjs abandon --file F --reason TEXT
//   node ledger.mjs check   (--file F | --dir ledgers)
//
// Paths written inside a ledger are relative to the base directory, the parent of the ledgers dir.
// Output is one JSON object on stdout. Exit 0 ok, 1 rule violation, 2 usage, 3 the directive says
// pause or stop, 4 the previous cycle is still open.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const FORMAT = 1;
const PART_ROLE = {
	chronicle: "runner",
	facts: "analyst",
	hypothesis: "theorist",
	critique: "critic",
	execution: "decider",
	lesson: "summarizer",
};
const PART_TITLE = {
	chronicle: "Part 0. Chronicle, directive and program",
	facts: "Part 1. Facts",
	hypothesis: "Part 2. Hypothesis and registered scope",
	critique: "Part 3. Critique",
	execution: "Part 4. Execution",
	lesson: "Part 5. Lesson",
};
const VERDICTS = ["KEEP", "REVISE", "REJECT"];
const RUN_STATUS = ["completed", "failed", "blocked"];
const OUTCOMES = ["pass", "kill", "inconclusive", "rejected", "blocked", "no-action"];
const NEEDS_RUN = new Set(["pass", "kill", "inconclusive"]);
const DEFAULT_CONFIG = {
	program: "",
	goal: "",
	rubric: [],
	memory: { readsLedger: "", findings: "", status: [] },
	scopeDir: "docs",
	evidenceDir: "",
	levers: [],
	never: [],
	maxRevisions: 2,
	chronicleMaxWords: 300,
	requireScopeCommit: true,
	factsLint: { banned: null },
};
// Words that turn a fact into a judgment or a proposal. Text inside backticks, code fences and
// quoted lines is not linted, so a source can be quoted verbatim.
const DEFAULT_BANNED = [
	"\\bshould\\b",
	"\\bought to\\b",
	"\\brecommend",
	"\\bpropos",
	"\\bsuggest",
	"\\bwe (could|can|might|need to)\\b",
	"\\bnext step",
	"\\bworth (trying|testing|exploring|a look)\\b",
	"\\bpromising\\b",
	"\\bencouraging\\b",
	"\\bdisappointing\\b",
];
const DIRECTIVE_TEMPLATE = [
	"STATUS: run",
	"",
	"<!-- The control file of the program owner. The runner reads it at the start of every cycle and",
	"copies the text below this comment into Part 0, where every role reads it. STATUS is run, pause",
	"or stop. Write directives as plain sentences: priorities, vetoes, constraints, decisions.",
	"Nothing written here waives a rule of the ledger. -->",
	"",
].join("\n");

class Fail extends Error {
	constructor(code, error, hint, extra = {}) {
		super(error);
		this.code = code;
		this.hint = hint;
		this.extra = extra;
	}
}
const norm = (s) => s.replace(/\r\n/g, "\n");
const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const words = (s) => (s.match(/\S+/g) ?? []).length;

function args(argv) {
	const o = {};
	for (let i = 0; i < argv.length; i++) {
		if (!argv[i].startsWith("--")) throw new Fail(2, `unexpected argument ${argv[i]}`);
		const key = argv[i].slice(2);
		const value = argv[i + 1];
		if (value === undefined || value.startsWith("--")) o[key] = true;
		else {
			o[key] = value;
			i++;
		}
	}
	return o;
}
function need(o, ...keys) {
	for (const k of keys) if (typeof o[k] !== "string") throw new Fail(2, `--${k} is required`);
}
function readText(file) {
	if (!fs.existsSync(file)) throw new Fail(2, `no such file ${file}`);
	return norm(fs.readFileSync(file, "utf8"));
}
function writeAtomic(file, text) {
	const tmp = `${file}.tmp-${process.pid}`;
	fs.writeFileSync(tmp, text, "utf8");
	fs.renameSync(tmp, file);
}
function places(o) {
	const dir = path.resolve(o.file ? path.dirname(o.file) : typeof o.dir === "string" ? o.dir : "ledgers");
	return { dir, base: path.dirname(dir) };
}
function loadConfig(dir) {
	const file = path.join(dir, "ledger.config.json");
	if (!fs.existsSync(file)) throw new Fail(2, `no ledger.config.json in ${dir}`, "run `init` first");
	let user;
	try {
		user = JSON.parse(fs.readFileSync(file, "utf8"));
	} catch (e) {
		throw new Fail(2, `ledger.config.json is not valid JSON: ${e.message}`);
	}
	return {
		...DEFAULT_CONFIG,
		...user,
		memory: { ...DEFAULT_CONFIG.memory, ...(user.memory ?? {}) },
		factsLint: { ...DEFAULT_CONFIG.factsLint, ...(user.factsLint ?? {}) },
	};
}
function cycleFiles(dir) {
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir)
		.filter((f) => /^cycle-\d{4,}\.md$/.test(f))
		.sort()
		.map((f) => path.join(dir, f));
}
function readDirective(dir) {
	const file = path.join(dir, "directive.md");
	if (!fs.existsSync(file)) return { status: "run", body: "" };
	const text = norm(fs.readFileSync(file, "utf8"));
	const m = text.match(/^STATUS:[ \t]*(\w+)[ \t]*$/im);
	const status = m ? m[1].toLowerCase() : "run";
	if (!["run", "pause", "stop"].includes(status)) throw new Fail(2, `directive.md STATUS is "${m[1]}"`, "use run, pause or stop");
	const body = text
		.replace(/^STATUS:.*$/im, "")
		.replace(/<!--[\s\S]*?-->/g, "")
		.trim();
	return { status, body };
}

// ---- reading a ledger

function field(body, key) {
	const m = body.match(new RegExp(`^${esc(key)}:[ \\t]*(.+?)[ \\t]*$`, "m"));
	return m ? m[1].replace(/^`|`$/g, "") : null;
}
function fieldAll(body, key) {
	return [...body.matchAll(new RegExp(`^${esc(key)}:[ \\t]*(.+?)[ \\t]*$`, "gm"))].map((m) => m[1].replace(/^`|`$/g, ""));
}
function section(body, heading) {
	const lines = body.split("\n");
	const start = lines.findIndex((l) => new RegExp(`^#{2,4} ${esc(heading)}\\s*$`, "i").test(l));
	if (start === -1) return null;
	const level = lines[start].match(/^#+/)[0].length;
	const rest = [];
	for (const l of lines.slice(start + 1)) {
		const h = l.match(/^(#+) /);
		if (h && h[1].length <= level) break;
		rest.push(l);
	}
	return rest.join("\n").trim();
}
function attrs(s) {
	const o = {};
	for (const m of s.matchAll(/([\w-]+)=(\S+)/g)) o[m[1]] = m[2];
	return o;
}
function parse(text) {
	const marks = [...text.matchAll(/^<!-- ledger:(part|seal) (.*?) -->$/gm)].map((m) => ({
		kind: m[1],
		a: attrs(m[2]),
		index: m.index,
		end: m.index + m[0].length,
	}));
	const parts = [];
	const problems = [];
	let seal = null;
	marks.forEach((mk, i) => {
		const label = mk.kind === "seal" ? "the seal" : `part ${mk.a.name}`;
		if (mk.a.prev !== sha(text.slice(0, mk.index))) problems.push(`the text before ${label} was edited after it was written (hash chain broken)`);
		const body = text.slice(mk.end, i + 1 < marks.length ? marks[i + 1].index : text.length).trim();
		if (mk.kind === "seal") {
			if (i !== marks.length - 1 || body !== "") problems.push("there is content after the seal");
			seal = mk.a;
		} else parts.push({ ...mk.a, body });
	});
	if (!/^# Ledger cycle \d+/.test(text)) problems.push("the title line `# Ledger cycle N` is missing");
	return { parts, seal, problems };
}
// The cycle as a state machine: which part may come next, given the parts so far.
function walk(parts, config) {
	const problems = [];
	let allowed = ["chronicle"];
	let hypotheses = 0;
	let verdict = null;
	let executed = false;
	for (const p of parts) {
		if (!allowed.includes(p.name)) problems.push(`part ${p.name} is out of order; expected ${allowed.join(" or ")}`);
		if (PART_ROLE[p.name] !== p.role) problems.push(`part ${p.name} was written by ${p.role}; only ${PART_ROLE[p.name]} may write it`);
		if (p.name === "chronicle") allowed = ["facts"];
		else if (p.name === "facts") allowed = ["hypothesis", "lesson"];
		else if (p.name === "hypothesis") {
			hypotheses++;
			allowed = ["critique"];
		} else if (p.name === "critique") {
			verdict = field(p.body, "verdict");
			if (verdict === "KEEP") allowed = ["execution"];
			else if (verdict === "REVISE" && hypotheses <= config.maxRevisions) allowed = ["hypothesis", "lesson"];
			else allowed = ["lesson"];
		} else if (p.name === "execution") {
			executed = true;
			allowed = ["lesson"];
		} else if (p.name === "lesson") allowed = ["seal"];
	}
	return { problems, allowed, hypotheses, verdict, executed };
}

// ---- rules of each part

function git(cwd, a) {
	try {
		return execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
	} catch {
		return null;
	}
}
function scopeBlobs(base, scope, commit) {
	const abs = path.resolve(base, scope);
	if (!fs.existsSync(abs)) return { error: `the scope file ${scope} does not exist`, missing: true };
	const cwd = path.dirname(abs);
	const name = path.basename(abs);
	const committed = git(cwd, ["rev-parse", "--verify", "--quiet", `${commit}:./${name}`]);
	if (!committed) return { error: `commit ${commit} does not contain ${scope}; commit the scope file before the hypothesis is appended` };
	return { committed, working: git(cwd, ["hash-object", "--", name]) };
}
function lintFacts(body, config) {
	const banned = (config.factsLint.banned ?? DEFAULT_BANNED).map((s) => new RegExp(s, "i"));
	const problems = [];
	const prose = body
		.replace(/```[\s\S]*?```/g, "")
		.split("\n")
		.filter((l) => !/^\s*>/.test(l))
		.map((l) => l.replace(/`[^`\n]*`/g, ""));
	for (const line of prose)
		for (const re of banned) {
			const m = line.match(re);
			if (m) problems.push(`facts may not judge or propose: "${m[0]}" in "${line.trim().slice(0, 100)}"`);
		}
	if (!/`[^`\n]*[\/.:][^`\n]*`/.test(body)) problems.push("facts cite no source; put each source path or command in backticks");
	return problems;
}
function lastHypothesis(parts) {
	return [...parts].reverse().find((p) => p.name === "hypothesis");
}
function hashFile(abs) {
	const data = fs.readFileSync(abs);
	return { sha256: crypto.createHash("sha256").update(data).digest("hex"), bytes: data.length };
}
// mode "append" judges new content against the working tree. mode "check" re-judges a written part.
function rules(part, body, ctx, mode) {
	const problems = [];
	const warnings = [];
	let extra = "";
	let appendix = "";
	const { base, config, parts, executed } = ctx;
	if (body.trim() === "") problems.push(`part ${part} is empty`);

	if (part === "facts") problems.push(...lintFacts(body, config));

	if (part === "hypothesis") {
		for (const key of ["family", "variant", "scope"]) if (!field(body, key)) problems.push(`hypothesis lacks the field \`${key}:\``);
		const scope = field(body, "scope");
		const commit = field(body, "scope-commit");
		if (config.requireScopeCommit && scope) {
			if (!commit) problems.push("hypothesis lacks `scope-commit:`, the commit that registered the scope before any read");
			else {
				const b = scopeBlobs(base, scope, commit);
				if (b.error) (mode === "check" && b.missing ? warnings : problems).push(b.error);
				else if (mode === "append" && b.working !== b.committed) problems.push(`the scope file ${scope} differs from commit ${commit}; commit the scope as it will run`);
			}
		}
	}

	if (part === "critique") {
		const verdict = field(body, "verdict");
		if (!VERDICTS.includes(verdict)) problems.push(`critique needs \`verdict:\` set to one of ${VERDICTS.join(", ")}`);
		else if (verdict !== "KEEP" && !field(body, "fatal-flaw")) problems.push("a critique that is not KEEP names the `fatal-flaw:`");
	}

	if (part === "execution") {
		const status = field(body, "status");
		if (!RUN_STATUS.includes(status)) problems.push(`execution needs \`status:\` set to one of ${RUN_STATUS.join(", ")}`);
		const evidence = fieldAll(body, "evidence");
		if (status === "completed" && evidence.length === 0) problems.push("a completed execution lists at least one `evidence:` path");
		const hyp = lastHypothesis(parts);
		const scope = hyp && field(hyp.body, "scope");
		const commit = hyp && field(hyp.body, "scope-commit");
		if (mode === "append") {
			if (config.requireScopeCommit && scope && commit) {
				const b = scopeBlobs(base, scope, commit);
				if (b.error) problems.push(b.error);
				else if (b.working !== b.committed) problems.push(`the scope file ${scope} changed after it was registered at ${commit}; a changed scope is a new hypothesis`);
				else extra = ` scope-blob=${b.committed}`;
			}
			const rows = [];
			for (const e of evidence) {
				const abs = path.resolve(base, e);
				if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) problems.push(`evidence file ${e} does not exist`);
				else {
					const h = hashFile(abs);
					rows.push(`- \`${e}\` sha256 ${h.sha256} bytes ${h.bytes}`);
				}
			}
			if (rows.length) appendix = `\n\n### Evidence hashes (recorded by the ledger CLI)\n\n${rows.join("\n")}`;
		} else {
			if (config.requireScopeCommit && scope && commit && ctx.attrs["scope-blob"]) {
				const b = scopeBlobs(base, scope, commit);
				if (!b.error && b.committed !== ctx.attrs["scope-blob"]) problems.push(`the executed scope is not the registered scope ${scope} at ${commit}`);
			}
			for (const m of body.matchAll(/^- `([^`]+)` sha256 ([0-9a-f]{64}) bytes \d+$/gm)) {
				const abs = path.resolve(base, m[1]);
				if (!fs.existsSync(abs)) warnings.push(`evidence file ${m[1]} is not on this machine`);
				else if (hashFile(abs).sha256 !== m[2]) problems.push(`evidence file ${m[1]} changed after the execution was recorded`);
			}
		}
	}

	if (part === "lesson") {
		const outcome = field(body, "outcome");
		if (!OUTCOMES.includes(outcome)) problems.push(`lesson needs \`outcome:\` set to one of ${OUTCOMES.join(", ")}`);
		else if (NEEDS_RUN.has(outcome) && !executed) problems.push(`outcome ${outcome} needs an execution part; nothing was run this cycle`);
		else if (outcome === "rejected" && executed) problems.push("outcome rejected means no read was spent, but this cycle has an execution part");
		const chronicle = section(body, "Chronicle");
		if (chronicle === null || chronicle === "") problems.push("lesson needs a `## Chronicle` section; the next cycle starts from it");
		else if (words(chronicle) > config.chronicleMaxWords) problems.push(`the chronicle is ${words(chronicle)} words; the limit is ${config.chronicleMaxWords}`);
	}
	return { problems, warnings, extra, appendix };
}

function checkFile(file, config, base) {
	const L = parse(readText(file));
	const w = walk(L.parts, config);
	const problems = [...L.problems, ...w.problems];
	const warnings = [];
	const seen = [];
	let executed = false;
	for (const p of L.parts) {
		const r = rules(p.name, p.body, { base, config, parts: seen, executed, attrs: p }, "check");
		problems.push(...r.problems);
		warnings.push(...r.warnings);
		if (p.name === "execution") executed = true;
		seen.push(p);
	}
	const lesson = L.parts.find((p) => p.name === "lesson");
	let outcome = null;
	if (L.seal) {
		outcome = L.seal.outcome;
		if (outcome !== "abandoned" && (!lesson || field(lesson.body, "outcome") !== outcome)) problems.push("the outcome on the seal does not match the lesson");
	}
	return { file, sealed: Boolean(L.seal), outcome, next: L.seal ? [] : w.allowed, round: w.hypotheses + 1, problems, warnings };
}

// ---- commands

function init(o) {
	const { dir } = places(o);
	fs.mkdirSync(dir, { recursive: true });
	const created = [];
	const config = path.join(dir, "ledger.config.json");
	if (!fs.existsSync(config)) {
		fs.writeFileSync(config, JSON.stringify({ ...DEFAULT_CONFIG, program: typeof o.program === "string" ? o.program : "" }, null, "\t") + "\n");
		created.push(config);
	}
	const directive = path.join(dir, "directive.md");
	if (!fs.existsSync(directive)) {
		fs.writeFileSync(directive, DIRECTIVE_TEMPLATE);
		created.push(directive);
	}
	return { dir, created, note: created.length ? "fill ledger.config.json before the first cycle" : "already initialised" };
}

function status(o) {
	const { dir, base } = places(o);
	const config = loadConfig(dir);
	const files = cycleFiles(dir).map((f) => checkFile(f, config, base));
	const outcomes = {};
	for (const f of files) if (f.sealed) outcomes[f.outcome] = (outcomes[f.outcome] ?? 0) + 1;
	const last = files.at(-1);
	const open = last && !last.sealed ? { file: last.file, next: last.next, round: last.round, problems: last.problems } : null;
	return { dir, base, program: config.program, directive: readDirective(dir).status, cycles: files.length, outcomes, open };
}

function cmdNew(o) {
	const { dir } = places(o);
	const config = loadConfig(dir);
	if (!config.program) throw new Fail(2, "ledger.config.json has no program name", "fill the config before the first cycle");
	const directive = readDirective(dir);
	if (directive.status !== "run") throw new Fail(3, `directive.md says ${directive.status}`, "the owner sets STATUS: run to continue", { directive: directive.status });
	const files = cycleFiles(dir);
	const parsed = files.map((f) => ({ f, L: parse(readText(f)) }));
	const last = parsed.at(-1);
	if (last && !last.L.seal) {
		const w = walk(last.L.parts, config);
		throw new Fail(4, `${path.basename(last.f)} is still open`, `resume it at part ${w.allowed.join(" or ")}, or \`abandon\` it with a reason`, {
			open: { file: last.f, next: w.allowed, round: w.hypotheses + 1 },
		});
	}
	let chronicle = "No prior cycle. The Analyst reads the records of the program from scratch.";
	for (const { L } of [...parsed].reverse()) {
		const lesson = L.parts.find((p) => p.name === "lesson");
		const text = lesson && section(lesson.body, "Chronicle");
		if (text) {
			chronicle = text;
			break;
		}
	}
	const n = files.length ? Number(path.basename(files.at(-1)).match(/\d+/)[0]) + 1 : 1;
	const list = (v) => {
		const items = (Array.isArray(v) ? v : [v]).filter(Boolean);
		return items.length ? items.map((x) => `\`${x}\``).join(", ") : "none";
	};
	const program = [
		`- program: ${config.program}`,
		`- goal: ${config.goal || "not stated"}`,
		`- rubric: ${list(config.rubric)}`,
		`- reads ledger: ${list(config.memory.readsLedger)}`,
		`- findings: ${list(config.memory.findings)}`,
		`- status documents: ${list(config.memory.status)}`,
		`- scope directory: ${list(config.scopeDir)}`,
		`- evidence directory: ${list(config.evidenceDir)}`,
		`- levers: ${list(config.levers)}`,
		`- never: ${Array.isArray(config.never) && config.never.length ? config.never.join("; ") : "nothing listed"}`,
	].join("\n");
	const head = `# Ledger cycle ${n}\n\nprogram: ${config.program}\nformat: ${FORMAT}\n\n`;
	const body = `### Chronicle\n\n${chronicle}\n\n### Directive\n\n${directive.body || "None."}\n\n### Program\n\n${program}`;
	const file = path.join(dir, `cycle-${String(n).padStart(4, "0")}.md`);
	const marker = `<!-- ledger:part name=chronicle role=runner at=${now()} prev=${sha(head)} -->`;
	writeAtomic(file, `${head}${marker}\n## ${PART_TITLE.chronicle}\n\n${body}\n`);
	return { file, cycle: n, next: ["facts"] };
}

function append(o) {
	need(o, "file", "part", "role");
	const { dir, base } = places(o);
	const config = loadConfig(dir);
	const text = readText(o.file);
	const L = parse(text);
	if (L.problems.length) throw new Fail(1, "the ledger does not verify; nothing was appended", "run `check`", { problems: L.problems });
	if (L.seal) throw new Fail(1, "the cycle is sealed", "start the next cycle with `new`");
	if (!PART_ROLE[o.part] || o.part === "chronicle") throw new Fail(2, `unknown part ${o.part}`, "facts, hypothesis, critique, execution or lesson");
	const w = walk(L.parts, config);
	if (!w.allowed.includes(o.part)) throw new Fail(1, `part ${o.part} may not be written now`, `the cycle expects ${w.allowed.join(" or ")}`, { next: w.allowed });
	if (PART_ROLE[o.part] !== o.role) throw new Fail(1, `role ${o.role} may not write part ${o.part}`, `only ${PART_ROLE[o.part]} writes it`);
	const body = norm(typeof o.from === "string" ? fs.readFileSync(o.from, "utf8") : fs.readFileSync(0, "utf8")).trim();
	if (body.includes("<!-- ledger:")) throw new Fail(1, "content may not contain a ledger marker");
	const r = rules(o.part, body, { base, config, parts: L.parts, executed: w.executed, attrs: {} }, "append");
	if (r.problems.length) throw new Fail(1, `part ${o.part} was refused; nothing was appended`, "fix the content and append again", { problems: r.problems });
	const round = o.part === "hypothesis" ? w.hypotheses + 1 : w.hypotheses;
	const title = PART_TITLE[o.part] + (["hypothesis", "critique"].includes(o.part) && round > 1 ? ` (round ${round})` : "");
	const pre = `${text.trimEnd()}\n\n`;
	const marker = `<!-- ledger:part name=${o.part} role=${o.role} at=${now()} prev=${sha(pre)}${r.extra} -->`;
	const next = `${pre}${marker}\n## ${title}\n\n${body}${r.appendix}\n`;
	writeAtomic(o.file, next);
	return { file: o.file, appended: o.part, next: walk(parse(next).parts, config).allowed };
}

function seal(o) {
	need(o, "file");
	const { dir, base } = places(o);
	const config = loadConfig(dir);
	const c = checkFile(o.file, config, base);
	if (c.sealed) return { file: o.file, outcome: c.outcome, note: "already sealed" };
	if (c.problems.length) throw new Fail(1, "the ledger does not verify; it was not sealed", undefined, { problems: c.problems });
	if (!c.next.includes("seal")) throw new Fail(1, "the cycle is not finished", `it expects ${c.next.join(" or ")}`, { next: c.next });
	const text = readText(o.file);
	const outcome = field(parse(text).parts.find((p) => p.name === "lesson").body, "outcome");
	const pre = `${text.trimEnd()}\n\n`;
	writeAtomic(o.file, `${pre}<!-- ledger:seal at=${now()} prev=${sha(pre)} outcome=${outcome} -->\n`);
	return { file: o.file, outcome, warnings: c.warnings };
}

function abandon(o) {
	need(o, "file", "reason");
	const text = readText(o.file);
	if (parse(text).seal) throw new Fail(1, "the cycle is already sealed");
	const pre = `${text.trimEnd()}\n\n> Abandoned by the runner: ${o.reason.replace(/\s+/g, " ").trim()}\n\n`;
	writeAtomic(o.file, `${pre}<!-- ledger:seal at=${now()} prev=${sha(pre)} outcome=abandoned -->\n`);
	return { file: o.file, outcome: "abandoned" };
}

function check(o) {
	const { dir, base } = places(o);
	const config = loadConfig(dir);
	const files = (typeof o.file === "string" ? [o.file] : cycleFiles(dir)).map((f) => checkFile(f, config, base));
	const bad = files.filter((f) => f.problems.length);
	if (bad.length) throw new Fail(1, `${bad.length} ledger file(s) do not verify`, undefined, { files });
	return { files };
}

const COMMANDS = { init, status, new: cmdNew, append, seal, abandon, check };
try {
	const [command, ...rest] = process.argv.slice(2);
	if (!COMMANDS[command]) throw new Fail(2, `unknown command ${command ?? "(none)"}`, `one of ${Object.keys(COMMANDS).join(", ")}`);
	process.stdout.write(JSON.stringify({ ok: true, command, ...COMMANDS[command](args(rest)) }, null, 2) + "\n");
} catch (e) {
	if (!(e instanceof Fail)) throw e;
	process.stdout.write(JSON.stringify({ ok: false, error: e.message, hint: e.hint, ...e.extra }, null, 2) + "\n");
	process.exitCode = e.code;
}
