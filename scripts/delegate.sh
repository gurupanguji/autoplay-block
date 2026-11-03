#!/usr/bin/env bash
# Delegate a task spec to pi, then run tests/lint. Full output goes to
# .orchestration/NNN/; stdout is a summary of at most 30 lines.
# Usage: scripts/delegate.sh tasks/NNN-<slug>.md
# Env:   PI_MODEL (default openai-codex/gpt-6-luna), TEST_CMD, LINT_CMD
set -uo pipefail

spec="${1:-}"
[ -f "$spec" ] || { echo "usage: $0 tasks/NNN-<slug>.md" >&2; exit 2; }

root="$(git rev-parse --show-toplevel)" || exit 2
cd "$root" || exit 2

branch="$(git branch --show-current)"
if [ "$branch" = "main" ]; then
  echo "refusing to delegate on main; switch to a feature branch" >&2
  exit 2
fi

num="$(basename "$spec" | sed -E 's/^([0-9]+).*/\1/')"
case "$num" in ''|*[!0-9]*) echo "spec name must start with NNN-" >&2; exit 2 ;; esac

PI_MODEL="${PI_MODEL:-openai-codex/gpt-6-luna}"
TEST_CMD="${TEST_CMD:-pnpm test}"
LINT_CMD="${LINT_CMD:-}"

dir=".orchestration/$num"
mkdir -p "$dir"

# Drop terminal escape sequences (OSC notifications, colors) that pi emits.
strip_ansi() { perl -pe 's/\e\][^\a\e]*(?:\a|\e\\)//g; s/\e\[[0-9;?]*[A-Za-z]//g'; }

# Prompts that are follow-ups are appended as extra specs; each run is numbered.
attempt=$(( $(find "$dir" -name 'pi-*.log' 2>/dev/null | wc -l) + 1 ))

prompt="$(cat <<PROMPT
Implement the task in the spec below. Stay inside the listed files and constraints.
Do not commit. Run the relevant tests before finishing.
End your final message with exactly these lines:
STATUS: done | blocked | partial
FILES_CHANGED: <paths>
TESTS: pass | fail (<count> failing)
NOTES: <max 3 lines; questions or deviations from spec>

--- SPEC ---
$(cat "$spec")
PROMPT
)"

pi -p --no-session --model "$PI_MODEL" "$prompt" </dev/null \
  >"$dir/pi-$attempt.log" 2>&1
pi_rc=$?

base="$(git merge-base HEAD main 2>/dev/null || echo HEAD)"
{
  git diff "$base" -- . ':(exclude).orchestration' ':(exclude)tasks'
  git ls-files --others --exclude-standard -- . ':(exclude).orchestration' ':(exclude)tasks' |
    while IFS= read -r f; do git diff --no-index -- /dev/null "$f"; done
} >"$dir/diff.patch" 2>/dev/null

# Deterministic checks, independent of what pi claims.
tests="skipped"
if [ -n "$TEST_CMD" ]; then
  if bash -c "$TEST_CMD" >"$dir/test-$attempt.log" 2>&1; then tests="pass"; else tests="fail"; fi
fi
lint="skipped"
if [ -n "$LINT_CMD" ]; then
  if bash -c "$LINT_CMD" >"$dir/lint-$attempt.log" 2>&1; then lint="pass"; else lint="fail"; fi
fi

# Consecutive failure counter for the 3-strikes escalation rule.
fails_file="$dir/fails"
if [ "$tests" = "fail" ] || [ "$lint" = "fail" ]; then
  echo $(( $(cat "$fails_file" 2>/dev/null || echo 0) + 1 )) >"$fails_file"
else
  echo 0 >"$fails_file"
fi

{
  echo "TASK: $num (attempt $attempt) on $branch"
  echo "PI_EXIT: $pi_rc"
  strip_ansi < "$dir/pi-$attempt.log" | grep -E '^(STATUS|FILES_CHANGED|TESTS|NOTES):' | tail -n 8
  echo "CHECK_TESTS: $tests ($TEST_CMD)"
  echo "CHECK_LINT: $lint"
  echo "CONSECUTIVE_FAILS: $(cat "$fails_file")"
  [ "$tests" = "fail" ] && { echo "--- test tail ---"; tail -n 8 "$dir/test-$attempt.log"; }
  [ "$lint" = "fail" ] && { echo "--- lint tail ---"; tail -n 5 "$dir/lint-$attempt.log"; }
  echo "LOGS: $dir/"
} | head -n 30

# Non-zero exit when pi crashed or a check failed.
[ "$pi_rc" -eq 0 ] && [ "$tests" != "fail" ] && [ "$lint" != "fail" ]
