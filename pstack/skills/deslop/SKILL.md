---
name: deslop
description: Strip slop from a diff before it is committed. Narrating comments, unsupported guards, dead compatibility paths, debug leftovers, speculative options, and edits unrelated to the task. Use for /pstack:deslop, "deslop it", or before every commit under /pstack:mode.
---

# Deslop

Remove what a careful engineer would delete from this diff before asking for review. Behavior stays the same. The diff gets smaller.

## Scope

The caller's files or diff. Otherwise the current diff against the base branch, default `main`, including the working tree. Only lines the diff adds or changes. Slop that was already there is a separate task.

## Delete

- Narrating comments: `// loop over users`, `// Phase 2`, banners, "added for X". Keep only a why the code cannot show, a doc comment on a public API, a license header, or a link to a constraint.
- Guards no caller can trip: nil checks behind a validated boundary, a try/catch that swallows, defaults for impossible states, retries around a contract that does not fail. Per the **principle-boundary-discipline** and **principle-fix-root-causes** skills.
- Compatibility paths kept just in case: the old function beside the new one, a feature flag nobody reads, a shim with no remaining caller. Per **principle-migrate-callers-then-delete-legacy-apis**.
- Debug leftovers: console and print statements, commented-out code, TODOs that restate the diff, unused imports and parameters.
- Speculative generality: options, parameters, abstractions, and config with one caller or none. Per **principle-laziness-protocol**.
- Edits outside the task: reformatting of untouched lines, renames the task did not need, drive-by fixes. Revert them or move them to their own commit.
- Tests that still pass if every import returned `undefined`. Rewrite or delete per **principle-test-behavior-not-implementation**.
- AI tells in identifiers and strings: `enhanced`, `robust`, `helper2`, `newX`, a `Manager` with no state.

## Keep

A deletion that changes behavior is a fix, not deslop. Leave it, name it in the report, and route it to the Bug fix or Refactoring playbook.

## Process

1. Read the diff. List each candidate with its file, line, and the rule above.
2. Delete. Re-run the project's type check, lint, and the tests the diff touches.
3. If a deletion breaks a check, the thing was load-bearing. Restore it and record why in the report, not in a comment.

**Reply:** lines removed, by category, with file and line. Anything kept that looked like slop and why. Checks run and their result.
