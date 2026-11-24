# PLAN-117 — 보안 묶음 마무리

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 117 · 11부 — 자율 오케스트레이션 (주제 → 분해 → 실행 → 통합 → 검증, 사람은 주제 · 결정 · 승락)
- **작업**: 보안 묶음 마무리 — 문지기 fail-closed(N11) · ci-zone "선언 없음 = 사람" 을 push · 작성자 신원 판정으로 · .github/CODEOWNERS(사람 계정)
- **자리**: `rebuild/gate.mjs` · `rebuild/ci-zone.mjs` · `.github/CODEOWNERS` (모두 L6 → 승인 묶음 하나 · 적용 스크립트 하나)
- **끝나는 조건**: 훅 예외 시 쓰는 도구가 막힘(시험 · 변이 시험) · 봇 계정 커밋은 선언이 없어도 AI 로 판정되어 구역 · 등록부 정책을 받음(시험) · CODEOWNERS 가 L6 자리에 사람 리뷰를 요구 · 사용자 커밋 해시 · 전환 기록 #20 open 셋 해소. 선행 없음 — 자동 배정이 실행 모듈을 늘리기 전 마지막 바닥
- **상태**: ◐ 진행 2026-11-24

## 결과 (날짜별)

- `2026-11-24` 커밋 전 기록: 2026-11-24 승인 묶음 workspace/PLAN-117-bundle.patch (지문 82625e9c1dc7… · 11 파일 · 거부 0) · README · 적용 스크립트 workspace/PLAN-117-apply.sh — ① rebuild/gate.mjs failClosed(RULE-0550: 훅 예외 시 쓰는 도구 막음 · 읽는 도구만 통과, N11) ② rebuild/ci-zone.mjs 사람 판정 = GITHUB_ACTOR 가 부모 커밋 .github/CODEOWNERS 의 @계정(RULE-0551: 봇이 민 선언 없는 커밋 거부, N8 · main 에 든 커밋은 다시 안 봄) ③ 새 .github/CODEOWNERS(L6 자리 → 사람 계정). 저장소 밖 사본에서 gate · ci_zone 13 · 변이 caught 둘 · 전체 563 통과. 찾은 것(RULE-0262): independent-judge 는 L6 PR 을 실패시키고 사람은 규칙 우회로 병합하게 설계됐는데 규칙 세트 우회 목록이 비어 있어 L6 PR 을 병합할 수 없을 수 있음 — README 의 선택 가(Repository admin 을 PR 한정 우회로) 권장. 남은 끝나는 조건: 사용자 커밋 해시 · CODEOWNERS 리뷰 강제 설정 · 봇 선언 없는 커밋 거부를 실제 push 로 확인

## 걸어온 길

- `2026-11-24` 커밋 전 기록 계획에 들어옴 (☐ 대기) — 사용자 결정 DEC-0093 — 오케스트레이터를 MVP(최종 형식) → 범위 → 병렬 → 자율 순서로 계획
- `2026-11-24` 커밋 전 기록 상태 ☐ → ◐ 2026-11-24 — PLAN-117 승인 묶음 만듦 — 사용자 적용 대기
- `2026-11-24` 커밋 전 기록 결과 처음 적힘 — PLAN-117 승인 묶음 만듦 — 사용자 적용 대기

## 닿는 결정

- [DEC-0093](../decisions/DEC-0093.md) 2026-11-24 오케스트레이터 순서 — MVP(최종 형식으로 · 있는 것 최대한) → 범위 넓히기 → 병렬 → 자율(사람은 주제 · 결정 · 확인 · 승락만)
