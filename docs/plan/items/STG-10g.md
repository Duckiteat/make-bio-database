# STG-10g — 상시 권한 장부

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [재건 계획 (rebuilding project) — 글이 아니라 구조가 말하게](../rebuild.md) · [순서](../ORDER.md)

- **계획 · 부**: rebuild 10g · 7. 단계
- **단계**: 상시 권한 장부
- **무엇**: 모드마다 허락된 예외(경로 · 명령)를 한 장부에 — 줄마다 무엇 · 누가 · 언제 · 왜 · 철회 방법. CLAUDE.md 에 생성되고, 장부 밖 권한은 시험이 거부. 마스터 권한(전부 허용) 대신 좁고 철회할 수 있는 권한만(RULE-0461). 계기: 10a 의 CI 설정 수정이 권한 확인에서 막힘 — 사용자가 '마스터 권한' 을 물었고 좁은 상시 권한으로 정리(2026-10-29)
- **끝나는 조건**: 장부 · 생성 · 거부 시험 · 문지기 권한·자기 검사 장치(gate · settings)는 장부로도 열 수 없음
- **상태**: ☑ 완료 2026-10-31

## 결과 (날짜별)

- `2026-10-31` 커밋 전 기록: 2026-10-31: 장부 rebuild/rules/permissions.jsonl (규칙 장부 도구 아래 — 봉인 · 왜 · 사건 기록, 새 번호 PERM-…) — 줄마다 무엇 · 누가 · 언제 · 왜 · 철회. 지금 권한 모두를 21 줄로: settings allow 10 · ask 3 · 문지기 write 7 · also 1(누가는 원문에 없으면 '원문에 없음', 언제는 그 줄이 처음 들어온 커밋). 대조: rebuild/permissions.mjs — 장부 밖 권한 · 두 곳에 없는 장부 줄 거부, 장부로도 보호 자리(.claude/settings · rebuild/gate.mjs · modes.json · 장부 자체)와 전부 허용은 열 수 없음. settings.json 은 생성하지 않고 대조만(사람이 고치고 Claude Code 가 확인). 생성: 중심 문서 '상시 권한' 절(자리별 줄 수 · 넓은 권한 ⚠) · 읽기 모드 PERM-… (0 · 1 · 2). 새 기계 규칙 RULE-0521(맥락 → RULE-0461) · 변이 caught · 시험 tests/permissions.test.mjs. 넓은 권한 6 줄을 표시만 함(바꾸지 않음): Edit·Write 경로 제한 없음 · node tests/ · node -e(사실상 임의 실행) · find · cp · 디벨롭 write **

## 걸어온 길

- `2026-10-29` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 재건 10a 로컬 = CI — CI 전체 역사 + 확인 시험 · 상시 권한 장부를 10g 로 (사용자 'ㄱㄱ')
- `2026-10-31` 커밋 전 기록 상태 ☐ → ☑ 2026-10-31 — 재건 10g 상시 권한 장부 (사용자 결정 2026-10-31: settings · 문지기 둘 다 · settings 는 대조만 · 기존 권한 모두 장부로)
- `2026-10-31` 커밋 전 기록 결과 처음 적힘 — 재건 10g 상시 권한 장부 (사용자 결정 2026-10-31: settings · 문지기 둘 다 · settings 는 대조만 · 기존 권한 모두 장부로)
