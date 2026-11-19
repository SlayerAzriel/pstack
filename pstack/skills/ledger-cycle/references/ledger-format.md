# The ledger format

One cycle is one file, `ledgers/cycle-NNNN.md`. Only the ledger CLI writes it. Each part starts with a marker line that the CLI generates.

```text
<!-- ledger:part name=facts role=analyst at=2026-01-05T09:12:44Z prev=<sha256 of everything above this line> -->
```

A sealed cycle ends with a `ledger:seal` marker that carries the outcome.

## Parts

| part | role | title | required at the top of the part |
|---|---|---|---|
| `chronicle` | runner | Part 0. Chronicle, directive and program | written by `ledger new` |
| `facts` | analyst | Part 1. Facts | at least one source in backticks |
| `hypothesis` | theorist | Part 2. Hypothesis and registered scope | `family:`, `variant:`, `scope:`, `scope-commit:` |
| `critique` | critic | Part 3. Critique | `verdict:`, and `fatal-flaw:` unless the verdict is `KEEP` |
| `execution` | decider | Part 4. Execution | `status:`, and one `evidence:` line per file when completed |
| `lesson` | summarizer | Part 5. Lesson | `outcome:`, and a `## Chronicle` section |

A required line is plain text at the start of a line: `verdict: KEEP`. A bold label or a list bullet in front of it is not read.

## Order

```text
chronicle -> facts -> hypothesis -> critique
critique KEEP    -> execution -> lesson -> seal
critique REVISE  -> hypothesis (while revisions remain) or lesson
critique REJECT  -> lesson -> seal
facts            -> lesson (nothing to register)
```

## What the CLI enforces

- **Order and author.** A part is refused when the cycle expects another part, or when the role is not the one that owns it.
- **Facts stay facts.** The facts part is refused when it uses a word that judges or proposes, outside backticks, code fences and quoted lines. It is refused when it cites no source.
- **The scope is registered first.** The hypothesis is refused unless its scope file is in the named commit and unchanged since. The execution is refused if the scope file changed after that. The execution marker records the blob of the scope that ran, and `check` compares it with the registered commit.
- **No read without a KEEP.** The execution part is refused unless the latest critique says `KEEP`. A cycle has at most one execution part.
- **Evidence is pinned.** Each `evidence:` file must exist. The CLI records its hash and size. `check` reports a file that changed as a problem and a file that is absent as a warning.
- **The outcome matches the cycle.** `pass`, `kill` and `inconclusive` need an execution part. `rejected` needs none.
- **The chronicle is bounded.** The lesson is refused without a `## Chronicle` section or with one over the word limit.
- **The file is append-only.** Each marker carries a hash of everything above it. `check` and `seal` recompute the chain. An edit to an earlier part breaks it.

## Limits

The hash chain detects an edit. It does not prevent one. A writer who recomputes every later hash can rewrite a file, so git history is the second witness: commit each cycle when it seals. Removing `Edit` and `Write` from the Analyst and the Critic narrows what they can do, but a role with a shell can still write a file. The roles are kept honest by their contract, by the order of the parts, and by a Critic and a Summarizer that reopen the sources.

## Commands

```text
ledger init    [--dir ledgers] [--program NAME]
ledger status  [--dir ledgers]
ledger new     [--dir ledgers]
ledger append  --file F --part P --role R [--from FILE]
ledger seal    --file F
ledger abandon --file F --reason TEXT
ledger check   (--file F | --dir ledgers)
```

Exit 0 is success. Exit 1 is a broken rule, with a `problems` list. Exit 2 is a usage error. Exit 3 means the directive says pause or stop. Exit 4 means the previous cycle is still open.

The tests are beside the CLI. Run them with `node --test` on the `scripts` directory.
