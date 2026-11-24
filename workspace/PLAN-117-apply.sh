#!/usr/bin/env bash
# PLAN-117 보안 묶음 적용 — 사람이 Codespaces 에서 한 번 실행한다: bash workspace/PLAN-117-apply.sh
# 하는 일 (읽어 보고 실행):
#   0) 지금 작업 트리에 바뀐 것이 있으면 지우지 않고 git stash 로 치워 둔다
#   1) 최신으로 · 2) 묶음 지문 확인 · 3) 적용 · 4) CHANGES.md 맨 위 한 행 · 5) 생성물 · 6) 전체 시험
#   통과: 커밋 · push (사람의 커밋 — L6)
#   실패: 시도를 git stash 로 치우고, 시험 기록만 workspace/PLAN-117-apply.log 로 커밋 · push — develop 세션이 읽고 원인을 찾는다
# 계정 · 토큰은 출력하지 않는다. data/ · attestations/ 를 건드리지 않는다.
# DRY=1 이면 커밋 · push 를 하지 않고 멈춘다 (develop 세션의 사전 확인용).
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
FP=82625e9c1dc7cfc933f326d505c04b16be137825e13dcc69e93617decc296363
PATCH=workspace/PLAN-117-bundle.patch
ROW=workspace/PLAN-117-changes-row.txt
LOG=workspace/PLAN-117-apply.log
BR=ccr-b0ff4012-x9uzg9
say() { echo; echo "== $*"; }

say "0) 앞선 시도 치우기"
if [ -n "$(git status --porcelain)" ]; then git stash push -u -m "PLAN-117 앞선 시도 $(date -u +%H%M%S)" && echo "치움 (git stash list)"; else echo "바뀐 것 없음"; fi

say "1) 최신으로"
git checkout "$BR" && git pull --ff-only origin "$BR" || { echo "멈춤: pull 실패"; exit 1; }

say "2) 묶음 지문 확인"
node rebuild/bundle.mjs verify "$PATCH" "$FP" || { echo "멈춤: 지문이 다름"; exit 1; }

say "3) 적용"
git apply "$PATCH" || { echo "멈춤: 적용 실패"; exit 1; }

say "4) CHANGES.md 맨 위 한 행 (승인 묶음 도구는 CHANGES.md 의 옛 긴 줄 때문에 그 파일을 검토하지 못해 — 행은 $ROW 그대로 넣는다)"
node -e "import('./legislative/clerk.mjs').then((C) => C.insertChangesRow(require('fs').readFileSync('$ROW', 'utf8'), process.cwd()))" || { echo "멈춤: CHANGES 행"; exit 1; }

say "5) 생성물"
node rebuild/status.mjs --write >/dev/null && node rebuild/regen.mjs >/dev/null && node rebuild/status.mjs --write >/dev/null || { echo "멈춤: 생성물"; exit 1; }

say "6) 전체 시험"
node --test --test-reporter=tap tests/*.test.mjs > "$LOG.tmp" 2>&1
FAIL=$(grep -E '^# fail ' "$LOG.tmp" | awk '{print $3}')
grep -E '^# (tests|pass|fail) ' "$LOG.tmp"
if [ "${DRY:-0}" = "1" ]; then echo "DRY — 커밋 · push 하지 않음 (fail=${FAIL:-?})"; rm -f "$LOG.tmp"; exit 0; fi
if [ "${FAIL:-1}" = "0" ]; then
  rm -f "$LOG.tmp"
  git add -A && git commit -m "L6: gate fail-closed · ci-zone account check · CODEOWNERS (PLAN-117, bundle 82625e9c1dc7)" && git push origin "$BR" && echo "끝 — 커밋 · push 됨. README 의 다음 단계(병합 · GitHub 설정)로"
else
  mv "$LOG.tmp" "$LOG.keep"
  git stash push -u -m "PLAN-117 실패한 시도 $(date -u +%H%M%S)"
  mv "$LOG.keep" "$LOG"
  grep -E '^not ok' "$LOG" | head -20
  git add "$LOG" && git commit -m "PLAN-117 apply failed — test log for develop" && git push origin "$BR"
  echo "실패 — 시험 기록만 push 했다. develop 세션에 알린다."
  exit 1
fi
