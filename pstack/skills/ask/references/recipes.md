# Prompts worth copying

Swap in the real paths, skills, and done checks. Informal wording works.

## Understand

- `/pstack:mode read <thread>. restate the underlying issue in your own words, in plain english.`
- `/pstack:mode investigate why <symptom>. give me what we know, what data you used, and your best hypotheses. don't change any code yet.`
- `use /pstack:how to understand <subsystem>. then use /pstack:why to find out why it broke recently.`
- `/pstack:recall my work on <topic> from last week, then read <issue>.`
- `/pstack:teach me why you implemented it this way and not <other way>. what did you trade off?`
- `/pstack:mode take over this branch. read the decision log, find what's done, and continue. don't redo finished work.`

## Build

- Bug: `/pstack:mode <symptom>. repro first, then fix and verify.`
- Bug in an app: `/pstack:mode repro this with /verify-<app>. if it repros on main, fix it and show me a video as proof.`
- Bug with a cheap test: `/pstack:mode repro <bug> first. if there's a cheap test path, /pstack:tdd it. then fix and rerun.`
- Feature: `/pstack:mode add <behavior>. <current output> stays byte-identical. verify both.`
- Refactor: `/pstack:mode move <code> into one module, zero behavior change. record the current output first and prove it's unchanged after.`
- Perf: `/pstack:mode <operation> takes <time> on <fixture>. trace it, fix the measured cause, show me before and after.`

## Design and plan

- `/pstack:mode prototype a few options for <feature>. take screenshots or videos for me to compare.`
- `/pstack:mode we need <feature>. /pstack:architect it first, and answer open questions with prototypes. let me review before proceeding.`
- `/pstack:mode write a tutorial for how i would use <new package> first. then /pstack:teach me why it beats the current one.`
- `ask /pstack:arena for a second opinion on this thread and our approach.`
- `/pstack:mode turn this design into a plan. small verifiable PRs, each with its own verification steps.`
- `/pstack:mode plan the migration of <library> to <target>. small verifiable PRs. the result must match the original exactly, bugs included.`

## Review and ship

- `/pstack:interrogate the whole branch, but skeptically. don't change anything yet. no nitpicks unless it's a real bug or regression.` Read the dismissals too.
- `/pstack:swarm check every package under <dir> against its check script. one worker per package. one report.`
- `/pstack:mode open the pr. small ordered commits, evidence in the description.`
- `/pstack:mode babysit this pr. get it green.` For status only: `/pstack:mode check on pr <number>. anything outstanding?`
- `/pstack:mode land the stack.`

## Away and back

- `/pstack:mode im going to bed. <goal> in a fresh worktree off <base>. done means <checks>. keep a decision log. don't ask me before committing. /loop until done. if you're truly stuck after a few hours, stop and write up why.`
- `/pstack:show-me-your-work catch me up on what you did last night.` Read its Attention section first.
- `/pstack:mode full autopilot on this queue. each item is independent.`
- `/pstack:mode autopilot these changes but stack them, don't ship. i'll land the stack.`
- `/pstack:reflect capture what we learned so the next run doesn't repeat it.` Approve only edits that change a future decision.
- `/pstack:bro` restates the last reply in plain words.
