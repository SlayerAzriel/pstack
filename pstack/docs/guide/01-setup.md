# Set up pstack

In this page you install the plugin, pick which models pstack uses, and run your first task. Setup is one command plus a short conversation.

## Install the plugin

In a Claude Code chat, run:

```text
/plugin marketplace add SlayerAzriel/pstack
/plugin install pstack@pstack-claude
```

For a local checkout, start Claude Code with `claude --plugin-dir ./pstack/pstack` instead. Either way, `/pstack:ask` answers from inside the session once the plugin is loaded.

## Pick your models

Run:

```text
/pstack:setup
```

[`/pstack:setup`](../../skills/setup/SKILL.md) detects the models you have access to, asks for a reasoning budget, shows you each role (code delegates, judgment, the review panels), and asks what you want. Answer the questions. It writes `~/.claude/pstack-models.md`, a small file every pstack skill reads.

The defaults run at `xhigh` effort, the same as the `large` budget. `unlimited` raises every role to `max`. `medium` and `small` lower the effort and spend fewer tokens. The budget sets the `effort` field on every subagent pstack spawns.

You only override what you care about. A role with no line in the rule keeps the skill's default. To restore a default, delete that role's line. A rerun of `/pstack:setup` keeps any role whose model differs from the default. When a default changes, a rule written before the change still pins the old default, so delete those role lines, or delete the file, then run `/pstack:setup` again.

Set a role to `inherit` and pstack omits the subagent `model` field, so the subagent inherits your parent chat model. For a panel role the value is a list, and one subagent runs per entry, so the list length sets the panel size. Setup also configures `swarm workers`, the default model for every `/pstack:swarm` worker unless a race names a model for each arm.

## Accept the verification offer, or don't

At the end of setup, `/pstack:setup` looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`/pstack:create-verification-skill`](../../skills/create-verification-skill/SKILL.md).

Say yes and it writes `.claude/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can run `/pstack:create-verification-skill` yourself any time. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers it in depth.

If you're new to pstack, say yes. An agent that can check its own work keeps going until the check passes. An agent that can't hands every result back to you to check by hand. Of everything in this guide, the verification skill pays off the most.

After setup, start a new chat. The model rule applies to new sessions.

## Keep the cost in check

pstack spends extra tokens on subagents and review panels. That's the price of the rigor. To spend fewer:

- Rerun `/pstack:setup` and pick a smaller reasoning budget or cheaper models. A strong model in the main chat with cheaper, faster models in the code roles is a good split.
- Set a role to `inherit` so it runs on the chat's own model.
- Shorten a panel list. Each entry runs one subagent.
- Save `/pstack:mode` for work that needs rigor. A small, obvious edit doesn't.

## Run your first task

Pick something real but small, and describe it the way you'd describe it to a colleague:

```text
/pstack:mode add a --json flag to this command. text output stays byte-identical. verify both.
```

Watch the todo list. Its first items are the matched playbook's steps copied in, the Feature playbook for this prompt. If `/pstack:mode` skips a step, the step stays in the list with `skip: <reason>`, so you can see what it chose not to do.

From here you can type normal follow-ups. To keep `/pstack:mode` on for a whole project, add one line to the project's `CLAUDE.md`:

```text
Use /pstack:mode for any non-trivial task.
```

Or install the optional `pstack-mode-pin` plugin from the same marketplace. It reminds the agent on every prompt and stays out of casual turns. Without either, `/pstack:mode` attaches to one message and fades as the chat moves on, so start each new task with it.

Next: [Route work through `/pstack:mode`](./02-mode.md).
