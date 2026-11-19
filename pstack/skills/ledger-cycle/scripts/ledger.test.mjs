// Tests for ledger.mjs. Run with: node --test pstack/skills/ledger-cycle/scripts/
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("./ledger.mjs", import.meta.url));

function run(cwd, ...a) {
	const r = spawnSync(process.execPath, [CLI, ...a], { cwd, encoding: "utf8" });
	let json;
	try {
		json = JSON.parse(r.stdout);
	} catch {
		json = { raw: r.stdout, stderr: r.stderr };
	}
	return { code: r.status, ...json };
}
function g(cwd, ...a) {
	return execFileSync("git", a, { cwd, encoding: "utf8" }).trim();
}
function project() {
	const d = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-"));
	g(d, "init", "-q");
	g(d, "config", "user.email", "test@example.com");
	g(d, "config", "user.name", "test");
	g(d, "config", "commit.gpgsign", "false");
	assert.equal(run(d, "init", "--program", "demo").code, 0);
	return d;
}
function part(d, file, name, role, text) {
	const tmp = path.join(d, `.part-${name}.md`);
	fs.writeFileSync(tmp, text);
	return run(d, "append", "--file", file, "--part", name, "--role", role, "--from", tmp);
}
function registerScope(d, name, text = "Hypothesis: X beats placebo.\nPass: folds >= 4 of 5.\nKill: anything else.\n") {
	fs.mkdirSync(path.join(d, "docs"), { recursive: true });
	fs.writeFileSync(path.join(d, "docs", name), text);
	g(d, "add", `docs/${name}`);
	g(d, "commit", "-q", "-m", `scope ${name}`);
	return g(d, "rev-parse", "HEAD");
}
const FACTS = "Reads recorded: 3 in `docs/reads.md:12`. Last read netted -1.1 per trade, `docs/reads/r3.txt:40`.\n";
const hypothesis = (sha, scope = "docs/v1-scope.md") =>
	`family: ctx\nvariant: v1\nscope: ${scope}\nscope-commit: ${sha}\n\nStatement: a longer window raises the fold count.\n`;
const KEEP = "verdict: KEEP\nviability: 70\n\nEvery rubric gate is met.\n";
const LESSON = (outcome) => `outcome: ${outcome}\n\nThe registered bar was 4 of 5 folds. Observed 2 of 5.\n\n### Chronicle\n\nOne read so far, one kill. Variant v1 is dead at 2 of 5 folds.\n`;

function runFullCycle(d) {
	const { file } = run(d, "new");
	assert.equal(part(d, file, "facts", "analyst", FACTS).code, 0);
	const sha = registerScope(d, "v1-scope.md");
	assert.equal(part(d, file, "hypothesis", "theorist", hypothesis(sha)).code, 0);
	assert.equal(part(d, file, "critique", "critic", KEEP).code, 0);
	fs.mkdirSync(path.join(d, "evidence"), { recursive: true });
	fs.writeFileSync(path.join(d, "evidence", "v1.txt"), "folds 2/5\n");
	const exec = part(d, file, "execution", "decider", "status: completed\nevidence: evidence/v1.txt\n\nRan the registered command. Exit 0.\n");
	assert.equal(exec.code, 0, JSON.stringify(exec));
	assert.equal(part(d, file, "lesson", "summarizer", LESSON("kill")).code, 0);
	return file;
}

test("a full cycle seals, verifies, and hands its chronicle to the next cycle", () => {
	const d = project();
	const file = runFullCycle(d);
	const sealed = run(d, "seal", "--file", file);
	assert.equal(sealed.code, 0, JSON.stringify(sealed));
	assert.equal(sealed.outcome, "kill");
	assert.equal(run(d, "check").code, 0);
	const text = fs.readFileSync(file, "utf8");
	assert.match(text, /scope-blob=[0-9a-f]{40}/);
	assert.match(text, /`evidence\/v1\.txt` sha256 [0-9a-f]{64} bytes 10/);
	const next = run(d, "new");
	assert.equal(next.cycle, 2);
	assert.match(fs.readFileSync(next.file, "utf8"), /Variant v1 is dead at 2 of 5 folds\./);
	assert.deepEqual(run(d, "status").outcomes, { kill: 1 });
});

test("facts are refused when they judge or propose, and accepted when the words are quoted", () => {
	const d = project();
	const { file } = run(d, "new");
	const refused = part(d, file, "facts", "analyst", "Net was -1.1 in `docs/r.txt:4`. We should try a longer window.\n");
	assert.equal(refused.code, 1);
	assert.match(refused.problems.join(" "), /may not judge or propose: "should"/);
	assert.equal(part(d, file, "facts", "analyst", "No numbers cited anywhere.\n").code, 1);
	const quoted = part(d, file, "facts", "analyst", "The scope file `docs/proposal.md:3` reads:\n\n> we should try a longer window\n");
	assert.equal(quoted.code, 0, JSON.stringify(quoted));
});

test("nothing executes without a KEEP, and a rejected cycle ends with a lesson", () => {
	const d = project();
	const { file } = run(d, "new");
	part(d, file, "facts", "analyst", FACTS);
	const sha = registerScope(d, "v1-scope.md");
	assert.equal(part(d, file, "execution", "decider", "status: completed\n").code, 1);
	part(d, file, "hypothesis", "theorist", hypothesis(sha));
	assert.equal(part(d, file, "critique", "critic", "verdict: REJECT\n").code, 1, "a REJECT must name its fatal flaw");
	assert.equal(part(d, file, "critique", "critic", "verdict: REJECT\nfatal-flaw: repeats a dead variant\n").code, 0);
	const blocked = part(d, file, "execution", "decider", "status: completed\nevidence: x\n");
	assert.equal(blocked.code, 1);
	assert.deepEqual(blocked.next, ["lesson"]);
	assert.equal(part(d, file, "lesson", "summarizer", LESSON("kill")).code, 1, "kill needs an execution");
	assert.equal(part(d, file, "lesson", "summarizer", LESSON("rejected")).code, 0);
	assert.equal(run(d, "seal", "--file", file).outcome, "rejected");
});

test("the scope must be committed, and may not change between registration and execution", () => {
	const d = project();
	const { file } = run(d, "new");
	part(d, file, "facts", "analyst", FACTS);
	fs.mkdirSync(path.join(d, "docs"));
	fs.writeFileSync(path.join(d, "docs", "v1-scope.md"), "draft\n");
	assert.equal(part(d, file, "hypothesis", "theorist", hypothesis("HEAD")).code, 1, "an uncommitted scope is refused");
	const sha = registerScope(d, "v1-scope.md");
	assert.equal(part(d, file, "hypothesis", "theorist", hypothesis(sha)).code, 0);
	part(d, file, "critique", "critic", KEEP);
	fs.appendFileSync(path.join(d, "docs", "v1-scope.md"), "Pass: folds >= 2 of 5.\n");
	fs.writeFileSync(path.join(d, "e.txt"), "x");
	const moved = part(d, file, "execution", "decider", "status: completed\nevidence: e.txt\n");
	assert.equal(moved.code, 1);
	assert.match(moved.problems.join(" "), /changed after it was registered/);
});

test("revisions are bounded and each round needs a fresh critique", () => {
	const d = project();
	const { file } = run(d, "new");
	part(d, file, "facts", "analyst", FACTS);
	const sha = registerScope(d, "v1-scope.md");
	const revise = "verdict: REVISE\nfatal-flaw: the kill criterion is not a number\n";
	for (let round = 1; round <= 3; round++) {
		assert.equal(run(d, "status").open.round, round, "the Theorist is told the round it opens");
		assert.equal(part(d, file, "hypothesis", "theorist", hypothesis(sha)).code, 0, `round ${round}`);
		assert.equal(run(d, "status").open.round, round, "the Critic works in the round of the hypothesis");
		assert.equal(part(d, file, "hypothesis", "theorist", hypothesis(sha)).code, 1, "two hypotheses in a row");
		assert.equal(part(d, file, "critique", "critic", revise).code, 0);
	}
	const fourth = part(d, file, "hypothesis", "theorist", hypothesis(sha));
	assert.equal(fourth.code, 1);
	assert.deepEqual(fourth.next, ["lesson"]);
	assert.match(fs.readFileSync(file, "utf8"), /## Part 2\. Hypothesis and registered scope \(round 3\)/);
});

test("only the named role writes a part", () => {
	const d = project();
	const { file } = run(d, "new");
	assert.equal(part(d, file, "facts", "theorist", FACTS).code, 1);
	assert.equal(part(d, file, "facts", "analyst", FACTS).code, 0);
});

test("an edit to an earlier part breaks the chain", () => {
	const d = project();
	const file = runFullCycle(d);
	run(d, "seal", "--file", file);
	fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("netted -1.1", "netted +1.1"));
	const c = run(d, "check", "--file", file);
	assert.equal(c.code, 1);
	assert.match(c.files[0].problems.join(" "), /hash chain broken/);
});

test("changed evidence is a problem and missing evidence is a warning", () => {
	const d = project();
	const file = runFullCycle(d);
	run(d, "seal", "--file", file);
	fs.writeFileSync(path.join(d, "evidence", "v1.txt"), "folds 5/5\n");
	const changed = run(d, "check", "--file", file);
	assert.equal(changed.code, 1);
	assert.match(changed.files[0].problems.join(" "), /changed after the execution was recorded/);
	fs.rmSync(path.join(d, "evidence", "v1.txt"));
	const missing = run(d, "check", "--file", file);
	assert.equal(missing.code, 0);
	assert.match(missing.files[0].warnings.join(" "), /not on this machine/);
});

test("the directive pauses the program and an open cycle blocks the next one", () => {
	const d = project();
	const dir = path.join(d, "ledgers");
	fs.writeFileSync(path.join(dir, "directive.md"), "STATUS: pause\n\nWait for the data pull.\n");
	assert.equal(run(d, "new").code, 3);
	fs.writeFileSync(path.join(dir, "directive.md"), "STATUS: run\n\nPrioritise the exits family.\n");
	const first = run(d, "new");
	assert.match(fs.readFileSync(first.file, "utf8"), /Prioritise the exits family\./);
	const again = run(d, "new");
	assert.equal(again.code, 4);
	assert.deepEqual(again.open.next, ["facts"]);
	assert.equal(run(d, "abandon", "--file", first.file, "--reason", "analyst failed twice").outcome, "abandoned");
	assert.equal(run(d, "check").code, 0);
	assert.equal(run(d, "new").cycle, 2);
});

test("a CRLF checkout still verifies", () => {
	const d = project();
	const file = runFullCycle(d);
	run(d, "seal", "--file", file);
	fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/\n/g, "\r\n"));
	fs.writeFileSync(path.join(d, "evidence", "v1.txt"), "folds 2/5\r\n");
	const c = run(d, "check", "--file", file);
	assert.equal(c.code, 0, JSON.stringify(c));
});
