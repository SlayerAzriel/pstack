# Design notes

## Where it comes from

The cycle adapts the Single Ledger Architecture described by Sagnelli et al. in "An autonomous agentic framework for cross-campaign generalization and sensor shift adaptation", Machine Learning: Science and Technology 7 055009 (2026), https://doi.org/10.1088/2632-2153/ae9fb7. That paper splits an autonomous experiment loop into isolated phases that communicate through one append-only markdown file, with a carry-forward summary at the head of each cycle and a control file for the human. No code from that project is used here.

## What is kept

- **Isolated phases and one ledger.** A role that reads numbers and proposes strategy in the same pass mixes the two. A fresh subagent per role, with the ledger as its only input, keeps a stated fact apart from an argument built on it.
- **A critic before execution.** The attack on a hypothesis is a fixed stage that runs every cycle, before a read is spent, not a review someone asks for afterward.
- **The chronicle.** A short summary, rewritten each cycle, is the only history the next cycle starts from. State does not have to be rebuilt from the whole record.
- **The directive file.** The owner steers between cycles through a file in the repository, so a decision is recorded where the roles read it.

## What is added

- **Registration in git.** The scope of a read is committed before the read, and the CLI refuses an execution whose scope changed. Pre-registration is checked by a tool, not promised by a prompt.
- **A hash chain and pinned evidence.** A later edit to a part, or to an evidence file, is detectable.
- **A lint on the facts.** The Analyst cannot judge or propose, because the CLI refuses the words.
- **A state machine.** The order of the parts is a property of the file, so the runner does not decide it.

## What is left out, on purpose

- **A reward-driven graph memory.** The paper scores past actions with Q-values and steers the next experiment toward what scored well. On a search metric that is a mechanism for overfitting: the paper's own lockbox result sits about eight points below its in-search peaks. A program that must not fool itself wants the opposite pressure, a bar that rises with every read. Keep that bar in the rubric and the reads ledger.
- **Ghost nodes.** Injecting the best states of earlier campaigns as hints transfers what scored well. Lessons transfer more safely as rules: a new gate in the rubric after a failure.
- **Adaptive lenses and a learned memory ranker.** Machinery with no evidence that it changes outcomes.

## What it does not do

It makes a research loop harder to fool and easier to audit. It does not make a real effect more likely to exist.
