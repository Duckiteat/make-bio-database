#!/usr/bin/env bash
# PLAN-135 L6 PR 을 우회 없이 적용 (DEC-0101) — 사람이 Codespaces 에서 한 번 실행한다: bash workspace/PLAN-135-apply.sh
# 하는 일 (읽어 보고 실행): 0) 바뀐 것은 stash 로 치움 · 1) 최신으로 · 2) 지문 확인 · 3) 적용(trust-check · trust.yml · 저장 지도 글롭 · CODEOWNERS · 규칙 장부 · 시험)
#   4) CHANGES.md 맨 위 한 행 · 5) 생성물 · 6) 전체 시험 — 통과면 커밋 · push(사람의 서명 커밋 — L6), 실패면 시험 기록만 push
# 계정 · 토큰은 출력하지 않는다. data/ · attestations/ 를 건드리지 않는다. DRY=1 이면 커밋 · push 하지 않는다.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
FP=2ea71e6a6cd2fbae0dea900b2ee1991a8a360675921efa64481525f74a9ee224
PATCH=workspace/PLAN-135-bundle.patch
ROW=workspace/PLAN-135-changes-row.txt
LOG=workspace/PLAN-135-apply.log
TMPLOG="$(mktemp)" # 시험 중 기록은 저장소 밖에
BR=ccr-b0ff4012-x9uzg9
say() { echo; echo "== $*"; }

say "0) 앞선 시도 치우기"
if [ -n "$(git status --porcelain)" ]; then git stash push -u -m "PLAN-135 앞선 시도 $(date -u +%H%M%S)" && echo "치움 (git stash list)"; else echo "바뀐 것 없음"; fi
say "1) 최신으로"
git checkout "$BR" && git pull --ff-only origin "$BR" || { echo "멈춤: pull 실패"; exit 1; }
say "2) 묶음 지문 확인"
node rebuild/bundle.mjs verify "$PATCH" "$FP" || { echo "멈춤: 지문이 다름"; exit 1; }
say "3) 적용"
git apply "$PATCH" || { echo "멈춤: 적용 실패"; exit 1; }
say "4) CHANGES.md 맨 위 한 행"
node -e "import('./legislative/clerk.mjs').then((C) => C.insertChangesRow(require('fs').readFileSync('$ROW', 'utf8'), process.cwd()))" || { echo "멈춤: CHANGES 행"; exit 1; }
say "5) 생성물"
node rebuild/status.mjs --write >/dev/null && node rebuild/regen.mjs >/dev/null && node rebuild/status.mjs --write >/dev/null || { echo "멈춤: 생성물"; exit 1; }
say "6) 전체 시험"
node --test --test-reporter=tap tests/*.test.mjs > "$TMPLOG" 2>&1
FAIL=$(grep -E '^# fail ' "$TMPLOG" | awk '{print $3}')
grep -E '^# (tests|pass|fail) ' "$TMPLOG"
if [ "${DRY:-0}" = "1" ]; then mv "$TMPLOG" "$LOG"; grep -E '^not ok' "$LOG" | head -20; echo "DRY — 커밋 · push 하지 않음 (fail=${FAIL:-?}) · 기록 $LOG"; exit 0; fi
if [ "${FAIL:-1}" = "0" ]; then
  rm -f "$TMPLOG"
  git add -A && git commit -m "L6: guarded paths only via human-signed commits — trust-check (PLAN-135, DEC-0101, bundle 2ea71e6a6c)" && git push origin "$BR" || { echo "멈춤: 커밋 · push"; exit 1; }
  if git cat-file -p HEAD | grep -q '^gpgsig'; then echo "서명된 커밋 · 커미터: $(git log -1 --format='%cn <%ce>')  (Duckiteat 이어야 — GitHub 이면 서명 키 설정을 다시, DEC-0100)"; else echo "주의: 서명 없는 커밋 — 서명 키 설정(docs/reports/2026-11-25-human-signing-key-setup.md)을 확인"; fi
  echo "끝 — develop 세션에 'PR 열어'"
else
  git stash push -u -m "PLAN-135 실패한 시도 $(date -u +%H%M%S)"
  mv "$TMPLOG" "$LOG"; grep -E '^not ok' "$LOG" | head -20
  git add "$LOG" && git commit -m "PLAN-135 apply failed — test log for develop" && git push origin "$BR"
  echo "실패 — 시험 기록만 push 했다. develop 세션에 알린다."; exit 1
fi
