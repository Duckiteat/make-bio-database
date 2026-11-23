# PLAN-116 G3 승인 묶음 — 도장 등록부 정책의 L6 부분 (DEC-0078)

> **적용 끝 — 다시 적용하지 않는다.** 2026-11-23 사용자가 Codespaces 에서 적용 · 시험(549 중 실패 0 · Rust 2 건너뜀 — cargo 없음) · 커밋 `01f5856`(Duckiteat) · push. develop 세션이 원격에서 받아 대조: 보호 파일 3 이 묶음 패치와 바이트 단위로 같음 · 권한 장부 PERM-0024 · 0025 가 ops 와 같음 · data · attestations 변경 0. 커밋 메시지의 지문 앞자리 오타(28d556… — 맞는 값 28d566…)는 메시지뿐, 내용은 같음.

> 사용자 커밋 대상. develop 세션은 L6(문지기 · 모드표 · 권한 장부)를 쓰지 못한다 — 이 묶음은 **적용하지 않은 제안** 이다. 보호 파일의 사본을 만들어 고쳐 보는 것도 하지 않았다(세션 권한이 거부함) — 그래서 묶음을 적용한 상태의 시험은 아직 돌지 않았다.

| 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|
| `PLAN-116-G3-bundle.patch` — `rebuild/rules/modes.json`(모드마다 `stamps`: author verified · trend / inspect accept / 그 밖 빈 목록) · `rebuild/gate.mjs`(도구 뒤 대조에 등록부 판정 — `judicial/attestation.js` registryPolicy, RULE-0542) · `tests/gate.test.mjs` ⑳ | author 가 승인 도장을 위조해 덧붙일 수 있고 도장 지우기를 알리는 검사가 없었다(메모리 시험으로 확인 — DEC-0078). CI 겹(`rebuild/ci-zone.mjs`)은 이미 커밋 bc9bfad 에서 같은 판정을 한다 — 이 묶음은 Claude Code 안(문지기)과 정책 칸(모드표)을 더한다 | 모드표에 stamps 가 서면: CI 가 모드별 도장 종류까지 판정 · SUP-0001 독립성의 권한 요소가 ✓(메모리 계산) · inspect 는 추세 도장을 못 냄(명령 장부는 bc9bfad 에서 이미 author 만) · 기존 도장 363 그대로 | `git apply --check` 통과 (HEAD bc9bfad 위) · 승인 화면 `PLAN-116-G3-bundle.screen.txt` (지문 28d566583c1e…) |
| `PLAN-116-G3-bundle.ops.json` — 권한 장부 PERM-0024(author stamps) · PERM-0025(inspect stamps) | 모드표에 권한을 더하면 장부 줄이 있어야 한다(RULE-0521 — stamps 만 넣고 줄이 없으면 권한 대조가 거부함, 메모리로 확인) | 권한 장부 · 봉인 사건(rebuild/rules/changes.jsonl) | 메모리 대조: 묶음 적용 뒤 권한 장부 오류 0 |

## 적용 순서 (사람)

1. `node rebuild/bundle.mjs verify workspace/PLAN-116-G3-bundle.patch 28d566583c1e0d0e26c773019f90c3e94485f1c6dc77ef802d80f32a9c4a20b2` — 지문 · 거부 없음 확인
2. `git apply workspace/PLAN-116-G3-bundle.patch`
3. `node rebuild/rules.mjs apply workspace/PLAN-116-G3-bundle.ops.json` — 권한 장부 두 줄 (2 와 같은 커밋에)
4. `node rebuild/status.mjs --write` — 중심 문서 · 관리 파일의 권한 수 갱신
5. `node --test tests/*.test.mjs` · `node dbtool.mjs validate` — 특히 `tests/gate.test.mjs` ⑳ · `tests/permissions.test.mjs` · `tests/registry_policy.test.mjs`
6. 커밋 (사람). 그 뒤 `node rebuild/supervise.mjs report SUP-0001` 의 독립 검수 권한 요소가 ○ 로 바뀌는지 본다
