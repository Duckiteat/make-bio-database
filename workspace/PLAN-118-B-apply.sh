#!/usr/bin/env bash
# PLAN-118 묶음 B 적용 (DEC-0097 섞기) — 사람이 Codespaces 에서 한 번 실행한다: bash workspace/PLAN-118-B-apply.sh
# 한 번에 하는 일 (읽어 보고 실행):
#   0) 지금 작업 트리에 바뀐 것이 있으면 지우지 않고 git stash 로 치워 둔다
#   1) 최신으로 · 2) 두 묶음 지문 확인 (B · 다른 세션의 DEC-0092 묶음 1)
#   3) 묶음 B 적용 — ci-zone 사람 서명 판정(DEC-0094) · 훅을 끄는 자리 막기(DEC-0095) · 규칙 · 권한 장부
#   4) 훅 명령 끝에 "|| exit 2" (승인 묶음 도구는 훅 줄 변경을 받지 않아 이 한 줄은 정해진 sed 로 — 다른 세션의 N11 README 와 같은 명령)
#   5) DEC-0092 묶음 1 + 규칙 장부 ops (전환 기록 번호를 일 묶음 단위로) — B 뒤에 (규칙 장부 봉인 사슬 때문에 순서가 정해짐)
#   6) CHANGES.md 맨 위 한 행 · 7) 생성물 · 8) 전체 시험
#   통과: 커밋 · push (사람의 커밋 — L6). 실패: 시도를 stash 로 치우고 시험 기록만 push
# 계정 · 토큰은 출력하지 않는다. data/ · attestations/ 를 건드리지 않는다. DRY=1 이면 커밋 · push 하지 않는다.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
FPB=f502939827ab24518c315029c8719f65890c0ae98efa40c74f68055b7512ad6a
FP92=f45217aaa87a4ac50e6a6cb2f1de6b81e656b26fe7ee939bcfa6412332bac00c
PB=workspace/PLAN-118-B-bundle.patch
P92=workspace/DEC-0092-bundle.patch
OPS92=workspace/DEC-0092-rule.ops.json
ROW=workspace/PLAN-118-B-changes-row.txt
LOG=workspace/PLAN-118-B-apply.log
TMPLOG="$(mktemp)" # 시험 중 기록은 저장소 밖에 — 저장소 안에 두면 파일 목록이 바뀌어 "관리 파일 최신" 시험이 깨진다
BR=ccr-b0ff4012-x9uzg9
say() { echo; echo "== $*"; }

say "0) 앞선 시도 치우기"
if [ -n "$(git status --porcelain)" ]; then git stash push -u -m "PLAN-118 B 앞선 시도 $(date -u +%H%M%S)" && echo "치움 (git stash list)"; else echo "바뀐 것 없음"; fi

say "1) 최신으로"
git checkout "$BR" && git pull --ff-only origin "$BR" || { echo "멈춤: pull 실패"; exit 1; }

say "2) 두 묶음 지문 확인"
node rebuild/bundle.mjs verify "$PB" "$FPB" || { echo "멈춤: 묶음 B 지문이 다름"; exit 1; }
node rebuild/bundle.mjs verify "$P92" "$FP92" || { echo "멈춤: DEC-0092 묶음 지문이 다름"; exit 1; }

say "3) 묶음 B 적용"
git apply "$PB" || { echo "멈춤: 묶음 B 적용 실패"; exit 1; }

say "4) 훅 명령 끝에 || exit 2"
sed -i 's|node rebuild/gate.mjs hook pre"|node rebuild/gate.mjs hook pre \|\| exit 2"|; s|node rebuild/gate.mjs hook post"|node rebuild/gate.mjs hook post \|\| exit 2"|' .claude/settings.json
[ "$(grep -c 'exit 2' .claude/settings.json)" = "2" ] || { echo "멈춤: 훅 두 줄이 아님"; exit 1; }

say "5) DEC-0092 묶음 1 + 규칙 장부 ops"
git apply "$P92" && node rebuild/rules.mjs apply "$OPS92" >/dev/null || { echo "멈춤: DEC-0092"; exit 1; }

say "6) CHANGES.md 맨 위 한 행"
node -e "import('./legislative/clerk.mjs').then((C) => C.insertChangesRow(require('fs').readFileSync('$ROW', 'utf8'), process.cwd()))" || { echo "멈춤: CHANGES 행"; exit 1; }

say "7) 생성물"
node rebuild/status.mjs --write >/dev/null && node rebuild/regen.mjs >/dev/null && node rebuild/status.mjs --write >/dev/null || { echo "멈춤: 생성물"; exit 1; }

say "8) 전체 시험"
node --test --test-reporter=tap tests/*.test.mjs > "$TMPLOG" 2>&1
FAIL=$(grep -E '^# fail ' "$TMPLOG" | awk '{print $3}')
grep -E '^# (tests|pass|fail) ' "$TMPLOG"
if [ "${DRY:-0}" = "1" ]; then mv "$TMPLOG" "$LOG"; grep -E '^not ok' "$LOG" | head -20; echo "DRY — 커밋 · push 하지 않음 (fail=${FAIL:-?}) · 기록 $LOG"; exit 0; fi
if [ "${FAIL:-1}" = "0" ]; then
  rm -f "$TMPLOG"
  git add -A && git commit -m "L6: ci-zone human-signature check (DEC-0094) · hook-disabling paths closed (DEC-0095) · hook exit 2 · transition numbering (DEC-0092) — PLAN-118 bundle B f502939827ab" && git push origin "$BR" || { echo "멈춤: 커밋 · push"; exit 1; }
  if git cat-file -p HEAD | grep -q '^gpgsig'; then echo "서명된 커밋 — GitHub 이 검증하면 사람 서명 커밋으로 셈"; else echo "주의: 서명 없는 커밋 — GitHub Settings → Codespaces → GPG verification 을 켜면 다음부터 서명된다 (README)"; fi
  echo "끝 — README 의 다음 단계(PR · 우회 병합 · GitHub 설정)로"
else
  git stash push -u -m "PLAN-118 B 실패한 시도 $(date -u +%H%M%S)"
  mv "$TMPLOG" "$LOG"
  grep -E '^not ok' "$LOG" | head -20
  git add "$LOG" && git commit -m "PLAN-118 B apply failed — test log for develop" && git push origin "$BR"
  echo "실패 — 시험 기록만 push 했다. develop 세션에 알린다."
  exit 1
fi
