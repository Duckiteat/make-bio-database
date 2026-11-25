#!/usr/bin/env bash
# PLAN-135 마지막 확인 — 서명된 L6 PR 이 우회 없이 지나가는지 (DEC-0102: 이번 L6 변경은 CODEOWNERS 주석 두 줄)
# Codespace 에서: bash workspace/PLAN-135-verify-apply.sh   (서명 설정은 bash workspace/sign-setup.sh 로 끝나 있어야)
# 하는 일: 1) 최신으로 · 2) 지문 확인 · 3) 적용 · 4) 서명 커밋 — 커밋이 내 SSH 서명 · 커미터 Duckiteat 가 아니면 push 하지 않고 되돌림 · 5) push
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
unset GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL # Codespaces 의 커미터 변수 (DEC-0100)
FP=eaf08d8c82d501f4a037928514b818da71a3f6e1e0ec4f8cf583194bead627d8
PATCH=workspace/PLAN-135-verify-bundle.patch
BR=ccr-b0ff4012-x9uzg9
say() { echo; echo "== $*"; }

say "1) 최신으로"
if [ -n "$(git status --porcelain)" ]; then git stash push -u -m "PLAN-135 확인 앞선 시도 $(date -u +%H%M%S)" && echo "바뀐 것은 치움 (git stash list)"; fi
git checkout "$BR" && git pull --ff-only origin "$BR" || { echo "멈춤: pull 실패"; exit 1; }
say "2) 지문 확인"
node rebuild/bundle.mjs verify "$PATCH" "$FP" || { echo "멈춤: 지문이 다름"; exit 1; }
say "3) 적용"
git apply "$PATCH" || { echo "멈춤: 적용 실패"; exit 1; }
say "4) 서명 커밋"
git add .github/CODEOWNERS && git commit -q -m "L6: CODEOWNERS — supervise 판정 코드는 MVP 뒤 L6 (DEC-0102 · PLAN-135 확인, bundle eaf08d8c82)" || { echo "멈춤: 커밋 실패 (서명 설정 — bash workspace/sign-setup.sh)"; exit 1; }
C=$(git cat-file -p HEAD | grep '^committer'); S=$(git cat-file -p HEAD | grep -m1 BEGIN)
echo "$C"; echo "$S"
case "$S$C" in
  *"SSH SIGNATURE"*Duckiteat*) echo "서명 · 커미터 맞음";;
  *) git reset -q --hard HEAD~1; echo "멈춤: 내 SSH 서명 · 커미터 Duckiteat 가 아님 — 커밋을 되돌렸다, push 안 함. bash workspace/sign-setup.sh 를 다시"; exit 1;;
esac
say "5) push"
git push origin "$BR" && echo "끝 — develop 세션에 'PR 열어'"
