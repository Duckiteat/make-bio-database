# PLAN-116 G5 승인 묶음 — 문지기의 장부 덧붙이기만 검사 (DEC-0079 ③ · RULE-0544)

> **적용 끝 — 다시 적용하지 않는다.** 2026-11-23 사용자가 Codespaces 에서 단계마다 확인하며 적용 · 커밋 `749fa2d`(Duckiteat) · push. 시험 중 '관리 파일이 최신이다' 하나가 실패 — 문지기 시험이 5 → 6 개가 되어 생성 문서(rebuild/status)가 낡은 것(이 README 의 '생성 문서는 바뀌지 않는다' 가 틀렸음 — 통합가의 판단 실수). `status.mjs --write` 뒤 통과. develop 세션 대조: 보호 파일 2 가 묶음과 바이트 동일 · data · attestations 변경 0 · 판정을 끄면 문지기 ㉑ 과 CI C4 가 둘 다 실패.

> 사용자 커밋 대상. develop 세션은 문지기(L6)를 쓰지 못한다 — 이 묶음은 **적용하지 않은 제안** 이다. G3 묶음(커밋 01f5856) 위에서 만들었다.

| 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|
| `PLAN-116-G5-bundle.patch` — `rebuild/gate.mjs`(도구 뒤 대조에 감독 장부 · 전환 기록 덧붙이기만 판정 — 판정 `judicial/transition_audit.js` appendOnly · 목록 `rebuild/ci-zone.mjs` APPEND_ONLY, CI 와 같은 함수 · 같은 목록) · `tests/gate.test.mjs` ㉑ | 지금은 CI(push 뒤)만 잡는다 — AI 가 작업하는 그 순간(Claude Code 안)에도 막는 겹. 자동 배정(PLAN-104)이 세션을 늘리기 전에 | 셸로 기존 줄을 고치면 문지기가 막고 영수증에 남김 · 서기 명령의 덧붙이기는 그대로 · 권한 장부 · 모드표는 안 바뀜(검사만 더함) | `git apply --check` 통과 · 승인 화면 `PLAN-116-G5-bundle.screen.txt` (지문 237599a508e9…) |

## 적용 순서 (사람 — Codespaces, G3 때와 같은 방식, 한 단계씩)

1. `git pull` — 이 묶음을 만든 커밋까지 받기
2. `node rebuild/bundle.mjs verify workspace/PLAN-116-G5-bundle.patch 237599a508e9de0a33c0fa0ca2e09dedb0ba91237cf7458c4d47f453c26c739d` — `통과` 확인
3. `git apply workspace/PLAN-116-G5-bundle.patch && git status --short` — `rebuild/gate.mjs` · `tests/gate.test.mjs` 둘만
4. `node --test tests/gate.test.mjs 2>&1 | tail -8` — `# fail 0`
5. `git add -A && git commit -m "L6: gate append-only ledgers (PLAN-116 G5, DEC-0079, bundle 237599a508e9)"` 그리고 `git push origin ccr-2a8c4e06-0zo0i6`
6. develop 세션이 원격에서 받아 대조(묶음과 바이트 동일 · 전체 시험)

권한 장부 · 생성 문서는 이번에는 바뀌지 않는다(검사만 더함) — G3 의 4 · 5 단계는 없다.
