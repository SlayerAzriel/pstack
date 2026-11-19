---
name: ledger-cycle
description: "Run one cycle of a research or experiment program through five isolated roles (Analyst, Theorist, Critic, Decider, Summarizer) that share only an append-only ledger file. Each cycle registers one scope in git, has it attacked before anything runs, spends at most one read, and writes the chronicle the next cycle starts from. Use for /pstack:ledger-cycle, 'run a ledger cycle', 'research loop', or a standing program of pre-registered experiments. Pair with /loop to run cycles unattended."
argument-hint: "[init | status | nothing to run the next cycle]"
---

# Ledger cycle

One cycle of a standing experiment program. Five roles write one file in a fixed order. Each role is a fresh subagent that sees the file and nothing of this conversation. A CLI is the only writer, and it refuses a part that breaks the order or its rules.

You are the runner. You move the baton. You do not write a part, you do not read raw results, and you do not give a role your opinion.

The ledger CLI is `node "${CLAUDE_SKILL_DIR}/scripts/ledger.mjs"`, written below as `ledger`. Every command prints one JSON object. The ledgers directory is `ledgers/` in the current project unless you pass `--dir`. Its parent is the base directory that paths inside a ledger are relative to.

## Arguments

- `init` sets up a program, then stops.
- `status` runs `ledger status`, reports it, then stops.
- Nothing runs the next cycle. Text after the command is not a directive. The owner writes directives in `ledgers/directive.md`.

## Set up a program

Do this once per program.

1. Run `ledger init --program "<name>"`. It writes `ledgers/ledger.config.json` and `ledgers/directive.md`.
2. Fill the config from the repository, not from the user. [`references/config.md`](references/config.md) names each field. Look for a rubric the project already has, such as a validation skill or a research-discipline document. Look for the records it already keeps: a reads ledger, a findings directory, status documents. Look for where its scopes and evidence live, and for the commands that count as a read. Copy the never-list from the agent instruction file of the project.
3. Reply with the config, and stop. The next invocation runs cycle 1. A program with history needs no import. The Analyst of cycle 1 reads the records.

## Run a cycle

Open a todo list with these steps.

1. **Start or resume.** Run `ledger new`.
   - Exit 0: a new cycle file exists with Part 0.
   - Exit 3: the directive says pause or stop. Report it and end the turn. Under `/loop`, a stop ends the loop.
   - Exit 4: a cycle is still open. Resume it at the part the output names.
2. **Run the roles in the order the CLI gives.** After every role, run `ledger status` and take the next part from `open.next`. Never decide the order yourself.

   | next part | agent to spawn |
   |---|---|
   | `facts` | `pstack:ledger-analyst` |
   | `hypothesis` | `pstack:ledger-theorist` |
   | `critique` | `pstack:ledger-critic` |
   | `execution` | `pstack:ledger-decider` |
   | `lesson` | `pstack:ledger-summarizer` |

   When `open.next` offers both `hypothesis` and `lesson`, spawn the Theorist. If the Theorist returns `no hypothesis`, spawn the Summarizer.
3. **Give each role this brief and nothing else.**

   ```text
   LEDGER  <absolute path of the cycle file>
   CLI     node "<absolute path of ledger.mjs>"
   DIR     <absolute path of the ledgers directory>
   BASE    <absolute path of the base directory>
   ROUND   <open.round, for the Theorist and the Critic>
   ```

   No summary of this conversation. No hint about what to find, propose or conclude. A role that needs context reads the ledger.
4. **Handle a role that did not append.** If `open.next` is unchanged when a role returns, spawn a fresh agent once with the same brief. After a second miss, run `ledger abandon --file <file> --reason "<role> did not append twice"` and report it. Never write the part yourself. Never resume the old agent.
5. **Seal.** When `open.next` is `seal`, run `ledger seal --file <file>`. A refusal lists the problems. They are defects of the cycle. Report them. Do not patch the file.
6. **Commit.** Stage the cycle file by explicit path and commit it as `ledger: cycle <n> <outcome> <variant>`. Push when the rules of the project allow it.
7. **Reply.** Read Part 5 of the cycle file, and only Part 5.

## Spawning

Spawn each role in the foreground, one at a time, with no worktree isolation. The roles share one checkout, because the scope commit, the evidence and the ledger all live in it. Run one cycle at a time per ledgers directory. A second program gets its own directory.

Each spawn names a role line in `~/.claude/pstack-models.md` and a default. Set `model` to the value of that line, or to the default if the file or the line is missing. Leave `model` unset when the value is `inherit`. Set `effort` from the `# budget` line of that file when one exists.

| role | role line | default |
|---|---|---|
| Analyst | `ledger analyst` | `sonnet` |
| Theorist | `ledger theorist` | `opus` |
| Critic | `ledger critic` | `opus` |
| Decider | `ledger decider` | the `feature, refactoring` line, else `sonnet` |
| Summarizer | `ledger summarizer` | `opus` |

If the Agent tool does not know a `pstack:ledger-*` type, spawn `general-purpose` and paste the body of `${CLAUDE_PLUGIN_ROOT}/agents/ledger-<role>.md` above the brief.

## Rules for the runner

- One cycle per invocation. Under `/loop`, each firing is one cycle.
- Never write, edit or delete a cycle file, a scope file or an evidence file.
- Never read evidence or raw output. You read `ledger status`, the one-line return of each role, and Part 5 for the reply. What you have not read, you cannot leak into the next brief.
- The directive and the config belong to the owner. Do not edit either after setup. A rubric is never relaxed to let a cycle through.
- A kill is a result. Do not run a second read in the same cycle to rescue it.

## Run it unattended

```text
/loop /pstack:ledger-cycle
```

Each firing runs one cycle and commits it. The owner steers between cycles by editing `ledgers/directive.md`: plain sentences for priorities, vetoes and decisions, and `STATUS: pause` or `STATUS: stop` to halt. Every role of the next cycle reads that text in Part 0.

## References

- [`references/config.md`](references/config.md). The fields of `ledger.config.json`.
- [`references/ledger-format.md`](references/ledger-format.md). The parts, their required lines, and what the CLI enforces.
- [`references/design.md`](references/design.md). Where the design comes from, and what it leaves out on purpose.

**Reply:** the cycle number and its outcome, the family and variant, the verdict table copied from Part 5, the path of the cycle file and its commit, any warning from the seal, and the decisions the chronicle lists for the owner. For `init`, the config. For `status`, the counts by outcome and the open cycle if there is one.
