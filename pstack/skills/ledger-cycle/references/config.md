# The ledger config

`ledgers/ledger.config.json` describes one program. The runner fills it once, from the repository. The owner can edit it between cycles. `ledger new` copies its pointers into Part 0 of every cycle, so each role reads the same program block.

Paths are relative to the base directory, the parent of `ledgers/`.

| field | meaning |
|---|---|
| `program` | A short name. Required before the first cycle. |
| `goal` | One sentence. What the program is trying to establish, and what counts as done. |
| `rubric` | Files the Critic applies as gates, in full. A validation skill, a research-discipline document, a checklist. |
| `memory.readsLedger` | The file that lists every read so far. The Theorist checks it for dead variants. The Summarizer adds a row per read. Leave it empty if the program keeps none. |
| `memory.findings` | The directory or file where each result is written up. |
| `memory.status` | Status and gate documents the Analyst reads and the Summarizer keeps current. |
| `scopeDir` | Where the Theorist writes scope files. Must be inside a git repository when `requireScopeCommit` is true. |
| `evidenceDir` | Where the Decider writes the output of a read. |
| `levers` | The commands that count as a read: a harness, a benchmark, an eval. The Analyst and the Critic never run them. |
| `never` | Actions no role may take. Copy them from the agent instruction file of the project. |
| `maxRevisions` | How many times a hypothesis may be revised after a `REVISE`. Default 2. |
| `chronicleMaxWords` | The limit on the chronicle. Default 300. |
| `requireScopeCommit` | When true, the hypothesis names the commit that registered its scope, and the CLI refuses an execution if the scope file changed since. Default true. Set it to false only for a program outside git. |
| `factsLint.banned` | Regular expressions the facts part may not match. `null` uses the default list. `[]` turns the lint off. |

## Example

```json
{
	"program": "checkout latency",
	"goal": "Find a change that lowers p95 checkout latency by 15% on the replay set without raising the error rate.",
	"rubric": ["docs/perf-experiment-rules.md"],
	"memory": {
		"readsLedger": "docs/perf-reads.md",
		"findings": "docs/perf-findings",
		"status": ["docs/perf-status.md"]
	},
	"scopeDir": "docs/perf-scopes",
	"evidenceDir": "perf/evidence",
	"levers": ["node perf/replay.mjs"],
	"never": ["deploy", "change production flags", "edit the replay set"],
	"maxRevisions": 2,
	"chronicleMaxWords": 300,
	"requireScopeCommit": true,
	"factsLint": { "banned": null }
}
```

## The directive

`ledgers/directive.md` is the control file of the owner. The first line that starts with `STATUS:` is `run`, `pause` or `stop`. `ledger new` refuses to start a cycle unless it is `run`. The rest of the file, without HTML comments, is copied into Part 0 of the next cycle. Write it as plain sentences. A directive can set a priority, veto a family, or record a decision. It cannot waive a rule of the ledger.
