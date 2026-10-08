#!/usr/bin/env node
// UserPromptSubmit hook. Reads the hook payload from stdin (ignored) and adds one
// line of context, the same reminder Cursor's pinned Custom Mode gives pstack.
// Never blocks: exit 0 on every path.
import process from "node:process";

const reminder =
  "pstack mode is pinned. New task? Playbook match or rigor needed -> invoke /pstack:mode (Skill pstack:mode) before working. Casual turn or user opts out -> don't.";

let chunks = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (chunks += c));
process.stdin.on("end", emit);
process.stdin.on("error", emit);
setTimeout(emit, 1000).unref();

let done = false;
function emit() {
  if (done) return;
  done = true;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: reminder,
      },
    }) + "\n"
  );
  process.exit(0);
}
