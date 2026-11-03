#!/usr/bin/env bash
# Review the current branch diff with agy. The diff is inlined in the prompt
# because headless agy auto-denies tool calls. Full output goes to
# .orchestration/NNN/; stdout is at most 30 lines.
# Usage: scripts/review.sh NNN
# Env:   AGY_MODEL (default gemini-3.8-flash-high), BASE (default merge-base with main)
set -uo pipefail

num="${1:-}"
case "$num" in ''|*[!0-9]*) echo "usage: $0 NNN" >&2; exit 2 ;; esac

root="$(git rev-parse --show-toplevel)" || exit 2
cd "$root" || exit 2

AGY_MODEL="${AGY_MODEL:-gemini-3.8-flash-high}"
BASE="${BASE:-$(git merge-base HEAD main 2>/dev/null || echo HEAD)}"

dir=".orchestration/$num"
mkdir -p "$dir"

# Tracked changes since BASE (includes working tree), plus untracked files.
{
  git diff "$BASE" -- . ':(exclude).orchestration' ':(exclude)tasks'
  git ls-files --others --exclude-standard -- . ':(exclude).orchestration' ':(exclude)tasks' |
    while IFS= read -r f; do git diff --no-index -- /dev/null "$f"; done
} >"$dir/review-diff.patch" 2>/dev/null

if [ ! -s "$dir/review-diff.patch" ]; then
  echo "NO_FINDINGS (empty diff)"
  exit 0
fi

spec_file="$(ls tasks/"$num"-*.md 2>/dev/null | head -n 1)"
spec_text="(no spec found)"
[ -n "$spec_file" ] && spec_text="$(cat "$spec_file")"

prompt="$(cat <<PROMPT
You are a code reviewer. Do not use any tools; everything you need is below.
Review the diff against the spec for correctness bugs, spec violations, missing
tests, and risky changes. Ignore style nits.
Return at most 10 lines, highest severity first, each in this exact format:
N. [high|med|low] path:line - issue - suggested fix
If there are no issues, return only: NO_FINDINGS

--- SPEC ---
$spec_text

--- DIFF ---
$(cat "$dir/review-diff.patch")
PROMPT
)"

agy --model "$AGY_MODEL" --print-timeout 600s -p "$prompt" </dev/null \
  >"$dir/review.log" 2>&1
rc=$?

{
  [ "$rc" -ne 0 ] && echo "AGY_EXIT: $rc (see $dir/review.log)"
  perl -pe 's/\e\][^\a\e]*(?:\a|\e\\)//g; s/\e\[[0-9;?]*[A-Za-z]//g' "$dir/review.log" |
    grep -E '^[0-9]+\. \[(high|med|low)\]|^NO_FINDINGS' | head -n 10
  echo "LOGS: $dir/"
} | head -n 30

exit "$rc"
