#!/usr/bin/env bash
# DEC-0089 묶음 2(독립 판정 워크플로) 적용 — 사람이 Codespaces 에서 한 번 실행한다: bash workspace/DEC-0089-trust-apply.sh
# 하는 일 (읽어 보고 실행):
#   0) 지금 작업 트리에 바뀐 것이 있으면 지우지 않고 git stash 로 치워 둔다 (앞선 시도 — 나중에 git stash list 로 볼 수 있음)
#   1) 최신으로 · 2) 묶음 지문 확인 · 3) 적용 · 4) 생성물(교과서 부록 · 관리 파일) · 5) 전체 시험
#   통과: 커밋 · push (사람의 커밋 — L6)
#   실패: 시도를 git stash 로 치우고, 시험 기록만 workspace/DEC-0089-trust-apply.log 로 커밋 · push — develop 세션이 읽고 원인을 찾는다
# 계정 · 토큰은 출력하지 않는다. 이 스크립트는 data/ · attestations/ 를 건드리지 않는다.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
FP=9a18ecb7c060524debe4b164d05b9bd38ee30944118da1423bcb0db7ae0b7aef
PATCH=workspace/DEC-0089-trust-bundle.patch
LOG=workspace/DEC-0089-trust-apply.log
BR=claude/attack-matrix-independent-review
say() { echo; echo "== $*"; }

say "0) 앞선 시도 치우기"
if [ -n "$(git status --porcelain)" ]; then git stash push -u -m "DEC-0089 묶음 2 앞선 시도 $(date -u +%H%M%S)" && echo "치움 (git stash list)"; else echo "바뀐 것 없음"; fi

say "1) 최신으로"
git checkout "$BR" && git pull --ff-only origin "$BR" || { echo "멈춤: pull 실패"; exit 1; }

say "2) 묶음 지문 확인"
node rebuild/bundle.mjs verify "$PATCH" "$FP" || { echo "멈춤: 지문이 다름"; exit 1; }

say "3) 적용"
git apply "$PATCH" || { echo "멈춤: 적용 실패"; exit 1; }

say "4) 생성물"
node rebuild/status.mjs --write >/dev/null && node dbtool.mjs textbook --write >/dev/null && node rebuild/status.mjs --write >/dev/null
node rebuild/status.mjs --check | tail -1

say "5) 전체 시험 (몇 분)"
node --test --test-reporter=tap tests/*.test.mjs > /tmp/dec0089-tap.txt 2>&1; RC=$?
grep -E "^# (tests|pass|fail)" /tmp/dec0089-tap.txt

if [ "$RC" -eq 0 ]; then
  say "통과 → 커밋 · push"
  git add -A && git commit -q -m "L6: independent judge workflow (DEC-0089, bundle 9a18ecb7c060)" && git push origin "$BR" && echo "끝 — develop 세션에 '푸쉬했어' 라고만 알려 주세요"
else
  say "실패 → 시도를 치우고 시험 기록만 push"
  git stash push -u -m "DEC-0089 묶음 2 실패한 시도 $(date -u +%H%M%S)"
  { echo "# DEC-0089 묶음 2 적용 시도 — 시험 실패 기록 ($(date -u +%FT%TZ))"; echo "node $(node -v) · HEAD $(git rev-parse --short HEAD) · shallow=$(git rev-parse --is-shallow-repository)";
    grep -E "^# (tests|pass|fail)" /tmp/dec0089-tap.txt; echo "---- 실패한 시험 (앞뒤 40 줄)";
    grep -nE "not ok" -A40 /tmp/dec0089-tap.txt | head -400; } > "$LOG"
  git add "$LOG" && git commit -q -m "log: DEC-0089 묶음 2 시험 실패 기록 (적용하지 않음)" && git push origin "$BR" && echo "기록을 push 함 — develop 세션에 '실패 기록 올렸어' 라고 알려 주세요"
fi
