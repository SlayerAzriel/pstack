# Harness recipes for CLIs, TUIs, services, and mobile

The control CLI template covers web and Electron. These are the generic recipes for the other surfaces. Pick the one the interview points at, write it into the generated skill with the real commands, and ship any helper as an executable file whose invocation the skill body shows.

## CLI and TUI: a PTY session per drive

A short-lived CLI needs no server. Build once, then start each drive in its own isolated terminal so nothing leaks between drives.

### tmux (macOS, Linux, WSL)

```bash
tmux new-session -d -s verify-<app> -x 120 -y 40 '<command under test>'
tmux send-keys -t verify-<app> '<keystrokes>' Enter
sleep 1
tmux capture-pane -t verify-<app> -p -S -200 > .claude/verify-evidence/<run-id>/<step>.txt
tmux kill-session -t verify-<app>
```

`capture-pane -p` prints what a user would see, including TUI layout. Capture before and after every interaction. Kill only the session you named.

### pexpect (any platform with Python)

```python
import pexpect, sys
child = pexpect.spawn("<command under test>", encoding="utf-8", timeout=10, dimensions=(40, 120))
child.logfile_read = open(".claude/verify-evidence/<run-id>/<step>.txt", "w")
child.expect("<prompt or banner>")
child.sendline("<input>")
child.expect("<expected output>")
child.sendline("quit")
child.expect(pexpect.EOF)
print(child.exitstatus)
```

On Windows, `pexpect` needs `pywinpty` (`pip install pexpect pywinpty`) and `pexpect.popen_spawn.PopenSpawn` for non-PTY programs.

### Plain subprocess, when the CLI is not interactive

```bash
<command> <args> > .claude/verify-evidence/<run-id>/stdout.txt 2> .claude/verify-evidence/<run-id>/stderr.txt; echo "exit=$?" > .claude/verify-evidence/<run-id>/exit.txt
```

Assert on exit code, stdout, stderr, and the files the command promises to write, not on one of them.

## HTTP service

```bash
curl -sS -o .claude/verify-evidence/<run-id>/<step>.json -w '%{http_code} %{time_total}\n' -X POST "$BASE_URL/<route>" -H 'content-type: application/json' -d '<body>'
```

Read the body back with `node -e` or `jq` and assert literal values. Then read the side effect through a second route or the datastore, never through the handler's own return value alone. Keep a `doctor` that hits the health route and checks the build id.

## Native mobile

iOS: `xcrun simctl boot "<device>"`, `xcrun simctl install booted <app>`, `xcrun simctl launch booted <bundle id>`, `xcrun simctl io booted screenshot <file>`. Drive the UI with an XCUITest target or `idb`. Android: `adb shell am start`, `adb shell input tap|text|keyevent`, `adb exec-out screencap -p > <file>`, `adb shell uiautomator dump` for the view tree. Tear down with `xcrun simctl shutdown` or `adb emu kill` on the device you booted, never on every device.

## What every recipe must state

- **Launch and ready signal.** The command, and the line or probe that says it is up.
- **Doctor.** One read-only check that the instance is worth driving.
- **Handles.** The prompts, routes, or view ids the feature map cites.
- **Evidence.** Where each capture goes, named by what it proves.
- **Cleanup.** Kill what you started, by the id you recorded.
