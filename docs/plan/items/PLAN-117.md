# PLAN-117 — 승인 증거를 GitHub 사실로

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 117 · 9부 — 작업 조율 (여러 모드 세션을 잇는 상위 작업)
- **작업**: **승인 증거를 GitHub 사실로** (PLAN-102 의 다음 판 · DEC-0093 ⑤ · DEC-0094 와 같은 길) — 지금 judicial/supervise_approval.js 는 'AI 가 병합했나' 를 영수증의 병합 호출 시간 창(병합 커밋 앞 600 초 · 뒤 60 초)으로 추정한다. 봇 신원 분리(DEC-0090 · 전환 기록 main #20: push · PR actor = daduteria, 병합 = Duckiteat) 뒤에는 GitHub 이 사실을 준다. 설계: ① 사실 = 병합 커밋 → 그 PR(커밋의 PR 조회) · merged_by.login · 리뷰 중 state APPROVED 이고 commit_id = 병합 직전 PR head 인 것의 user.login. ② 판정(순수, 실행 · 쓰기 없음) approved = merged_by ∈ HUMANS 이고 승인 리뷰어 중 HUMANS 하나 이상(PR 작성자 아님 · head 와 같은 커밋 — 승인 뒤 커밋을 밀어 넣으면 무효) · merged_ai = merged_by ∉ HUMANS · unreviewed = 사람 승인 없음 · 사실 없음 = 승인 아님(fail-closed). HUMANS 는 한 곳(ci-zone.mjs HUMANS, L6)에서 가져온다. ③ 지문 대조(PLAN-102 ① ②: 넘긴 바이트가 main 에 처음 나타난 커밋)는 그대로 — 사실 판정은 그 커밋의 PR 에 대해. ④ 영수증 시간 창은 사실이 없을 때의 보조 표시로만 남기고 판정에서 뺌. ⑤ 사실 모으기: CI(trust.yml 처럼 main 코드 · 읽기 권한 토큰)에서 JSON 으로 — 세션의 GitHub 도구는 봇 신원이라 사실을 꾸밀 수 있는 자리가 아니게, 판정은 CI 가 모은 사실만. 남는 한계: 같은 사람 계정이 승인 · 병합(R3) · GitHub 계정 탈취
- **자리**: judicial/supervise_approval.js 사실 칸 · rebuild/supervise.mjs 모으기(입력 JSON) · .github/workflows (사실 모으기) · 시험 tests/supervise_approval.test.mjs — 판정 코드 · 워크플로는 L6 라 승인 묶음
- **끝나는 조건**: 봇이 병합 → merged_ai · 사람 승인 없이 사람 병합 → unreviewed · 승인 뒤 커밋 추가 → 승인 아님 · 사람 승인 + 사람 병합 + 지문 일치 → approved 시험 · 사실 파일이 없으면 승인 아님 · 판정 모듈이 실행 · 쓰기를 하지 않음 · 사용자 결정(설계 검토) 뒤 구현
- **상태**: ☐ 대기 2026-11-24

## 결과 (날짜별)

- `2026-11-24` 커밋 전 기록: · 2026-11-24 DEC-0096: 오케스트레이터 계획의 0 바닥에 이 작업을 그대로 씀(따로 두지 않음)

## 걸어온 길

- `2026-11-24` 커밋 전 기록 계획에 들어옴 (☐ 대기) — DEC-0093 ⑤ — 승인 증거를 GitHub 사실로(전환 기록 main #20 open) · 이 세션은 설계만, 구현은 다음 번호
- `2026-11-24` 커밋 전 기록 결과 처음 적힘 — 사용자 결정 DEC-0096(처음 DEC-0093 으로 적음) · DEC-0097 — main(PR #25)과 번호가 겹쳐 다시 매겨 적용

## 닿는 결정

- [DEC-0096](../decisions/DEC-0096.md) 2026-11-24 오케스트레이터 순서 — MVP(최종 형식으로 · 있는 것 최대한) → 범위 넓히기 → 병렬 → 자율(사람은 주제 · 결정 · 확인 · 승락만)
- [DEC-0097](../decisions/DEC-0097.md) 2026-11-24 보안 셋 섞기 — fail-closed · CODEOWNERS 는 이 브랜치의 적용분(d600490), ci-zone 은 DEC-0094(사람 서명 커밋만 사람)로 다시, 묶음 5(훅을 끄는 자리)는 이 브랜치에 맞춰 다시
