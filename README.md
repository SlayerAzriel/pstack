# pstack for Claude Code

A Claude Code port of [pstack](https://github.com/cursor/plugins/tree/main/pstack), Lauren Tan's set of rigorous engineering skills for coding agents. The original targets Cursor. This repository carries the same playbooks, skills, and principles as a Claude Code plugin, plus a verification skill generator built for Claude Code's tools.

pstack's own summary still applies: if you want to go fast, go deep first. The goal is not more code. It is less code, verified.

## Install

From a session, with this repository pushed to GitHub:

```text
/plugin marketplace add SlayerAzriel/pstack
/plugin install pstack@pstack-claude
```

From a local checkout, for development:

```bash
claude --plugin-dir ./pstack/pstack
```

Then run `/pstack:setup` once to pick models and an effort budget, and start any non-trivial task with `/pstack:mode`. Type `/pstack:ask` with a question when you are not sure which skill fits.

The optional `pstack-mode-pin` plugin in the same marketplace keeps the mode on for every prompt. A one-line `CLAUDE.md` entry does the same without a hook. Both are described in the [setup guide](pstack/docs/guide/01-setup.md).

## Layout

| Path | What it is |
|---|---|
| [`pstack/`](pstack/) | The plugin. Read its [README](pstack/README.md) for the full skill list, the 23 playbooks, and the 24 principles. |
| [`mode-pin/`](mode-pin/) | Optional plugin. One hook that reminds the agent to apply `/pstack:mode`. |
| [`PORTING.md`](PORTING.md) | What changed from the Cursor original, what did not port, and what is not yet verified. Read this before trusting the port. |
| [`scripts/check-skills.mjs`](scripts/check-skills.mjs) | Validator for frontmatter, links, and leftover Cursor vocabulary. |

## Validate

```bash
node scripts/check-skills.mjs
```

```bash
claude plugin validate ./pstack
```

## Credits and license

pstack is by [Lauren Tan](https://x.com/poteto), MIT licensed. This port keeps the license and the attribution. The ideas are hers. The Claude Code plumbing, the deslop skill, the verification skill rewrite, and the porting notes are additions made for this port.
