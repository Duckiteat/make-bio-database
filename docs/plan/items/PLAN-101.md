# PLAN-101 — 승인 PR 권한(F6)

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 101 · 9부 — 작업 조율 (여러 모드 세션을 잇는 상위 작업)
- **작업**: **승인 PR 권한(F6)** — 문지기 연결은 필요 없어짐(F1 = 공통 구역, DEC-0066). 결정: 첫 순환(PLAN-103)의 승인 PR 은 **사용자가 연다**. 그 뒤 상시 권한 "ORCH 승인 PR 만 Supervisor 가 연다"(권한 장부 PERM 줄 + RULE-0257 고침 + 철회 가능, RULE-0461)를 검토. 병합은 어느 쪽이든 사람만
- **자리**: `rebuild/rules/permissions.jsonl` · `rebuild/rules/rules.jsonl`(RULE-0257) · `CLAUDE.md`(생성물)
- **끝나는 조건**: 사용자 결정 기록 · (나)면 PERM 줄과 철회 방법 · RULE-0521 시험 통과
- **상태**: ☑ 완료 2026-11-21

## 결과 (날짜별)

- `2026-11-21` 커밋 전 기록: 2026-11-21 결정 기록으로 끝: 첫 순환(PLAN-103)의 승인 PR 은 사용자가 연다(DEC-0066 F6). 문지기 연결은 F1(공통 구역)으로 필요 없어짐. 상시 권한 "승인 PR 만 Supervisor 가 연다" 는 첫 순환 뒤 검토 — 그때 권한 장부 PERM 줄 + RULE-0257 고침 + 철회 방법(RULE-0461). 병합은 사람만이고, AI 의 병합은 설정 deny 로 막힘(PLAN-113 · 6c78179).

## 걸어온 길

- `2026-11-20` 커밋 전 기록 계획에 들어옴 (☐ 대기) — DEC-0064 — 여러 모드 세션을 잇는 상위 작업 조율(오케스트레이션), 사용자 요청 2026-11-20
- `2026-11-20` 커밋 전 기록 '작업' 칸이 바뀜 — DEC-0065 — 빈 곳 다섯 반영 + 가상 실행 발견(F1–F13)

  <details><summary>이전 · 이후</summary>

이전: **문지기 연결** — `dbtool orch` 를 모든 모드의 명령으로(dbtool transition 과 같은 방식), 쓰기 구역 orchestration(= workspace/orchestration/**) 하나. 권한 장부에 PERM 줄. 문지기 모드 표 · 설정은 문지기 파일이라 develop 도 못 고친다 → 승인 묶음(STG-12 방식, 사용자가 GitHub 웹에서 커밋). STG-12a(사용자 손이 드는 L6 보강 보류, 2026-11-02)와 부딪힘 — 열린 질문

이후: **승인 PR 권한(F6)** — 원래 문지기 연결이었으나 가상 실행에서 장부를 공통 구역에 두면 문지기 변경이 필요 없다(F1). 남은 것: 승인 PR 을 누가 여나 — RULE-0257(PR 은 사용자 명시 요청만). (가) 사용자가 연다 (나) 상시 권한 "ORCH 승인 PR 만 Supervisor 가 연다" — 권한 장부 PERM 줄 + RULE-0257 고침 + 철회 가능(RULE-0461). 병합은 어느 쪽이든 사람만. F1 에서 새 구역을 고르면 문지기 연결(STG-12a 와 부딪힘)도 여기

</details>
- `2026-11-20` 커밋 전 기록 '자리' 칸이 바뀜 — DEC-0065 — 빈 곳 다섯 반영 + 가상 실행 발견(F1–F13)

  <details><summary>이전 · 이후</summary>

이전: `rebuild/rules/modes.json` · `rebuild/rules/permissions.jsonl` · `rebuild/rules/commands.jsonl` · `.claude/settings.json`(필요하면)

이후: `rebuild/rules/permissions.jsonl` · `rebuild/rules/rules.jsonl`(RULE-0257) · `CLAUDE.md`(생성물)

</details>
- `2026-11-20` 커밋 전 기록 '끝나는 조건' 칸이 바뀜 — DEC-0065 — 빈 곳 다섯 반영 + 가상 실행 발견(F1–F13)

  <details><summary>이전 · 이후</summary>

이전: 모든 모드에서 orch 쓰기 가능 · 다른 구역 불변 · RULE-0521(장부 = 설정 = 문지기) 시험 통과 · 사용자 커밋

이후: 사용자 결정 기록 · (나)면 PERM 줄과 철회 방법 · RULE-0521 시험 통과

</details>
- `2026-11-21` 커밋 전 기록 '작업' 칸이 바뀜 — DEC-0066 · DEC-0067 — 자기 개선 루프 최소판 채택 · 권장 결정 전부 · 개발 순서는 조율(오케스트레이터)부터

  <details><summary>이전 · 이후</summary>

이전: **승인 PR 권한(F6)** — 원래 문지기 연결이었으나 가상 실행에서 장부를 공통 구역에 두면 문지기 변경이 필요 없다(F1). 남은 것: 승인 PR 을 누가 여나 — RULE-0257(PR 은 사용자 명시 요청만). (가) 사용자가 연다 (나) 상시 권한 "ORCH 승인 PR 만 Supervisor 가 연다" — 권한 장부 PERM 줄 + RULE-0257 고침 + 철회 가능(RULE-0461). 병합은 어느 쪽이든 사람만. F1 에서 새 구역을 고르면 문지기 연결(STG-12a 와 부딪힘)도 여기

이후: **승인 PR 권한(F6)** — 문지기 연결은 필요 없어짐(F1 = 공통 구역, DEC-0066). 결정: 첫 순환(PLAN-103)의 승인 PR 은 **사용자가 연다**. 그 뒤 상시 권한 "ORCH 승인 PR 만 Supervisor 가 연다"(권한 장부 PERM 줄 + RULE-0257 고침 + 철회 가능, RULE-0461)를 검토. 병합은 어느 쪽이든 사람만

</details>
- `2026-11-21` 커밋 전 기록 상태 ☐ → ☑ 2026-11-21 — DEC-0071 순서 고침 · PLAN-101 결정 기록으로 끝
- `2026-11-21` 커밋 전 기록 결과 처음 적힘 — DEC-0071 순서 고침 · PLAN-101 결정 기록으로 끝

## 닿는 결정

- [DEC-0064](../decisions/DEC-0064.md) 2026-11-20 작업 조율(오케스트레이션) — Hybrid · DB 반영은 사람 승인 · 모드 권한 유지 · 기존 기록 재사용 · 승인 증거는 사람이 병합한 PR
- [DEC-0065](../decisions/DEC-0065.md) 2026-11-20 작업 조율 보강 다섯 + 가상 실행 — Supervisor 는 쓰지 않음 · 전환 형식 불변 · 세션 브랜치 잇기 · 077 뒤 순환 · 안전장치
- [DEC-0066](../decisions/DEC-0066.md) 2026-11-21 자기 개선 루프 — 최소판(관측 묶음 · 제안 연결 · 사람 승인 · 증거 완료) · RP1 · RP2 첫 사이클 · 탐지기 보호 · 과학 진척 지표 분리 · 권장 결정 전부
- [DEC-0088](../decisions/DEC-0088.md) 2026-11-23 상호 권한 · 독립 신뢰 경계 제안서를 PLAN-116 2 차 입력(최종 정의 후보)으로 — AI 전용 GitHub 신원 · 보안 핵심 먼저 · Hard Veto 와 중재자 정의를 지킬 수 있게
